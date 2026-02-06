const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function investigarDiscrepancia() {
    console.log('🔍 INVESTIGANDO DISCREPÂNCIA NOS AGENDAMENTOS\n');

    // 1. Contar TOTAL de registros na tabela taj_agendamentos
    const { count: totalAgendamentos } = await supabase
        .from('taj_agendamentos')
        .select('*', { count: 'exact', head: true });

    console.log(`📊 TOTAL de registros na tabela taj_agendamentos: ${totalAgendamentos}`);

    // 2. Buscar TODOS os agendamentos
    const { data: todosAgendamentos } = await supabase
        .from('taj_agendamentos')
        .select('chatid, codigo_agendamento');

    console.log(`📊 Registros retornados pela query: ${todosAgendamentos.length}\n`);

    // 3. Contar chatids ÚNICOS
    const chatidsUnicos = new Set(todosAgendamentos.map(a => a.chatid));
    console.log(`👥 Chatids ÚNICOS (leads que agendaram): ${chatidsUnicos.size}`);

    // 4. Verificar se há leads com múltiplos agendamentos
    const agendamentosPorLead = {};
    for (const ag of todosAgendamentos) {
        if (!agendamentosPorLead[ag.chatid]) {
            agendamentosPorLead[ag.chatid] = [];
        }
        agendamentosPorLead[ag.chatid].push(ag.codigo_agendamento);
    }

    const leadsComMultiplosAgendamentos = Object.entries(agendamentosPorLead)
        .filter(([chatid, agendamentos]) => agendamentos.length > 1)
        .sort((a, b) => b[1].length - a[1].length);

    console.log(`\n📌 Leads com MÚLTIPLOS agendamentos: ${leadsComMultiplosAgendamentos.length}`);

    if (leadsComMultiplosAgendamentos.length > 0) {
        console.log('\n🔍 Top 10 leads com mais agendamentos:\n');
        for (let i = 0; i < Math.min(10, leadsComMultiplosAgendamentos.length); i++) {
            const [chatid, agendamentos] = leadsComMultiplosAgendamentos[i];
            console.log(`   ${i + 1}. ${chatid}: ${agendamentos.length} agendamentos`);
            console.log(`      Códigos: ${agendamentos.join(', ')}`);
        }
    }

    // 5. Total de leads
    const { count: totalLeads } = await supabase
        .from('taj_leads')
        .select('*', { count: 'exact', head: true });

    console.log(`\n👥 TOTAL de leads: ${totalLeads}`);

    // 6. Resumo
    console.log('\n' + '='.repeat(70));
    console.log('📊 RESUMO DA DISCREPÂNCIA');
    console.log('='.repeat(70));
    console.log(`Total de AGENDAMENTOS (registros): ${totalAgendamentos}`);
    console.log(`Total de LEADS QUE AGENDARAM (únicos): ${chatidsUnicos.size}`);
    console.log(`Diferença: ${totalAgendamentos - chatidsUnicos.size} agendamentos duplicados`);
    console.log('\n💡 EXPLICAÇÃO:');
    console.log('   - 989 = TOTAL de agendamentos feitos (alguns leads agendaram mais de 1 vez)');
    console.log('   - 681 = LEADS ÚNICOS que fizeram pelo menos 1 agendamento');
    console.log('   - Diferença = Leads que retornaram e agendaram novamente\n');
}

investigarDiscrepancia();
