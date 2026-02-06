/**
 * Script de Análise Detalhada de Leads e Conversão
 * 
 * Este script gera um relatório completo sobre:
 * - Onde estamos perdendo clientes
 * - Pontos de abandono na jornada
 * - Análise de mensagens e padrões de comportamento
 * - Sugestões de melhorias nos scripts do bot
 * 
 * Uso: node scripts/analise-detalhada.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Configuração do Supabase
const SUPABASE_URL = 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// FUNÇÕES DE ANÁLISE
// ============================================

/**
 * Analisa a jornada completa de cada lead
 */
async function analisarJornadaLeads() {
    console.log('\n📊 ANÁLISE DA JORNADA DOS LEADS\n');

    // Buscar todos os leads
    const { data: leads } = await supabase
        .from('taj_leads')
        .select('*')
        .order('timestamp', { ascending: false });

    // Buscar todas as mensagens
    const { data: mensagens } = await supabase
        .from('taj_mensagens')
        .select('*')
        .order('timestamp', { ascending: true });

    // Buscar todos os agendamentos
    const { data: agendamentos } = await supabase
        .from('taj_agendamentos')
        .select('*');

    // Criar mapa de conversas por lead
    const jornadaPorLead = new Map();

    for (const lead of leads) {
        const conversasLead = mensagens.filter(m => m.chatid === lead.chatid);
        const agendamentosLead = agendamentos.filter(a => a.chatid === lead.chatid);

        const analise = analisarConversaIndividual(
            lead,
            conversasLead,
            agendamentosLead
        );

        jornadaPorLead.set(lead.chatid, analise);
    }

    return {
        leads,
        totalLeads: leads.length,
        jornadaPorLead,
        agendamentos
    };
}

/**
 * Analisa uma conversa individual para identificar padrões
 */
function analisarConversaIndividual(lead, mensagens, agendamentos) {
    const analise = {
        chatid: lead.chatid,
        nome: lead.nome,
        totalMensagens: mensagens.length,
        mensagensBot: mensagens.filter(m => m.conversation?.role === 'model').length,
        mensagensUsuario: mensagens.filter(m => m.conversation?.role === 'user').length,
        converteu: agendamentos.length > 0,
        etapaAbandono: null,
        ultimaMensagem: null,
        tempoResposta: [],
        topicosDiscutidos: [],
        objecoes: [],
        interesseNivel: 'baixo'
    };

    if (mensagens.length > 0) {
        analise.ultimaMensagem = mensagens[mensagens.length - 1];

        // Identificar etapa de abandono
        analise.etapaAbandono = identificarEtapaAbandono(mensagens, agendamentos.length > 0);

        // Análise de conteúdo das mensagens
        const conteudoAnalise = analisarConteudoMensagens(mensagens);
        analise.topicosDiscutidos = conteudoAnalise.topicos;
        analise.objecoes = conteudoAnalise.objecoes;
        analise.interesseNivel = conteudoAnalise.nivelInteresse;

        // Calcular tempo de resposta
        analise.tempoResposta = calcularTempoResposta(mensagens);
    }

    return analise;
}

/**
 * Identifica em qual etapa o lead abandonou
 */
function identificarEtapaAbandono(mensagens, converteu) {
    if (converteu) return 'CONVERTEU';
    if (mensagens.length === 0) return 'SEM_MENSAGENS';

    const textoCompleto = mensagens
        .map(m => m.conversation?.parts?.[0]?.text || '')
        .join(' ')
        .toLowerCase();

    // Padrões de identificação de etapas
    const etapas = [
        {
            nome: 'Após ver preços',
            keywords: ['valor', 'preço', 'quanto custa', 'investimento', 'r$', 'reais'],
            peso: 3
        },
        {
            nome: 'Ao escolher horário',
            keywords: ['horário', 'hora', 'disponível', 'agenda', 'quando'],
            peso: 2
        },
        {
            nome: 'Ao escolher terapeuta',
            keywords: ['terapeuta', 'profissional', 'massagista', 'quem atende'],
            peso: 2
        },
        {
            nome: 'Sem resposta inicial',
            keywords: [],
            peso: 1
        }
    ];

    let etapaIdentificada = 'Outros';
    let maiorPeso = 0;

    for (const etapa of etapas) {
        const encontrados = etapa.keywords.filter(k => textoCompleto.includes(k));
        const pesoTotal = encontrados.length * etapa.peso;

        if (pesoTotal > maiorPeso) {
            maiorPeso = pesoTotal;
            etapaIdentificada = etapa.nome;
        }
    }

    // Se não respondeu após primeira mensagem
    if (mensagens.length <= 2) {
        etapaIdentificada = 'Sem resposta inicial';
    }

    return etapaIdentificada;
}

/**
 * Analisa o conteúdo das mensagens para extrair insights
 */
function analisarConteudoMensagens(mensagens) {
    const textos = mensagens
        .map(m => m.conversation?.parts?.[0]?.text || '')
        .filter(t => t.length > 0);

    const textoCompleto = textos.join(' ').toLowerCase();

    // Tópicos discutidos
    const topicos = [];
    const topicosPossiveis = {
        'preços': ['valor', 'preço', 'quanto', 'custa', 'investimento'],
        'horários': ['horário', 'hora', 'disponível', 'agenda'],
        'serviços': ['massagem', 'terapia', 'tratamento', 'serviço'],
        'localização': ['endereço', 'onde', 'local', 'fica'],
        'dúvidas': ['dúvida', 'pergunta', 'como funciona']
    };

    for (const [topico, keywords] of Object.entries(topicosPossiveis)) {
        if (keywords.some(k => textoCompleto.includes(k))) {
            topicos.push(topico);
        }
    }

    // Objeções identificadas
    const objecoes = [];
    const objecoesPossiveis = {
        'preço alto': ['caro', 'muito alto', 'não tenho', 'muito valor'],
        'falta de tempo': ['não tenho tempo', 'ocupado', 'agenda cheia'],
        'indecisão': ['vou pensar', 'depois', 'não sei', 'talvez'],
        'comparação': ['vou ver outros', 'pesquisar', 'comparar']
    };

    for (const [objecao, keywords] of Object.entries(objecoesPossiveis)) {
        if (keywords.some(k => textoCompleto.includes(k))) {
            objecoes.push(objecao);
        }
    }

    // Nível de interesse
    let nivelInteresse = 'baixo';
    const indicadoresAltoInteresse = [
        'quero', 'gostaria', 'quando posso', 'como faço', 'agendar'
    ];
    const indicadoresMedioInteresse = [
        'interessante', 'legal', 'bacana', 'pode ser'
    ];

    if (indicadoresAltoInteresse.some(i => textoCompleto.includes(i))) {
        nivelInteresse = 'alto';
    } else if (indicadoresMedioInteresse.some(i => textoCompleto.includes(i))) {
        nivelInteresse = 'médio';
    }

    return {
        topicos,
        objecoes,
        nivelInteresse
    };
}

/**
 * Calcula tempo médio de resposta do lead
 */
function calcularTempoResposta(mensagens) {
    const tempos = [];

    for (let i = 1; i < mensagens.length; i++) {
        const msgAnterior = mensagens[i - 1];
        const msgAtual = mensagens[i];

        // Se a mensagem atual é do usuário e a anterior era do bot
        if (msgAtual.conversation?.role === 'user' &&
            msgAnterior.conversation?.role === 'model') {

            const tempo = new Date(msgAtual.timestamp) - new Date(msgAnterior.timestamp);
            tempos.push(tempo / 1000 / 60); // em minutos
        }
    }

    return tempos;
}

/**
 * Gera estatísticas consolidadas
 */
function gerarEstatisticas(jornadaPorLead, totalLeads) {
    const stats = {
        totalLeads,
        convertidos: 0,
        naoConvertidos: 0,
        taxaConversao: 0,
        abandonoPorEtapa: {},
        mediaMensagens: 0,
        mediaMensagensConvertidos: 0,
        mediaMensagensNaoConvertidos: 0,
        objecoesFrequentes: {},
        topicosFrequentes: {},
        tempoMedioResposta: 0,
        distribuicaoInteresse: {
            alto: 0,
            medio: 0,
            baixo: 0
        }
    };

    let totalMensagens = 0;
    let totalMensagensConvertidos = 0;
    let totalMensagensNaoConvertidos = 0;
    let totalTempoResposta = 0;
    let countTempoResposta = 0;

    jornadaPorLead.forEach((analise) => {
        totalMensagens += analise.totalMensagens;

        if (analise.converteu) {
            stats.convertidos++;
            totalMensagensConvertidos += analise.totalMensagens;
        } else {
            stats.naoConvertidos++;
            totalMensagensNaoConvertidos += analise.totalMensagens;

            // Contar abandonos por etapa
            if (!stats.abandonoPorEtapa[analise.etapaAbandono]) {
                stats.abandonoPorEtapa[analise.etapaAbandono] = 0;
            }
            stats.abandonoPorEtapa[analise.etapaAbandono]++;
        }

        // Objeções
        analise.objecoes.forEach(obj => {
            stats.objecoesFrequentes[obj] = (stats.objecoesFrequentes[obj] || 0) + 1;
        });

        // Tópicos
        analise.topicosDiscutidos.forEach(top => {
            stats.topicosFrequentes[top] = (stats.topicosFrequentes[top] || 0) + 1;
        });

        // Nível de interesse
        stats.distribuicaoInteresse[analise.interesseNivel]++;

        // Tempo de resposta
        if (analise.tempoResposta.length > 0) {
            const media = analise.tempoResposta.reduce((a, b) => a + b, 0) / analise.tempoResposta.length;
            totalTempoResposta += media;
            countTempoResposta++;
        }
    });

    stats.taxaConversao = (stats.convertidos / totalLeads * 100).toFixed(2);
    stats.mediaMensagens = (totalMensagens / totalLeads).toFixed(1);
    stats.mediaMensagensConvertidos = stats.convertidos > 0
        ? (totalMensagensConvertidos / stats.convertidos).toFixed(1)
        : 0;
    stats.mediaMensagensNaoConvertidos = stats.naoConvertidos > 0
        ? (totalMensagensNaoConvertidos / stats.naoConvertidos).toFixed(1)
        : 0;
    stats.tempoMedioResposta = countTempoResposta > 0
        ? (totalTempoResposta / countTempoResposta).toFixed(1)
        : 0;

    return stats;
}

/**
 * Gera sugestões de melhorias com base nas análises
 */
function gerarSugestoesMelhoria(stats, jornadaPorLead) {
    const sugestoes = [];

    // Análise de abandono por etapa
    const etapaComMaisAbandono = Object.entries(stats.abandonoPorEtapa)
        .sort((a, b) => b[1] - a[1])[0];

    if (etapaComMaisAbandono) {
        const [etapa, quantidade] = etapaComMaisAbandono;
        const percentual = (quantidade / stats.naoConvertidos * 100).toFixed(1);

        sugestoes.push({
            prioridade: 'ALTA',
            categoria: 'Abandono',
            problema: `${percentual}% dos abandonos acontecem na etapa: "${etapa}"`,
            sugestoes: gerarSugestoesPorEtapa(etapa, stats)
        });
    }

    // Análise de objeções
    const objecoesOrdenadas = Object.entries(stats.objecoesFrequentes)
        .sort((a, b) => b[1] - a[1]);

    if (objecoesOrdenadas.length > 0) {
        const [objecao, frequencia] = objecoesOrdenadas[0];
        sugestoes.push({
            prioridade: 'ALTA',
            categoria: 'Objeção Frequente',
            problema: `Objeção "${objecao}" aparece em ${frequencia} conversas`,
            sugestoes: gerarSugestoesParaObjecao(objecao)
        });
    }

    // Análise de interesse
    const percentualBaixoInteresse = (stats.distribuicaoInteresse.baixo / stats.totalLeads * 100).toFixed(1);
    if (percentualBaixoInteresse > 40) {
        sugestoes.push({
            prioridade: 'MÉDIA',
            categoria: 'Engajamento',
            problema: `${percentualBaixoInteresse}% dos leads demonstram baixo interesse`,
            sugestoes: [
                'Revisar a abordagem inicial do bot - pode estar sendo muito genérico',
                'Adicionar perguntas abertas que incentivem respostas mais elaboradas',
                'Incluir gatilhos emocionais e benefícios específicos logo no início',
                'Testar diferentes tipos de abertura (personalizada, curious, urgência)'
            ]
        });
    }

    // Análise de tempo de resposta
    if (stats.tempoMedioResposta > 60) {
        sugestoes.push({
            prioridade: 'BAIXA',
            categoria: 'Tempo de Resposta',
            problema: `Tempo médio de resposta do lead: ${stats.tempoMedioResposta} minutos`,
            sugestoes: [
                'Considerar enviar mensagem de follow-up após 30min sem resposta',
                'Adicionar senso de urgência nas mensagens (vagas limitadas, promoção temporária)',
                'Implementar nudges automáticos para reengajar leads inativos'
            ]
        });
    }

    // Análise de média de mensagens
    const diferencaMensagens = stats.mediaMensagensConvertidos - stats.mediaMensagensNaoConvertidos;
    if (diferencaMensagens > 3) {
        sugestoes.push({
            prioridade: 'MÉDIA',
            categoria: 'Ciclo de Conversão',
            problema: `Leads convertidos trocam ${stats.mediaMensagensConvertidos} mensagens vs ${stats.mediaMensagensNaoConvertidos} dos não convertidos`,
            sugestoes: [
                'Leads engajados convertem mais - focar em manter a conversa ativa',
                'Fazer perguntas abertas para prolongar o diálogo',
                'Não apresentar todas as informações de uma vez - dosear conteúdo',
                'Usar storytelling e casos de sucesso para manter interesse'
            ]
        });
    }

    return sugestoes;
}

function gerarSugestoesPorEtapa(etapa, stats) {
    const sugestoesMap = {
        'Após ver preços': [
            '💰 SCRIPT: Reformular apresentação de preços',
            '   - Usar ancoragem: mostrar preço mais alto primeiro, depois opções acessíveis',
            '   - Destacar VALOR antes do preço (benefícios, transformação)',
            '   - Incluir comparativo: "Menos que um jantar no fim de semana"',
            '   - Oferecer parcelamento ou pacotes com desconto',
            '   - Adicionar prova social logo após preço: "90% dos clientes consideram justo"',
            '',
            '🎯 EXEMPLO DE MELHORIA NO SCRIPT:',
            '   Ao invés de: "A sessão custa R$150"',
            '   Usar: "Imagine dedicar 1h30 só para você, eliminando meses de tensão..."',
            '         "Nossos clientes relatam 85% de melhora já na primeira sessão"',
            '         "O investimento? Apenas R$150 - menos que um jantar especial"',
            '         "E temos pacotes com 15% de desconto 😊"'
        ],
        'Ao escolher horário': [
            '📅 SCRIPT: Simplificar processo de agendamento',
            '   - Não perguntar "Qual horário prefere?" (muito aberto)',
            '   - Oferecer 2-3 opções específicas: "Tenho hoje 14h ou amanhã 10h"',
            '   - Usar urgência positiva: "Temos apenas 2 vagas hoje"',
            '   - Se não tiver horário ideal, oferecer lista de espera com benefício',
            '   - Reduzir atrito: confirmar em 1 mensagem, não em várias',
            '',
            '🎯 EXEMPLO:',
            '   "Perfeito! Tenho 2 horários incríveis disponíveis:',
            '    📌 Hoje 16h com a Dra. Ana (especialista em dores crônicas)',
            '    📌 Amanhã 10h com a Dra. Carla (expert em relaxamento profundo)',
            '    Qual funciona melhor para você?"'
        ],
        'Ao escolher terapeuta': [
            '👩‍⚕️ SCRIPT: Personalizar escolha de terapeuta',
            '   - Não listar todas as terapeutas - overwhelming',
            '   - Fazer 1 pergunta: "Prefere atendimento mais técnico ou mais relaxante?"',
            '   - Recomendar terapeuta baseado na resposta (sensação de personalização)',
            '   - Adicionar mini-bio humanizada: "Ana adora trabalhar dores nas costas"',
            '   - Incluir foto se possível (aumenta confiança)',
            '',
            '🎯 EXEMPLO:',
            '   "Para sua necessidade, recomendo a Terapeuta Carla 🌟"',
            '   "Especialista em liberação de tensão profunda, formada há 8 anos"',
            '   "Clientes dizem que as mãos dela são mágicas! ✨"',
            '   "Posso agendar com ela para amanhã 14h?"'
        ],
        'Sem resposta inicial': [
            '🚀 SCRIPT: Melhorar primeira mensagem',
            '   - Primeira impressão é CRÍTICA - 80% decidem continuar nos primeiros 10seg',
            '   - Usar nome do lead se possível (personalização)',
            '   - Fazer pergunta aberta interessante, não "Como posso ajudar?"',
            '   - Incluir elemento de curiosidade ou benefício claro',
            '   - Usar emojis com moderação (humaniza, mas não exagerar)',
            '   - Testar diferentes abordagens: problema, desejo, transformação',
            '',
            '🎯 EXEMPLOS para testar (A/B test):',
            '   Abordagem 1 (Problema):',
            '   "Oi [Nome]! 👋 Sua região lombar tem pedido socorro? 😅"',
            '',
            '   Abordagem 2 (Benefício):',
            '   "Oi [Nome]! Que tal 90min de puro relaxamento hoje? 🌸"',
            '',
            '   Abordagem 3 (Curiosidade):',
            '   "Oi [Nome]! Posso te mostrar como 80% dos nossos clientes eliminam"',
            '   "dores de cabeça sem remédios? 🤔"'
        ],
        'Outros': [
            '🔍 SCRIPT: Revisar fluxo geral',
            '   - Mapear toda jornada do início ao fim',
            '   - Identificar pontos de fricção não categorizados',
            '   - Analisar conversas manualmente para encontrar padrões',
            '   - Testar variações de script em pequena escala',
            '   - Implementar funil de reengajamento para leads silent'
        ]
    };

    return sugestoesMap[etapa] || sugestoesMap['Outros'];
}

function gerarSugestoesParaObjecao(objecao) {
    const sugestoesMap = {
        'preço alto': [
            '💡 Trabalhar VALOR, não preço',
            '   - Nunca justificar preço, elevar percepção de valor',
            '   - Usar prova social: testemunhos sobre resultados',
            '   - Comparar com alternativas: "Vs 6 meses de remédios..."',
            '   - Oferecer garantia: "Se não sentir diferença, reagendamos grátis"',
            '   - Criar pacotes: "3 sessões por R$400 (economia de R$50)"'
        ],
        'falta de tempo': [
            '⏰ Facilitar encaixe na rotina',
            '   - Enfatizar tempo curto: "A mais econômicas"',
            'só 1h para 1 semana de bem-estar"',
            '   - Horários flexíveis: destacar early morning ou final do dia',
            '   - Proximidade: "Estamos a 5min de você"',
            '   - Benefício secundário: "Nossos clientes dizem que rendem mais no trabalho depois"'
        ],
        'indecisão': [
            '🎯 Reduzir risco percebido',
            '   - Oferecer sessão experimental com desconto',
            '   - Garantia de satisfação',
            '   - "Que tal conhecer sem compromisso?"',
            '   - Urgência suave: "Hoje temos uma vaga especial..."',
            '   - Social proof: "95% dos clientes voltam para 2ª sessão"'
        ],
        'comparação': [
            '🏆 Diferenciar-se claramente',
            '   - Destacar diferenciais únicos',
            '   - "Somos os únicos com técnica XYZ na região"',
            '   - Especialização: "10 anos focados em..."',
            '   - Conveniência: "Agendamento em 2 minutos, sem burocracia"',
            '   - Oferta limitada: "Se agendar hoje, garantimos horário nobre"'
        ]
    };

    return sugestoesMap[objecao] || [
        'Analisar manualmente as conversas com esta objeção',
        'Criar resposta específica e testar eficácia',
        'Documentar casos de sucesso superando esta objeção'
    ];
}

/**
 * Gera relatório em markdown
 */
function gerarRelatorioMarkdown(stats, sugestoes, jornadaPorLead) {
    const data = new Date().toLocaleString('pt-BR');

    let md = `# 📊 RELATÓRIO DETALHADO DE ANÁLISE DE LEADS\n\n`;
    md += `**Data de Geração:** ${data}\n\n`;
    md += `---\n\n`;

    // RESUMO EXECUTIVO
    md += `## 📈 RESUMO EXECUTIVO\n\n`;
    md += `| Métrica | Valor |\n`;
    md += `|---------|-------|\n`;
    md += `| **Total de Leads** | ${stats.totalLeads} |\n`;
    md += `| **Leads Convertidos** | ${stats.convertidos} (${stats.taxaConversao}%) |\n`;
    md += `| **Leads Não Convertidos** | ${stats.naoConvertidos} |\n`;
    md += `| **Média de Mensagens (Geral)** | ${stats.mediaMensagens} mensagens |\n`;
    md += `| **Média de Mensagens (Convertidos)** | ${stats.mediaMensagensConvertidos} mensagens |\n`;
    md += `| **Média de Mensagens (Não Convertidos)** | ${stats.mediaMensagensNaoConvertidos} mensagens |\n`;
    md += `| **Tempo Médio de Resposta do Lead** | ${stats.tempoMedioResposta} minutos |\n\n`;

    // ANÁLISE DE ABANDONO
    md += `## 🚨 ANÁLISE DE ABANDONO POR ETAPA\n\n`;
    md += `### Onde Estamos Perdendo Clientes:\n\n`;

    const abandonoOrdenado = Object.entries(stats.abandonoPorEtapa)
        .sort((a, b) => b[1] - a[1]);

    for (const [etapa, quantidade] of abandonoOrdenado) {
        const percentual = (quantidade / stats.naoConvertidos * 100).toFixed(1);
        const barraVisual = '█'.repeat(Math.round(percentual / 5));
        md += `**${etapa}**\n`;
        md += `- Quantidade: ${quantidade} leads\n`;
        md += `- Percentual: ${percentual}% dos abandonos\n`;
        md += `- Visual: ${barraVisual} (${percentual}%)\n\n`;
    }

    // OBJEÇÕES
    md += `## 💬 OBJEÇÕES MAIS FREQUENTES\n\n`;
    const objecoesOrdenadas = Object.entries(stats.objecoesFrequentes)
        .sort((a, b) => b[1] - a[1]);

    if (objecoesOrdenadas.length > 0) {
        for (const [objecao, freq] of objecoesOrdenadas) {
            md += `- **${objecao.toUpperCase()}**: ${freq} ocorrências\n`;
        }
    } else {
        md += `*Nenhuma objeção clara identificada nas conversas*\n`;
    }
    md += `\n`;

    // TÓPICOS DISCUTIDOS
    md += `## 📋 TÓPICOS MAIS DISCUTIDOS\n\n`;
    const topicosOrdenados = Object.entries(stats.topicosFrequentes)
        .sort((a, b) => b[1] - a[1]);

    if (topicosOrdenados.length > 0) {
        for (const [topico, freq] of topicosOrdenados) {
            const percentual = (freq / stats.totalLeads * 100).toFixed(1);
            md += `- **${topico}**: ${freq} conversas (${percentual}% dos leads)\n`;
        }
    } else {
        md += `*Dados insuficientes para análise de tópicos*\n`;
    }
    md += `\n`;

    // NÍVEL DE INTERESSE
    md += `## 🎯 DISTRIBUIÇÃO DE NÍVEL DE INTERESSE\n\n`;
    md += `| Nível | Quantidade | Percentual |\n`;
    md += `|-------|------------|------------|\n`;
    md += `| Alto | ${stats.distribuicaoInteresse.alto} | ${(stats.distribuicaoInteresse.alto / stats.totalLeads * 100).toFixed(1)}% |\n`;
    md += `| Médio | ${stats.distribuicaoInteresse.medio} | ${(stats.distribuicaoInteresse.medio / stats.totalLeads * 100).toFixed(1)}% |\n`;
    md += `| Baixo | ${stats.distribuicaoInteresse.baixo} | ${(stats.distribuicaoInteresse.baixo / stats.totalLeads * 100).toFixed(1)}% |\n\n`;

    // INSIGHTS E CONCLUSÕES
    md += `## 🔍 INSIGHTS E CONCLUSÕES\n\n`;

    if (stats.mediaMensagensConvertidos > stats.mediaMensagensNaoConvertidos) {
        md += `### ✅ Engajamento Positivo\n`;
        md += `Leads que convertem trocam **${stats.mediaMensagensConvertidos} mensagens** em média, enquanto os que não convertem trocam apenas **${stats.mediaMensagensNaoConvertidos}**. Isso indica que:\n`;
        md += `- Manter a conversa ativa aumenta chances de conversão\n`;
        md += `- O bot está funcionando bem quando consegue engajar\n`;
        md += `- Foco deve ser em **aumentar engajamento inicial**\n\n`;
    }

    if (stats.tempoMedioResposta > 30) {
        md += `### ⏰ Atenção ao Tempo de Resposta\n`;
        md += `Tempo médio de ${stats.tempoMedioResposta} minutos sugere que leads estão "pensando" bastante entre mensagens. Considere:\n`;
        md += `- Implementar follow-ups automáticos\n`;
        md += `- Adicionar senso de urgência nas mensagens\n`;
        md += `- Reduzir complexidade das perguntas\n\n`;
    }

    // SUGESTÕES DE MELHORIA
    md += `## 🚀 SUGESTÕES DE MELHORIA PRIORITIZADAS\n\n`;

    const sugestoesOrdenadas = sugestoes.sort((a, b) => {
        const prioridadeMap = { 'ALTA': 3, 'MÉDIA': 2, 'BAIXA': 1 };
        return prioridadeMap[b.prioridade] - prioridadeMap[a.prioridade];
    });

    for (const sug of sugestoesOrdenadas) {
        const emoji = sug.prioridade === 'ALTA' ? '🔴' : sug.prioridade === 'MÉDIA' ? '🟡' : '🟢';
        md += `### ${emoji} ${sug.prioridade} - ${sug.categoria}\n\n`;
        md += `**Problema Identificado:**\n${sug.problema}\n\n`;
        md += `**Sugestões de Ação:**\n`;
        for (const sugestao of sug.sugestoes) {
            md += `${sugestao}\n`;
        }
        md += `\n`;
    }

    // PRÓXIMOS PASSOS
    md += `## 📝 PRÓXIMOS PASSOS RECOMENDADOS\n\n`;
    md += `1. **Imediato (Esta Semana)**:\n`;
    md += `   - Revisar e reescrever a mensagem para a etapa com mais abandono\n`;
    md += `   - Criar resposta específica para objeção mais frequente\n`;
    md += `   - Implementar mensagem de follow-up automática\n\n`;

    md += `2. **Curto Prazo (Próximas 2 Semanas)**:\n`;
    md += `   - Fazer A/B test com 2 versões diferentes de script\n`;
    md += `   - Analisar manualmente 10 conversas de leads com alto interesse que não converteram\n`;
    md += `   - Adicionar mais provas sociais e testemunhos no fluxo\n\n`;

    md += `3. **Médio Prazo (Próximo Mês)**:\n`;
    md += `   - Revisar todo o funil de conversação\n`;
    md += `   - Implementar sistema de scoring de leads\n`;
    md += `   - Criar sequência de reengajamento para leads inativos\n`;
    md += `   - Documentar boas práticas baseadas nos casos de sucesso\n\n`;

    md += `---\n\n`;
    md += `*Relatório gerado automaticamente pelo sistema de análise Taj Dashboard*\n`;

    return md;
}

/**
 * Função principal
 */
async function main() {
    console.log('🔍 Iniciando análise detalhada...\n');

    try {
        // 1. Analisar jornada dos leads
        const { totalLeads, jornadaPorLead, agendamentos } = await analisarJornadaLeads();

        console.log(`✅ ${totalLeads} leads analisados`);
        console.log(`✅ ${agendamentos.length} agendamentos encontrados\n`);

        // 2. Gerar estatísticas
        const stats = gerarEstatisticas(jornadaPorLead, totalLeads);

        // 3. Gerar sugestões
        const sugestoes = gerarSugestoesMelhoria(stats, jornadaPorLead);

        // 4. Gerar relatório
        const relatorio = gerarRelatorioMarkdown(stats, sugestoes, jornadaPorLead);

        // 5. Salvar em arquivo
        const filename = `relatorio-analise-${new Date().toISOString().split('T')[0]}.md`;
        fs.writeFileSync(filename, relatorio, 'utf8');

        console.log(`\n✅ Relatório gerado com sucesso: ${filename}\n`);

        // 6. Mostrar preview do resumo
        console.log('📊 PREVIEW DO RESUMO:');
        console.log(`Taxa de Conversão: ${stats.taxaConversao}%`);
        console.log(`Média de Mensagens (Convertidos): ${stats.mediaMensagensConvertidos}`);
        console.log(`Média de Mensagens (Não Convertidos): ${stats.mediaMensagensNaoConvertidos}`);
        console.log(`\nEtapa com mais abandono: ${Object.entries(stats.abandonoPorEtapa).sort((a, b) => b[1] - a[1])[0]?.[0]}`);
        console.log(`\n🎯 ${sugestoes.length} sugestões de melhoria identificadas!\n`);

    } catch (error) {
        console.error('❌ Erro na análise:', error);
        process.exit(1);
    }
}

// Executar
main();
