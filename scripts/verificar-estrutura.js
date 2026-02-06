const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verificarEstrutura() {
    // Verificar se podemos usar upsert com onConflict
    console.log('🔍 Testando inserção com onConflict...\n');

    // Inserir um registro de teste
    const testRecord = {
        chatid: 'teste@test.com',
        codigo_agendamento: '#0000001',
        timestamp: new Date().toISOString(),
        nome_cliente: 'Teste'
    };

    // Tentar upsert
    const { data, error } = await supabase
        .from('taj_agendamentos')
        .upsert(testRecord, {
            onConflict: 'chatid,codigo_agendamento',
            ignoreDuplicates: true
        })
        .select();

    if (error) {
        console.log('❌ Erro ao tentar upsert:', error.message);
        console.log('\n⚠️  A tabela não tem uma constraint única em (chatid, codigo_agendamento)');
        console.log('   Precisamos criar essa constraint no Supabase');
    } else {
        console.log('✅ Upsert funcionou!');

        // Limpar registro de teste
        await supabase
            .from('taj_agendamentos')
            .delete()
            .eq('chatid', 'teste@test.com');

        console.log('   Registro de teste removido');
    }
}

verificarEstrutura();
