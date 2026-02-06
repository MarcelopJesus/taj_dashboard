const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verificarCadaAgendamento() {
    console.log('🔍 VERIFICANDO CADA AGENDAMENTO DE HOJE\n');
    console.log('='.repeat(80));

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeFim = new Date();
    hojeFim.setHours(23, 59, 59, 999);

    // Buscar agendamentos com timestamp de hoje
    const { data: agendamentos } = await supabase
        .from('taj_agendamentos')
        .select('*')
        .gte('timestamp', hoje.toISOString())
        .lte('timestamp', hojeFim.toISOString())
        .order('timestamp', { ascending: true });

    console.log(`Total de registros na tabela com timestamp de HOJE: ${agendamentos?.length || 0}\n`);

    // Agrupar por chatid para ver únicos
    const porChatId = {};
    for (const ag of agendamentos || []) {
        if (!porChatId[ag.chatid]) {
            porChatId[ag.chatid] = [];
        }
        porChatId[ag.chatid].push(ag);
    }

    console.log(`ChatIds ÚNICOS com agendamento hoje: ${Object.keys(porChatId).length}\n`);

    // Buscar leads para ter os nomes
    const { data: leads } = await supabase
        .from('taj_leads')
        .select('chatid, nome, telefone, timestamp');

    const leadMap = {};
    for (const l of leads || []) {
        leadMap[l.chatid] = l;
    }

    // Listar cada um
    console.log('📋 LISTA DETALHADA DE CADA AGENDAMENTO:\n');

    let contador = 0;
    for (const [chatid, ags] of Object.entries(porChatId)) {
        contador++;
        const lead = leadMap[chatid] || {};
        console.log(`${contador}. ${lead.nome || 'Sem nome'}`);
        console.log(`   Telefone: ${chatid.replace('@s.whatsapp.net', '')}`);
        console.log(`   Lead entrou em: ${lead.timestamp ? new Date(lead.timestamp).toLocaleString('pt-BR') : 'N/A'}`);

        for (const ag of ags) {
            console.log(`   📅 Código: ${ag.codigo_agendamento}`);
            console.log(`      Data do agendamento: ${ag.data_agendamento || 'N/A'}`);
            console.log(`      Hora: ${ag.hora_agendamento || 'N/A'}`);
            console.log(`      Terapeuta: ${ag['nome da terapeuta'] || 'N/A'}`);
            console.log(`      Detectado em: ${new Date(ag.timestamp).toLocaleString('pt-BR')}`);
        }
        console.log('');
    }

    // Verificar se há leads que entraram HOJE e têm agendamento
    console.log('='.repeat(80));
    console.log('📊 LEADS QUE ENTRARAM HOJE E AGENDARAM:\n');

    const { data: leadsHoje } = await supabase
        .from('taj_leads')
        .select('chatid, nome, timestamp')
        .gte('timestamp', hoje.toISOString())
        .lte('timestamp', hojeFim.toISOString());

    const chatIdsHoje = new Set((leadsHoje || []).map(l => l.chatid));

    let contadorHoje = 0;
    for (const [chatid, ags] of Object.entries(porChatId)) {
        if (chatIdsHoje.has(chatid)) {
            contadorHoje++;
            const lead = leadMap[chatid] || {};
            console.log(`${contadorHoje}. ${lead.nome || 'Sem nome'} - ${ags[0].codigo_agendamento}`);
        }
    }

    console.log(`\nTotal de leads que ENTRARAM hoje e agendaram: ${contadorHoje}`);
}

verificarCadaAgendamento();
