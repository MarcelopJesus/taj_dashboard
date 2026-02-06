const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Simular a lógica da API de sync

const CODIGO_PATTERN = /#(\d{7})\b/g;

function extractAgendamentosFromMessage(texto, chatid, timestamp, nomeCliente) {
    const agendamentos = [];
    let match;
    while ((match = CODIGO_PATTERN.exec(texto)) !== null) {
        const codigo = `#${match[1]}`;
        agendamentos.push({
            chatid,
            codigo_agendamento: codigo,
            timestamp,
            nome_cliente: nomeCliente,
        });
    }
    return agendamentos;
}

async function simularSync() {
    console.log('🔄 SIMULANDO LÓGICA DE SYNC\n');

    // 1. Buscar mensagens das últimas 24h
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const { data: mensagens } = await supabase
        .from('taj_mensagens')
        .select('chatid, conversation, timestamp')
        .gte('timestamp', yesterday.toISOString())
        .order('timestamp', { ascending: true });

    console.log(`Mensagens nas últimas 24h: ${mensagens?.length || 0}\n`);

    // 2. Processar mensagens
    const todosAgendamentos = [];
    const codigosProcessados = new Set();

    for (const msg of mensagens || []) {
        if (!msg.conversation || msg.conversation.role !== 'model') continue;

        const texto = (msg.conversation.parts && msg.conversation.parts[0] && msg.conversation.parts[0].text) || '';
        if (!texto) continue;

        const agendamentos = extractAgendamentosFromMessage(texto, msg.chatid, msg.timestamp, 'Teste');

        for (const ag of agendamentos) {
            const chave = `${ag.chatid}-${ag.codigo_agendamento}`;
            if (!codigosProcessados.has(chave)) {
                codigosProcessados.add(chave);
                todosAgendamentos.push(ag);
            }
        }
    }

    console.log(`Agendamentos detectados (únicos internamente): ${todosAgendamentos.length}`);
    console.log(`Códigos processados: ${codigosProcessados.size}\n`);

    // 3. Verificar existentes no banco (com paginação)
    console.log('Buscando existentes no banco...');
    const existentesSet = new Set();
    let offset = 0;
    const PAGE_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data: existentes } = await supabase
            .from('taj_agendamentos')
            .select('chatid, codigo_agendamento')
            .range(offset, offset + PAGE_SIZE - 1);

        if (existentes && existentes.length > 0) {
            existentes.forEach(e => existentesSet.add(`${e.chatid}-${e.codigo_agendamento}`));
            offset += PAGE_SIZE;
            hasMore = existentes.length === PAGE_SIZE;
        } else {
            hasMore = false;
        }
    }

    console.log(`Total de registros existentes no banco: ${existentesSet.size}\n`);

    // 4. Filtrar novos
    const novosAgendamentos = todosAgendamentos.filter(ag => {
        const chave = `${ag.chatid}-${ag.codigo_agendamento}`;
        return !existentesSet.has(chave);
    });

    console.log(`Agendamentos NOVOS a inserir: ${novosAgendamentos.length}`);

    if (novosAgendamentos.length > 0) {
        console.log('\n📋 Lista de novos:');
        for (const ag of novosAgendamentos) {
            console.log(`   - ${ag.codigo_agendamento} (${ag.chatid.substring(0, 15)}...)`);
        }
    }

    // 5. Verificar se há algum que deveria ser filtrado
    const aindaDuplicados = todosAgendamentos.filter(ag => {
        const chave = `${ag.chatid}-${ag.codigo_agendamento}`;
        return existentesSet.has(chave);
    });

    console.log(`\nAgendamentos que JÁ existem e seriam filtrados: ${aindaDuplicados.length}`);

    // 6. Verificar especificamente o #2130868
    const codigo2130868 = todosAgendamentos.filter(a => a.codigo_agendamento === '#2130868');
    console.log(`\n📌 Código #2130868 encontrado nas mensagens: ${codigo2130868.length} vez(es)`);

    const existeNoBanco = existentesSet.has('5511981199861@s.whatsapp.net-#2130868');
    console.log(`   Existe no banco? ${existeNoBanco ? 'SIM ✅' : 'NÃO ❌'}`);
}

simularSync();
