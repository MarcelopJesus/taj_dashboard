const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verificarCorrecao() {
    console.log('✅ VERIFICAÇÃO DA CORREÇÃO\n');
    console.log('='.repeat(70));

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeFim = new Date();
    hojeFim.setHours(23, 59, 59, 999);

    console.log(`📅 Período: HOJE (${hoje.toLocaleDateString('pt-BR')})\n`);

    // LÓGICA CORRIGIDA: Buscar leads que entraram hoje
    const { data: leadsHoje, count: totalLeads } = await supabase
        .from('taj_leads')
        .select('chatid', { count: 'exact' })
        .gte('timestamp', hoje.toISOString())
        .lte('timestamp', hojeFim.toISOString());

    console.log(`👥 Total de LEADS hoje: ${totalLeads}`);

    if (!leadsHoje || leadsHoje.length === 0) {
        console.log('❌ Nenhum lead hoje');
        return;
    }

    const chatIdsLidosHoje = leadsHoje.map(l => l.chatid);

    // Buscar agendamentos SOMENTE desses leads
    const { data: agendamentos } = await supabase
        .from('taj_agendamentos')
        .select('chatid')
        .in('chatid', chatIdsLidosHoje);

    // Contar chatIds únicos (leads que agendaram)
    const chatIdsQueAgendaram = new Set((agendamentos || []).map(a => a.chatid));

    console.log(`📅 Leads de HOJE que têm agendamento: ${chatIdsQueAgendaram.size}`);

    // Taxa de conversão
    const taxa = totalLeads > 0 ? (chatIdsQueAgendaram.size / totalLeads) * 100 : 0;
    console.log(`📈 Taxa de conversão: ${taxa.toFixed(1)}%`);

    console.log('\n' + '='.repeat(70));
    console.log('📊 VALORES QUE DEVEM APARECER NO DASHBOARD:');
    console.log('='.repeat(70));
    console.log(`   📌 Card "Total de Leads": ${totalLeads}`);
    console.log(`   📌 Card "Agendamentos": ${chatIdsQueAgendaram.size}`);
    console.log(`   📌 Card "Taxa de Conversão": ${taxa.toFixed(1)}%`);
    console.log(`   📌 Gráfico (agendamentos hoje): ${chatIdsQueAgendaram.size}`);
    console.log('='.repeat(70));

    console.log('\n✅ CORREÇÃO APLICADA:');
    console.log('   - Agora conta LEADS ÚNICOS que agendaram');
    console.log('   - Filtra baseado no timestamp do LEAD, não do agendamento');
    console.log('   - Os números do Card e do Gráfico agora serão IGUAIS');
}

verificarCorrecao();
