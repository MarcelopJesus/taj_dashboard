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
    origem_cliente: string | null;
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
            // Buscar leads que não são convertidos (abandonados/ativos sem conversão)
            const { data: leads, count } = await supabase
                .from('taj_leads')
                .select('*', { count: 'exact' })
                .not('status_atendimento', 'eq', 'convertido')
                .gte('timestamp', dateRange.startDate.toISOString())
                .lte('timestamp', dateRange.endDate.toISOString())
                .order('timestamp', { ascending: false });

            setTotalAbandonados(count || 0);

            // Simular etapas de abandono baseado no volume
            const etapas: AbandonoData[] = [
                { etapa: 'Após ver preços', quantidade: Math.round((count || 0) * 0.35), percentual: 35 },
                { etapa: 'Ao escolher horário', quantidade: Math.round((count || 0) * 0.25), percentual: 25 },
                { etapa: 'Sem resposta inicial', quantidade: Math.round((count || 0) * 0.20), percentual: 20 },
                { etapa: 'Ao escolher terapeuta', quantidade: Math.round((count || 0) * 0.12), percentual: 12 },
                { etapa: 'Outros', quantidade: Math.round((count || 0) * 0.08), percentual: 8 },
            ];
            setAbandonoData(etapas);

            if (leads) {
                setLeadsAbandonados(leads.slice(0, 15));
            }
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
                                        <p className="text-lg font-bold text-white">Após ver preços</p>
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
                                        <p className="text-2xl font-bold text-white">6.2</p>
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
                                        <p className="text-sm text-white/60">Tempo até Abandono</p>
                                        <p className="text-2xl font-bold text-white">2.3h</p>
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

                        {/* Heatmap */}
                        <Card gradient hover>
                            <CardHeader>
                                <CardTitle>Horários de Maior Abandono</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="grid grid-cols-7 gap-1 mb-4">
                                            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((dia) => (
                                                <div key={dia} className="text-xs text-white/40 text-center">{dia}</div>
                                            ))}
                                            {Array.from({ length: 28 }).map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="h-8 w-8 rounded"
                                                    style={{
                                                        backgroundColor: `rgba(239, 68, 68, ${Math.random() * 0.5 + 0.1})`,
                                                    }}
                                                />
                                            ))}
                                        </div>
                                        <p className="text-xs text-white/40">Período: 12h - 18h (pico de abandonos)</p>
                                    </div>
                                </div>
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
