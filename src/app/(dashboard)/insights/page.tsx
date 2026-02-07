'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { getSupabaseClient } from '@/lib/supabase/client';
import { exportToCSV, exportToPDF } from '@/lib/utils/export';
import {
    Brain,
    HelpCircle,
    AlertTriangle,
    Users,
    Sparkles,
    Download,
    FileText,
    RefreshCw,
    TrendingUp,
    MessageSquare,
    Copy,
    Check
} from 'lucide-react';

interface InsightItem {
    texto: string;
    contagem: number;
    exemplos?: string[];
}

interface InsightsData {
    perguntasFrequentes: InsightItem[];
    objecoesComuns: InsightItem[];
    terapeutasMaisPedidas: InsightItem[];
    servicosMaisPedidos: InsightItem[];
}

export default function InsightsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [copiedItem, setCopiedItem] = useState<string | null>(null);

    const [insights, setInsights] = useState<InsightsData>({
        perguntasFrequentes: [],
        objecoesComuns: [],
        terapeutasMaisPedidas: [],
        servicosMaisPedidos: [],
    });

    const [stats, setStats] = useState({
        totalMensagens: 0,
        totalLeads: 0,
        taxaEngajamento: 0,
    });

    const supabase = getSupabaseClient();

    useEffect(() => {
        loadInsights();
    }, []);

    async function loadInsights() {
        setIsLoading(true);
        setIsRefreshing(true);
        try {
            // Buscar mensagens dos usuários para análise
            const { data: mensagens, count } = await supabase
                .from('taj_mensagens')
                .select('chatid, conversation', { count: 'exact' })
                .limit(15000);

            setStats(prev => ({ ...prev, totalMensagens: count || 0 }));

            // Buscar total de leads
            const { count: leadsCount } = await supabase
                .from('taj_leads')
                .select('chatid', { count: 'exact' });

            setStats(prev => ({ ...prev, totalLeads: leadsCount || 0 }));

            // Processar mensagens do usuário
            const userMessages: string[] = [];
            mensagens?.forEach(m => {
                if (m.conversation?.role === 'user') {
                    const texto = m.conversation?.parts?.[0]?.text || '';
                    if (texto && texto.length > 5) {
                        userMessages.push(texto.toLowerCase());
                    }
                }
            });

            // Analisar perguntas frequentes
            const perguntaPatterns = [
                { pattern: /qual.*(?:preço|valor|custo)/i, label: 'Qual o preço/valor?' },
                { pattern: /quanto.*(?:custa|cobram|pago)/i, label: 'Quanto custa?' },
                { pattern: /(?:tem|têm).*(?:vaga|horário|disponível)/i, label: 'Tem vaga disponível?' },
                { pattern: /(?:funciona|funcionam).*(?:como|de que forma)/i, label: 'Como funciona?' },
                { pattern: /(?:aceita|aceitam).*(?:cartão|pix|dinheiro)/i, label: 'Formas de pagamento?' },
                { pattern: /(?:onde|qual).*(?:localização|endereço|fica)/i, label: 'Qual a localização?' },
                { pattern: /(?:preciso|precisa|necessário).*(?:agendar|marcar)/i, label: 'Precisa agendar?' },
                { pattern: /(?:qual|quais).*(?:serviço|tratamento|massagem)/i, label: 'Quais serviços?' },
                { pattern: /(?:dura|duração|quanto tempo)/i, label: 'Duração da sessão?' },
                { pattern: /(?:primeira|primeira vez|nunca)/i, label: 'É minha primeira vez' },
                { pattern: /(?:estacionamento|estacionar)/i, label: 'Tem estacionamento?' },
                { pattern: /(?:atende|atendem).*(?:casal|dupla)/i, label: 'Atendimento para casal?' },
            ];

            const perguntasCount: Record<string, number> = {};
            userMessages.forEach(msg => {
                perguntaPatterns.forEach(p => {
                    if (p.pattern.test(msg)) {
                        perguntasCount[p.label] = (perguntasCount[p.label] || 0) + 1;
                    }
                });
            });

            const perguntasFrequentes = Object.entries(perguntasCount)
                .map(([texto, contagem]) => ({ texto, contagem }))
                .sort((a, b) => b.contagem - a.contagem)
                .slice(0, 10);

            // Analisar objeções comuns
            const objecaoPatterns = [
                { pattern: /(?:caro|muito caro|achei caro|puxado)/i, label: 'Achei caro/muito caro' },
                { pattern: /(?:não|nao).*(?:posso|consigo|dá)/i, label: 'Não posso agora' },
                { pattern: /(?:vou|vo).*(?:pensar|ver|analisar)/i, label: 'Vou pensar' },
                { pattern: /(?:depois|mais tarde|outro dia)/i, label: 'Vou ver depois' },
                { pattern: /(?:longe|distante|perto)/i, label: 'Localização inconveniente' },
                { pattern: /(?:não|nao).*(?:conhecia|conheco|conheço)/i, label: 'Não conhecia o lugar' },
                { pattern: /(?:medo|receio|vergonha)/i, label: 'Receio/insegurança' },
                { pattern: /(?:marido|esposa|namorad)/i, label: 'Precisa consultar parceiro' },
                { pattern: /(?:horário|horario).*(?:não|nao|difícil)/i, label: 'Horário difícil' },
                { pattern: /(?:só|so).*(?:perguntando|curiosidade)/i, label: 'Só estava perguntando' },
            ];

            const objecoesCount: Record<string, number> = {};
            userMessages.forEach(msg => {
                objecaoPatterns.forEach(p => {
                    if (p.pattern.test(msg)) {
                        objecoesCount[p.label] = (objecoesCount[p.label] || 0) + 1;
                    }
                });
            });

            const objecoesComuns = Object.entries(objecoesCount)
                .map(([texto, contagem]) => ({ texto, contagem }))
                .sort((a, b) => b.contagem - a.contagem)
                .slice(0, 8);

            // Analisar terapeutas mais pedidas
            const terapeutaPatterns = [
                { pattern: /amanda/i, label: 'Amanda' },
                { pattern: /julia|júlia/i, label: 'Julia' },
                { pattern: /maria/i, label: 'Maria' },
                { pattern: /ana/i, label: 'Ana' },
                { pattern: /carol|carolina/i, label: 'Carolina' },
                { pattern: /fernanda/i, label: 'Fernanda' },
                { pattern: /gabriela|gabi/i, label: 'Gabriela' },
                { pattern: /larissa/i, label: 'Larissa' },
                { pattern: /patricia|patrícia/i, label: 'Patricia' },
                { pattern: /camila/i, label: 'Camila' },
            ];

            const terapeutasCount: Record<string, number> = {};
            userMessages.forEach(msg => {
                terapeutaPatterns.forEach(p => {
                    if (p.pattern.test(msg)) {
                        terapeutasCount[p.label] = (terapeutasCount[p.label] || 0) + 1;
                    }
                });
            });

            const terapeutasMaisPedidas = Object.entries(terapeutasCount)
                .map(([texto, contagem]) => ({ texto, contagem }))
                .sort((a, b) => b.contagem - a.contagem)
                .slice(0, 6);

            // Analisar serviços mais pedidos
            const servicoPatterns = [
                { pattern: /relaxante/i, label: 'Massagem Relaxante' },
                { pattern: /tântrica|tantrica|tantra/i, label: 'Massagem Tântrica' },
                { pattern: /nuru/i, label: 'Massagem Nuru' },
                { pattern: /lingam/i, label: 'Massagem Lingam' },
                { pattern: /yoni/i, label: 'Massagem Yoni' },
                { pattern: /sensual/i, label: 'Massagem Sensual' },
                { pattern: /corpo.*corpo/i, label: 'Corpo a Corpo' },
                { pattern: /quatro.*mãos|4.*mãos/i, label: 'Quatro Mãos' },
                { pattern: /casal/i, label: 'Massagem para Casal' },
                { pattern: /thai|tailandesa/i, label: 'Massagem Thai' },
            ];

            const servicosCount: Record<string, number> = {};
            userMessages.forEach(msg => {
                servicoPatterns.forEach(p => {
                    if (p.pattern.test(msg)) {
                        servicosCount[p.label] = (servicosCount[p.label] || 0) + 1;
                    }
                });
            });

            const servicosMaisPedidos = Object.entries(servicosCount)
                .map(([texto, contagem]) => ({ texto, contagem }))
                .sort((a, b) => b.contagem - a.contagem)
                .slice(0, 8);

            // Calcular taxa de engajamento
            const chatsUnicos = new Set(mensagens?.map(m => m.chatid)).size;
            const taxaEngajamento = leadsCount
                ? Math.round((chatsUnicos / leadsCount) * 100)
                : 0;

            setStats(prev => ({ ...prev, taxaEngajamento }));

            setInsights({
                perguntasFrequentes,
                objecoesComuns,
                terapeutasMaisPedidas,
                servicosMaisPedidos,
            });
        } catch (error) {
            console.error('Erro ao analisar insights:', error);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }

    async function handleCopy(texto: string) {
        await navigator.clipboard.writeText(texto);
        setCopiedItem(texto);
        setTimeout(() => setCopiedItem(null), 2000);
    }

    function handleExportCSV() {
        const allData = [
            ...insights.perguntasFrequentes.map(i => ({ categoria: 'Pergunta Frequente', ...i })),
            ...insights.objecoesComuns.map(i => ({ categoria: 'Objeção', ...i })),
            ...insights.terapeutasMaisPedidas.map(i => ({ categoria: 'Terapeuta Pedida', ...i })),
            ...insights.servicosMaisPedidos.map(i => ({ categoria: 'Serviço Solicitado', ...i })),
        ];

        exportToCSV(
            allData,
            [
                { key: 'categoria', header: 'Categoria' },
                { key: 'texto', header: 'Item' },
                { key: 'contagem', header: 'Ocorrências' },
            ],
            'insights_ia'
        );
        setShowExportMenu(false);
    }

    function handleExportPDF() {
        const allData = [
            ...insights.perguntasFrequentes.map(i => ({ categoria: 'Pergunta', ...i })),
            ...insights.objecoesComuns.map(i => ({ categoria: 'Objeção', ...i })),
            ...insights.terapeutasMaisPedidas.map(i => ({ categoria: 'Terapeuta', ...i })),
            ...insights.servicosMaisPedidos.map(i => ({ categoria: 'Serviço', ...i })),
        ];

        exportToPDF(
            allData,
            [
                { key: 'categoria', header: 'Categoria' },
                { key: 'texto', header: 'Item' },
                { key: 'contagem', header: 'Qtd' },
            ],
            'insights_ia',
            {
                title: 'Insights de IA',
                subtitle: 'Análise de Mensagens dos Clientes',
            }
        );
        setShowExportMenu(false);
    }

    function InsightCard({
        title,
        icon: Icon,
        items,
        color
    }: {
        title: string;
        icon: typeof HelpCircle;
        items: InsightItem[];
        color: string;
    }) {
        return (
            <Card gradient hover>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color.includes('amber') ? 'bg-amber-500/20 text-amber-400' : color.includes('red') ? 'bg-red-500/20 text-red-400' : color.includes('emerald') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-purple-500/20 text-purple-400'}`}>
                            <Icon className="h-5 w-5" />
                        </div>
                        <CardTitle>{title}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-12 shimmer rounded-lg" />
                            ))}
                        </div>
                    ) : items.length === 0 ? (
                        <p className="text-white/40 text-center py-8">
                            Sem dados suficientes
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {items.map((item, idx) => {
                                const maxCount = items[0].contagem;
                                const percentage = (item.contagem / maxCount) * 100;

                                return (
                                    <div
                                        key={item.texto}
                                        className="group relative p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                                        onClick={() => handleCopy(item.texto)}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm text-white font-medium truncate max-w-[70%]">
                                                {item.texto}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-semibold ${color}`}>
                                                    {item.contagem}x
                                                </span>
                                                {copiedItem === item.texto ? (
                                                    <Check className="h-4 w-4 text-emerald-400" />
                                                ) : (
                                                    <Copy className="h-4 w-4 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                )}
                                            </div>
                                        </div>
                                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full bg-gradient-to-r ${color.includes('amber') ? 'from-amber-500 to-yellow-400' : color.includes('red') ? 'from-red-500 to-rose-400' : color.includes('emerald') ? 'from-emerald-500 to-green-400' : 'from-purple-500 to-violet-400'}`}
                                                style={{ width: `${percentage}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex min-h-screen bg-brand-black">
            <Sidebar />

            <main className="flex-1 ml-64">
                <Header
                    title="Insights de IA"
                    subtitle="Análise inteligente das conversas para melhorar seu prompt"
                />

                <div className="p-8">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <Card gradient hover>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gold/20 text-brand-gold">
                                        <MessageSquare className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-white/60">Mensagens Analisadas</p>
                                        <p className="text-2xl font-bold text-white">
                                            {isLoading ? '—' : stats.totalMensagens.toLocaleString('pt-BR')}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card gradient hover>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
                                        <Users className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-white/60">Leads no Período</p>
                                        <p className="text-2xl font-bold text-white">
                                            {isLoading ? '—' : stats.totalLeads.toLocaleString('pt-BR')}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card gradient hover>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                                        <TrendingUp className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-white/60">Taxa de Engajamento</p>
                                        <p className="text-2xl font-bold text-white">
                                            {isLoading ? '—' : `${stats.taxaEngajamento}%`}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between mb-6">
                        <p className="text-white/50 text-sm">
                            <Brain className="inline-block h-4 w-4 mr-2" />
                            Clique em qualquer item para copiar e usar no seu prompt
                        </p>

                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Button
                                    variant="secondary"
                                    onClick={() => setShowExportMenu(!showExportMenu)}
                                    className="gap-2"
                                >
                                    <Download className="h-4 w-4" />
                                    Exportar
                                </Button>

                                {showExportMenu && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setShowExportMenu(false)}
                                        />
                                        <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-xl border border-white/10 bg-brand-gray shadow-2xl overflow-hidden animate-fade-in">
                                            <button
                                                onClick={handleExportCSV}
                                                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                                            >
                                                <FileText className="h-4 w-4" />
                                                Exportar CSV
                                            </button>
                                            <button
                                                onClick={handleExportPDF}
                                                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                                            >
                                                <FileText className="h-4 w-4" />
                                                Exportar PDF
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            <Button
                                variant="secondary"
                                onClick={() => loadInsights()}
                                disabled={isRefreshing}
                                className="gap-2"
                            >
                                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                Atualizar
                            </Button>
                        </div>
                    </div>

                    {/* Insights Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <InsightCard
                            title="Perguntas Frequentes"
                            icon={HelpCircle}
                            items={insights.perguntasFrequentes}
                            color="text-amber-400"
                        />

                        <InsightCard
                            title="Objeções Comuns"
                            icon={AlertTriangle}
                            items={insights.objecoesComuns}
                            color="text-red-400"
                        />

                        <InsightCard
                            title="Terapeutas Mais Pedidas"
                            icon={Users}
                            items={insights.terapeutasMaisPedidas}
                            color="text-emerald-400"
                        />

                        <InsightCard
                            title="Serviços Mais Solicitados"
                            icon={Sparkles}
                            items={insights.servicosMaisPedidos}
                            color="text-purple-400"
                        />
                    </div>

                    {/* Dica */}
                    <Card className="mt-8 bg-gradient-to-r from-brand-gold/10 to-amber-500/5 border-brand-gold/20">
                        <CardContent className="py-4 px-6">
                            <div className="flex items-start gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gold/20 text-brand-gold flex-shrink-0">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="text-white font-semibold mb-1">Dica de Uso</h4>
                                    <p className="text-white/60 text-sm">
                                        Use esses insights para melhorar seu prompt de IA! As perguntas frequentes devem ter respostas prontas no seu agente.
                                        As objeções comuns são oportunidades para criar scripts de contorno. Exporte esses dados para sua base de conhecimento.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
