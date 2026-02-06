const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnosticarProblema() {
    console.log('🔍 DIAGNÓSTICO COMPLETO DO PROBLEMA\n');

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeFim = new Date();
    hojeFim.setHours(23, 59, 59, 999);

    console.log(`📅 Período "HOJE": ${hoje.toISOString()} até ${hojeFim.toISOString()}\n`);

    // 1. Buscar todos agendamentos com timestamp de hoje
    const { data: agHoje } = await supabase
        .from('taj_agendamentos')
        .select('chatid, codigo_agendamento, timestamp, data_agendamento')
        .gte('timestamp', hoje.toISOString())
        .lte('timestamp', hojeFim.toISOString())
        .order('timestamp', { ascending: true });

    console.log(`📊 Total de agendamentos com TIMESTAMP de hoje: ${agHoje?.length || 0}\n`);

    // 2. Verificar quais desses leads realmente entraram hoje
    const { data: leadsHoje } = await supabase
        .from('taj_leads')
        .select('chatid, timestamp, nome')
        .gte('timestamp', hoje.toISOString())
        .lte('timestamp', hojeFim.toISOString());

    const chatIdsLeadsHoje = new Set((leadsHoje || []).map(l => l.chatid));
    console.log(`👥 Leads que ENTRARAM hoje: ${chatIdsLeadsHoje.size}\n`);

    // 3. Classificar os agendamentos
    const agendamentosDeLeadsHoje = [];
    const agendamentosDeLeadsAntigos = [];

    for (const ag of agHoje || []) {
        if (chatIdsLeadsHoje.has(ag.chatid)) {
            agendamentosDeLeadsHoje.push(ag);
        } else {
            agendamentosDeLeadsAntigos.push(ag);
        }
    }

    console.log('📊 CLASSIFICAÇÃO DOS AGENDAMENTOS:');
    console.log(`   ✅ De leads que ENTRARAM hoje: ${agendamentosDeLeadsHoje.length}`);
    console.log(`   ⚠️  De leads ANTIGOS (reprocessados): ${agendamentosDeLeadsAntigos.length}\n`);

    // 4. Mostrar alguns exemplos de leads antigos
    if (agendamentosDeLeadsAntigos.length > 0) {
        console.log('🔍 EXEMPLOS de agendamentos de leads ANTIGOS (não deveriam estar aqui):');
        for (const ag of agendamentosDeLeadsAntigos.slice(0, 5)) {
            // Buscar quando o lead realmente entrou
            const { data: lead } = await supabase
                .from('taj_leads')
                .select('timestamp, nome')
                .eq('chatid', ag.chatid)
                .single();

            console.log(`   - Código: ${ag.codigo_agendamento}`);
            console.log(`     Timestamp agendamento: ${ag.timestamp}`);
            console.log(`     Lead entrou em: ${lead?.timestamp || 'N/A'}`);
            console.log(`     Nome: ${lead?.nome || 'N/A'}`);
            console.log('');
        }
    }

    // 5. Verificar chatids únicos
    const chatIdsUnicos = new Set((agHoje || []).map(a => a.chatid));
    console.log(`\n📊 ChatIds ÚNICOS com agendamento hoje: ${chatIdsUnicos.size}`);

    // 6. O número correto deveria ser
    const chatIdsQueDeveriamContar = new Set(
        agendamentosDeLeadsHoje.map(a => a.chatid)
    );

    console.log(`\n✅ NÚMERO CORRETO DE AGENDAMENTOS HOJE: ${chatIdsQueDeveriamContar.size}`);
    console.log(`   (Contando apenas leads que ENTRARAM hoje)`);

    console.log('\n' + '='.repeat(70));
    console.log('🐛 PROBLEMA IDENTIFICADO:');
    console.log('='.repeat(70));
    console.log(`
O filtro de agendamentos usa o campo "timestamp" do registro de agendamento,
que é o momento em que o agendamento foi DETECTADO/SINCRONIZADO, não quando
o lead ENTROU no sistema.

Quando você clica em "Atualizar", o sistema re-processa mensagens das últimas
24 horas e pode inserir agendamentos "novos" de leads antigos com timestamp
de HOJE, inflando o número artificialmente.

SOLUÇÃO: Usar o timestamp do LEAD para filtrar, não do agendamento.
Ou seja, contar agendamentos de leads que entraram no período selecionado.
`);
}

diagnosticarProblema();
