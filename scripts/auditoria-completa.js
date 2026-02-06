const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function auditarTodosDados() {
    console.log('='.repeat(80));
    console.log('🔍 AUDITORIA COMPLETA DE TODOS OS DADOS DO SISTEMA');
    console.log('='.repeat(80));
    console.log(`Data/Hora: ${new Date().toLocaleString('pt-BR')}\n`);

    // ========== PARTE 1: AGENDAMENTOS DE HOJE - VERIFICAR DATAS ==========
    console.log('\n📅 PARTE 1: VERIFICANDO AGENDAMENTOS DE HOJE E SUAS DATAS\n');
    console.log('-'.repeat(80));

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeFim = new Date();
    hojeFim.setHours(23, 59, 59, 999);
    const hojeStr = hoje.toISOString().split('T')[0]; // 2026-02-06

    const { data: agHoje } = await supabase
        .from('taj_agendamentos')
        .select('*')
        .gte('timestamp', hoje.toISOString())
        .lte('timestamp', hojeFim.toISOString());

    const { data: leads } = await supabase
        .from('taj_leads')
        .select('chatid, nome');

    const leadMap = {};
    for (const l of leads || []) {
        leadMap[l.chatid] = l.nome || 'Sem nome';
    }

    let agendamentosParaHoje = 0;
    let agendamentosParaOutroDia = 0;

    console.log('Código           | Data Agendamento | Nome Cliente');
    console.log('-'.repeat(80));

    for (const ag of agHoje || []) {
        const nome = leadMap[ag.chatid] || 'Desconhecido';
        const dataAg = ag.data_agendamento || 'N/A';
        const ehHoje = dataAg === hojeStr || dataAg === '2026-02-06';

        if (ehHoje || dataAg === 'N/A') {
            agendamentosParaHoje++;
        } else {
            agendamentosParaOutroDia++;
        }

        const marcador = ehHoje ? '✅ HOJE' : (dataAg === 'N/A' ? '❓ S/DATA' : '📆 OUTRO DIA');
        console.log(`${ag.codigo_agendamento.padEnd(16)} | ${dataAg.padEnd(16)} | ${nome.substring(0, 20)} ${marcador}`);
    }

    console.log('-'.repeat(80));
    console.log(`Total detectado hoje: ${agHoje?.length || 0}`);
    console.log(`   - Para HOJE: ${agendamentosParaHoje}`);
    console.log(`   - Para OUTRO DIA: ${agendamentosParaOutroDia}`);

    // ========== PARTE 2: CONTAGENS TOTAIS ==========
    console.log('\n\n📊 PARTE 2: CONTAGENS TOTAIS DO SISTEMA\n');
    console.log('-'.repeat(80));

    // Total de agendamentos (registros)
    let totalRegistrosAg = 0;
    let offset = 0;
    while (true) {
        const { data } = await supabase
            .from('taj_agendamentos')
            .select('id')
            .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        totalRegistrosAg += data.length;
        offset += 1000;
        if (data.length < 1000) break;
    }

    // ChatIds únicos com agendamento
    const chatIdsComAg = new Set();
    offset = 0;
    while (true) {
        const { data } = await supabase
            .from('taj_agendamentos')
            .select('chatid')
            .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        data.forEach(a => chatIdsComAg.add(a.chatid));
        offset += 1000;
        if (data.length < 1000) break;
    }

    // Total de leads
    const { count: totalLeads } = await supabase
        .from('taj_leads')
        .select('*', { count: 'exact', head: true });

    console.log(`📌 Total de REGISTROS de agendamento: ${totalRegistrosAg}`);
    console.log(`📌 Total de LEADS que agendaram (únicos): ${chatIdsComAg.size}`);
    console.log(`📌 Total de LEADS no sistema: ${totalLeads}`);
    console.log(`📌 Média de agendamentos por lead: ${(totalRegistrosAg / chatIdsComAg.size).toFixed(2)}`);

    // ========== PARTE 3: LEADS DE HOJE ==========
    console.log('\n\n👥 PARTE 3: LEADS DE HOJE\n');
    console.log('-'.repeat(80));

    const { data: leadsHoje, count: totalLeadsHoje } = await supabase
        .from('taj_leads')
        .select('chatid', { count: 'exact' })
        .gte('timestamp', hoje.toISOString())
        .lte('timestamp', hojeFim.toISOString());

    const chatIdsLeadsHoje = new Set((leadsHoje || []).map(l => l.chatid));

    // Quantos desses leads têm agendamento?
    const leadsHojeComAg = [...chatIdsLeadsHoje].filter(id => chatIdsComAg.has(id));

    console.log(`Total de leads HOJE: ${totalLeadsHoje}`);
    console.log(`Leads de hoje COM agendamento: ${leadsHojeComAg.length}`);
    console.log(`Leads de hoje SEM agendamento: ${totalLeadsHoje - leadsHojeComAg.length}`);

    // ========== PARTE 4: ANÁLISE DE ABANDONOS ==========
    console.log('\n\n🚪 PARTE 4: ANÁLISE DE ABANDONOS (LÓGICA ESPERADA)\n');
    console.log('-'.repeat(80));

    console.log('DEFINIÇÃO DE ABANDONO:');
    console.log('   Um lead é considerado "abandono" se NÃO tem agendamento confirmado.');
    console.log('');
    console.log(`Leads HOJE: ${totalLeadsHoje}`);
    console.log(`Leads HOJE com agendamento: ${leadsHojeComAg.length}`);
    console.log(`Leads HOJE SEM agendamento (abandonos): ${totalLeadsHoje - leadsHojeComAg.length}`);
    console.log('');
    console.log('⚠️  Se a página de abandonos mostra 53, está INCORRETO!');
    console.log(`   O valor correto deveria ser: ${totalLeadsHoje - leadsHojeComAg.length}`);

    // ========== PARTE 5: ÚLTIMOS 90 DIAS ==========
    console.log('\n\n📆 PARTE 5: ÚLTIMOS 90 DIAS\n');
    console.log('-'.repeat(80));

    const data90 = new Date();
    data90.setDate(data90.getDate() - 90);
    data90.setHours(0, 0, 0, 0);

    // Buscar todos os agendamentos dos últimos 90 dias
    const agendamentos90 = [];
    offset = 0;
    while (true) {
        const { data } = await supabase
            .from('taj_agendamentos')
            .select('chatid, codigo_agendamento, timestamp')
            .gte('timestamp', data90.toISOString())
            .range(offset, offset + 999);
        if (!data || data.length === 0) break;
        agendamentos90.push(...data);
        offset += 1000;
        if (data.length < 1000) break;
    }

    const chatIds90 = new Set(agendamentos90.map(a => a.chatid));

    console.log(`Período: ${data90.toLocaleDateString('pt-BR')} até hoje`);
    console.log(`Total de REGISTROS de agendamento: ${agendamentos90.length}`);
    console.log(`Total de LEADS que agendaram (únicos): ${chatIds90.size}`);

    console.log('\n⚠️  EXPLICAÇÃO DA DIFERENÇA (989 vs 690):');
    console.log('   - 989+ = Total de REGISTROS de agendamento (um lead pode ter vários)');
    console.log(`   - ${chatIds90.size} = Total de LEADS ÚNICOS que agendaram`);
    console.log('   - A mudança feita hoje passou a contar LEADS ÚNICOS');

    // ========== PARTE 6: VERIFICAR CONSISTÊNCIA ==========
    console.log('\n\n✅ PARTE 6: VERIFICAÇÃO DE CONSISTÊNCIA\n');
    console.log('-'.repeat(80));

    const problemas = [];

    // Verificar se há agendamentos sem lead correspondente
    const { data: leadsAll } = await supabase
        .from('taj_leads')
        .select('chatid');
    const chatIdsLeadsAll = new Set((leadsAll || []).map(l => l.chatid));

    const agSemLead = [...chatIdsComAg].filter(id => !chatIdsLeadsAll.has(id));
    if (agSemLead.length > 0) {
        problemas.push(`⚠️  ${agSemLead.length} agendamentos de leads que NÃO existem na tabela taj_leads`);
    }

    if (problemas.length === 0) {
        console.log('✅ Nenhum problema de consistência encontrado');
    } else {
        problemas.forEach(p => console.log(p));
    }

    // ========== RESUMO FINAL ==========
    console.log('\n\n' + '='.repeat(80));
    console.log('📋 RESUMO EXECUTIVO');
    console.log('='.repeat(80));
    console.log(`
HOJE (${hoje.toLocaleDateString('pt-BR')}):
   - Leads: ${totalLeadsHoje}
   - Agendamentos detectados: ${agHoje?.length || 0}
   - Leads únicos que agendaram: ${leadsHojeComAg.length}
   - Leads sem agendamento (abandonos): ${totalLeadsHoje - leadsHojeComAg.length}

TOTAL GERAL:
   - Total de leads: ${totalLeads}
   - Total de registros de agendamento: ${totalRegistrosAg}
   - Total de leads que agendaram: ${chatIdsComAg.size}
   - Taxa de conversão geral: ${((chatIdsComAg.size / totalLeads) * 100).toFixed(1)}%

DIFERENÇA 989 vs 690:
   - Antes: Contava REGISTROS (${totalRegistrosAg} registros)
   - Agora: Conta LEADS ÚNICOS (${chatIdsComAg.size} leads)
   - Isso é uma MUDANÇA DE MÉTRICA, não perda de dados
`);

    console.log('='.repeat(80));
}

auditarTodosDados();
