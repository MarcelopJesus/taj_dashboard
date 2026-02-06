/**
 * ANÁLISE DE PERGUNTAS RECORRENTES DOS CLIENTES
 * Identifica padrões de perguntas que a Duda pode não estar respondendo bem
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Padrões de perguntas problemáticas baseadas no feedback do dono
const PADROES_PERGUNTAS = {
    // Sobre terapeutas específicas (pode não estar mais no time)
    terapeuta_especifica: {
        patterns: [
            /t(?:á|a) na casa/i,
            /está na casa/i,
            /trabalha hoje/i,
            /ainda trabalha/i,
            /tem horário com a?\s*(\w+)/i,
            /quero a?\s*(\w+)/i,
            /gostei d[ao]\s*(\w+)/i
        ],
        categoria: 'Sobre Terapeuta Específica'
    },

    // Comparação/Similaridade (precisa de descrições)
    comparacao: {
        patterns: [
            /estilo d[aeo]/i,
            /parecid[ao]/i,
            /similar/i,
            /tipo d[aeo]/i,
            /mesmo estilo/i,
            /quem (?:faz|é) (?:igual|parecid)/i,
            /alguma (?:parecida|similar)/i
        ],
        categoria: 'Comparação/Similaridade'
    },

    // Perguntas sobre serviços específicos (risco de ambiguidade)
    servicos_especificos: {
        patterns: [
            /faz anal/i,
            /faz oral/i,
            /tem sexo/i,
            /sexo oral/i,
            /penetra/i,
            /relação/i,
            /beijo/i,
            /beija/i,
            /goza/i,
            /finaliza/i,
            /finalização/i,
            /completo/i,
            /liberal/i,
            /mais liberal/i,
            /fetiche/i,
            /dominação/i,
            /submiss/i,
            /bdsm/i,
            /bate/i,
            /apanha/i
        ],
        categoria: 'Serviços Específicos/Fetiches'
    },

    // Preços
    precos: {
        patterns: [
            /quanto (?:é|custa)/i,
            /qual (?:o )?valor/i,
            /preço/i,
            /valores/i,
            /tabela/i,
            /promoção/i,
            /desconto/i,
            /pacote/i
        ],
        categoria: 'Preços/Valores'
    },

    // Horários
    horarios: {
        patterns: [
            /que hora/i,
            /horário/i,
            /disponível/i,
            /agenda/i,
            /quando/i,
            /amanhã/i,
            /hoje/i,
            /fim de semana/i,
            /sábado/i,
            /domingo/i
        ],
        categoria: 'Horários/Disponibilidade'
    },

    // Cliente que já conhece
    cliente_casa: {
        patterns: [
            /já (?:sou|fui) cliente/i,
            /já conheço/i,
            /já fui/i,
            /voltei/i,
            /de novo/i,
            /outra vez/i,
            /indicação/i,
            /indicaram/i,
            /amigo (?:me )?indic/i
        ],
        categoria: 'Cliente da Casa/Indicação'
    },

    // Dúvidas sobre funcionamento
    funcionamento: {
        patterns: [
            /como funciona/i,
            /como é/i,
            /o que é/i,
            /pode explicar/i,
            /qual a diferença/i,
            /tântrica/i,
            /nuru/i,
            /sensitiva/i,
            /tailandesa/i
        ],
        categoria: 'Funcionamento/Dúvidas'
    },

    // Localização/Estrutura
    localizacao: {
        patterns: [
            /onde fica/i,
            /endereço/i,
            /localização/i,
            /estacionamento/i,
            /como chego/i,
            /perto de/i,
            /moema/i
        ],
        categoria: 'Localização/Estrutura'
    },

    // Fotos
    fotos: {
        patterns: [
            /foto/i,
            /mais foto/i,
            /galeria/i,
            /ver (?:ela|as meninas)/i,
            /como (?:ela|elas) (?:é|são)/i,
            /tem video/i
        ],
        categoria: 'Fotos/Galeria'
    },

    // Atendimentos especiais
    especiais: {
        patterns: [
            /casal/i,
            /minha (?:esposa|namorada|mulher)/i,
            /four hands/i,
            /4 mãos/i,
            /duas terapeutas/i,
            /homem/i,
            /terapeuta masculin/i,
            /massagista homem/i,
            /mulher atende/i
        ],
        categoria: 'Atendimentos Especiais'
    }
};

async function analisarPerguntasRecorrentes() {
    console.log('🔍 ANALISANDO PERGUNTAS RECORRENTES DOS CLIENTES...\n');
    console.log('='.repeat(80));

    // Buscar mensagens
    console.log('\n📊 Buscando mensagens...');
    let todasMensagens = [];
    let offset = 0;
    const batchSize = 1000;

    while (true) {
        const { data } = await supabase
            .from('taj_mensagens')
            .select('chatid, conversation, timestamp')
            .order('timestamp', { ascending: false })
            .range(offset, offset + batchSize - 1);

        if (!data || data.length === 0) break;
        todasMensagens = todasMensagens.concat(data);
        offset += batchSize;

        if (offset % 10000 === 0) {
            console.log(`   → ${todasMensagens.length} mensagens carregadas...`);
        }
        if (data.length < batchSize) break;
    }

    console.log(`\n✅ ${todasMensagens.length} mensagens carregadas!\n`);

    // Buscar agendamentos para saber quem converteu
    const { data: agendamentos } = await supabase
        .from('taj_agendamentos')
        .select('chatid');

    const chatidsConvertidos = new Set(agendamentos?.map(a => a.chatid) || []);

    // Contadores
    const contadorCategorias = {};
    const exemplosPerguntas = {};
    const perguntasSemConversao = {};

    // Inicializar contadores
    for (const key in PADROES_PERGUNTAS) {
        const categoria = PADROES_PERGUNTAS[key].categoria;
        contadorCategorias[categoria] = { total: 0, semConversao: 0 };
        exemplosPerguntas[categoria] = [];
        perguntasSemConversao[categoria] = [];
    }

    // Analisar cada mensagem
    console.log('🔬 Analisando padrões de perguntas...\n');

    for (const msg of todasMensagens) {
        // Extrair texto da mensagem
        let texto = '';
        try {
            if (msg.conversation?.parts?.[0]?.text) {
                texto = msg.conversation.parts[0].text;
            } else if (typeof msg.conversation === 'string') {
                texto = msg.conversation;
            }
        } catch (e) {
            continue;
        }

        if (!texto || texto.length < 3) continue;

        // Verificar se é mensagem do cliente (não do bot)
        // Geralmente mensagens do bot são longas e formatadas
        const isBot = texto.includes('Taj Mahal Spa') ||
            texto.includes('sou a Duda') ||
            texto.includes('✨') ||
            texto.length > 500;

        if (isBot) continue;

        // Checar cada padrão
        for (const key in PADROES_PERGUNTAS) {
            const { patterns, categoria } = PADROES_PERGUNTAS[key];

            for (const pattern of patterns) {
                if (pattern.test(texto)) {
                    contadorCategorias[categoria].total++;

                    // Verificar se converteu
                    const converteu = chatidsConvertidos.has(msg.chatid);
                    if (!converteu) {
                        contadorCategorias[categoria].semConversao++;

                        // Guardar exemplo
                        if (perguntasSemConversao[categoria].length < 10) {
                            perguntasSemConversao[categoria].push({
                                texto: texto.substring(0, 200),
                                chatid: msg.chatid
                            });
                        }
                    }

                    // Guardar exemplo geral
                    if (exemplosPerguntas[categoria].length < 5) {
                        exemplosPerguntas[categoria].push(texto.substring(0, 150));
                    }

                    break; // Não contar a mesma mensagem duas vezes na mesma categoria
                }
            }
        }
    }

    // Ordenar categorias por número de perguntas sem conversão
    const categoriasOrdenadas = Object.entries(contadorCategorias)
        .sort((a, b) => b[1].semConversao - a[1].semConversao);

    // Exibir resultados
    console.log('='.repeat(80));
    console.log('📊 RANKING DE PERGUNTAS MAIS RECORRENTES (SEM CONVERSÃO)');
    console.log('='.repeat(80));
    console.log('');
    console.log('| # | CATEGORIA                        | TOTAL | SEM CONV. | % ABANDONO |');
    console.log('|---|----------------------------------|-------|-----------|------------|');

    let ranking = 1;
    for (const [categoria, dados] of categoriasOrdenadas) {
        if (dados.total === 0) continue;

        const taxaAbandono = ((dados.semConversao / dados.total) * 100).toFixed(1);
        console.log(`| ${ranking.toString().padStart(1)} | ${categoria.padEnd(32)} | ${dados.total.toString().padStart(5)} | ${dados.semConversao.toString().padStart(9)} | ${taxaAbandono.padStart(9)}% |`);
        ranking++;
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('📋 EXEMPLOS DE PERGUNTAS QUE NÃO CONVERTERAM');
    console.log('='.repeat(80));

    for (const [categoria, dados] of categoriasOrdenadas) {
        if (perguntasSemConversao[categoria].length === 0) continue;

        console.log(`\n🔴 ${categoria.toUpperCase()}`);
        console.log('-'.repeat(60));

        for (let i = 0; i < Math.min(5, perguntasSemConversao[categoria].length); i++) {
            const ex = perguntasSemConversao[categoria][i];
            console.log(`   ${i + 1}. "${ex.texto}"`);
        }
    }

    // Análise específica para o feedback do dono
    console.log('\n');
    console.log('='.repeat(80));
    console.log('🎯 PROBLEMAS IDENTIFICADOS (BASEADO NO FEEDBACK DO DONO)');
    console.log('='.repeat(80));

    console.log(`
📌 PROBLEMA 1: Terapeuta Específica
   - Total de perguntas: ${contadorCategorias['Sobre Terapeuta Específica']?.total || 0}
   - Sem conversão: ${contadorCategorias['Sobre Terapeuta Específica']?.semConversao || 0}
   - AÇÃO: Melhorar resposta quando terapeuta não está mais no time
   - AÇÃO: Sugerir alternativas similares

📌 PROBLEMA 2: Comparação/Similaridade (PRECISA DE DESCRIÇÕES)
   - Total de perguntas: ${contadorCategorias['Comparação/Similaridade']?.total || 0}
   - Sem conversão: ${contadorCategorias['Comparação/Similaridade']?.semConversao || 0}
   - AÇÃO: Solicitar descrições detalhadas das terapeutas
   - CAMPOS NECESSÁRIOS:
     * Tipo físico (magra, curvilínea, etc.)
     * Estilo de atendimento (carinhosa, intensa, dominadora, etc.)
     * Fetiches que pratica
     * Personalidade

📌 PROBLEMA 3: Serviços Específicos/Fetiches (RISCO DE AMBIGUIDADE)
   - Total de perguntas: ${contadorCategorias['Serviços Específicos/Fetiches']?.total || 0}
   - Sem conversão: ${contadorCategorias['Serviços Específicos/Fetiches']?.semConversao || 0}
   - AÇÃO: Definir respostas específicas por tipo de serviço
   - AÇÃO: Evitar respostas genéricas como "completo"

📌 PROBLEMA 4: Diferenciação por Origem
   - Cliente da casa/Indicação: ${contadorCategorias['Cliente da Casa/Indicação']?.total || 0} perguntas
   - AÇÃO: Implementar fluxo diferente por origem do lead
`);

    console.log('✅ Análise concluída!\n');
}

analisarPerguntasRecorrentes().catch(console.error);
