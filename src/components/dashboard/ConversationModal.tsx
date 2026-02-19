'use client';

import { useEffect, useState, useRef } from 'react';
import { X, User, Bot, Download, Copy, Check, MessageCircle, Clock, Phone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getSupabaseClient } from '@/lib/supabase/client';
import { formatDateTime, formatTimeAgo, formatPhone } from '@/lib/utils/format';

interface Mensagem {
    id: number;
    chatid: string;
    conversation: {
        role: 'user' | 'model';
        parts: { text: string }[];
    };
    timestamp: string;
}

interface Lead {
    chatid: string;
    nome: string;
    telefone?: string;
    timestamp: string;
    status_atendimento: string;
    origem_cliente_taj?: string | null;
}

interface ConversationModalProps {
    isOpen: boolean;
    onClose: () => void;
    chatId: string | null;
    leadInfo?: Lead | null;
}

export function ConversationModal({ isOpen, onClose, chatId, leadInfo }: ConversationModalProps) {
    const [mensagens, setMensagens] = useState<Mensagem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lead, setLead] = useState<Lead | null>(leadInfo || null);
    const [copied, setCopied] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const supabase = getSupabaseClient();

    useEffect(() => {
        if (isOpen && chatId) {
            loadConversation();
        }
    }, [isOpen, chatId]);

    useEffect(() => {
        // Scroll to bottom when messages load
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [mensagens]);

    async function loadConversation() {
        if (!chatId) return;
        setIsLoading(true);

        try {
            // Load lead info if not provided
            if (!leadInfo) {
                const { data: leadData } = await supabase
                    .from('taj_leads')
                    .select('*')
                    .eq('chatid', chatId)
                    .single();

                if (leadData) {
                    setLead(leadData);
                }
            } else {
                setLead(leadInfo);
            }

            // Load messages
            const { data: msgs } = await supabase
                .from('taj_mensagens')
                .select('*')
                .eq('chatid', chatId);

            if (msgs) {
                // 1. Ordenar por timestamp (convertendo para Date para garantir ordem correta)
                const msgsSorted = [...msgs].sort((a, b) => {
                    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
                });

                // 2. Filtrar mensagens válidas (apenas user e model, com texto)
                const msgsFiltered = msgsSorted.filter(msg => {
                    const role = msg.conversation?.role;
                    const text = msg.conversation?.parts?.[0]?.text || '';

                    // Ignorar mensagens do tipo function
                    if (role === 'function') return false;

                    // Ignorar mensagens sem texto (vazias)
                    if (!text.trim()) return false;

                    // Apenas user e model
                    return role === 'user' || role === 'model';
                });

                // 3. Remover duplicatas (mesma mensagem no mesmo segundo)
                const msgsUnique: typeof msgs = [];
                const seen = new Set<string>();

                for (const msg of msgsFiltered) {
                    const text = msg.conversation?.parts?.[0]?.text || '';
                    const key = `${msg.conversation?.role}-${text.substring(0, 100)}-${msg.timestamp}`;

                    if (!seen.has(key)) {
                        seen.add(key);
                        msgsUnique.push(msg);
                    }
                }

                setMensagens(msgsUnique);
            }
        } catch (error) {
            console.error('Erro ao carregar conversa:', error);
        } finally {
            setIsLoading(false);
        }
    }

    function handleCopyConversation() {
        const text = mensagens
            .map((msg) => {
                const role = msg.conversation.role === 'user' ? '👤 Cliente' : '🤖 Bot';
                const content = msg.conversation.parts?.[0]?.text || '';
                return `${role} (${formatDateTime(msg.timestamp)}):\n${content}`;
            })
            .join('\n\n---\n\n');

        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    function handleExportTxt() {
        const header = `Conversa com ${lead?.nome || 'Cliente'}\nChatID: ${chatId}\nData: ${formatDateTime(lead?.timestamp || '')}\n${'='.repeat(50)}\n\n`;

        const text = mensagens
            .map((msg) => {
                const role = msg.conversation.role === 'user' ? 'CLIENTE' : 'BOT';
                const content = msg.conversation.parts?.[0]?.text || '';
                return `[${formatDateTime(msg.timestamp)}] ${role}:\n${content}`;
            })
            .join('\n\n');

        const blob = new Blob([header + text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conversa_${lead?.nome?.replace(/\s+/g, '_') || chatId}_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-4 z-50 flex items-center justify-center">
                <div className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl border border-white/10 bg-brand-gray shadow-2xl flex flex-col animate-fade-in overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-white/5 p-6">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold/20 text-brand-gold font-bold text-lg">
                                {(lead?.nome || 'C').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">
                                    {lead?.nome || 'Cliente'}
                                </h2>
                                <div className="flex items-center gap-4 text-sm text-white/50">
                                    {lead?.telefone && (
                                        <span className="flex items-center gap-1">
                                            <Phone className="h-3 w-3" />
                                            {formatPhone(lead.telefone)}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatTimeAgo(lead?.timestamp || '')}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <MessageCircle className="h-3 w-3" />
                                        {mensagens.length} mensagens
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCopyConversation}
                                className="gap-2"
                            >
                                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                {copied ? 'Copiado!' : 'Copiar'}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleExportTxt}
                                className="gap-2"
                            >
                                <Download className="h-4 w-4" />
                                Exportar
                            </Button>
                            <button
                                onClick={onClose}
                                className="flex h-10 w-10 items-center justify-center rounded-xl text-white/50 hover:bg-white/5 hover:text-white transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Status Badge */}
                    {lead?.status_atendimento && (
                        <div className="px-6 py-3 border-b border-white/5 flex items-center gap-3">
                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${lead.status_atendimento === 'convertido'
                                ? 'bg-brand-gold/20 text-brand-gold'
                                : lead.status_atendimento === 'ativo'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-red-500/20 text-red-400'
                                }`}>
                                {lead.status_atendimento}
                            </span>
                            {lead.origem_cliente_taj && (
                                <span className="text-sm text-white/50">
                                    Origem: <span className="text-white/70">{lead.origem_cliente_taj}</span>
                                </span>
                            )}
                        </div>
                    )}

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {isLoading ? (
                            <div className="space-y-4">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className={`flex gap-3 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
                                        <div className="h-8 w-8 rounded-full shimmer" />
                                        <div className="h-16 w-2/3 rounded-xl shimmer" />
                                    </div>
                                ))}
                            </div>
                        ) : mensagens.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center py-12">
                                <MessageCircle className="h-16 w-16 text-white/10 mb-4" />
                                <p className="text-white/50 text-lg">Nenhuma mensagem encontrada</p>
                                <p className="text-white/30 text-sm mt-1">Esta conversa não possui mensagens registradas</p>
                            </div>
                        ) : (
                            mensagens.map((msg, index) => {
                                const isUser = msg.conversation.role === 'user';
                                const text = msg.conversation.parts?.[0]?.text || '';
                                const prevMsg = mensagens[index - 1];

                                // Verificar se é um novo dia
                                const msgDate = new Date(msg.timestamp);
                                const prevDate = prevMsg ? new Date(prevMsg.timestamp) : null;
                                const isNewDay = !prevDate ||
                                    msgDate.toDateString() !== prevDate.toDateString();

                                // Formatar data do dia
                                const formatDayLabel = (date: Date) => {
                                    const today = new Date();
                                    const yesterday = new Date(today);
                                    yesterday.setDate(yesterday.getDate() - 1);

                                    if (date.toDateString() === today.toDateString()) {
                                        return 'Hoje';
                                    } else if (date.toDateString() === yesterday.toDateString()) {
                                        return 'Ontem';
                                    } else {
                                        return date.toLocaleDateString('pt-BR', {
                                            weekday: 'long',
                                            day: '2-digit',
                                            month: 'long',
                                            year: 'numeric'
                                        });
                                    }
                                };

                                // Formatar horário HH:MM
                                const formatTime = (timestamp: string) => {
                                    return new Date(timestamp).toLocaleTimeString('pt-BR', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    });
                                };

                                return (
                                    <div key={msg.id}>
                                        {/* Separador de dia */}
                                        {isNewDay && (
                                            <div className="flex justify-center my-6">
                                                <span className="text-xs text-white/50 bg-white/10 px-4 py-1.5 rounded-full font-medium">
                                                    {formatDayLabel(msgDate)}
                                                </span>
                                            </div>
                                        )}

                                        {/* Mensagem */}
                                        <div className={`flex gap-3 mb-3 ${isUser ? '' : 'flex-row-reverse'}`}>
                                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isUser ? 'bg-brand-gold/20 text-brand-gold' : 'bg-purple-500/20 text-purple-400'
                                                }`}>
                                                {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                                            </div>
                                            <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${isUser
                                                ? 'bg-brand-gold/10 border border-brand-gold/20 rounded-tl-sm'
                                                : 'bg-white/5 border border-white/5 rounded-tr-sm'
                                                }`}>
                                                <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{text}</p>
                                                <p className={`text-[10px] mt-1 ${isUser ? 'text-brand-gold/50' : 'text-white/30'}`}>
                                                    {formatTime(msg.timestamp)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
            </div>
        </>
    );
}
