const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function limparDuplicatas() {
    console.log('🧹 LIMPANDO DUPLICATAS DA TABELA taj_agendamentos\n');

    // 1. Buscar todos os agendamentos
    const { data: todos, error } = await supabase
        .from('taj_agendamentos')
        .select('*')
        .order('timestamp', { ascending: true });

    if (error) {
        console.error('Erro:', error);
        return;
    }

    console.log(`Total de registros antes: ${todos.length}\n`);

    // 2. Identificar duplicatas (mesmo chatid + codigo_agendamento)
    const vistos = new Map(); // chave -> primeiro registro
    const idsParaDeletar = [];

    for (const ag of todos) {
        const chave = `${ag.chatid}-${ag.codigo_agendamento}`;

        if (vistos.has(chave)) {
            // É uma duplicata - marcar para deletar
            idsParaDeletar.push(ag.id);
        } else {
            // Primeiro registro com essa chave - manter
            vistos.set(chave, ag);
        }
    }

    console.log(`Registros ÚNICOS: ${vistos.size}`);
    console.log(`Duplicatas a deletar: ${idsParaDeletar.length}\n`);

    if (idsParaDeletar.length === 0) {
        console.log('✅ Nenhuma duplicata encontrada!');
        return;
    }

    // 3. Deletar duplicatas em lotes (Supabase tem limite)
    const BATCH_SIZE = 100;
    let deletados = 0;

    for (let i = 0; i < idsParaDeletar.length; i += BATCH_SIZE) {
        const batch = idsParaDeletar.slice(i, i + BATCH_SIZE);

        const { error: deleteError } = await supabase
            .from('taj_agendamentos')
            .delete()
            .in('id', batch);

        if (deleteError) {
            console.error(`Erro ao deletar lote ${i}:`, deleteError);
        } else {
            deletados += batch.length;
            console.log(`Deletados: ${deletados}/${idsParaDeletar.length}`);
        }
    }

    console.log(`\n✅ Limpeza concluída! ${deletados} duplicatas removidas.`);

    // 4. Verificar resultado
    const { count } = await supabase
        .from('taj_agendamentos')
        .select('*', { count: 'exact', head: true });

    console.log(`\nTotal de registros após limpeza: ${count}`);
}

limparDuplicatas();
