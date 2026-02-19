'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DateFilter, useDateFilter } from '@/components/ui/DateFilter';
import { ConversationModal } from '@/components/dashboard/ConversationModal';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import { getSupabaseClient } from '@/lib/supabase/client';
import { formatTimeAgo } from '@/lib/utils/format';
import { exportToCSV, exportToPDF } from '@/lib/utils/export';
import { AlertTriangle, MessageCircle, Clock, TrendingDown, Download, FileText } from 'lucide-react';

interface Lead {
    chatid: string;
    nome: string;
    telefone?: string;
    timestamp: string;
    status_atendimento: string;
    origem_cliente_taj: string | null;
}

interface AbandonoData {
    etapa: string;
    quantidade: number;
    percentual: number;
    [key: string]: string | number; // Index signature for export compatibility
}

export default function AnalyticsPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [abandonoData, setAbandonoData] = useState<AbandonoData[]>([]);
    const [leadsAbandonados, setLeadsAbandonados] = useState<Lead[]>([]);
    const [totalAbandonados, setTotalAbandonados] = useState(0);
    const [selectedEtapa, setSelectedEtapa] = useState<string | null>(null);
    const [showExportMenu, setShowExportMenu] = useState(false);

    // KPIs dinâmicos
    const [principalEtapa, setPrincipalEtapa] = useState<string>('—');
    const [mediaMensagens, setMediaMensagens] = useState<number>(0);
    const [taxaPerda, setTaxaPerda] = useState<number>(0);
    const [abandonoPorHora, setAbandonoPorHora] = useState<{ hora: number, quantidade: number }[]>([]);

    // Conversation modal
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

    // Date filter
    const { dateRange, setDateRange } = useDateFilter(30);

    const supabase = getSupabaseClient();

    useEffect(() => {
        loadAnalyticsData();
    }, [dateRange]);

    async function loadAnalyticsData() {
        setIsLoading(true);
        try {
            // 1. Buscar todos os leads no período
            const { data: allLeads } = await supabase
                .from('taj_leads')
                .select('*')
                .gte('timestamp', dateRange.startDate.toISOString())
                .lte('timestamp', dateRange.endDate.toISOString())
                .order('timestamp', { ascending: false });

            // 2. Buscar todos os chatIds que têm agendamento
            const { data: agendamentos } = await supabase
                .from('taj_agendamentos')
                .select('chatid');

            const chatIdsConvertidos = new Set((agendamentos || []).map(a => a.chatid));

            // 3. Filtrar leads que NÃO têm agendamento (abandonados)
            const leadsAbandonadosList = (allLeads || []).filter(
                lead => !chatIdsConvertidos.has(lead.chatid)
            );

            setTotalAbandonados(leadsAbandonadosList.length);

            // 4. Classificar abandono REAL baseado nas mensagens
            const chatIdsAbandonados = leadsAbandonadosList.map(l => l.chatid);

            // Buscar mensagens dos leads abandonados
            const { data: mensagens } = await supabase
                .from('taj_mensagens')
                .select('chatid, conversation')
                .in('chatid', chatIdsAbandonados)
                .limit(5000);

            // Analisar cada conversa para classificar
            const classificacao: Record<string, {
                mensagens: number,
                perguntouPreco: boolean,
                perguntouHorario: boolean,
                perguntouTerapeuta: boolean
            }> = {};

            mensagens?.forEach(m => {
                if (!classificacao[m.chatid]) {
                    classificacao[m.chatid] = {
                        mensagens: 0,
                        perguntouPreco: false,
                        perguntouHorario: false,
                        perguntouTerapeuta: false
                    };
                }
                classificacao[m.chatid].mensagens++;

                // Analisar mensagens do bot (model) para ver o que foi mostrado
                if (m.conversation?.role === 'model') {
                    const texto = (m.conversation?.parts?.[0]?.text || '').toLowerCase();
                    if (texto.includes('r$') || texto.includes('reais') || texto.includes('valor')) {
                        classificacao[m.chatid].perguntouPreco = true;
                    }
                    if (texto.includes('horário') || texto.includes('disponível') || texto.includes('vaga')) {
                        classificacao[m.chatid].perguntouHorario = true;
                    }
                    if (texto.includes('terapeuta') || texto.includes('massagista') || texto.includes('profissional')) {
                        classificacao[m.chatid].perguntouTerapeuta = true;
                    }
                }
            });

            // Classificar em etapas reais
            let semResposta = 0;
            let aposVerPreco = 0;
            let aposVerHorario = 0;
            let aposVerTerapeuta = 0;
            let outros = 0;

            Object.values(classificacao).forEach(c => {
                if (c.mensagens <= 2) {
                    semResposta++;
                } else if (c.perguntouTerapeuta) {
                    aposVerTerapeuta++;
                } else if (c.perguntouHorario) {
                    aposVerHorario++;
                } else if (c.perguntouPreco) {
                    aposVerPreco++;
                } else {
                    outros++;
                }
            });

            // Leads sem mensagens registradas
            const leadsNaoClassificados = leadsAbandonadosList.length - Object.keys(classificacao).length;
            semResposta += leadsNaoClassificados;

            const total = leadsAbandonadosList.length || 1;
            const etapas: AbandonoData[] = [
                { etapa: 'Sem resposta inicial', quantidade: semResposta, percentual: Math.round((semResposta / total) * 100) },
                { etapa: 'Após ver preços', quantidade: aposVerPreco, percentual: Math.round((aposVerPreco / total) * 100) },
                { etapa: 'Após ver horários', quantidade: aposVerHorario, percentual: Math.round((aposVerHorario / total) * 100) },
                { etapa: 'Após ver terapeutas', quantidade: aposVerTerapeuta, percentual: Math.round((aposVerTerapeuta / total) * 100) },
                { etapa: 'Outros', quantidade: outros, percentual: Math.round((outros / total) * 100) },
            ].filter(e => e.quantidade > 0).sort((a, b) => b.quantidade - a.quantidade);

            setAbandonoData(etapas);

            // Setar KPIs dinâmicos
            if (etapas.length > 0) {
                setPrincipalEtapa(etapas[0].etapa);
            }

            // Calcular média de mensagens dos leads abandonados
            const msgCounts = Object.values(classificacao).map(c => c.mensagens);
            const avgMsgs = msgCounts.length > 0
                ? msgCounts.reduce((a, b) => a + b, 0) / msgCounts.length
                : 0;
            setMediaMensagens(avgMsgs);

            // Calcular taxa de perda (abandonados / total de leads no período)
            const taxaPerdaCalc = (leadsAbandonadosList.length / (allLeads?.length || 1)) * 100;
            setTaxaPerda(taxaPerdaCalc);

            // Calcular distribuição por hora
            const abandonoPorHoraCalc: Record<number, number> = {};
            leadsAbandonadosList.forEach(lead => {
                const hora = new Date(lead.timestamp).getHours();
                abandonoPorHoraCalc[hora] = (abandonoPorHoraCalc[hora] || 0) + 1;
            });
            const horasPico = Object.entries(abandonoPorHoraCalc)
                .map(([hora, qtd]) => ({ hora: parseInt(hora), quantidade: qtd }))
                .sort((a, b) => b.quantidade - a.quantidade)
                .slice(0, 6);
            setAbandonoPorHora(horasPico);

            setLeadsAbandonados(leadsAbandonadosList.slice(0, 15));
        } catch (error) {
            console.error('Erro ao carregar analytics:', error);
        } finally {
            setIsLoading(false);
        }
    }

    function handleViewConversation(lead: Lead) {
        setSelectedLead(lead);
        setSelectedChatId(lead.chatid);
    }

    function handleExportCSV() {
        exportToCSV(
            abandonoData,
            [
                { key: 'etapa', header: 'Etapa de Abandono' },
                { key: 'quantidade', header: 'Quantidade' },
                { key: 'percentual', header: 'Percentual', format: (v) => `${v}%` },
            ],
            `analise_abandono_${dateRange.label.replace(/\s+/g, '_')}`
        );
        setShowExportMenu(false);
    }

    function handleExportPDF() {
        exportToPDF(
            abandonoData,
            [
                { key: 'etapa', header: 'Etapa de Abandono' },
                { key: 'quantidade', header: 'Quantidade' },
                { key: 'percentual', header: 'Percentual', format: (v) => `${v}%` },
            ],
            `analise_abandono_${dateRange.label.replace(/\s+/g, '_')}`,
            {
                title: 'Análise de Abandono',
                subtitle: dateRange.label,
            }
        );
        setShowExportMenu(false);
    }

    const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: AbandonoData }[] }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="rounded-lg border border-white/10 bg-brand-gray/95 backdrop-blur-xl p-3 shadow-xl">
                    <p className="font-semibold text-white">{data.etapa}</p>
                    <p className="text-sm text-red-400">{data.quantidade} leads</p>
                    <p className="text-xs text-white/60">{data.percentual}% do total</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex min-h-screen bg-brand-black">
            <Sidebar />

            <main className="flex-1 ml-64">
                <Header
                    title="Análise de Abandono"
                    subtitle="Identifique onde os leads estão parando na jornada"
                />

                <div className="p-8">
                    {/* Actions Bar */}
                    <div className="flex items-center justify-between mb-8">
                        <DateFilter value={dateRange} onChange={setDateRange} />

                        {/* Export Dropdown */}
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
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <Card gradient hover>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
                                        <AlertTriangle className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-white/60">Total Abandonados</p>
                                        <p className="text-2xl font-bold text-white">
                                            {isLoading ? '—' : totalAbandonados.toLocaleString('pt-BR')}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card gradient hover>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                                        <TrendingDown className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-white/60">Principal Etapa</p>
                                        <p className="text-lg font-bold text-white">
                                            {isLoading ? '—' : principalEtapa}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card gradient hover>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gold/20 text-brand-gold">
                                        <MessageCircle className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-white/60">Média de Mensagens</p>
                                        <p className="text-2xl font-bold text-white">
                                            {isLoading ? '—' : mediaMensagens.toFixed(1)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card gradient hover>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400">
                                        <Clock className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-white/60">Taxa de Perda</p>
                                        <p className="text-2xl font-bold text-white">
                                            {isLoading ? '—' : `${taxaPerda.toFixed(1)}%`}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* Abandono por Etapa */}
                        <Card gradient hover>
                            <CardHeader>
                                <CardTitle>Abandono por Etapa</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="h-[300px] shimmer rounded-xl" />
                                ) : (
                                    <div className="h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={abandonoData}
                                                layout="vertical"
                                                margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                                                <XAxis
                                                    type="number"
                                                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                                />
                                                <YAxis
                                                    type="category"
                                                    dataKey="etapa"
                                                    tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                                    width={120}
                                                />
                                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(239, 68, 68, 0.1)' }} />
                                                <Bar dataKey="quantidade" radius={[0, 8, 8, 0]} barSize={24}>
                                                    {abandonoData.map((_, index) => (
                                                        <Cell
                                                            key={`cell-${index}`}
                                                            fill={index === 0 ? '#EF4444' : `rgba(239, 68, 68, ${1 - index * 0.15})`}
                                                            className="cursor-pointer"
                                                            onClick={() => setSelectedEtapa(abandonoData[index].etapa)}
                                                        />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Horários Críticos - Dados Reais */}
                        <Card gradient hover>
                            <CardHeader>
                                <CardTitle>Horários Críticos de Abandono</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="h-[300px] shimmer rounded-xl" />
                                ) : (
                                    <div className="space-y-4">
                                        <p className="text-sm text-white/50 mb-4">
                                            Horários com maior volume de leads perdidos
                                        </p>
                                        {abandonoPorHora.length > 0 ? (
                                            abandonoPorHora.map((item, idx) => {
                                                const maxQtd = abandonoPorHora[0].quantidade;
                                                const percentage = (item.quantidade / maxQtd) * 100;
                                                return (
                                                    <div key={item.hora} className="space-y-2">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-white font-medium">
                                                                {item.hora.toString().padStart(2, '0')}:00 - {(item.hora + 1).toString().padStart(2, '0')}:00
                                                            </span>
                                                            <span className="text-red-400">
                                                                {item.quantidade} leads
                                                            </span>
                                                        </div>
                                                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-400 transition-all"
                                                                style={{ width: `${percentage}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <p className="text-white/40 text-center py-8">
                                                Sem dados suficientes
                                            </p>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Lista de Leads Abandonados */}
                    <Card gradient hover>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>
                                Leads Abandonados
                                {selectedEtapa && (
                                    <span className="ml-2 text-sm font-normal text-brand-gold">
                                        - Etapa: {selectedEtapa}
                                    </span>
                                )}
                            </CardTitle>
                            {selectedEtapa && (
                                <button
                                    onClick={() => setSelectedEtapa(null)}
                                    className="text-sm text-white/50 hover:text-white"
                                >
                                    Limpar filtro
                                </button>
                            )}
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="space-y-4">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div key={i} className="h-16 shimmer rounded-xl" />
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {leadsAbandonados.map((lead) => (
                                        <div
                                            key={lead.chatid}
                                            className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4 transition-all hover:border-red-500/30 hover:bg-red-500/5 cursor-pointer"
                                            onClick={() => handleViewConversation(lead)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 text-red-400 font-semibold">
                                                    {(lead.nome || 'S').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{lead.nome || 'Sem nome'}</p>
                                                    <p className="text-sm text-white/50">
                                                        Última interação: {formatTimeAgo(lead.timestamp)}
                                                    </p>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" className="gap-2">
                                                Ver conversa
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>

            {/* Conversation Modal */}
            <ConversationModal
                isOpen={!!selectedChatId}
                onClose={() => {
                    setSelectedChatId(null);
                    setSelectedLead(null);
                }}
                chatId={selectedChatId}
                leadInfo={selectedLead}
            />
        </div>
    );
}
