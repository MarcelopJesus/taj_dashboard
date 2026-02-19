const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://vynilpckcxkahcyavtgy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0'
);

async function check() {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    console.log('Período: ' + tenDaysAgo.toISOString().substring(0, 10) + ' até agora\n');

    // 1. Descobrir colunas da tabela taj_leads pegando 1 registro
    console.log('=== ESTRUTURA DAS TABELAS ===');

    const { data: sampleLead, error: e1 } = await supabase
        .from('taj_leads')
        .select('*')
        .limit(1);

    if (e1) {
        console.log('ERRO taj_leads: ' + e1.message);
    } else if (sampleLead && sampleLead.length > 0) {
        console.log('Colunas taj_leads: ' + Object.keys(sampleLead[0]).join(', '));
    } else {
        console.log('taj_leads: tabela vazia');
    }

    const { data: sampleAg, error: e2 } = await supabase
        .from('taj_agendamentos')
        .select('*')
        .limit(1);

    if (e2) {
        console.log('ERRO taj_agendamentos: ' + e2.message);
    } else if (sampleAg && sampleAg.length > 0) {
        console.log('Colunas taj_agendamentos: ' + Object.keys(sampleAg[0]).join(', '));
    } else {
        console.log('taj_agendamentos: tabela vazia');
    }

    const { data: sampleMsg, error: e3 } = await supabase
        .from('taj_mensagens')
        .select('*')
        .limit(1);

    if (e3) {
        console.log('ERRO taj_mensagens: ' + e3.message);
    } else if (sampleMsg && sampleMsg.length > 0) {
        console.log('Colunas taj_mensagens: ' + Object.keys(sampleMsg[0]).join(', '));
    } else {
        console.log('taj_mensagens: tabela vazia');
    }

    // 2. Totais gerais
    console.log('\n=== TOTAIS GERAIS ===');
    const { count: c1 } = await supabase.from('taj_leads').select('*', { count: 'exact', head: true });
    const { count: c2 } = await supabase.from('taj_mensagens').select('*', { count: 'exact', head: true });
    const { count: c3 } = await supabase.from('taj_agendamentos').select('*', { count: 'exact', head: true });
    console.log('taj_leads: ' + (c1 || 0));
    console.log('taj_mensagens: ' + (c2 || 0));
    console.log('taj_agendamentos: ' + (c3 || 0));

    // 3. Leads últimos 10 dias (sem campo origem_cliente, usando campos reais)
    const { data: leads, error: leadsErr } = await supabase
        .from('taj_leads')
        .select('*')
        .gte('timestamp', tenDaysAgo.toISOString())
        .order('timestamp', { ascending: false });

    if (leadsErr) {
        console.log('\nERRO leads 10 dias: ' + leadsErr.message);
        return;
    }

    console.log('\n=== LEADS ÚLTIMOS 10 DIAS ===');
    console.log('Total: ' + (leads ? leads.length : 0));

    if (leads && leads.length > 0) {
        // Verificar se existe campo de origem (qualquer variação)
        const keys = Object.keys(leads[0]);
        const originField = keys.find(function (k) {
            return k.toLowerCase().includes('origem') || k.toLowerCase().includes('origin') || k.toLowerCase().includes('source');
        });
        const statusField = keys.find(function (k) {
            return k.toLowerCase().includes('status');
        });

        console.log('Campo de origem encontrado: ' + (originField || 'NENHUM'));
        console.log('Campo de status encontrado: ' + (statusField || 'NENHUM'));

        // Agrupar por status
        if (statusField) {
            console.log('\n=== POR STATUS ===');
            const statusCount = {};
            leads.forEach(function (l) {
                const status = l[statusField] || 'sem status';
                statusCount[status] = (statusCount[status] || 0) + 1;
            });
            Object.entries(statusCount).sort(function (a, b) { return b[1] - a[1]; }).forEach(function (entry) {
                const pct = ((entry[1] / leads.length) * 100).toFixed(1);
                console.log('  ' + entry[0] + ': ' + entry[1] + ' (' + pct + '%)');
            });
        }

        // Agrupar por origem se existir
        if (originField) {
            console.log('\n=== POR ORIGEM ===');
            const origens = {};
            leads.forEach(function (l) {
                const origem = l[originField] || 'não identificado';
                origens[origem] = (origens[origem] || 0) + 1;
            });
            Object.entries(origens).sort(function (a, b) { return b[1] - a[1]; }).forEach(function (entry) {
                const pct = ((entry[1] / leads.length) * 100).toFixed(1);
                console.log('  ' + entry[0] + ': ' + entry[1] + ' (' + pct + '%)');
            });
        }

        // Leads por dia
        console.log('\n=== LEADS POR DIA ===');
        const leadsByDay = {};
        leads.forEach(function (l) {
            const day = l.timestamp ? l.timestamp.substring(0, 10) : 'sem data';
            leadsByDay[day] = (leadsByDay[day] || 0) + 1;
        });
        Object.entries(leadsByDay).sort().forEach(function (entry) {
            console.log('  ' + entry[0] + ': ' + entry[1]);
        });

        // Últimos 10 leads com TODOS os campos 
        console.log('\n=== ÚLTIMOS 10 LEADS (COMPLETO) ===');
        leads.slice(0, 10).forEach(function (l, i) {
            console.log('\n--- Lead ' + (i + 1) + ' ---');
            Object.entries(l).forEach(function (entry) {
                if (entry[0] !== 'conversation') {
                    const val = entry[1] !== null && entry[1] !== undefined ? String(entry[1]).substring(0, 80) : 'null';
                    console.log('  ' + entry[0] + ': ' + val);
                }
            });
        });
    }

    // 4. Agendamentos últimos 10 dias
    const { data: agendamentos, error: agErr } = await supabase
        .from('taj_agendamentos')
        .select('*')
        .gte('timestamp', tenDaysAgo.toISOString())
        .order('timestamp', { ascending: false });

    console.log('\n=== AGENDAMENTOS ÚLTIMOS 10 DIAS ===');
    if (agErr) {
        console.log('ERRO: ' + agErr.message);
    } else {
        console.log('Total: ' + (agendamentos ? agendamentos.length : 0));

        if (agendamentos && agendamentos.length > 0) {
            const agByDay = {};
            agendamentos.forEach(function (a) {
                const day = a.timestamp ? a.timestamp.substring(0, 10) : 'sem data';
                agByDay[day] = (agByDay[day] || 0) + 1;
            });
            console.log('\nPor dia:');
            Object.entries(agByDay).sort().forEach(function (entry) {
                console.log('  ' + entry[0] + ': ' + entry[1]);
            });

            const chatIdsUnicos = new Set(agendamentos.map(function (a) { return a.chatid; }));
            console.log('\nLeads únicos que agendaram: ' + chatIdsUnicos.size);

            console.log('\nÚltimos 5 agendamentos:');
            agendamentos.slice(0, 5).forEach(function (a, i) {
                console.log('\n--- Agendamento ' + (i + 1) + ' ---');
                Object.entries(a).forEach(function (entry) {
                    const val = entry[1] !== null && entry[1] !== undefined ? String(entry[1]).substring(0, 80) : 'null';
                    console.log('  ' + entry[0] + ': ' + val);
                });
            });
        }
    }

    // 5. Verificação de sincronização
    console.log('\n=== VERIFICAÇÃO DE SINCRONIZAÇÃO ===');
    if (leads && agendamentos) {
        const statusField = Object.keys(leads[0] || {}).find(function (k) { return k.toLowerCase().includes('status'); });

        if (statusField) {
            const leadsConvertidos = leads.filter(function (l) { return l[statusField] === 'convertido'; });
            const chatIdsAgendamentos = new Set((agendamentos || []).map(function (a) { return a.chatid; }));
            const chatIdsConvertidos = new Set(leadsConvertidos.map(function (l) { return l.chatid; }));

            const convertidosSemAgendamento = [];
            chatIdsConvertidos.forEach(function (chatid) {
                if (!chatIdsAgendamentos.has(chatid)) convertidosSemAgendamento.push(chatid);
            });

            const agendamentosSemConversao = [];
            chatIdsAgendamentos.forEach(function (chatid) {
                if (!chatIdsConvertidos.has(chatid)) agendamentosSemConversao.push(chatid);
            });

            console.log('Leads convertidos (10 dias): ' + leadsConvertidos.length);
            console.log('ChatIDs com agendamento (10 dias): ' + chatIdsAgendamentos.size);
            console.log('Convertidos SEM agendamento: ' + convertidosSemAgendamento.length);
            console.log('Agendamentos SEM lead convertido: ' + agendamentosSemConversao.length);

            if (convertidosSemAgendamento.length > 0) {
                console.log('\nDetalhes - convertidos sem agendamento:');
                convertidosSemAgendamento.slice(0, 5).forEach(function (id) {
                    const lead = leads.find(function (l) { return l.chatid === id; });
                    console.log('  - ' + id.substring(0, 20) + '... | ' + (lead ? (lead.nome || 'Sem nome') : '?'));
                });
            }

            if (agendamentosSemConversao.length > 0) {
                console.log('\nDetalhes - agendamentos sem lead convertido:');
                agendamentosSemConversao.slice(0, 5).forEach(function (id) {
                    console.log('  - chatid: ' + id.substring(0, 25) + '...');
                });
            }
        }
    }
}

check().catch(function (e) { console.error('ERRO GERAL: ' + e.message); });
