const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function consultarDados() {
    console.log('📊 Consultando dados do banco...\n');

    // Total de leads
    const { count: totalLeads } = await supabase
        .from('taj_leads')
        .select('*', { count: 'exact', head: true });

    console.log(`✅ Total de Leads: ${totalLeads}\n`);

    // Total de agendamentos
    const { count: totalAgendamentos } = await supabase
        .from('taj_agendamentos')
        .select('*', { count: 'exact', head: true });

    console.log(`✅ Total de Agendamentos: ${totalAgendamentos}\n`);

    // Total de mensagens
    const { count: totalMensagens } = await supabase
        .from('taj_mensagens')
        .select('*', { count: 'exact', head: true });

    console.log(`✅ Total de Mensagens: ${totalMensagens}\n`);

    // Sample de alguns leads para ver estrutura
    const { data: sampleLeads } = await supabase
        .from('taj_leads')
        .select('*')
        .limit(5);

    console.log('📋 Sample de 5 Leads:');
    console.log(JSON.stringify(sampleLeads, null, 2));
    console.log('\n');

    // Sample de mensagens
    const { data: sampleMensagens } = await supabase
        .from('taj_mensagens')
        .select('*')
        .limit(3);

    console.log('💬 Sample de 3 Mensagens:');
    console.log(JSON.stringify(sampleMensagens, null, 2));
}

consultarDados();
