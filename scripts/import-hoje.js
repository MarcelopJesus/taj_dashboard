/**
 * Script para importar agendamentos de HOJE
 * 
 * Uso: node scripts/import-hoje.js
 */

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Regex patterns para detectar agendamentos
const PATTERNS = {
    codigo: /[Cc][óo]digo:?\s*[\*]*\s*#?(\d{5,})/gi,
    confirmado: /agendamento\s+(confirmado|realizado|feito)/gi,
};

function extractDataFromText(texto) {
    const dataRegex = /\*?\*?Data:?\*?\*?\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/i;
    const match = texto.match(dataRegex);
    if (match) {
        const dia = (match[1] || '01').padStart(2, '0');
        const mes = (match[2] || '01').padStart(2, '0');
        let ano = match[3] || new Date().getFullYear().toString();
        if (ano.length === 2) ano = '20' + ano;
        return `${ano}-${mes}-${dia}`;
    }
    return null;
}

function extractHoraFromText(texto) {
    const horaRegex = /\*?\*?Hora:?\*?\*?\s*(\d{1,2}):(\d{2})/i;
    const match = texto.match(horaRegex);
    if (match) {
        return `${match[1].padStart(2, '0')}:${match[2]}:00`;
    }
    return null;
}

function extractTerapeutaFromText(texto) {
    const terapeutaRegex = /\*?\*?Terapeuta:?\*?\*?\s*([^\n\*]+)/i;
    const match = texto.match(terapeutaRegex);
    if (match) {
        return match[1].trim();
    }
    return null;
}

function extractAgendamentosFromMessage(texto, chatid, timestamp, nomeCliente) {
    const agendamentos = [];

    const codigoMatches = [...texto.matchAll(PATTERNS.codigo)];
    const confirmadoMatch = texto.match(PATTERNS.confirmado);

    if (codigoMatches.length === 0 && !confirmadoMatch) {
        return agendamentos;
    }

    const dataAgendamento = extractDataFromText(texto);
    const horaAgendamento = extractHoraFromText(texto);
    const terapeuta = extractTerapeutaFromText(texto);

    if (codigoMatches.length > 0) {
        for (const match of codigoMatches) {
            const codigo = match[1];

            agendamentos.push({
                chatid,
                'nome do cliente': nomeCliente,
                timestamp: timestamp,
                codigo_agendamento: `#${codigo}`,
                data_agendamento: dataAgendamento,
                hora_agendamento: horaAgendamento,
                'nome da terapeuta': terapeuta,
                'serviço': null,
                status: 'confirmado',
            });
        }
    } else if (confirmadoMatch) {
        agendamentos.push({
            chatid,
            'nome do cliente': nomeCliente,
            timestamp: timestamp,
            codigo_agendamento: '#SEM_CODIGO',
            data_agendamento: dataAgendamento,
            hora_agendamento: horaAgendamento,
            'nome da terapeuta': terapeuta,
            'serviço': null,
            status: 'confirmado',
        });
    }

    return agendamentos;
}

async function importHoje() {
    console.log('🚀 Iniciando importação de agendamentos de HOJE...\n');

    // Data de hoje
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeISO = hoje.toISOString();

    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const amanhaISO = amanha.toISOString();

    console.log(`📅 Data: ${hoje.toLocaleDateString('pt-BR')}`);
    console.log(`🔍 Buscando mensagens de ${hojeISO} até ${amanhaISO}\n`);

    // 1. Buscar leads
    console.log('📋 Buscando leads...');
    const { data: leads } = await supabase
        .from('taj_leads')
        .select('chatid, nome');

    const leadMap = new Map();
    if (leads) {
        leads.forEach(l => leadMap.set(l.chatid, l.nome || 'Sem nome'));
    }
    console.log(`✅ ${leads?.length || 0} leads encontrados\n`);

    // 2. Buscar mensagens de hoje
    console.log('📨 Buscando mensagens de HOJE...');
    const { data: mensagens, error: msgError } = await supabase
        .from('taj_mensagens')
        .select('chatid, conversation, timestamp')
        .gte('timestamp', hojeISO)
        .lt('timestamp', amanhaISO)
        .order('timestamp', { ascending: true });

    if (msgError) {
        console.error('❌ Erro ao buscar mensagens:', msgError.message);
        return;
    }

    console.log(`✅ ${mensagens?.length || 0} mensagens de hoje encontradas\n`);

    if (!mensagens || mensagens.length === 0) {
        console.log('⚠️ Nenhuma mensagem encontrada para hoje.');
        console.log('   Isso pode significar que não houve conversas hoje.');
        return;
    }

    // 3. Processar mensagens
    console.log('🔍 Analisando mensagens para detectar agendamentos...\n');
    const todosAgendamentos = [];
    const codigosProcessados = new Set();

    for (const msg of mensagens) {
        if (!msg.conversation || msg.conversation.role !== 'model') continue;

        const texto = (msg.conversation.parts && msg.conversation.parts[0] && msg.conversation.parts[0].text) || '';
        if (!texto) continue;

        const nomeCliente = leadMap.get(msg.chatid) || 'Sem nome';
        const agendamentos = extractAgendamentosFromMessage(
            texto,
            msg.chatid,
            msg.timestamp,
            nomeCliente
        );

        for (const ag of agendamentos) {
            const chave = `${ag.chatid}-${ag.codigo_agendamento}`;
            if (!codigosProcessados.has(chave)) {
                codigosProcessados.add(chave);
                todosAgendamentos.push(ag);
            }
        }
    }

    console.log(`📊 Total de agendamentos de HOJE detectados: ${todosAgendamentos.length}\n`);

    if (todosAgendamentos.length === 0) {
        console.log('⚠️ Nenhum agendamento encontrado nas mensagens de hoje.');
        console.log('\n📋 Exibindo algumas mensagens do bot para debug:');

        let botMessages = 0;
        for (const msg of mensagens) {
            if (msg.conversation && msg.conversation.role === 'model' && botMessages < 5) {
                const texto = (msg.conversation.parts && msg.conversation.parts[0] && msg.conversation.parts[0].text) || '';
                if (texto.length > 50) {
                    console.log(`\n   [${msg.timestamp}]`);
                    console.log(`   ${texto.substring(0, 200)}...`);
                    botMessages++;
                }
            }
        }
        return;
    }

    // 4. Listar agendamentos
    console.log('📋 Agendamentos de HOJE encontrados:');
    console.log('─'.repeat(60));
    todosAgendamentos.forEach((ag, i) => {
        console.log(`${i + 1}. ${ag['nome do cliente']}`);
        console.log(`   🔢 Código: ${ag.codigo_agendamento}`);
        console.log(`   📅 Data: ${ag.data_agendamento || 'N/A'} | 🕐 Hora: ${ag.hora_agendamento || 'N/A'}`);
        console.log(`   👩 Terapeuta: ${ag['nome da terapeuta'] || 'N/A'}`);
    });
    console.log('─'.repeat(60));

    // 5. Verificar existentes
    console.log('\n🔍 Verificando agendamentos já existentes...');
    const { data: existentes } = await supabase
        .from('taj_agendamentos')
        .select('chatid, codigo_agendamento');

    const existentesSet = new Set();
    if (existentes) {
        existentes.forEach(e => existentesSet.add(`${e.chatid}-${e.codigo_agendamento}`));
    }

    const novosAgendamentos = todosAgendamentos.filter(ag => {
        const chave = `${ag.chatid}-${ag.codigo_agendamento}`;
        return !existentesSet.has(chave);
    });

    console.log(`✅ ${existentes?.length || 0} agendamentos já existem na tabela`);
    console.log(`📥 ${novosAgendamentos.length} novos agendamentos de HOJE para inserir\n`);

    if (novosAgendamentos.length === 0) {
        console.log('✅ Todos os agendamentos de hoje já estão na tabela!');
        return;
    }

    // 6. Inserir
    console.log('💾 Inserindo agendamentos de HOJE na tabela...');

    const { data: inserted, error: insertError } = await supabase
        .from('taj_agendamentos')
        .insert(novosAgendamentos)
        .select();

    if (insertError) {
        console.error('❌ Erro ao inserir:', insertError.message);
        return;
    }

    console.log(`\n✅ ${inserted.length} agendamentos de HOJE importados com sucesso!`);

    console.log('\n📊 RESUMO:');
    console.log('─'.repeat(40));
    console.log(`Mensagens de hoje analisadas: ${mensagens.length}`);
    console.log(`Agendamentos de hoje detectados: ${todosAgendamentos.length}`);
    console.log(`Novos inseridos: ${inserted.length}`);
    console.log('─'.repeat(40));
}

importHoje()
    .then(() => {
        console.log('\n🎉 Importação de HOJE concluída!');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Erro fatal:', err);
        process.exit(1);
    });
