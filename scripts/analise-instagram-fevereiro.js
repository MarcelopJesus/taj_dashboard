const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vynilpckcxkahcyavtgy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Iniciando análise de leads do Instagram - Fevereiro 2026...');

    const dataInicio = '2026-02-01T00:00:00Z';
    const dataFim = '2026-02-28T23:59:59Z';

    let leads = [];
    let fetchMore = true;
    let from = 0;
    const limit = 1000;

    while (fetchMore) {
        const { data: chunk, error: leadsErr } = await supabase
            .from('taj_leads')
            .select('chatid, nome, origem_cliente_taj, timestamp, origem')
            .gte('timestamp', dataInicio)
            .lte('timestamp', dataFim)
            .range(from, from + limit - 1);

        if (leadsErr) {
            console.error('Erro ao buscar leads:', leadsErr.message);
            return;
        }

        if (chunk && chunk.length > 0) {
            leads = [...leads, ...chunk];
            from += limit;
        } else {
            fetchMore = false;
        }

        if (!chunk || chunk.length < limit) {
            fetchMore = false;
        }
    }

    console.log(`Total de leads em Fevereiro: ${leads.length}`);

    // 2. Filtrar apenas os que vieram do Instagram
    const leadsInstagram = leads.filter(l => {
        const origemTaj = l.origem_cliente_taj ? l.origem_cliente_taj.toLowerCase() : '';
        const origem = l.origem ? l.origem.toLowerCase() : '';
        return origemTaj.includes('instagram') || origemTaj.includes('insta') || origemTaj.includes('anúncio') || origemTaj.includes('anuncio') ||
            origem.includes('instagram') || origem.includes('anuncio');
    });

    console.log(`Leads classificados como Instagram: ${leadsInstagram.length}`);

    // 3. Buscar os agendamentos feitos por esses leads
    const instagramChatIds = leadsInstagram.map(l => l.chatid);

    const { data: agendamentos, error: agErr } = await supabase
        .from('taj_agendamentos')
        .select('chatid, codigo_agendamento, timestamp')
        .in('chatid', instagramChatIds);

    if (agErr) {
        console.error('Erro ao buscar agendamentos:', agErr.message);
        return;
    }

    // 4. Analisar e relatar
    const relatorioLeads = [];
    const diasAgendamento = {};
    let totalAgendamentos = 0;

    leadsInstagram.forEach(lead => {
        const agendamentosDoLead = agendamentos.filter(a => a.chatid === lead.chatid);
        const agendou = agendamentosDoLead.length > 0;

        relatorioLeads.push({
            nome: lead.nome || 'Sem Nome',
            chatid: lead.chatid,
            dataLead: new Date(lead.timestamp).toLocaleDateString('pt-BR'),
            origemEnquete: lead.origem_cliente_taj || 'N/A',
            agendou: agendou ? 'SIM' : 'NÃO',
            quantidadeAgendamentos: agendamentosDoLead.length,
            datasAgendadas: agendamentosDoLead.map(a => new Date(a.timestamp).toLocaleDateString('pt-BR'))
        });

        if (agendou) {
            totalAgendamentos++;
            agendamentosDoLead.forEach(a => {
                const diaDoAgendamentoRealizado = new Date(a.timestamp).toLocaleDateString('pt-BR');
                if (!diasAgendamento[diaDoAgendamentoRealizado]) {
                    diasAgendamento[diaDoAgendamentoRealizado] = 0;
                }
                diasAgendamento[diaDoAgendamentoRealizado]++;
            });
        }
    });

    console.log('\n======================================================');
    console.log('RESUMO - INSTAGRAM (FEVEREIRO/2026)');
    console.log('======================================================');
    console.log(`Total de Leads (Instagram): ${leadsInstagram.length}`);
    console.log(`Total de Leads que Agendararam: ${totalAgendamentos}`);
    const taxaConversao = leadsInstagram.length ? ((totalAgendamentos / leadsInstagram.length) * 100).toFixed(2) : 0;
    console.log(`Taxa de Conversão do Instagram: ${taxaConversao}%\n`);

    console.log('======================================================');
    console.log('AGENDAMENTOS POR DIA (Quando a marcação foi feita)');
    console.log('======================================================');
    const diasOrdenados = Object.keys(diasAgendamento).sort((a, b) => {
        const [diaA, mesA, anoA] = a.split('/');
        const [diaB, mesB, anoB] = b.split('/');
        return new Date(`${anoA}-${mesA}-${diaA}`) - new Date(`${anoB}-${mesB}-${diaB}`);
    });

    diasOrdenados.forEach(dia => {
        console.log(`${dia}: ${diasAgendamento[dia]} agendamento(s)`);
    });

    console.log('\n======================================================');
    console.log('LISTA DOS LEADS DO INSTAGRAM QUE AGENDARAM');
    console.log('======================================================');
    const leadsQueAgendaram = relatorioLeads.filter(l => l.agendou === 'SIM');
    leadsQueAgendaram.forEach((l, index) => {
        console.log(`${index + 1}. Nome: ${l.nome}`);
        console.log(`   Data do Lead: ${l.dataLead}`);
        console.log(`   Origem: ${l.origemEnquete}`);
        console.log(`   Dias em que fez o agendamento: ${l.datasAgendadas.join(', ')}`);
        console.log('------------------------------------------------------');
    });

}

main().catch(console.error);
