const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function investigarHoje() {
    console.log('🔍 INVESTIGANDO AGENDAMENTOS DE HOJE (06/02/2026)\n');

    // Data de hoje
    const hoje = new Date('2026-02-06');
    hoje.setHours(0, 0, 0, 0);
    const hojeStart = hoje.toISOString();

    const hojeFim = new Date('2026-02-06');
    hojeFim.setHours(23, 59, 59, 999);
    const hojeEnd = hojeFim.toISOString();

    console.log(`📅 Range: ${hojeStart} até ${hojeEnd}\n`);

    // 1. Buscar todos agendamentos de hoje
    const { data: agendamentosHoje, count } = await supabase
        .from('taj_agendamentos')
        .select('*', { count: 'exact' })
        .gte('timestamp', hojeStart)
        .lte('timestamp', hojeEnd);

    console.log(`📊 Total de agendamentos de HOJE (por timestamp): ${count}`);
    console.log(`📊 Registros retornados: ${agendamentosHoje?.length || 0}\n`);

    if (agendamentosHoje && agendamentosHoje.length > 0) {
        console.log('📋 LISTA DE AGENDAMENTOS DE HOJE:\n');

        // Agrupar por chatid para ver duplicatas
        const porChatId = {};
        for (const ag of agendamentosHoje) {
            if (!porChatId[ag.chatid]) {
                porChatId[ag.chatid] = [];
            }
            porChatId[ag.chatid].push({
                codigo: ag.codigo_agendamento,
                timestamp: ag.timestamp,
                data_agendamento: ag.data_agendamento
            });
        }

        // Verificar duplicatas (mesmo chatid + codigo)
        let duplicatas = 0;
        const codigosVistos = new Set();

        for (const ag of agendamentosHoje) {
            const chave = `${ag.chatid}-${ag.codigo_agendamento}`;
            if (codigosVistos.has(chave)) {
                duplicatas++;
                console.log(`⚠️  DUPLICATA: ${ag.chatid.substring(0, 15)}... - Código: ${ag.codigo_agendamento}`);
            } else {
                codigosVistos.add(chave);
            }
        }

        console.log(`\n📊 Chatids únicos hoje: ${Object.keys(porChatId).length}`);
        console.log(`⚠️  Duplicatas encontradas (mesmo chatid+codigo): ${duplicatas}`);

        // Mostrar leads com múltiplos agendamentos hoje
        const leadsMultiplos = Object.entries(porChatId).filter(([_, ags]) => ags.length > 1);
        if (leadsMultiplos.length > 0) {
            console.log(`\n📌 Leads com múltiplos registros hoje: ${leadsMultiplos.length}`);
            for (const [chatid, ags] of leadsMultiplos.slice(0, 5)) {
                console.log(`   - ${chatid.substring(0, 20)}...`);
                for (const ag of ags) {
                    console.log(`     Código: ${ag.codigo}, Timestamp: ${ag.timestamp}`);
                }
            }
        }
    }

    // 2. Verificar leads de hoje
    const { count: leadsHoje } = await supabase
        .from('taj_leads')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', hojeStart)
        .lte('timestamp', hojeEnd);

    console.log(`\n👥 Total de LEADS hoje: ${leadsHoje}`);

    // 3. Agendamentos baseado em data_agendamento (não timestamp de criação)
    const { data: agendamentosParaHoje, count: countParaHoje } = await supabase
        .from('taj_agendamentos')
        .select('*', { count: 'exact' })
        .eq('data_agendamento', '2026-02-06');

    console.log(`\n📅 Agendamentos com DATA_AGENDAMENTO = 06/02: ${countParaHoje || 0}`);

    // 4. Calcular taxa
    if (leadsHoje && leadsHoje > 0) {
        const taxa = ((count || 0) / leadsHoje) * 100;
        console.log(`\n📈 Taxa de conversão hoje: ${taxa.toFixed(1)}%`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('💡 O CARD mostra agendamentos filtrados por TIMESTAMP do registro');
    console.log('💡 O GRÁFICO mostra agendamentos baseado em CHATIDS únicos dos leads');
    console.log('='.repeat(70));
}

investigarHoje();
