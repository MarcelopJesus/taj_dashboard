'use client';

import { cn } from "@/lib/utils/cn";
import { formatTimeAgo } from "@/lib/utils/format";
import type { LeadRecente } from "@/types/database";
import { Eye, MessageCircle, Instagram, Search, Users, Globe, Phone, HelpCircle } from "lucide-react";

interface LeadsTableProps {
    leads: LeadRecente[];
    onViewLead?: (chatid: string) => void;
}

const statusStyles = {
    ativo: {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        label: 'Ativo',
    },
    convertido: {
        bg: 'bg-brand-gold/20',
        text: 'text-brand-gold',
        label: 'Convertido',
    },
    abandonado: {
        bg: 'bg-red-500/20',
        text: 'text-red-400',
        label: 'Abandonado',
    },
    pendente: {
        bg: 'bg-amber-500/20',
        text: 'text-amber-400',
        label: 'Pendente',
    },
};

const origemIcons: Record<string, React.ReactNode> = {
    instagram: <Instagram className="h-4 w-4" />,
    google: <Search className="h-4 w-4" />,
    indicacao: <Users className="h-4 w-4" />,
    facebook: <Globe className="h-4 w-4" />,
    site: <Globe className="h-4 w-4" />,
    whatsapp_direto: <Phone className="h-4 w-4" />,
    outro: <HelpCircle className="h-4 w-4" />,
};

export function LeadsTable({ leads, onViewLead }: LeadsTableProps) {
    return (
        <div className="overflow-hidden rounded-xl border border-white/5">
            {/* Header */}
            <div className="grid grid-cols-5 gap-4 bg-white/5 px-4 py-3 text-xs font-medium uppercase tracking-wider text-white/50">
                <div>Nome</div>
                <div>Origem</div>
                <div>Status</div>
                <div>Última Mensagem</div>
                <div className="text-right">Ação</div>
            </div>

            {/* Body */}
            <div className="divide-y divide-white/5">
                {leads.map((lead) => {
                    const status = statusStyles[lead.status] || statusStyles.pendente;
                    const origemIcon = origemIcons[lead.origem] || origemIcons.outro;

                    return (
                        <div
                            key={lead.chatid}
                            className="grid grid-cols-5 gap-4 px-4 py-4 transition-colors hover:bg-white/5 items-center"
                        >
                            {/* Nome */}
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gold/10 text-brand-gold font-semibold text-sm">
                                    {lead.nome.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-medium text-white truncate">{lead.nome}</span>
                            </div>

                            {/* Origem */}
                            <div className="flex items-center gap-2 text-white/60">
                                <span className="text-brand-gold">{origemIcon}</span>
                                <span className="text-sm capitalize">{lead.origem.replace('_', ' ')}</span>
                            </div>

                            {/* Status */}
                            <div>
                                <span
                                    className={cn(
                                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                                        status.bg,
                                        status.text
                                    )}
                                >
                                    {status.label}
                                </span>
                            </div>

                            {/* Última Mensagem */}
                            <div className="text-sm text-white/50">
                                {formatTimeAgo(lead.tempoDecorrido)}
                            </div>

                            {/* Ação */}
                            <div className="flex justify-end">
                                <button
                                    onClick={() => onViewLead?.(lead.chatid)}
                                    className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-all hover:bg-brand-gold/20 hover:text-brand-gold"
                                >
                                    <Eye className="h-3.5 w-3.5" />
                                    Ver
                                </button>
                            </div>
                        </div>
                    );
                })}

                {leads.length === 0 && (
                    <div className="px-4 py-12 text-center">
                        <MessageCircle className="mx-auto h-12 w-12 text-white/20 mb-4" />
                        <p className="text-white/50">Nenhum lead encontrado</p>
                    </div>
                )}
            </div>
        </div>
    );
}
