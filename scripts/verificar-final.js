const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verificarFinal() {
    console.log('📊 VERIFICAÇÃO FINAL DOS DADOS\n');
    console.log('='.repeat(70));

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeFim = new Date();
    hojeFim.setHours(23, 59, 59, 999);

    // Leads hoje
    const { count: leadsHoje } = await supabase
        .from('taj_leads')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', hoje.toISOString())
        .lte('timestamp', hojeFim.toISOString());

    // Agendamentos hoje
    const { data: agHoje } = await supabase
        .from('taj_agendamentos')
        .select('chatid, codigo_agendamento')
        .gte('timestamp', hoje.toISOString())
        .lte('timestamp', hojeFim.toISOString());

    const chatIdsUnicos = new Set((agHoje || []).map(a => a.chatid));

    console.log(`📅 HOJE (${hoje.toLocaleDateString('pt-BR')}):`);
    console.log(`   👥 Total de Leads: ${leadsHoje}`);
    console.log(`   📅 Agendamentos (registros): ${agHoje?.length || 0}`);
    console.log(`   📅 Agendamentos (chatIds únicos): ${chatIdsUnicos.size}`);

    const taxa = leadsHoje > 0 ? (chatIdsUnicos.size / leadsHoje) * 100 : 0;
    console.log(`   📈 Taxa de Conversão: ${taxa.toFixed(1)}%`);

    console.log('\n📋 CÓDIGOS DE AGENDAMENTO DE HOJE:');
    for (const ag of agHoje || []) {
        console.log(`   - ${ag.codigo_agendamento}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ O sistema real tem 8 agendamentos? Verifique os códigos acima.');
    console.log('='.repeat(70));
}

verificarFinal();
