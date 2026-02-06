const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function limparTodasDuplicatas() {
    console.log('🧹 LIMPANDO TODAS AS DUPLICATAS DA BASE\n');

    // 1. Buscar TODOS os agendamentos usando paginação
    const todosAgendamentos = [];
    let offset = 0;
    const PAGE_SIZE = 1000;

    console.log('Buscando todos os agendamentos...');
    while (true) {
        const { data, error } = await supabase
            .from('taj_agendamentos')
            .select('id, chatid, codigo_agendamento, timestamp')
            .order('timestamp', { ascending: true })
            .range(offset, offset + PAGE_SIZE - 1);

        if (error) {
            console.error('Erro:', error);
            break;
        }

        if (!data || data.length === 0) break;
        todosAgendamentos.push(...data);
        console.log(`   Carregados: ${todosAgendamentos.length}`);
        offset += PAGE_SIZE;
        if (data.length < PAGE_SIZE) break;
    }

    console.log(`\nTotal de registros: ${todosAgendamentos.length}\n`);

    // 2. Identificar duplicatas (manter apenas o primeiro de cada chatid+codigo)
    const vistos = new Map();
    const idsParaDeletar = [];

    for (const ag of todosAgendamentos) {
        const chave = `${ag.chatid}-${ag.codigo_agendamento}`;

        if (vistos.has(chave)) {
            idsParaDeletar.push(ag.id);
        } else {
            vistos.set(chave, ag);
        }
    }

    console.log(`Registros ÚNICOS: ${vistos.size}`);
    console.log(`Duplicatas a deletar: ${idsParaDeletar.length}\n`);

    if (idsParaDeletar.length === 0) {
        console.log('✅ Nenhuma duplicata encontrada!');
        return;
    }

    // 3. Deletar em lotes
    console.log('Deletando duplicatas...');
    const BATCH_SIZE = 100;
    let deletados = 0;

    for (let i = 0; i < idsParaDeletar.length; i += BATCH_SIZE) {
        const batch = idsParaDeletar.slice(i, i + BATCH_SIZE);

        const { error } = await supabase
            .from('taj_agendamentos')
            .delete()
            .in('id', batch);

        if (error) {
            console.error(`Erro no lote ${i}:`, error);
        } else {
            deletados += batch.length;
            if (deletados % 500 === 0 || deletados === idsParaDeletar.length) {
                console.log(`   Deletados: ${deletados}/${idsParaDeletar.length}`);
            }
        }
    }

    console.log(`\n✅ ${deletados} duplicatas removidas!`);

    // 4. Verificar resultado
    let totalFinal = 0;
    offset = 0;
    while (true) {
        const { data } = await supabase
            .from('taj_agendamentos')
            .select('id')
            .range(offset, offset + PAGE_SIZE - 1);
        if (!data || data.length === 0) break;
        totalFinal += data.length;
        offset += PAGE_SIZE;
        if (data.length < PAGE_SIZE) break;
    }

    console.log(`Total de registros após limpeza: ${totalFinal}`);
}

limparTodasDuplicatas();
