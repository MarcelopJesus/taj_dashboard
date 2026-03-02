const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://vynilpckcxkahcyavtgy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0'
);

async function updateConvertidoParaAtivo() {
    console.log('=== ATUALIZAÇÃO DE STATUS: convertido → ativo ===\n');

    // PASSO 1: Contar quantos leads estão como "convertido"
    const { count: totalConvertidos, error: countError } = await supabase
        .from('taj_leads')
        .select('*', { count: 'exact', head: true })
        .eq('status_atendimento', 'convertido');

    if (countError) {
        console.error('❌ Erro ao contar leads convertidos:', countError.message);
        return;
    }

    console.log(`📊 Total de leads com status "convertido": ${totalConvertidos}`);

    if (totalConvertidos === 0) {
        console.log('✅ Nenhum lead com status "convertido" encontrado. Nada a fazer.');
        return;
    }

    // PASSO 2: Atualizar todos de "convertido" para "ativo"
    console.log(`\n🔄 Atualizando ${totalConvertidos} leads de "convertido" para "ativo"...`);

    const { data, error: updateError } = await supabase
        .from('taj_leads')
        .update({ status_atendimento: 'ativo' })
        .eq('status_atendimento', 'convertido')
        .select('chatid');

    if (updateError) {
        console.error('❌ Erro ao atualizar leads:', updateError.message);
        return;
    }

    console.log(`✅ ${data?.length || 0} leads atualizados com sucesso de "convertido" → "ativo"!`);

    // PASSO 3: Verificação final
    const { count: remainingConvertidos } = await supabase
        .from('taj_leads')
        .select('*', { count: 'exact', head: true })
        .eq('status_atendimento', 'convertido');

    const { count: totalAtivos } = await supabase
        .from('taj_leads')
        .select('*', { count: 'exact', head: true })
        .eq('status_atendimento', 'ativo');

    console.log(`\n📋 VERIFICAÇÃO FINAL:`);
    console.log(`   - Leads ainda como "convertido": ${remainingConvertidos}`);
    console.log(`   - Leads como "ativo": ${totalAtivos}`);
    console.log('\n✅ Processo concluído!');
}

updateConvertidoParaAtivo();
