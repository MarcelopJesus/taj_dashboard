const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function analisarMensagens() {
    console.log('🔍 ANALISANDO ESTRUTURA DAS MENSAGENS\n');
    console.log('='.repeat(80));

    // 1. Buscar uma conversa de exemplo
    const { data: leads } = await supabase
        .from('taj_leads')
        .select('chatid, nome')
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

    if (!leads || leads.length === 0) {
        console.log('Nenhum lead encontrado');
        return;
    }

    const chatId = leads[0].chatid;
    console.log(`Analisando conversa de: ${leads[0].nome || 'Sem nome'}`);
    console.log(`ChatID: ${chatId}\n`);

    // 2. Buscar todas as mensagens
    const { data: mensagens } = await supabase
        .from('taj_mensagens')
        .select('*')
        .eq('chatid', chatId)
        .order('timestamp', { ascending: true });

    console.log(`Total de mensagens: ${mensagens?.length || 0}\n`);

    if (!mensagens || mensagens.length === 0) {
        console.log('Nenhuma mensagem encontrada');
        return;
    }

    // 3. Analisar cada mensagem
    console.log('📋 PRIMEIRAS 10 MENSAGENS (ordenadas por timestamp):\n');
    console.log('-'.repeat(80));

    const primeiras10 = mensagens.slice(0, 10);

    for (let i = 0; i < primeiras10.length; i++) {
        const msg = primeiras10[i];
        const role = msg.conversation?.role || 'N/A';
        const texto = (msg.conversation?.parts?.[0]?.text || '').substring(0, 100);
        const timestamp = new Date(msg.timestamp).toLocaleString('pt-BR');

        console.log(`${i + 1}. [${timestamp}] ${role.toUpperCase()}`);
        console.log(`   ID: ${msg.id}`);
        console.log(`   Texto: ${texto}...`);
        console.log('');
    }

    // 4. Verificar problemas de ordenação
    console.log('='.repeat(80));
    console.log('📊 VERIFICANDO PROBLEMAS DE ORDENAÇÃO:\n');

    let problemasOrdenacao = 0;
    for (let i = 1; i < mensagens.length; i++) {
        const prev = new Date(mensagens[i - 1].timestamp).getTime();
        const curr = new Date(mensagens[i].timestamp).getTime();

        if (curr < prev) {
            problemasOrdenacao++;
            if (problemasOrdenacao <= 3) {
                console.log(`⚠️  Mensagem ${i + 1} tem timestamp ANTERIOR à mensagem ${i}`);
                console.log(`   Anterior: ${new Date(prev).toLocaleString('pt-BR')}`);
                console.log(`   Atual: ${new Date(curr).toLocaleString('pt-BR')}`);
            }
        }
    }

    if (problemasOrdenacao === 0) {
        console.log('✅ Todas as mensagens estão ordenadas corretamente por timestamp');
    } else {
        console.log(`\n❌ Total de problemas de ordenação: ${problemasOrdenacao}`);
    }

    // 5. Verificar se há mensagens duplicadas
    console.log('\n📊 VERIFICANDO DUPLICATAS:\n');

    const textosPorRole = {};
    let duplicatas = 0;

    for (const msg of mensagens) {
        const texto = msg.conversation?.parts?.[0]?.text || '';
        const chave = `${msg.conversation?.role}-${texto.substring(0, 50)}`;

        if (textosPorRole[chave]) {
            duplicatas++;
        } else {
            textosPorRole[chave] = true;
        }
    }

    console.log(`Mensagens potencialmente duplicadas: ${duplicatas}`);

    // 6. Verificar separação por dias
    console.log('\n📊 DISTRIBUIÇÃO POR DIA:\n');

    const porDia = {};
    for (const msg of mensagens) {
        const dia = new Date(msg.timestamp).toLocaleDateString('pt-BR');
        porDia[dia] = (porDia[dia] || 0) + 1;
    }

    Object.entries(porDia).sort().forEach(([dia, count]) => {
        console.log(`   ${dia}: ${count} mensagens`);
    });
}

analisarMensagens();
