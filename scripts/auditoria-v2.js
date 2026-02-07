const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function auditarDados() {
    console.log('='.repeat(80));
    console.log('🔍 AUDITORIA COMPLETA DO SISTEMA - ANÁLISE PARA V2.0');
    console.log('='.repeat(80));
    console.log();

    // 1. Estrutura das tabelas
    console.log('📊 ESTRUTURA DAS TABELAS\n');

    const { data: lead } = await supabase.from('taj_leads').select('*').limit(1);
    if (lead && lead.length > 0) {
        console.log('TAJ_LEADS:');
        Object.keys(lead[0]).forEach(k => console.log(`   - ${k}: ${typeof lead[0][k]}`));
    }

    const { data: msg } = await supabase.from('taj_mensagens').select('*').limit(1);
    if (msg && msg.length > 0) {
        console.log('\nTAJ_MENSAGENS:');
        Object.keys(msg[0]).forEach(k => console.log(`   - ${k}: ${typeof msg[0][k]}`));
    }

    const { data: ag } = await supabase.from('taj_agendamentos').select('*').limit(1);
    if (ag && ag.length > 0) {
        console.log('\nTAJ_AGENDAMENTOS:');
        Object.keys(ag[0]).forEach(k => console.log(`   - ${k}: ${typeof ag[0][k]}`));
    }

    // 2. Estatísticas gerais
    console.log('\n' + '='.repeat(80));
    console.log('📈 ESTATÍSTICAS GERAIS\n');

    const { count: totalLeads } = await supabase.from('taj_leads').select('*', { count: 'exact', head: true });
    const { count: totalMsgs } = await supabase.from('taj_mensagens').select('*', { count: 'exact', head: true });
    const { count: totalAg } = await supabase.from('taj_agendamentos').select('*', { count: 'exact', head: true });

    console.log(`Total de Leads: ${totalLeads}`);
    console.log(`Total de Mensagens: ${totalMsgs}`);
    console.log(`Total de Agendamentos: ${totalAg}`);

    // 3. Análise de campos de leads
    console.log('\n' + '='.repeat(80));
    console.log('📋 ANÁLISE DOS CAMPOS DE LEADS\n');

    const { data: leads100 } = await supabase.from('taj_leads').select('*').limit(100);

    const campoPreenchido = {};
    const valoresUnicos = {};

    if (leads100) {
        leads100.forEach(lead => {
            Object.keys(lead).forEach(k => {
                if (!campoPreenchido[k]) campoPreenchido[k] = 0;
                if (!valoresUnicos[k]) valoresUnicos[k] = new Set();

                if (lead[k] !== null && lead[k] !== '') {
                    campoPreenchido[k]++;
                    if (typeof lead[k] !== 'object') {
                        valoresUnicos[k].add(lead[k]);
                    }
                }
            });
        });

        console.log('Taxa de preenchimento dos campos:');
        Object.keys(campoPreenchido).forEach(k => {
            const taxa = (campoPreenchido[k] / leads100.length * 100).toFixed(1);
            const unicos = valoresUnicos[k] ? valoresUnicos[k].size : 0;
            console.log(`   ${k}: ${taxa}% preenchido, ${unicos} valores únicos`);
        });
    }

    // 4. Análise de origens
    console.log('\n' + '='.repeat(80));
    console.log('🎯 ANÁLISE DE ORIGENS\n');

    const { data: origens } = await supabase.from('taj_leads').select('origem_cliente');
    const origemCount = {};
    origens?.forEach(l => {
        const origem = l.origem_cliente || 'Não identificado';
        origemCount[origem] = (origemCount[origem] || 0) + 1;
    });

    console.log('Distribuição de origens:');
    Object.entries(origemCount).sort((a, b) => b[1] - a[1]).forEach(([origem, count]) => {
        const pct = ((count / origens.length) * 100).toFixed(1);
        console.log(`   ${origem}: ${count} (${pct}%)`);
    });

    // 5. Análise de status
    console.log('\n' + '='.repeat(80));
    console.log('📊 ANÁLISE DE STATUS DE ATENDIMENTO\n');

    const { data: status } = await supabase.from('taj_leads').select('status_atendimento');
    const statusCount = {};
    status?.forEach(l => {
        const s = l.status_atendimento || 'Não definido';
        statusCount[s] = (statusCount[s] || 0) + 1;
    });

    console.log('Distribuição de status:');
    Object.entries(statusCount).sort((a, b) => b[1] - a[1]).forEach(([s, count]) => {
        const pct = ((count / status.length) * 100).toFixed(1);
        console.log(`   ${s}: ${count} (${pct}%)`);
    });

    // 6. Análise de mensagens
    console.log('\n' + '='.repeat(80));
    console.log('💬 ANÁLISE DE MENSAGENS\n');

    const { data: msgSample } = await supabase.from('taj_mensagens').select('chatid, conversation').limit(500);

    // Contar mensagens por conversa
    const msgPorChat = {};
    const roleCount = { user: 0, model: 0, function: 0, outros: 0 };

    msgSample?.forEach(m => {
        msgPorChat[m.chatid] = (msgPorChat[m.chatid] || 0) + 1;
        const role = m.conversation?.role || 'outros';
        if (roleCount[role] !== undefined) roleCount[role]++;
        else roleCount.outros++;
    });

    const msgCounts = Object.values(msgPorChat);
    const avgMsgs = (msgCounts.reduce((a, b) => a + b, 0) / msgCounts.length).toFixed(1);
    const maxMsgs = Math.max(...msgCounts);
    const minMsgs = Math.min(...msgCounts);

    console.log(`Média de mensagens por conversa: ${avgMsgs}`);
    console.log(`Máximo de mensagens em uma conversa: ${maxMsgs}`);
    console.log(`Mínimo de mensagens em uma conversa: ${minMsgs}`);
    console.log(`\nDistribuição por role:`);
    Object.entries(roleCount).forEach(([role, count]) => {
        console.log(`   ${role}: ${count}`);
    });

    // 7. Análise temporal
    console.log('\n' + '='.repeat(80));
    console.log('📅 ANÁLISE TEMPORAL\n');

    const { data: temporal } = await supabase
        .from('taj_leads')
        .select('timestamp')
        .order('timestamp', { ascending: true })
        .limit(1);

    const { data: temporalUltimo } = await supabase
        .from('taj_leads')
        .select('timestamp')
        .order('timestamp', { ascending: false })
        .limit(1);

    if (temporal?.[0] && temporalUltimo?.[0]) {
        console.log(`Primeiro lead: ${new Date(temporal[0].timestamp).toLocaleDateString('pt-BR')}`);
        console.log(`Último lead: ${new Date(temporalUltimo[0].timestamp).toLocaleDateString('pt-BR')}`);
    }

    // 8. Análise de horários
    const { data: leadsHora } = await supabase.from('taj_leads').select('timestamp').limit(500);
    const horarios = {};
    leadsHora?.forEach(l => {
        const hora = new Date(l.timestamp).getHours();
        horarios[hora] = (horarios[hora] || 0) + 1;
    });

    console.log('\nDistribuição por hora do dia (amostra de 500):');
    Object.entries(horarios).sort((a, b) => a[0] - b[0]).forEach(([hora, count]) => {
        const bar = '█'.repeat(Math.round(count / 5));
        console.log(`   ${hora.padStart(2, '0')}h: ${bar} (${count})`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ AUDITORIA CONCLUÍDA');
    console.log('='.repeat(80));
}

auditarDados();
