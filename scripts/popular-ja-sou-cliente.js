/**
 * Script para popular origem_cliente_taj = "Já sou cliente"
 * para todos os leads que já efetuaram um agendamento
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://vynilpckcxkahcyavtgy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0'
);

async function popularJaSouCliente() {
    console.log('🔄 Iniciando processo de popular "Já sou cliente"...\n');

    try {
        // 1. Buscar todos os chatIds que têm agendamento
        console.log('1. Buscando todos os agendamentos...');
        const { data: agendamentos, error: agendError } = await supabase
            .from('taj_agendamentos')
            .select('chatid');

        if (agendError) {
            throw new Error(`Erro ao buscar agendamentos: ${agendError.message}`);
        }

        // Criar Set de chatIds únicos com agendamento
        const chatIdsComAgendamento = [...new Set(agendamentos.map(a => a.chatid))];
        console.log(`   ✅ Encontrados ${chatIdsComAgendamento.length} chatIds únicos com agendamento\n`);

        // 2. Atualizar diretamente os leads em batches de chatIds
        console.log('2. Atualizando leads em batches...');
        const batchSize = 50;
        let updated = 0;
        let errors = 0;

        for (let i = 0; i < chatIdsComAgendamento.length; i += batchSize) {
            const batchChatIds = chatIdsComAgendamento.slice(i, i + batchSize);

            const { data, error: updateError } = await supabase
                .from('taj_leads')
                .update({ origem_cliente_taj: 'Já sou cliente' })
                .in('chatid', batchChatIds)
                .neq('origem_cliente_taj', 'Já sou cliente')
                .select('id');

            if (updateError) {
                console.error(`   ❌ Erro no batch ${Math.floor(i / batchSize) + 1}: ${updateError.message}`);
                errors++;
            } else {
                const count = data?.length || 0;
                updated += count;
                if (count > 0) {
                    console.log(`   ✅ Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chatIdsComAgendamento.length / batchSize)} - Atualizados: ${count}`);
                }
            }
        }

        console.log('\n========================================');
        console.log('📊 RESUMO DA EXECUÇÃO:');
        console.log('========================================');
        console.log(`   Total de chatIds com agendamento: ${chatIdsComAgendamento.length}`);
        console.log(`   Leads atualizados com sucesso: ${updated}`);
        console.log(`   Erros: ${errors}`);
        console.log('========================================\n');

        if (updated > 0) {
            console.log('✅ Processo concluído com sucesso!');
            console.log('   Os leads que já fizeram agendamento agora estão marcados como "Já sou cliente"');
        }

    } catch (error) {
        console.error('❌ Erro fatal:', error.message);
        process.exit(1);
    }
}

// Executar
popularJaSouCliente();
