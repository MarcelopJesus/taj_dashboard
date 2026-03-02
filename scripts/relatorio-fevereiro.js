const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vynilpckcxkahcyavtgy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log('Iniciando análise completa de leads de Fevereiro 2026...\n');

    const dataInicio = '2026-02-01T00:00:00Z';
    const dataFim = '2026-02-28T23:59:59Z';

    // 1. Buscar todos os leads de Fevereiro
    let leads = [];
    let fetchMoreLeads = true;
    let fromLeads = 0;
    const limitParams = 1000;

    while (fetchMoreLeads) {
        const { data: chunk, error: leadsErr } = await supabase
            .from('taj_leads')
            .select('chatid, nome, origem_cliente_taj, timestamp, origem')
            .gte('timestamp', dataInicio)
            .lte('timestamp', dataFim)
            .range(fromLeads, fromLeads + limitParams - 1);

        if (leadsErr) {
            console.error('Erro ao buscar leads:', leadsErr.message);
            return;
        }

        if (chunk && chunk.length > 0) {
            leads = [...leads, ...chunk];
            fromLeads += limitParams;
        } else {
            fetchMoreLeads = false;
        }

        if (!chunk || chunk.length < limitParams) {
            fetchMoreLeads = false;
        }
    }

    console.log(`======================================================`);
    console.log(`RELATÓRIO GERAL MÊS DE FEVEREIRO/2026`);
    console.log(`======================================================`);
    console.log(`Total de Leads captados: ${leads.length}`);

    // 2. Buscar agendamentos desses leads
    const todosChatIds = leads.map(l => l.chatid);
    let agendamentos = [];

    // Suporte para Supabase "in" array muito grande divide os IDs
    const chunkSize = 200;
    for (let i = 0; i < todosChatIds.length; i += chunkSize) {
        const idsChunk = todosChatIds.slice(i, i + chunkSize);

        const { data: agChunk, error: agErr } = await supabase
            .from('taj_agendamentos')
            .select('chatid, codigo_agendamento, timestamp')
            .in('chatid', idsChunk);

        if (agErr) {
            console.error('Erro ao buscar agendamentos:', agErr.message);
            return;
        }

        agendamentos = [...agendamentos, ...agChunk];
    }

    // 3. Classificar origens e compilar dados
    const totaisPorOrigem = {
        'Instagram': { leads: 0, agendamentos: 0 },
        'Google': { leads: 0, agendamentos: 0 },
        'Indicação': { leads: 0, agendamentos: 0 },
        'Casa/Cliente': { leads: 0, agendamentos: 0 },
        'Não sabemos ainda': { leads: 0, agendamentos: 0 }
    };

    const dsAgendamentosRealizados = {}; // Para agrupar agendamentos por dia

    let totalAgendamentosGeral = 0;

    leads.forEach(lead => {
        // Classificar origem do lead
        const origTaj = lead.origem_cliente_taj ? lead.origem_cliente_taj.toLowerCase() : '';
        const origNum = lead.origem ? lead.origem.toLowerCase() : '';

        let classificacao = 'Não sabemos ainda';

        if (origTaj.includes('instagram') || origTaj.includes('insta') || origTaj.includes('anúncio') || origTaj.includes('anuncio') || origNum.includes('instagram') || origNum.includes('anuncio')) {
            classificacao = 'Instagram';
        } else if (origTaj.includes('google') || origTaj.includes('pesquisa')) {
            classificacao = 'Google';
        } else if (origTaj.includes('indicação') || origTaj.includes('indicacao') || origTaj.includes('indicou')) {
            classificacao = 'Indicação';
        } else if (origTaj.includes('cliente') || origTaj.includes('já') || origTaj.includes('ja ') || origTaj.includes('casa')) {
            classificacao = 'Casa/Cliente';
        }

        totaisPorOrigem[classificacao].leads++;

        // Checar agendamentos FEITOS EM FEVEREIRO
        const agendamentosDoLead = agendamentos.filter(a => {
            if (a.chatid !== lead.chatid) return false;
            const pt = new Date(a.timestamp);
            return pt >= new Date(dataInicio) && pt <= new Date(dataFim);
        });

        if (agendamentosDoLead.length > 0) {
            totaisPorOrigem[classificacao].agendamentos++;
            totalAgendamentosGeral += agendamentosDoLead.length;

            agendamentosDoLead.forEach(a => {
                const dia = new Date(a.timestamp).toLocaleDateString('pt-BR');
                if (!dsAgendamentosRealizados[dia]) {
                    dsAgendamentosRealizados[dia] = { total: 0, origens: {} };
                }
                dsAgendamentosRealizados[dia].total++;

                if (!dsAgendamentosRealizados[dia].origens[classificacao]) {
                    dsAgendamentosRealizados[dia].origens[classificacao] = 0;
                }
                dsAgendamentosRealizados[dia].origens[classificacao]++;
            });
        }
    });

    console.log(`Total de Agendamentos (feitos por leads de fev): ${totalAgendamentosGeral}\n`);

    console.log(`======================================================`);
    console.log(`ORIGEM DOS LEADS VS. AGENDAMENTOS`);
    console.log(`======================================================`);
    for (const [origem, dados] of Object.entries(totaisPorOrigem)) {
        const taxaConv = dados.leads > 0 ? ((dados.agendamentos / dados.leads) * 100).toFixed(2) : 0;
        console.log(`Origem: ${origem.toUpperCase()}`);
        console.log(`  - Leads gerados: ${dados.leads}`);
        console.log(`  - Agendamentos: ${dados.agendamentos}`);
        console.log(`  - Conversão: ${taxaConv}%`);
        console.log(`------------------------------------------------------`);
    }

    console.log(`\n======================================================`);
    console.log(`RESUMO DE AGENDAMENTOS POR DIA (E SUAS ORIGENS)`);
    console.log(`======================================================`);

    const diasOrdenados = Object.keys(dsAgendamentosRealizados).sort((a, b) => {
        const [diaA, mesA, anoA] = a.split('/');
        const [diaB, mesB, anoB] = b.split('/');
        return new Date(`${anoA}-${mesA}-${diaA}`) - new Date(`${anoB}-${mesB}-${diaB}`);
    });

    diasOrdenados.forEach(dia => {
        const ds = dsAgendamentosRealizados[dia];
        console.log(`Data: ${dia} => ${ds.total} agendamento(s)`);
        for (const [ori, qtd] of Object.entries(ds.origens)) {
            console.log(`    - ${ori}: ${qtd}`);
        }
    });

    console.log(`\n======================================================`);
    console.log(`FIM DO RELATÓRIO DE FEVEREIRO`);
    console.log(`======================================================\n`);
}

main().catch(console.error);
