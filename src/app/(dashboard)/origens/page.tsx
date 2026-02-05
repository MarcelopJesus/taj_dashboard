'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DateFilter, useDateFilter } from '@/components/ui/DateFilter';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from 'recharts';
import { getSupabaseClient } from '@/lib/supabase/client';
import { exportToCSV, exportToPDF } from '@/lib/utils/export';
import { Instagram, Search, Users, Globe, Phone, HelpCircle, TrendingUp, Target, Download, FileText } from 'lucide-react';

interface OrigemData {
    origem: string;
    total: number;
    convertidos: number;
    percentual: number;
    taxaConversao: number;
}

const COLORS = ['#D4AF37', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899', '#3B82F6'];

const origemIcons: Record<string, React.ReactNode> = {
    instagram: <Instagram className="h-5 w-5" />,
    google: <Search className="h-5 w-5" />,
    indicacao: <Users className="h-5 w-5" />,
    facebook: <Globe className="h-5 w-5" />,
    site: <Globe className="h-5 w-5" />,
    whatsapp_direto: <Phone className="h-5 w-5" />,
    outro: <HelpCircle className="h-5 w-5" />,
    'Não identificado': <HelpCircle className="h-5 w-5" />,
};

const origemLabels: Record<string, string> = {
    instagram: 'Instagram',
    google: 'Google',
    indicacao: 'Indicação',
    facebook: 'Facebook',
    site: 'Site',
    whatsapp_direto: 'WhatsApp Direto',
    outro: 'Outro',
    'Não identificado': 'Não Identificado',
};

export default function OrigensPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [origemData, setOrigemData] = useState<OrigemData[]>([]);
    const [totalLeads, setTotalLeads] = useState(0);
    const [melhorOrigem, setMelhorOrigem] = useState<OrigemData | null>(null);
    const [showExportMenu, setShowExportMenu] = useState(false);

    // Date filter
    const { dateRange, setDateRange } = useDateFilter(30);

    const supabase = getSupabaseClient();

    useEffect(() => {
        loadOrigemData();
    }, [dateRange]);

    async function loadOrigemData() {
        setIsLoading(true);
        try {
            const { data: leads } = await supabase
                .from('taj_leads')
                .select('origem_cliente, status_atendimento')
                .gte('timestamp', dateRange.startDate.toISOString())
                .lte('timestamp', dateRange.endDate.toISOString());

            if (leads) {
                // Agrupar por origem
                const stats: Record<string, { total: number; convertidos: number }> = {};

                leads.forEach(lead => {
                    const origem = lead.origem_cliente || 'Não identificado';
                    if (!stats[origem]) {
                        stats[origem] = { total: 0, convertidos: 0 };
                    }
                    stats[origem].total++;
                    if (lead.status_atendimento === 'convertido') {
                        stats[origem].convertidos++;
                    }
                });

                const total = leads.length || 1;
                setTotalLeads(total);

                const data = Object.entries(stats)
                    .map(([origem, stat]) => ({
                        origem,
                        total: stat.total,
                        convertidos: stat.convertidos,
                        percentual: (stat.total / total) * 100,
                        taxaConversao: stat.total ? (stat.convertidos / stat.total) * 100 : 0,
                    }))
                    .sort((a, b) => b.total - a.total);

                setOrigemData(data);

                // Encontrar melhor origem por taxa de conversão (com mínimo de 10 leads)
                const origensComVolume = data.filter(d => d.total >= 10);
                const melhor = origensComVolume.length > 0
                    ? origensComVolume.reduce((prev, curr) =>
                        curr.taxaConversao > prev.taxaConversao ? curr : prev
                    )
                    : data[0];
                setMelhorOrigem(melhor);
            }
        } catch (error) {
            console.error('Erro ao carregar origens:', error);
        } finally {
            setIsLoading(false);
        }
    }

    function handleExportCSV() {
        exportToCSV(
            origemData.map(item => ({
                ...item,
                origem: origemLabels[item.origem] || item.origem,
            })),
            [
                { key: 'origem', header: 'Origem' },
                { key: 'total', header: 'Total de Leads' },
                { key: 'convertidos', header: 'Convertidos' },
                { key: 'percentual', header: '% do Total', format: (v) => `${Number(v).toFixed(1)}%` },
                { key: 'taxaConversao', header: 'Taxa de Conversão', format: (v) => `${Number(v).toFixed(1)}%` },
            ],
            `origens_leads_${dateRange.label.replace(/\s+/g, '_')}`
        );
        setShowExportMenu(false);
    }

    function handleExportPDF() {
        exportToPDF(
            origemData.map(item => ({
                ...item,
                origem: origemLabels[item.origem] || item.origem,
            })),
            [
                { key: 'origem', header: 'Origem' },
                { key: 'total', header: 'Total' },
                { key: 'convertidos', header: 'Convertidos' },
                { key: 'percentual', header: '% Total', format: (v) => `${Number(v).toFixed(1)}%` },
                { key: 'taxaConversao', header: 'Taxa Conv.', format: (v) => `${Number(v).toFixed(1)}%` },
            ],
            `origens_leads_${dateRange.label.replace(/\s+/g, '_')}`,
            {
                title: 'Relatório de Origens de Leads',
                subtitle: dateRange.label,
            }
        );
        setShowExportMenu(false);
    }

    const pieData = origemData.map(item => ({
        name: origemLabels[item.origem] || item.origem,
        value: item.total,
    }));

    const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: { name: string; value: number } }[] }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="rounded-lg border border-white/10 bg-brand-gray/95 backdrop-blur-xl p-3 shadow-xl">
                    <p className="font-semibold text-white">{data.name}</p>
                    <p className="text-sm text-brand-gold">{data.value} leads</p>
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
                    title="Origem de Leads"
                    subtitle="Análise de performance por canal de aquisição"
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <Card gradient hover>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gold/20 text-brand-gold">
                                        <Target className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-white/60">Total de Origens</p>
                                        <p className="text-2xl font-bold text-white">
                                            {isLoading ? '—' : origemData.length}
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
                                        <p className="text-sm text-white/60">Melhor Taxa de Conversão</p>
                                        <p className="text-xl font-bold text-white">
                                            {isLoading ? '—' : melhorOrigem ? (
                                                <>
                                                    {origemLabels[melhorOrigem.origem] || melhorOrigem.origem}
                                                    <span className="text-emerald-400 text-sm ml-2">
                                                        ({melhorOrigem.taxaConversao.toFixed(1)}%)
                                                    </span>
                                                </>
                                            ) : '—'}
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
                                            {isLoading ? '—' : totalLeads.toLocaleString('pt-BR')}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* Pie Chart */}
                        <Card gradient hover>
                            <CardHeader>
                                <CardTitle>Distribuição por Origem</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="h-[300px] shimmer rounded-xl" />
                                ) : (
                                    <div className="h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={pieData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={100}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {pieData.map((_, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<CustomTooltip />} />
                                                <Legend
                                                    formatter={(value) => (
                                                        <span className="text-white/70 text-sm">{value}</span>
                                                    )}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Bar Chart - Taxa de Conversão */}
                        <Card gradient hover>
                            <CardHeader>
                                <CardTitle>Taxa de Conversão por Origem</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="h-[300px] shimmer rounded-xl" />
                                ) : (
                                    <div className="h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={origemData.map(item => ({
                                                    ...item,
                                                    nome: origemLabels[item.origem] || item.origem,
                                                }))}
                                                layout="vertical"
                                                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                                                <XAxis
                                                    type="number"
                                                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                                                    domain={[0, 100]}
                                                    tickFormatter={(value) => `${value}%`}
                                                />
                                                <YAxis
                                                    type="category"
                                                    dataKey="nome"
                                                    tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                                                    width={100}
                                                />
                                                <Tooltip
                                                    formatter={(value) => value !== undefined ? [`${Number(value).toFixed(1)}%`, 'Taxa'] : ['0%', 'Taxa']}
                                                    contentStyle={{
                                                        backgroundColor: 'rgba(20, 20, 20, 0.95)',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        borderRadius: '8px',
                                                    }}
                                                />
                                                <Bar dataKey="taxaConversao" radius={[0, 8, 8, 0]} barSize={20}>
                                                    {origemData.map((_, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Tabela Detalhada */}
                    <Card gradient hover>
                        <CardHeader>
                            <CardTitle>Performance Detalhada por Origem</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="h-64 shimmer rounded-xl" />
                            ) : (
                                <div className="overflow-hidden rounded-xl border border-white/5">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-white/5">
                                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/50">
                                                    Origem
                                                </th>
                                                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-white/50">
                                                    Total Leads
                                                </th>
                                                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-white/50">
                                                    Convertidos
                                                </th>
                                                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-white/50">
                                                    % do Total
                                                </th>
                                                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-white/50">
                                                    Taxa Conversão
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {origemData.map((item, index) => (
                                                <tr key={item.origem} className="hover:bg-white/5 transition-colors">
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="flex h-10 w-10 items-center justify-center rounded-lg"
                                                                style={{ backgroundColor: `${COLORS[index % COLORS.length]}20`, color: COLORS[index % COLORS.length] }}
                                                            >
                                                                {origemIcons[item.origem] || origemIcons.outro}
                                                            </div>
                                                            <span className="font-medium text-white">
                                                                {origemLabels[item.origem] || item.origem}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-white">
                                                        {item.total.toLocaleString('pt-BR')}
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-emerald-400">
                                                        {item.convertidos.toLocaleString('pt-BR')}
                                                    </td>
                                                    <td className="px-4 py-4 text-right text-white/70">
                                                        {item.percentual.toFixed(1)}%
                                                    </td>
                                                    <td className="px-4 py-4 text-right">
                                                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${item.taxaConversao >= 10
                                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                                : item.taxaConversao >= 5
                                                                    ? 'bg-amber-500/20 text-amber-400'
                                                                    : 'bg-red-500/20 text-red-400'
                                                            }`}>
                                                            {item.taxaConversao.toFixed(1)}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
