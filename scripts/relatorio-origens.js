/**
 * Relatório de Origem de Leads vs Agendamentos (últimos 10 dias)
 * 
 * Cruza dados de taj_leads (origem_cliente_taj) com taj_agendamentos
 * para mostrar de onde vieram os leads e quantos converteram.
 * 
 * Uso: node scripts/relatorio-origens.js
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://vynilpckcxkahcyavtgy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0'
);

async function main() {
    var tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    var hoje = new Date();
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║     RELATÓRIO: ORIGEM DE LEADS vs AGENDAMENTOS             ║');
    console.log('║     Período: ' + tenDaysAgo.toISOString().substring(0, 10) + ' até ' + hoje.toISOString().substring(0, 10) + '                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');

    // 1. Buscar todos os leads dos últimos 10 dias
    var { data: leads, error: leadsErr } = await supabase
        .from('taj_leads')
        .select('chatid, nome, origem_cliente_taj, status_atendimento, timestamp, origem')
        .gte('timestamp', tenDaysAgo.toISOString())
        .order('timestamp', { ascending: false });

    if (leadsErr) {
        console.error('ERRO ao buscar leads: ' + leadsErr.message);
        return;
    }

    if (!leads || leads.length === 0) {
        console.log('Nenhum lead encontrado no período.');
        return;
    }

    // 2. Buscar agendamentos dos últimos 10 dias
    var { data: agendamentos, error: agErr } = await supabase
        .from('taj_agendamentos')
        .select('chatid, codigo_agendamento, timestamp')
        .gte('timestamp', tenDaysAgo.toISOString());

    if (agErr) {
        console.error('ERRO ao buscar agendamentos: ' + agErr.message);
        return;
    }

    // Criar set de chatIds que agendaram
    var chatIdsQueAgendaram = new Set();
    if (agendamentos) {
        agendamentos.forEach(function (a) {
            chatIdsQueAgendaram.add(a.chatid);
        });
    }

    // 3. Classificar origens
    console.log('\n📊 VISÃO GERAL');
    console.log('─────────────────────────────────────────');
    console.log('  Total de leads no período: ' + leads.length);
    console.log('  Total de agendamentos: ' + (agendamentos ? agendamentos.length : 0));
    console.log('  Leads únicos que agendaram: ' + chatIdsQueAgendaram.size);

    // 4. Agrupar por origem_cliente_taj
    var porOrigem = {};
    var porOrigemNumero = {};

    leads.forEach(function (l) {
        // Origem pelo campo origem_cliente_taj (resposta da enquete)
        var origemTaj = l.origem_cliente_taj || 'Não respondeu enquete';
        if (!porOrigem[origemTaj]) {
            porOrigem[origemTaj] = { total: 0, agendaram: 0, chatids: [] };
        }
        porOrigem[origemTaj].total++;
        porOrigem[origemTaj].chatids.push(l.chatid);
        if (chatIdsQueAgendaram.has(l.chatid)) {
            porOrigem[origemTaj].agendaram++;
        }

        // Também por número de origem (WhatsApp)
        var origemNum = l.origem || 'desconhecido';
        if (!porOrigemNumero[origemNum]) {
            porOrigemNumero[origemNum] = { total: 0, agendaram: 0 };
        }
        porOrigemNumero[origemNum].total++;
        if (chatIdsQueAgendaram.has(l.chatid)) {
            porOrigemNumero[origemNum].agendaram++;
        }
    });

    // 5. Relatório por origem_cliente_taj (enquete)
    console.log('\n\n📋 POR ORIGEM (respostas da enquete da Duda)');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  Origem'.padEnd(35) + 'Leads'.padEnd(10) + 'Agendaram'.padEnd(12) + 'Conversão');
    console.log('─────────────────────────────────────────────────────────────');

    var origemEntries = Object.entries(porOrigem).sort(function (a, b) { return b[1].total - a[1].total; });

    origemEntries.forEach(function (entry) {
        var origem = entry[0];
        var dados = entry[1];
        var pct = dados.total > 0 ? ((dados.agendaram / dados.total) * 100).toFixed(1) : '0.0';
        console.log('  ' + origem.padEnd(33) + String(dados.total).padEnd(10) + String(dados.agendaram).padEnd(12) + pct + '%');
    });

    // 6. FOCO: Instagram
    console.log('\n\n🟠 FOCO: ANÚNCIO DO INSTAGRAM');
    console.log('═══════════════════════════════════════════════════════════════');

    var instagramKeys = Object.keys(porOrigem).filter(function (k) {
        return k.toLowerCase().includes('instagram') || k.toLowerCase().includes('insta') || k.toLowerCase().includes('anúncio') || k.toLowerCase().includes('anuncio');
    });

    if (instagramKeys.length > 0) {
        var totalInsta = 0;
        var agendaramInsta = 0;

        instagramKeys.forEach(function (key) {
            totalInsta += porOrigem[key].total;
            agendaramInsta += porOrigem[key].agendaram;
            console.log('  Categoria: "' + key + '"');
            console.log('    Leads: ' + porOrigem[key].total);
            console.log('    Agendaram: ' + porOrigem[key].agendaram);
            var pct = porOrigem[key].total > 0 ? ((porOrigem[key].agendaram / porOrigem[key].total) * 100).toFixed(1) : '0.0';
            console.log('    Taxa de conversão: ' + pct + '%');
        });

        if (instagramKeys.length > 1) {
            console.log('\n  TOTAL INSTAGRAM:');
            console.log('    Leads: ' + totalInsta);
            console.log('    Agendaram: ' + agendaramInsta);
            var pctTotal = totalInsta > 0 ? ((agendaramInsta / totalInsta) * 100).toFixed(1) : '0.0';
            console.log('    Taxa de conversão: ' + pctTotal + '%');
        }

        // Detalhe dos que agendaram pelo Instagram
        if (agendaramInsta > 0) {
            console.log('\n  Leads do Instagram que AGENDARAM:');
            instagramKeys.forEach(function (key) {
                porOrigem[key].chatids.forEach(function (chatid) {
                    if (chatIdsQueAgendaram.has(chatid)) {
                        var lead = leads.find(function (l) { return l.chatid === chatid; });
                        var ags = agendamentos.filter(function (a) { return a.chatid === chatid; });
                        console.log('    ✅ ' + (lead ? (lead.nome || 'Sem nome') : '?') + ' - ' + ags.length + ' agendamento(s)');
                    }
                });
            });
        }
    } else {
        console.log('  Nenhum lead identificado como vindo do Instagram no período.');
        console.log('  (campo origem_cliente_taj não contém "Instagram" ou "Anúncio")');
    }

    // 7. Por número de WhatsApp (os 3 números diferentes)
    console.log('\n\n📞 POR NÚMERO DE WHATSAPP (campo "origem")');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  Número'.padEnd(25) + 'Leads'.padEnd(10) + 'Agendaram'.padEnd(12) + 'Conversão');
    console.log('─────────────────────────────────────────────────────────────');

    Object.entries(porOrigemNumero).sort(function (a, b) { return b[1].total - a[1].total; }).forEach(function (entry) {
        var num = entry[0];
        var dados = entry[1];
        var pct = dados.total > 0 ? ((dados.agendaram / dados.total) * 100).toFixed(1) : '0.0';
        console.log('  ' + num.padEnd(23) + String(dados.total).padEnd(10) + String(dados.agendaram).padEnd(12) + pct + '%');
    });

    // 8. Relatório por dia
    console.log('\n\n📅 LEADS POR DIA (com origem)');
    console.log('═══════════════════════════════════════════════════════════════');

    var porDia = {};
    leads.forEach(function (l) {
        var dia = l.timestamp ? l.timestamp.substring(0, 10) : 'sem data';
        if (!porDia[dia]) porDia[dia] = { total: 0, agendaram: 0, instagram: 0, google: 0, indicacao: 0, jaSouCliente: 0, naoRespondeu: 0 };
        porDia[dia].total++;
        if (chatIdsQueAgendaram.has(l.chatid)) porDia[dia].agendaram++;

        var orig = (l.origem_cliente_taj || '').toLowerCase();
        if (orig.includes('instagram') || orig.includes('anúncio') || orig.includes('anuncio')) {
            porDia[dia].instagram++;
        } else if (orig.includes('google') || orig.includes('pesquisa')) {
            porDia[dia].google++;
        } else if (orig.includes('indicação') || orig.includes('indicacao') || orig.includes('indicou')) {
            porDia[dia].indicacao++;
        } else if (orig.includes('cliente') || orig.includes('já') || orig.includes('ja ')) {
            porDia[dia].jaSouCliente++;
        } else {
            porDia[dia].naoRespondeu++;
        }
    });

    console.log('  Data'.padEnd(15) + 'Total'.padEnd(8) + 'Agnd'.padEnd(7) + 'Insta'.padEnd(8) + 'Google'.padEnd(9) + 'Indic'.padEnd(8) + 'Cliente'.padEnd(10) + 'N/A');
    console.log('─────────────────────────────────────────────────────────────────────');

    Object.entries(porDia).sort().forEach(function (entry) {
        var d = entry[1];
        console.log('  ' + entry[0].padEnd(13) + String(d.total).padEnd(8) + String(d.agendaram).padEnd(7) + String(d.instagram).padEnd(8) + String(d.google).padEnd(9) + String(d.indicacao).padEnd(8) + String(d.jaSouCliente).padEnd(10) + d.naoRespondeu);
    });

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  FIM DO RELATÓRIO');
    console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(function (e) { console.error('ERRO: ' + e.message); });
