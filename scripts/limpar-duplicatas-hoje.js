const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function limparDuplicatasHoje() {
    console.log('🧹 LIMPANDO DUPLICATAS DE HOJE\n');

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeFim = new Date();
    hojeFim.setHours(23, 59, 59, 999);

    // 1. Buscar agendamentos de HOJE
    const { data: agHoje, error } = await supabase
        .from('taj_agendamentos')
        .select('*')
        .gte('timestamp', hoje.toISOString())
        .lte('timestamp', hojeFim.toISOString())
        .order('timestamp', { ascending: true });

    if (error) {
        console.error('Erro:', error);
        return;
    }

    console.log(`Agendamentos de hoje: ${agHoje.length}\n`);

    // 2. Identificar duplicatas
    const vistos = new Map();
    const idsParaDeletar = [];

    for (const ag of agHoje) {
        const chave = `${ag.chatid}-${ag.codigo_agendamento}`;

        if (vistos.has(chave)) {
            idsParaDeletar.push(ag.id);
        } else {
            vistos.set(chave, ag);
        }
    }

    console.log(`Registros ÚNICOS hoje: ${vistos.size}`);
    console.log(`Duplicatas a deletar: ${idsParaDeletar.length}\n`);

    // Mostrar as duplicatas
    if (idsParaDeletar.length > 0) {
        console.log('Exemplos de duplicatas:');
        const duplicatasPorCodigo = {};
        for (const ag of agHoje) {
            const chave = `${ag.chatid}-${ag.codigo_agendamento}`;
            if (!duplicatasPorCodigo[chave]) {
                duplicatasPorCodigo[chave] = 0;
            }
            duplicatasPorCodigo[chave]++;
        }

        for (const [chave, count] of Object.entries(duplicatasPorCodigo)) {
            if (count > 1) {
                console.log(`   ${chave.split('-')[1]}: ${count} vezes`);
            }
        }

        // Deletar duplicatas
        console.log('\nDeletando duplicatas...');

        const BATCH_SIZE = 100;
        let deletados = 0;

        for (let i = 0; i < idsParaDeletar.length; i += BATCH_SIZE) {
            const batch = idsParaDeletar.slice(i, i + BATCH_SIZE);

            const { error: deleteError } = await supabase
                .from('taj_agendamentos')
                .delete()
                .in('id', batch);

            if (deleteError) {
                console.error(`Erro:`, deleteError);
            } else {
                deletados += batch.length;
            }
        }

        console.log(`✅ ${deletados} duplicatas removidas!`);
    }

    // 3. Verificar resultado final
    const { data: depois } = await supabase
        .from('taj_agendamentos')
        .select('chatid, codigo_agendamento')
        .gte('timestamp', hoje.toISOString())
        .lte('timestamp', hojeFim.toISOString());

    const chatIdsUnicos = new Set((depois || []).map(a => a.chatid));

    console.log(`\n📊 RESULTADO APÓS LIMPEZA:`);
    console.log(`   Agendamentos únicos hoje: ${depois?.length || 0}`);
    console.log(`   ChatIds únicos: ${chatIdsUnicos.size}`);
}

limparDuplicatasHoje();
