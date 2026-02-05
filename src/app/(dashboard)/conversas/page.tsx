'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DateFilter, useDateFilter } from '@/components/ui/DateFilter';
import { ConversationModal } from '@/components/dashboard/ConversationModal';
import { getSupabaseClient } from '@/lib/supabase/client';
import { formatTimeAgo } from '@/lib/utils/format';
import { verificarAgendamentoLead } from '@/lib/utils/agendamentos';
import { exportLeadsCSV, exportLeadsPDF, LeadExportData } from '@/lib/utils/export';
import {
    Search,
    ChevronLeft,
    ChevronRight,
    Eye,
    Download,
    FileText,
    X,
    CalendarCheck
} from 'lucide-react';

interface Lead {
    chatid: string;
    nome: string;
    telefone?: string;
    timestamp: string;
    status_atendimento: string;
    origem_cliente: string | null;
    temAgendamento?: boolean;
}

export default function ConversasPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [leads, setLeads] = useState<Lead[]>([]);
    const [allLeads, setAllLeads] = useState<Lead[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [totalLeads, setTotalLeads] = useState(0);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const perPage = 20;

    // Conversation modal
    const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

    // Date filter
    const { dateRange, setDateRange } = useDateFilter(30);

    const supabase = getSupabaseClient();

    useEffect(() => {
        loadLeads();
    }, [page, searchTerm, dateRange]);

    async function loadLeads() {
        setIsLoading(true);
        try {
            let query = supabase
                .from('taj_leads')
                .select('*', { count: 'exact' })
                .gte('timestamp', dateRange.startDate.toISOString())
                .lte('timestamp', dateRange.endDate.toISOString())
                .order('timestamp', { ascending: false });

            if (searchTerm) {
                query = query.ilike('nome', `%${searchTerm}%`);
            }

            // Get all leads for export
            const { data: allData } = await supabase
                .from('taj_leads')
                .select('*')
                .gte('timestamp', dateRange.startDate.toISOString())
                .lte('timestamp', dateRange.endDate.toISOString())
                .order('timestamp', { ascending: false });

            if (allData) {
                setAllLeads(allData);
            }

            // Get paginated results
            query = query.range((page - 1) * perPage, page * perPage - 1);
            const { data, count } = await query;

            if (data) {
                // Verificar agendamentos para cada lead
                const leadsComAgendamento = await Promise.all(
                    data.map(async (lead) => {
                        const { temAgendamento } = await verificarAgendamentoLead(lead.chatid);
                        return { ...lead, temAgendamento };
                    })
                );
                setLeads(leadsComAgendamento);
                setTotalLeads(count || 0);
            }
        } catch (error) {
            console.error('Erro ao carregar leads:', error);
        } finally {
            setIsLoading(false);
        }
    }

    function handleViewConversation(lead: Lead) {
        setSelectedLead(lead);
        setSelectedChatId(lead.chatid);
    }

    function handleExportCSV() {
        exportLeadsCSV(allLeads as LeadExportData[], dateRange.label);
        setShowExportMenu(false);
    }

    function handleExportPDF() {
        exportLeadsPDF(allLeads as LeadExportData[], dateRange.label);
        setShowExportMenu(false);
    }

    const totalPages = Math.ceil(totalLeads / perPage);

    return (
        <div className="flex min-h-screen bg-brand-black">
            <Sidebar />

            <main className="flex-1 ml-64">
                <Header
                    title="Conversas"
                    subtitle={`${totalLeads.toLocaleString('pt-BR')} conversas encontradas`}
                />

                <div className="p-8">
                    {/* Filters Bar */}
                    <div className="flex flex-wrap items-center gap-4 mb-6">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[250px]">
                            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                            <input
                                type="text"
                                placeholder="Buscar por nome..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setPage(1);
                                }}
                                className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-12 pr-4 text-white placeholder:text-white/40 focus:border-brand-gold/50 focus:outline-none"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Date Filter */}
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
                                            Exportar CSV ({allLeads.length})
                                        </button>
                                        <button
                                            onClick={handleExportPDF}
                                            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                                        >
                                            <FileText className="h-4 w-4" />
                                            Exportar PDF ({allLeads.length})
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Leads List */}
                    <Card gradient>
                        <CardContent className="p-0">
                            {isLoading ? (
                                <div className="space-y-0 divide-y divide-white/5">
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                        <div key={i} className="h-20 shimmer" />
                                    ))}
                                </div>
                            ) : leads.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <Search className="h-12 w-12 text-white/10 mb-4" />
                                    <p className="text-white/50 text-lg">Nenhuma conversa encontrada</p>
                                    <p className="text-white/30 text-sm mt-1">Tente ajustar os filtros de busca</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {leads.map((lead) => (
                                        <div
                                            key={lead.chatid}
                                            onClick={() => handleViewConversation(lead)}
                                            className="flex items-center gap-4 p-4 cursor-pointer transition-all hover:bg-white/5"
                                        >
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold/10 text-brand-gold font-semibold">
                                                {(lead.nome || 'S').charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-white truncate">
                                                        {lead.nome || 'Sem nome'}
                                                    </p>
                                                    {lead.temAgendamento && (
                                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-gold/20 text-brand-gold">
                                                            <CalendarCheck className="h-3 w-3" />
                                                            Agendou
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-sm text-white/50 mt-1">
                                                    <span>{formatTimeAgo(lead.timestamp)}</span>
                                                    {lead.origem_cliente && (
                                                        <>
                                                            <span>•</span>
                                                            <span>{lead.origem_cliente}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" className="gap-2">
                                                <Eye className="h-4 w-4" />
                                                Ver conversa
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between border-t border-white/5 p-4">
                                    <p className="text-sm text-white/50">
                                        Mostrando {((page - 1) * perPage) + 1} - {Math.min(page * perPage, totalLeads)} de {totalLeads}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            Anterior
                                        </Button>

                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                let pageNum: number;
                                                if (totalPages <= 5) {
                                                    pageNum = i + 1;
                                                } else if (page <= 3) {
                                                    pageNum = i + 1;
                                                } else if (page >= totalPages - 2) {
                                                    pageNum = totalPages - 4 + i;
                                                } else {
                                                    pageNum = page - 2 + i;
                                                }

                                                return (
                                                    <button
                                                        key={pageNum}
                                                        onClick={() => setPage(pageNum)}
                                                        className={`h-8 w-8 rounded-lg text-sm font-medium transition-colors ${page === pageNum
                                                                ? 'bg-brand-gold text-brand-black'
                                                                : 'text-white/50 hover:bg-white/5 hover:text-white'
                                                            }`}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                            disabled={page === totalPages}
                                        >
                                            Próximo
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
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
