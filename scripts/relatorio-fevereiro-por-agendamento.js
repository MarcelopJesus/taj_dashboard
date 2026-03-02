const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vynilpckcxkahcyavtgy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const dataInicio = '2026-02-01T00:00:00Z';
    const dataFim = '2026-02-28T23:59:59Z';

    console.log('Buscando TODOS os agendamentos feitos no mês de Fevereiro...');

    let agendamentos = [];
    let fetchMore = true;
    let from = 0;
    const limit = 1000;

    while (fetchMore) {
        const { data: chunk, error } = await supabase
            .from('taj_agendamentos')
            .select('chatid, codigo_agendamento, timestamp')
            .gte('timestamp', dataInicio)
            .lte('timestamp', dataFim)
            .range(from, from + limit - 1);

        if (error) {
            console.error('Erro agendamentos:', error.message);
            return;
        }

        if (chunk && chunk.length > 0) {
            agendamentos = [...agendamentos, ...chunk];
            from += limit;
        } else {
            fetchMore = false;
        }

        if (!chunk || chunk.length < limit) {
            fetchMore = false;
        }
    }

    console.log(`Total de agendamentos faturados no período: ${agendamentos.length}`);

    // Identificar chatids únicos
    const chatidsUnicos = [...new Set(agendamentos.map(a => a.chatid))];
    console.log(`Leads únicos que agendaram neste período: ${chatidsUnicos.length}`);

    // Buscar as origens desses leads na tabela taj_leads
    let leads = [];
    const chunkSize = 200;
    for (let i = 0; i < chatidsUnicos.length; i += chunkSize) {
        const ids = chatidsUnicos.slice(i, i + chunkSize);
        const { data: leadChunk, error } = await supabase
            .from('taj_leads')
            .select('chatid, nome, origem_cliente_taj, origem, timestamp')
            .in('chatid', ids);

        if (error) {
            console.error('Erro leads:', error.message);
            return;
        }
        if (leadChunk) leads = [...leads, ...leadChunk];
    }

    const totaisPorOrigem = {
        'Instagram': { leads: 0, agendamentos: 0 },
        'Google': { leads: 0, agendamentos: 0 },
        'Indicação': { leads: 0, agendamentos: 0 },
        'Casa/Cliente': { leads: 0, agendamentos: 0 },
        'Não sabemos ainda': { leads: 0, agendamentos: 0 }
    };

    const dsAgendamentosRealizados = {};

    agendamentos.forEach(a => {
        const lead = leads.find(l => l.chatid === a.chatid);

        let classificacao = 'Não sabemos ainda';

        if (lead) {
            const origTaj = lead.origem_cliente_taj ? lead.origem_cliente_taj.toLowerCase() : '';
            const origNum = lead.origem ? lead.origem.toLowerCase() : '';

            if (origTaj.includes('instagram') || origTaj.includes('insta') || origTaj.includes('anúncio') || origTaj.includes('anuncio') || origNum.includes('instagram') || origNum.includes('anuncio')) {
                classificacao = 'Instagram';
            } else if (origTaj.includes('google') || origTaj.includes('pesquisa')) {
                classificacao = 'Google';
            } else if (origTaj.includes('indicação') || origTaj.includes('indicacao') || origTaj.includes('indicou')) {
                classificacao = 'Indicação';
            } else if (origTaj.includes('cliente') || origTaj.includes('já') || origTaj.includes('ja ') || origTaj.includes('casa')) {
                classificacao = 'Casa/Cliente';
            }
        }

        totaisPorOrigem[classificacao].agendamentos++;

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

    console.log(`======================================================`);
    console.log(`ORIGEM DOS AGENDAMENTOS FEITOS EM FEVEREIRO`);
    console.log(`======================================================`);
    for (const [origem, dados] of Object.entries(totaisPorOrigem)) {
        console.log(`Origem: ${origem.toUpperCase()}`);
        console.log(`  - Agendamentos: ${dados.agendamentos}`);
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

}

main().catch(console.error);
