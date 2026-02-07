'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConversationModal } from '@/components/dashboard/ConversationModal';
import { getSupabaseClient } from '@/lib/supabase/client';
import { formatTimeAgo } from '@/lib/utils/format';
import { exportToCSV, exportToPDF } from '@/lib/utils/export';
import {
    Users,
    Crown,
    AlertTriangle,
    Snowflake,
    Download,
    FileText,
    Eye,
    Phone,
    MessageSquare,
    Calendar
} from 'lucide-react';

interface LeadSegmentado {
    chatid: string;
    nome: string;
    telefone?: string;
    timestamp: string;
    qtdMensagens: number;
    qtdAgendamentos: number;
    segmento: 'verde' | 'dourado' | 'amarelo' | 'vermelho';
    ultimaInteracao: string;
}

const segmentoConfig = {
    dourado: {
        label: 'VIP (2+ agendamentos)',
        color: 'from-yellow-500 to-amber-600',
        bgColor: 'bg-yellow-500/20',
        textColor: 'text-yellow-400',
        borderColor: 'border-yellow-500/30',
        icon: Crown,
    },
    verde: {
        label: 'Convertido (1 agendamento)',
        color: 'from-emerald-500 to-green-600',
        bgColor: 'bg-emerald-500/20',
        textColor: 'text-emerald-400',
        borderColor: 'border-emerald-500/30',
        icon: Users,
    },
    amarelo: {
        label: 'Interesse Alto (5+ msgs)',
        color: 'from-orange-500 to-amber-500',
        bgColor: 'bg-orange-500/20',
        textColor: 'text-orange-400',
        borderColor: 'border-orange-500/30',
        icon: MessageSquare,
    },
    vermelho: {
        label: 'Frio (1-2 msgs)',
        color: 'from-red-500 to-rose-600',
        bgColor: 'bg-red-500/20',
        textColor: 'text-red-400',
        borderColor: 'border-red-500/30',
        icon: Snowflake,
    },
};

export default function SegmentacaoPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [leads, setLeads] = useState<LeadSegmentado[]>([]);
    const [filtroSegmento, setFiltroSegmento] = useState<string | null>(null);
    const [showExportMenu, setShowExportMenu] = useState(false);

    // Modal de conversa
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [selectedLead, setSelectedLead] = useState<LeadSegmentado | null>(null);

    // Contadores
    const [contadores, setContadores] = useState({
        dourado: 0,
        verde: 0,
        amarelo: 0,
        vermelho: 0,
    });

    const supabase = getSupabaseClient();

    useEffect(() => {
        loadLeads();
    }, []);

    async function loadLeads() {
        setIsLoading(true);
        try {
            // 1. Buscar todos os leads
            const { data: allLeads } = await supabase
                .from('taj_leads')
                .select('chatid, nome, timestamp')
                .order('timestamp', { ascending: false });

            // 2. Buscar agendamentos por chatId
            const { data: agendamentos } = await supabase
                .from('taj_agendamentos')
                .select('chatid');

            // Contar agendamentos por lead
            const agendamentosPorLead: Record<string, number> = {};
            agendamentos?.forEach(a => {
                agendamentosPorLead[a.chatid] = (agendamentosPorLead[a.chatid] || 0) + 1;
            });

            // 3. Buscar contagem de mensagens por chatId
            const { data: mensagens } = await supabase
                .from('taj_mensagens')
                .select('chatid, timestamp')
                .order('timestamp', { ascending: false });

            // Contar mensagens e última interação por lead
            const msgPorLead: Record<string, { count: number; ultima: string }> = {};
            mensagens?.forEach(m => {
                if (!msgPorLead[m.chatid]) {
                    msgPorLead[m.chatid] = { count: 0, ultima: m.timestamp };
                }
                msgPorLead[m.chatid].count++;
            });

            // 4. Classificar cada lead
            const leadsSegmentados: LeadSegmentado[] = (allLeads || []).map(lead => {
                const qtdAgendamentos = agendamentosPorLead[lead.chatid] || 0;
                const msgInfo = msgPorLead[lead.chatid] || { count: 0, ultima: lead.timestamp };

                let segmento: LeadSegmentado['segmento'];

                if (qtdAgendamentos >= 2) {
                    segmento = 'dourado';
                } else if (qtdAgendamentos === 1) {
                    segmento = 'verde';
                } else if (msgInfo.count >= 5) {
                    segmento = 'amarelo';
                } else {
                    segmento = 'vermelho';
                }

                return {
                    chatid: lead.chatid,
                    nome: lead.nome || 'Sem nome',
                    timestamp: lead.timestamp,
                    qtdMensagens: msgInfo.count,
                    qtdAgendamentos,
                    segmento,
                    ultimaInteracao: msgInfo.ultima,
                };
            });

            // 5. Calcular contadores
            const counts = {
                dourado: leadsSegmentados.filter(l => l.segmento === 'dourado').length,
                verde: leadsSegmentados.filter(l => l.segmento === 'verde').length,
                amarelo: leadsSegmentados.filter(l => l.segmento === 'amarelo').length,
                vermelho: leadsSegmentados.filter(l => l.segmento === 'vermelho').length,
            };
            setContadores(counts);

            setLeads(leadsSegmentados);
        } catch (error) {
            console.error('Erro ao carregar leads:', error);
        } finally {
            setIsLoading(false);
        }
    }

    function handleViewConversation(lead: LeadSegmentado) {
        setSelectedLead(lead);
        setSelectedChatId(lead.chatid);
    }

    function handleExportCSV() {
        const dataToExport = filtroSegmento
            ? leads.filter(l => l.segmento === filtroSegmento)
            : leads;

        exportToCSV(
            dataToExport.map(l => ({
                ...l,
                segmentoLabel: segmentoConfig[l.segmento].label,
            })),
            [
                { key: 'nome', header: 'Nome' },
                { key: 'segmentoLabel', header: 'Segmento' },
                { key: 'qtdMensagens', header: 'Qtd Mensagens' },
                { key: 'qtdAgendamentos', header: 'Qtd Agendamentos' },
                { key: 'ultimaInteracao', header: 'Última Interação' },
            ],
            `segmentacao_leads_${filtroSegmento || 'todos'}`
        );
        setShowExportMenu(false);
    }

    function handleExportPDF() {
        const dataToExport = filtroSegmento
            ? leads.filter(l => l.segmento === filtroSegmento)
            : leads;

        exportToPDF(
            dataToExport.map(l => ({
                ...l,
                segmentoLabel: segmentoConfig[l.segmento].label,
            })),
            [
                { key: 'nome', header: 'Nome' },
                { key: 'segmentoLabel', header: 'Segmento' },
                { key: 'qtdMensagens', header: 'Msgs' },
                { key: 'qtdAgendamentos', header: 'Agend.' },
            ],
            `segmentacao_leads_${filtroSegmento || 'todos'}`,
            {
                title: 'Segmentação de Leads',
                subtitle: filtroSegmento
                    ? segmentoConfig[filtroSegmento as keyof typeof segmentoConfig].label
                    : 'Todos os Segmentos',
            }
        );
        setShowExportMenu(false);
    }

    const leadsFiltrados = filtroSegmento
        ? leads.filter(l => l.segmento === filtroSegmento)
        : leads;

    return (
        <div className="flex min-h-screen bg-brand-black">
            <Sidebar />

            <main className="flex-1 ml-64">
                <Header
                    title="Segmentação de Leads"
                    subtitle="Classifique e priorize seus leads por comportamento"
                />

                <div className="p-8">
                    {/* Cards de Resumo */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        {(['dourado', 'verde', 'amarelo', 'vermelho'] as const).map((seg) => {
                            const config = segmentoConfig[seg];
                            const Icon = config.icon;
                            const isSelected = filtroSegmento === seg;

                            return (
                                <Card
                                    key={seg}
                                    gradient
                                    hover
                                    className={`cursor-pointer transition-all ${isSelected ? `ring-2 ${config.borderColor.replace('border-', 'ring-')}` : ''}`}
                                    onClick={() => setFiltroSegmento(isSelected ? null : seg)}
                                >
                                    <CardContent className="pt-6">
                                        <div className="flex items-center gap-4">
                                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${config.bgColor} ${config.textColor}`}>
                                                <Icon className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-white/60">{config.label}</p>
                                                <p className="text-2xl font-bold text-white">
                                                    {isLoading ? '—' : contadores[seg].toLocaleString('pt-BR')}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-4">
                            <p className="text-white/70">
                                {filtroSegmento ? (
                                    <>Mostrando <span className={segmentoConfig[filtroSegmento as keyof typeof segmentoConfig].textColor}>{leadsFiltrados.length}</span> leads</>
                                ) : (
                                    <>Total: <span className="text-white font-medium">{leads.length}</span> leads</>
                                )}
                            </p>
                            {filtroSegmento && (
                                <button
                                    onClick={() => setFiltroSegmento(null)}
                                    className="text-sm text-brand-gold hover:underline"
                                >
                                    Limpar filtro
                                </button>
                            )}
                        </div>

                        {/* Export */}
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

                    {/* Lista de Leads */}
                    <Card gradient>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="p-8 space-y-4">
                                    {[1, 2, 3, 4, 5].map((i) => (
                                        <div key={i} className="h-16 shimmer rounded-xl" />
                                    ))}
                                </div>
                            ) : (
                                <div className="overflow-hidden rounded-xl">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-white/5 border-b border-white/5">
                                                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white/50">
                                                    Lead
                                                </th>
                                                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white/50">
                                                    Segmento
                                                </th>
                                                <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider text-white/50">
                                                    Mensagens
                                                </th>
                                                <th className="px-6 py-4 text-center text-xs font-medium uppercase tracking-wider text-white/50">
                                                    Agendamentos
                                                </th>
                                                <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-white/50">
                                                    Última Interação
                                                </th>
                                                <th className="px-6 py-4 text-right text-xs font-medium uppercase tracking-wider text-white/50">
                                                    Ação
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {leadsFiltrados.slice(0, 50).map((lead) => {
                                                const config = segmentoConfig[lead.segmento];

                                                return (
                                                    <tr
                                                        key={lead.chatid}
                                                        className={`hover:bg-white/5 transition-colors ${config.borderColor} border-l-4`}
                                                    >
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${config.bgColor} ${config.textColor} font-semibold`}>
                                                                    {lead.nome.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div>
                                                                    <p className="font-medium text-white">{lead.nome}</p>
                                                                    <p className="text-xs text-white/40">{lead.chatid.slice(-8)}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${config.bgColor} ${config.textColor}`}>
                                                                <config.icon className="h-3 w-3" />
                                                                {config.label.split(' ')[0]}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex items-center justify-center gap-1 text-white/70">
                                                                <MessageSquare className="h-4 w-4" />
                                                                {lead.qtdMensagens}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex items-center justify-center gap-1 text-white/70">
                                                                <Calendar className="h-4 w-4" />
                                                                {lead.qtdAgendamentos}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white/60">
                                                            {formatTimeAgo(lead.ultimaInteracao)}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleViewConversation(lead)}
                                                                className="gap-2"
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                                Ver
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>

                                    {leadsFiltrados.length > 50 && (
                                        <div className="p-4 text-center text-white/50 text-sm border-t border-white/5">
                                            Mostrando 50 de {leadsFiltrados.length} leads. Exporte para ver todos.
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </main>

            {/* Modal de Conversa */}
            <ConversationModal
                isOpen={!!selectedChatId}
                onClose={() => {
                    setSelectedChatId(null);
                    setSelectedLead(null);
                }}
                chatId={selectedChatId}
                leadInfo={selectedLead ? {
                    chatid: selectedLead.chatid,
                    nome: selectedLead.nome,
                    timestamp: selectedLead.timestamp,
                    status_atendimento: selectedLead.segmento,
                    origem_cliente: null,
                } : null}
            />
        </div>
    );
}
