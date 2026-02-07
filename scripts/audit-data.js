const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://vynilpckcxkahcyavtgy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0'
);

async function auditData() {
    console.log('=== AUDITORIA DE DADOS ===\n');

    // 1. Verificar origem_cliente
    const { data: origens } = await supabase.from('taj_leads').select('origem_cliente').limit(100);
    const origemCounts = {};
    origens?.forEach(l => {
        const o = l.origem_cliente || 'NULL';
        origemCounts[o] = (origemCounts[o] || 0) + 1;
    });
    console.log('1. ORIGEM_CLIENTE (100 amostras):');
    console.log(JSON.stringify(origemCounts, null, 2));

    // 2. Verificar status_atendimento
    const { data: status } = await supabase.from('taj_leads').select('status_atendimento').limit(100);
    const statusCounts = {};
    status?.forEach(l => {
        const s = l.status_atendimento || 'NULL';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    });
    console.log('\n2. STATUS_ATENDIMENTO (100 amostras):');
    console.log(JSON.stringify(statusCounts, null, 2));

    // 3. Verificar campos disponíveis
    const { data: sample } = await supabase.from('taj_leads').select('*').limit(1);
    console.log('\n3. CAMPOS DISPONÍVEIS NA TAJ_LEADS:');
    console.log(Object.keys(sample?.[0] || {}));

    // 4. Amostra de um lead completo
    console.log('\n4. AMOSTRA DE UM LEAD:');
    console.log(JSON.stringify(sample?.[0], null, 2));

    // 5. Verificar agendamentos
    const { data: agendamentos } = await supabase.from('taj_agendamentos').select('*').limit(3);
    console.log('\n5. AMOSTRA DE AGENDAMENTOS:');
    console.log(JSON.stringify(agendamentos, null, 2));

    // 6. Contar totais
    const { count: totalLeads } = await supabase.from('taj_leads').select('*', { count: 'exact', head: true });
    const { count: totalAgendamentos } = await supabase.from('taj_agendamentos').select('*', { count: 'exact', head: true });
    const { count: totalMensagens } = await supabase.from('taj_mensagens').select('*', { count: 'exact', head: true });

    console.log('\n6. CONTAGEM TOTAL:');
    console.log(`   - Total Leads: ${totalLeads}`);
    console.log(`   - Total Agendamentos: ${totalAgendamentos}`);
    console.log(`   - Total Mensagens: ${totalMensagens}`);
}

auditData();
