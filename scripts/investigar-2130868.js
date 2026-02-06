const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verificarMensagem2130868() {
    console.log('🔍 Investigando o código #2130868\n');

    // Listar agendamentos com esse código
    const { data: agendamentos } = await supabase
        .from('taj_agendamentos')
        .select('*')
        .eq('codigo_agendamento', '#2130868');

    console.log(`Total de registros com código #2130868: ${agendamentos?.length || 0}`);

    if (agendamentos && agendamentos.length > 0) {
        const chatid = agendamentos[0].chatid;
        console.log(`ChatID: ${chatid}\n`);

        // Buscar mensagens desse chat das últimas 24h
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);

        const { data: mensagens } = await supabase
            .from('taj_mensagens')
            .select('conversation, timestamp')
            .eq('chatid', chatid)
            .gte('timestamp', yesterday.toISOString())
            .order('timestamp', { ascending: true });

        console.log(`Mensagens nas últimas 24h: ${mensagens?.length || 0}\n`);

        // Procurar mensagens que contêm o código
        let countMensagensComCodigo = 0;
        for (const msg of mensagens || []) {
            if (msg.conversation && msg.conversation.role === 'model') {
                const texto = (msg.conversation.parts && msg.conversation.parts[0] && msg.conversation.parts[0].text) || '';
                const matches = texto.match(/2130868/g);
                if (matches) {
                    countMensagensComCodigo++;
                    console.log(`\n📩 Mensagem com código encontrada:`);
                    console.log(`   Timestamp: ${msg.timestamp}`);
                    console.log(`   Ocorrências do código: ${matches.length}`);
                    console.log(`   Trecho da mensagem:`);
                    console.log(`   "${texto.substring(0, 500)}..."`);
                }
            }
        }

        console.log(`\n\n📊 RESUMO:`);
        console.log(`   - Registros na tabela taj_agendamentos: ${agendamentos.length}`);
        console.log(`   - Mensagens que contêm o código: ${countMensagensComCodigo}`);

        if (countMensagensComCodigo > 1) {
            console.log('\n⚠️  PROBLEMA: O código aparece em MÚLTIPLAS mensagens!');
            console.log('   Cada vez que o auto-refresh roda, ele detecta todas essas mensagens');
            console.log('   e tenta inserir o agendamento novamente.');
        }
    }
}

verificarMensagem2130868();
