/**
 * ANÁLISE DE BUSINESS INTELLIGENCE - PONTOS DE ABANDONO
 * 
 * Objetivo: Identificar EXATAMENTE onde os leads não convertidos param de responder
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Padrões de detecção por tópico
const PADROES = {
    precos: {
        keywords: ['valor', 'preço', 'quanto', 'custa', 'investimento', 'r$', 'reais', 'pagar', 'custo', 'cobrar'],
        nome: 'Preços/Valores'
    },
    horarios: {
        keywords: ['horário', 'hora', 'disponível', 'agenda', 'quando', 'dia', 'semana', 'amanhã', 'hoje'],
        nome: 'Horários/Agendamento'
    },
    terapeutas: {
        keywords: ['terapeuta', 'profissional', 'massagista', 'quem', 'atende', 'especialista', 'pessoa'],
        nome: 'Terapeutas/Profissionais'
    },
    servicos: {
        keywords: ['massagem', 'terapia', 'tratamento', 'serviço', 'tipo', 'modalidade', 'técnica'],
        nome: 'Serviços/Tratamentos'
    },
    localizacao: {
        keywords: ['endereço', 'onde', 'local', 'fica', 'rua', 'bairro', 'região', 'longe', 'perto'],
        nome: 'Localização'
    },
    duvidas: {
        keywords: ['dúvida', 'pergunta', 'como funciona', 'explicar', 'entender', 'saber'],
        nome: 'Dúvidas Gerais'
    },
    confirmacao: {
        keywords: ['confirmar', 'confirmo', 'código', 'agendamento', 'marcado', 'reserva'],
        nome: 'Confirmação de Agendamento'
    }
};

/**
 * Identifica o tópico sendo discutido baseado no texto
 */
function identificarTopico(texto) {
    if (!texto) return 'Sem interação';

    const textoLower = texto.toLowerCase();
    const topicosEncontrados = [];

    for (const [chave, config] of Object.entries(PADROES)) {
        const encontrou = config.keywords.some(k => textoLower.includes(k));
        if (encontrou) {
            topicosEncontrados.push(config.nome);
        }
    }

    return topicosEncontrados.length > 0 ? topicosEncontrados : ['Conversa Inicial/Geral'];
}

/**
 * Analisa uma conversa individual
 */
function analisarConversa(mensagens) {
    if (!mensagens || mensagens.length === 0) {
        return {
            totalMensagens: 0,
            ultimaMensagemDe: 'Nenhuma',
            ultimoTopico: 'Sem interação',
            textoUltimaMensagem: '',
            foiRespondidasPeloLead: false
        };
    }

    // Ordenar por timestamp
    const mensagensOrdenadas = [...mensagens].sort((a, b) =>
        new Date(a.timestamp) - new Date(b.timestamp)
    );

    const ultimaMensagem = mensagensOrdenadas[mensagensOrdenadas.length - 1];
    const penultimaMensagem = mensagensOrdenadas.length > 1 ? mensagensOrdenadas[mensagensOrdenadas.length - 2] : null;

    // Quem deu a última mensagem
    const roleUltima = ultimaMensagem.conversation?.role;
    const ultimaMensagemDe = roleUltima === 'model' ? 'Bot' : roleUltima === 'user' ? 'Lead' : 'Desconhecido';

    // Texto das últimas mensagens para identificar tópico
    const textoUltima = ultimaMensagem.conversation?.parts?.[0]?.text || '';
    const textoPenultima = penultimaMensagem?.conversation?.parts?.[0]?.text || '';
    const textoContexto = textoPenultima + ' ' + textoUltima;

    // Identificar tópico
    const topicos = identificarTopico(textoContexto);

    // Verificar se lead respondeu (tem pelo menos 1 mensagem do tipo 'user')
    const foiRespondidasPeloLead = mensagensOrdenadas.some(m => m.conversation?.role === 'user');

    return {
        totalMensagens: mensagensOrdenadas.length,
        ultimaMensagemDe,
        ultimoTopico: topicos[0] || 'Indefinido',
        todosTopicos: topicos,
        textoUltimaMensagem: textoUltima.substring(0, 100), // Primeiros 100 caracteres
        foiRespondidasPeloLead
    };
}

async function analiseBIAbandono() {
    console.log('🔍 ANÁLISE DE BUSINESS INTELLIGENCE - PONTOS DE ABANDONO\n');
    console.log('='.repeat(80));

    // 1. Buscar TODOS os leads (sem limitação)
    console.log('\n📊 Buscando TODOS os leads...');

    let todosLeads = [];
    let offset = 0;
    const batchSize = 1000;

    while (true) {
        const { data } = await supabase
            .from('taj_leads')
            .select('chatid, nome')
            .range(offset, offset + batchSize - 1);

        if (!data || data.length === 0) break;
        todosLeads = todosLeads.concat(data);
        offset += batchSize;
        console.log(`   → ${todosLeads.length} leads carregados...`);

        if (data.length < batchSize) break;
    }

    // 2. Buscar todos os agendamentos
    console.log('\n📅 Buscando agendamentos...');
    const { data: agendamentos } = await supabase
        .from('taj_agendamentos')
        .select('chatid');

    const chatidsComAgendamento = new Set(agendamentos.map(a => a.chatid));

    // 3. Separar quem agendou vs quem não agendou
    const leadsQueAgendaram = todosLeads.filter(l => chatidsComAgendamento.has(l.chatid));
    const leadsQueNaoAgendaram = todosLeads.filter(l => !chatidsComAgendamento.has(l.chatid));

    console.log(`\n✅ Total de Leads: ${todosLeads.length}`);
    console.log(`✅ Leads que AGENDARAM: ${leadsQueAgendaram.length} (${(leadsQueAgendaram.length / todosLeads.length * 100).toFixed(1)}%)`);
    console.log(`❌ Leads que NÃO AGENDARAM: ${leadsQueNaoAgendaram.length} (${(leadsQueNaoAgendaram.length / todosLeads.length * 100).toFixed(1)}%)`);

    // 4. Buscar TODAS as mensagens (80k+ registros, vai demorar)
    console.log('\n💬 Buscando TODAS as mensagens (pode levar 2-3 minutos)...');

    let todasMensagens = [];
    offset = 0;

    while (true) {
        const { data } = await supabase
            .from('taj_mensagens')
            .select('chatid, conversation, timestamp')
            .order('timestamp', { ascending: true })
            .range(offset, offset + batchSize - 1);

        if (!data || data.length === 0) break;
        todasMensagens = todasMensagens.concat(data);
        offset += batchSize;
        console.log(`   → ${todasMensagens.length} mensagens carregadas...`);

        if (data.length < batchSize) break;
    }

    console.log(`\n✅ Total de mensagens carregadas: ${todasMensagens.length}`);

    // 5. Agrupar mensagens por chatid
    const mensagensPorChat = {};
    for (const msg of todasMensagens) {
        if (!mensagensPorChat[msg.chatid]) {
            mensagensPorChat[msg.chatid] = [];
        }
        mensagensPorChat[msg.chatid].push(msg);
    }

    // 6. Analisar leads que NÃO AGENDARAM
    console.log('\n🔬 Analisando pontos de abandono...\n');

    const analiseAbandono = {
        semInteracao: 0,
        abandonoPorTopico: {},
        abandonoPorQuemDeuUltimaMensagem: {
            Bot: 0,
            Lead: 0,
            Desconhecido: 0
        },
        distribuicaoMensagens: {
            '0': 0,
            '1-2': 0,
            '3-5': 0,
            '6-10': 0,
            '11-20': 0,
            '20+': 0
        },
        exemplosDetalhados: []
    };

    for (const lead of leadsQueNaoAgendaram) {
        const mensagens = mensagensPorChat[lead.chatid] || [];
        const analise = analisarConversa(mensagens);

        // Contabilizar
        if (analise.totalMensagens === 0) {
            analiseAbandono.semInteracao++;
        }

        // Tópico de abandono
        if (!analiseAbandono.abandonoPorTopico[analise.ultimoTopico]) {
            analiseAbandono.abandonoPorTopico[analise.ultimoTopico] = 0;
        }
        analiseAbandono.abandonoPorTopico[analise.ultimoTopico]++;

        // Quem deu última mensagem
        analiseAbandono.abandonoPorQuemDeuUltimaMensagem[analise.ultimaMensagemDe]++;

        // Distribuição de mensagens
        if (analise.totalMensagens === 0) {
            analiseAbandono.distribuicaoMensagens['0']++;
        } else if (analise.totalMensagens <= 2) {
            analiseAbandono.distribuicaoMensagens['1-2']++;
        } else if (analise.totalMensagens <= 5) {
            analiseAbandono.distribuicaoMensagens['3-5']++;
        } else if (analise.totalMensagens <= 10) {
            analiseAbandono.distribuicaoMensagens['6-10']++;
        } else if (analise.totalMensagens <= 20) {
            analiseAbandono.distribuicaoMensagens['11-20']++;
        } else {
            analiseAbandono.distribuicaoMensagens['20+']++;
        }

        // Guardar alguns exemplos detalhados
        if (analiseAbandono.exemplosDetalhados.length < 20) {
            analiseAbandono.exemplosDetalhados.push({
                nome: lead.nome || 'Sem nome',
                chatid: lead.chatid,
                totalMensagens: analise.totalMensagens,
                ultimoTopico: analise.ultimoTopico,
                ultimaMensagemDe: analise.ultimaMensagemDe,
                textoUltima: analise.textoUltimaMensagem
            });
        }
    }

    // 7. EXIBIR RESULTADOS
    console.log('='.repeat(80));
    console.log('📊 RESULTADOS DA ANÁLISE');
    console.log('='.repeat(80));

    console.log('\n🚨 PONTO CRÍTICO: ONDE OS LEADS PARAM DE RESPONDER?\n');

    // Ordenar tópicos por frequência
    const topicosOrdenados = Object.entries(analiseAbandono.abandonoPorTopico)
        .sort((a, b) => b[1] - a[1]);

    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ TÓPICO/ETAPA                    │ QTD ABANDONOS │ % DO TOTAL    │');
    console.log('├─────────────────────────────────────────────────────────────────┤');

    for (const [topico, quantidade] of topicosOrdenados) {
        const percentual = (quantidade / leadsQueNaoAgendaram.length * 100).toFixed(1);
        const barra = '█'.repeat(Math.round(percentual / 2));
        console.log(`│ ${topico.padEnd(30)} │ ${quantidade.toString().padStart(13)} │ ${percentual.toString().padStart(6)}% ${barra}`);
    }
    console.log('└─────────────────────────────────────────────────────────────────┘');

    console.log('\n💬 QUEM DEU A ÚLTIMA MENSAGEM ANTES DO ABANDONO?\n');
    console.log('┌────────────────────────────────────────────────────────────┐');
    console.log('│ QUEM                │ QUANTIDADE │ % DO TOTAL │ SIGNIFICADO│');
    console.log('├────────────────────────────────────────────────────────────┤');

    for (const [quem, qtd] of Object.entries(analiseAbandono.abandonoPorQuemDeuUltimaMensagem)) {
        const perc = (qtd / leadsQueNaoAgendaram.length * 100).toFixed(1);
        let significado = '';
        if (quem === 'Bot') significado = 'Lead não respondeu';
        if (quem === 'Lead') significado = 'Bot não respondeu';
        console.log(`│ ${quem.padEnd(18)} │ ${qtd.toString().padStart(10)} │ ${perc.toString().padStart(9)}% │ ${significado.padEnd(10)}│`);
    }
    console.log('└────────────────────────────────────────────────────────────┘');

    console.log('\n📈 DISTRIBUIÇÃO DE ENGAJAMENTO (Número de Mensagens)\n');
    console.log('┌──────────────────────────────────────────────────┐');
    console.log('│ Nº MENSAGENS │ QUANTIDADE │ % DO TOTAL          │');
    console.log('├──────────────────────────────────────────────────┤');

    for (const [range, qtd] of Object.entries(analiseAbandono.distribuicaoMensagens)) {
        const perc = (qtd / leadsQueNaoAgendaram.length * 100).toFixed(1);
        const barra = '█'.repeat(Math.round(perc / 2));
        console.log(`│ ${range.padEnd(12)} │ ${qtd.toString().padStart(10)} │ ${perc.toString().padStart(6)}% ${barra}`);
    }
    console.log('└──────────────────────────────────────────────────┘');

    console.log('\n🔍 EXEMPLOS DETALHADOS DE ABANDONOS:\n');
    console.log('┌────────────────────────────────────────────────────────────────────────────┐');

    for (let i = 0; i < Math.min(10, analiseAbandono.exemplosDetalhados.length); i++) {
        const ex = analiseAbandono.exemplosDetalhados[i];
        console.log(`│ ${(i + 1).toString().padStart(2)}. ${ex.nome?.substring(0, 20).padEnd(20)}`);
        console.log(`│     Mensagens: ${ex.totalMensagens} | Tópico: ${ex.ultimoTopico}`);
        console.log(`│     Última msg de: ${ex.ultimaMensagemDe}`);
        if (ex.textoUltima) {
            console.log(`│     Texto: "${ex.textoUltima}..."`);
        }
        console.log(`│`);
    }
    console.log('└────────────────────────────────────────────────────────────────────────────┘');

    // 8. INSIGHTS E RECOMENDAÇÕES
    console.log('\n' + '='.repeat(80));
    console.log('💡 INSIGHTS E RECOMENDAÇÕES');
    console.log('='.repeat(80));

    const topicoMaisAbandono = topicosOrdenados[0];
    const percentualSemInteracao = (analiseAbandono.semInteracao / leadsQueNaoAgendaram.length * 100).toFixed(1);
    const percentualBotUltimo = (analiseAbandono.abandonoPorQuemDeuUltimaMensagem.Bot / leadsQueNaoAgendaram.length * 100).toFixed(1);

    console.log(`\n🔴 PROBLEMA #1: ${percentualSemInteracao}% dos leads que NÃO agendaram não tiveram NENHUMA interação`);
    console.log(`   → Possível problema técnico ou leads de baixíssima qualidade`);
    console.log(`   → AÇÃO: Verificar integração e qualidade da fonte de leads\n`);

    console.log(`🔴 PROBLEMA #2: ${topicoMaisAbandono[1]} abandonos na etapa "${topicoMaisAbandono[0]}" (${(topicoMaisAbandono[1] / leadsQueNaoAgendaram.length * 100).toFixed(1)}%)`);
    console.log(`   → Este é o maior ponto de perda!`);
    console.log(`   → AÇÃO: Revisar como o bot aborda "${topicoMaisAbandono[0]}"\n`);

    console.log(`🔴 PROBLEMA #3: ${percentualBotUltimo}% das conversas terminam com o BOT dando a última mensagem`);
    console.log(`   → Isso significa que o lead RECEBEU a informação mas não respondeu`);
    console.log(`   → AÇÃO: Mensagem do bot não está criando urgência/ação\n`);

    const leadsMuitoEngajadosQueNaoAgendaram = analiseAbandono.distribuicaoMensagens['20+'];
    if (leadsMuitoEngajadosQueNaoAgendaram > 10) {
        console.log(`⚠️  ATENÇÃO: ${leadsMuitoEngajadosQueNaoAgendaram} leads tiveram 20+ mensagens e NÃO AGENDARAM`);
        console.log(`   → Esses eram leads quentes que se perderam no processo`);
        console.log(`   → AÇÃO URGENTE: Analisar essas conversas manualmente!\n`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Análise concluída!');
    console.log('='.repeat(80));
}

// Executar
analiseBIAbandono().catch(console.error);
