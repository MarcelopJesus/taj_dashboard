/**
 * Script para importar agendamentos históricos das mensagens para a tabela taj_agendamentos
 * 
 * Uso: node scripts/import-agendamentos.js
 */

const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Regex patterns para detectar agendamentos
const PATTERNS = {
    // Código de agendamento: #123456 ou **#123456**
    codigo: /[Cc][óo]digo:?\s*[\*]*\s*#?(\d{5,})/gi,

    // Agendamento confirmado (várias formas)
    confirmado: /agendamento\s+(confirmado|realizado|feito)/gi,
};

function extractDataFromText(texto) {
    // Data do agendamento: 29/01, 29/01/2026, etc
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

    // Verificar se tem código de agendamento OU confirmação
    const codigoMatches = [...texto.matchAll(PATTERNS.codigo)];
    const confirmadoMatch = texto.match(PATTERNS.confirmado);

    if (codigoMatches.length === 0 && !confirmadoMatch) {
        return agendamentos;
    }

    const dataAgendamento = extractDataFromText(texto);
    const horaAgendamento = extractHoraFromText(texto);
    const terapeuta = extractTerapeutaFromText(texto);

    // Para cada código encontrado, extrair um agendamento
    // NOTA: Os nomes das colunas têm espaços, não underscores!
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
        // Agendamento sem código específico
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

async function fetchAllRecords(table, selectFields) {
    const pageSize = 1000;
    let allRecords = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from(table)
            .select(selectFields)
            .range(page * pageSize, (page + 1) * pageSize - 1)
            .order('timestamp', { ascending: true });

        if (error) {
            throw error;
        }

        if (data && data.length > 0) {
            allRecords = allRecords.concat(data);
            page++;
            hasMore = data.length === pageSize;
        } else {
            hasMore = false;
        }
    }

    return allRecords;
}

async function importAgendamentos() {
    console.log('🚀 Iniciando importação de agendamentos...\n');

    // 1. Buscar todos os leads para ter os nomes
    console.log('📋 Buscando leads...');
    const leads = await fetchAllRecords('taj_leads', 'chatid, nome');

    const leadMap = new Map();
    leads.forEach(l => leadMap.set(l.chatid, l.nome || 'Sem nome'));
    console.log(`✅ ${leads.length} leads encontrados\n`);

    // 2. Buscar todas as mensagens do bot
    console.log('📨 Buscando mensagens do bot (pode demorar...)');
    const mensagens = await fetchAllRecords('taj_mensagens', 'chatid, conversation, timestamp');

    console.log(`✅ ${mensagens.length} mensagens encontradas\n`);

    // 3. Processar mensagens e extrair agendamentos
    console.log('🔍 Analisando mensagens para detectar agendamentos...\n');
    const todosAgendamentos = [];
    const codigosProcessados = new Set();
    let processadas = 0;

    for (const msg of mensagens) {
        processadas++;
        if (processadas % 10000 === 0) {
            console.log(`   Processando mensagem ${processadas}/${mensagens.length}...`);
        }

        // Verificar apenas mensagens do bot (model)
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

        // Evitar duplicatas de código
        for (const ag of agendamentos) {
            const chave = `${ag.chatid}-${ag.codigo_agendamento}`;
            if (!codigosProcessados.has(chave)) {
                codigosProcessados.add(chave);
                todosAgendamentos.push(ag);
            }
        }
    }

    console.log(`\n📊 Total de agendamentos detectados: ${todosAgendamentos.length}\n`);

    if (todosAgendamentos.length === 0) {
        console.log('⚠️ Nenhum agendamento encontrado nas mensagens.');
        return;
    }

    // 4. Listar agendamentos encontrados (primeiros 30)
    console.log('📋 Agendamentos encontrados (primeiros 30):');
    console.log('─'.repeat(80));
    todosAgendamentos.slice(0, 30).forEach((ag, i) => {
        console.log(`${i + 1}. ${ag['nome do cliente']}`);
        console.log(`   🔢 Código: ${ag.codigo_agendamento}`);
        console.log(`   📅 Data: ${ag.data_agendamento || 'N/A'} | 🕐 Hora: ${ag.hora_agendamento || 'N/A'}`);
        console.log(`   👩 Terapeuta: ${ag['nome da terapeuta'] || 'N/A'}`);
    });
    if (todosAgendamentos.length > 30) {
        console.log(`\n   ... e mais ${todosAgendamentos.length - 30} agendamentos`);
    }
    console.log('─'.repeat(80));

    // 5. Verificar agendamentos já existentes na tabela
    console.log('\n🔍 Verificando agendamentos já existentes...');
    const { data: existentes, error: existError } = await supabase
        .from('taj_agendamentos')
        .select('chatid, codigo_agendamento');

    if (existError) {
        console.error('❌ Erro ao verificar existentes:', existError.message);
        return;
    }

    const existentesSet = new Set();
    if (existentes) {
        existentes.forEach(e => existentesSet.add(`${e.chatid}-${e.codigo_agendamento}`));
    }

    // Filtrar apenas novos
    const novosAgendamentos = todosAgendamentos.filter(ag => {
        const chave = `${ag.chatid}-${ag.codigo_agendamento}`;
        return !existentesSet.has(chave);
    });

    console.log(`✅ ${existentes?.length || 0} agendamentos já existem na tabela`);
    console.log(`📥 ${novosAgendamentos.length} novos agendamentos para inserir\n`);

    if (novosAgendamentos.length === 0) {
        console.log('✅ Todos os agendamentos já estão na tabela!');
        return;
    }

    // 6. Inserir novos agendamentos em lotes
    console.log('💾 Inserindo agendamentos na tabela...');

    const batchSize = 50;
    let inserted = 0;

    for (let i = 0; i < novosAgendamentos.length; i += batchSize) {
        const batch = novosAgendamentos.slice(i, i + batchSize);
        const { error: insertError } = await supabase
            .from('taj_agendamentos')
            .insert(batch);

        if (insertError) {
            console.error(`❌ Erro ao inserir lote ${Math.floor(i / batchSize) + 1}:`, insertError.message);
            console.error('Primeiro item do lote:', JSON.stringify(batch[0], null, 2));
            // Tentar inserir um por um para identificar o problema
            for (const item of batch) {
                const { error: singleError } = await supabase
                    .from('taj_agendamentos')
                    .insert(item);
                if (!singleError) {
                    inserted++;
                }
            }
            continue;
        }

        inserted += batch.length;
        if ((i + batchSize) % 200 === 0 || i + batchSize >= novosAgendamentos.length) {
            console.log(`   Inseridos ${inserted}/${novosAgendamentos.length}...`);
        }
    }

    console.log(`\n✅ ${inserted} agendamentos importados com sucesso!`);

    // 7. Resumo final
    console.log('\n📊 RESUMO DA IMPORTAÇÃO:');
    console.log('─'.repeat(40));
    console.log(`Total de mensagens analisadas: ${mensagens.length}`);
    console.log(`Agendamentos detectados: ${todosAgendamentos.length}`);
    console.log(`Agendamentos já existentes: ${existentes?.length || 0}`);
    console.log(`Novos agendamentos inseridos: ${inserted}`);
    console.log('─'.repeat(40));
}

// Executar
importAgendamentos()
    .then(() => {
        console.log('\n🎉 Importação concluída!');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Erro fatal:', err);
        process.exit(1);
    });
