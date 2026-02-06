const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Regex patterns para detectar agendamentos (igual ao route.ts)
const PATTERNS = {
    codigo: /[Cc][óo]digo:?\s*[\*]*\s*#?(\d{5,})/gi,
    confirmado: /agendamento\s+(confirmado|realizado|feito)/gi,
};

async function simularSync() {
    console.log('🔄 SIMULANDO SYNC (igual ao /api/sync-data)\n');

    // 1. Buscar leads para ter os nomes
    const { data: leads } = await supabase
        .from('taj_leads')
        .select('chatid, nome');

    const leadMap = new Map();
    if (leads) {
        leads.forEach(l => leadMap.set(l.chatid, l.nome || 'Sem nome'));
    }

    // 2. Data de ontem (24 horas)
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    console.log(`📅 Buscando mensagens desde: ${yesterday.toISOString()}\n`);

    const { data: mensagens, error: msgError } = await supabase
        .from('taj_mensagens')
        .select('chatid, conversation, timestamp')
        .gte('timestamp', yesterday.toISOString())
        .order('timestamp', { ascending: true });

    if (msgError) {
        console.error('Erro:', msgError);
        return;
    }

    console.log(`📨 Total de mensagens encontradas: ${mensagens?.length || 0}\n`);

    // 3. Processar mensagens
    const todosAgendamentos = [];
    const codigosProcessados = new Set();
    const detalhes = [];

    for (const msg of mensagens || []) {
        if (!msg.conversation || msg.conversation.role !== 'model') continue;

        const texto = (msg.conversation.parts && msg.conversation.parts[0] && msg.conversation.parts[0].text) || '';
        if (!texto) continue;

        const codigoMatches = [...texto.matchAll(PATTERNS.codigo)];
        const confirmadoMatch = texto.match(PATTERNS.confirmado);

        if (codigoMatches.length === 0 && !confirmadoMatch) continue;

        for (const match of codigoMatches) {
            const codigo = `#${match[1]}`;
            const chave = `${msg.chatid}-${codigo}`;

            if (!codigosProcessados.has(chave)) {
                codigosProcessados.add(chave);
                todosAgendamentos.push({
                    chatid: msg.chatid,
                    codigo,
                    timestamp: msg.timestamp
                });
                detalhes.push({ chatid: msg.chatid.substring(0, 15), codigo, timestamp: msg.timestamp });
            }
        }

        if (confirmadoMatch && codigoMatches.length === 0) {
            const chave = `${msg.chatid}-#SEM_CODIGO`;
            if (!codigosProcessados.has(chave)) {
                codigosProcessados.add(chave);
                todosAgendamentos.push({
                    chatid: msg.chatid,
                    codigo: '#SEM_CODIGO',
                    timestamp: msg.timestamp
                });
            }
        }
    }

    console.log(`📊 Agendamentos detectados nas mensagens: ${todosAgendamentos.length}\n`);

    // 4. Verificar existentes
    const { data: existentes } = await supabase
        .from('taj_agendamentos')
        .select('chatid, codigo_agendamento');

    const existentesSet = new Set();
    if (existentes) {
        existentes.forEach(e => existentesSet.add(`${e.chatid}-${e.codigo_agendamento}`));
    }

    console.log(`📂 Agendamentos já existentes no banco: ${existentes?.length || 0}`);

    const novos = todosAgendamentos.filter(ag => {
        const chave = `${ag.chatid}-${ag.codigo}`;
        return !existentesSet.has(chave);
    });

    console.log(`✨ Novos agendamentos a inserir: ${novos.length}\n`);

    if (novos.length > 0) {
        console.log('📋 NOVOS AGENDAMENTOS QUE SERIAM INSERIDOS:');
        for (const ag of novos.slice(0, 10)) {
            console.log(`   - ${ag.chatid.substring(0, 20)}... Código: ${ag.codigo}`);
        }
        if (novos.length > 10) {
            console.log(`   ... e mais ${novos.length - 10} agendamentos`);
        }
    }

    // 5. Verificar problema específico
    console.log('\n' + '='.repeat(70));
    console.log('🔍 VERIFICAÇÃO DE PROBLEMA: Agendamentos de hoje no filtro "Hoje"');
    console.log('='.repeat(70));

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeFim = new Date();
    hojeFim.setHours(23, 59, 59, 999);

    const { count: agHojeCard } = await supabase
        .from('taj_agendamentos')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', hoje.toISOString())
        .lte('timestamp', hojeFim.toISOString());

    console.log(`\n📊 Agendamentos HOJE (o que aparece no CARD): ${agHojeCard}`);

    // Verificar no gráfico (chatids únicos)
    const { data: leadsHoje } = await supabase
        .from('taj_leads')
        .select('chatid, timestamp')
        .gte('timestamp', hoje.toISOString())
        .lte('timestamp', hojeFim.toISOString());

    const chatIdsLeadsHoje = new Set((leadsHoje || []).map(l => l.chatid));
    console.log(`👥 Leads de HOJE: ${chatIdsLeadsHoje.size}`);

    // Buscar agendamentos e verificar quais são de leads de hoje
    const { data: agHoje } = await supabase
        .from('taj_agendamentos')
        .select('chatid')
        .gte('timestamp', hoje.toISOString())
        .lte('timestamp', hojeFim.toISOString());

    const chatIdsAgendaram = new Set((agHoje || []).map(a => a.chatid));

    // Quantos dos leads de hoje agendaram?
    const leadsHojeQueAgendaram = [...chatIdsLeadsHoje].filter(id => chatIdsAgendaram.has(id));
    console.log(`✅ Leads de HOJE que TÊM agendamento: ${leadsHojeQueAgendaram.length}`);

    console.log('\n💡 POSSÍVEL CAUSA:');
    console.log('   - CARD conta TODOS os registros de agendamento do período');
    console.log('   - GRÁFICO conta CHATIDS ÚNICOS (leads únicos que agendaram)');
}

simularSync();
