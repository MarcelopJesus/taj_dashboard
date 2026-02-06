const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debug() {
    console.log('🔍 DEBUG URGENTE\n');

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeFim = new Date();
    hojeFim.setHours(23, 59, 59, 999);

    // Leads de hoje
    const { data: leadsHoje } = await supabase
        .from('taj_leads')
        .select('chatid, timestamp')
        .gte('timestamp', hoje.toISOString())
        .lte('timestamp', hojeFim.toISOString());

    console.log(`Leads hoje: ${leadsHoje?.length || 0}`);

    const chatIdsHoje = (leadsHoje || []).map(l => l.chatid);

    // TODOS os agendamentos desses leads (o que a função errada faz)
    const { data: todosAg } = await supabase
        .from('taj_agendamentos')
        .select('chatid, timestamp, codigo_agendamento')
        .in('chatid', chatIdsHoje);

    console.log(`Total de agendamentos desses leads (TODOS os históricos): ${todosAg?.length || 0}`);

    // Agendamentos com timestamp DE HOJE (o que deveria ser)
    const { data: agHoje } = await supabase
        .from('taj_agendamentos')
        .select('chatid, timestamp')
        .gte('timestamp', hoje.toISOString())
        .lte('timestamp', hojeFim.toISOString());

    console.log(`Agendamentos com timestamp de HOJE: ${agHoje?.length || 0}`);

    // Interseção: leads de hoje que têm agendamento com timestamp de hoje
    const chatIdsAgHoje = new Set((agHoje || []).map(a => a.chatid));
    const chatIdsHojeSet = new Set(chatIdsHoje);

    const leadsHojeQueAgenHoje = [...chatIdsAgHoje].filter(id => chatIdsHojeSet.has(id));
    console.log(`\nLeads de HOJE que agendaram HOJE: ${leadsHojeQueAgenHoje.length}`);

    // Como o gráfico calcula (funciona)
    console.log(`\n📊 COMO O GRÁFICO CALCULA (CORRETO):`);
    console.log(`   Pega os leads de hoje e verifica quais têm agendamento EXISTENTE`);
    console.log(`   ChatIds únicos com agendamento (qualquer): ${new Set((todosAg || []).map(a => a.chatid)).size}`);

    // Mas o problema é que está contando agendamentos DEMAIS
    // A lógica correta seria...
    console.log('\n💡 A LÓGICA CORRETA:');
    console.log('   Precisamos contar leads que AGENDARAM no período, não todos os agendamentos históricos');
    console.log('   Ou seja: usar o timestamp do AGENDAMENTO para filtrar, mas contar chatIds únicos');
}

debug();
