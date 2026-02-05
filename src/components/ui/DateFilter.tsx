'use client';

import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface DateRange {
    startDate: Date;
    endDate: Date;
    label: string;
}

interface DateFilterProps {
    value: DateRange;
    onChange: (range: DateRange) => void;
    className?: string;
}

const presetRanges = [
    {
        label: 'Hoje',
        getValue: () => {
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            return { startDate: start, endDate: end };
        }
    },
    {
        label: 'Últimos 7 dias',
        getValue: () => {
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            const start = subDays(new Date(), 7);
            start.setHours(0, 0, 0, 0);
            return { startDate: start, endDate: end };
        }
    },
    {
        label: 'Últimos 30 dias',
        getValue: () => {
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            const start = subDays(new Date(), 30);
            start.setHours(0, 0, 0, 0);
            return { startDate: start, endDate: end };
        }
    },
    {
        label: 'Este mês',
        getValue: () => {
            const start = startOfMonth(new Date());
            const end = endOfMonth(new Date());
            end.setHours(23, 59, 59, 999);
            return { startDate: start, endDate: end };
        }
    },
    {
        label: 'Mês passado',
        getValue: () => {
            const start = startOfMonth(subMonths(new Date(), 1));
            const end = endOfMonth(subMonths(new Date(), 1));
            end.setHours(23, 59, 59, 999);
            return { startDate: start, endDate: end };
        }
    },
    {
        label: 'Últimos 90 dias',
        getValue: () => {
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            const start = subDays(new Date(), 90);
            start.setHours(0, 0, 0, 0);
            return { startDate: start, endDate: end };
        }
    },
    {
        label: 'Este ano',
        getValue: () => {
            const start = startOfYear(new Date());
            const end = new Date();
            end.setHours(23, 59, 59, 999);
            return { startDate: start, endDate: end };
        }
    },
];

export function DateFilter({ value, onChange, className = '' }: DateFilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    function handlePresetClick(preset: typeof presetRanges[0]) {
        const { startDate, endDate } = preset.getValue();
        onChange({ startDate, endDate, label: preset.label });
        setIsOpen(false);
    }

    function handleCustomApply() {
        if (customStart && customEnd) {
            const startDate = new Date(customStart);
            const endDate = new Date(customEnd);
            const formattedLabel = `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`;
            onChange({ startDate, endDate, label: formattedLabel });
            setIsOpen(false);
        }
    }

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-white transition-all hover:border-brand-gold/50 hover:bg-white/10"
            >
                <Calendar className="h-4 w-4 text-brand-gold" />
                <span>{value.label}</span>
                <ChevronDown className={`h-4 w-4 text-white/50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-white/10 bg-brand-gray shadow-2xl overflow-hidden animate-fade-in">
                    {/* Presets */}
                    <div className="p-2 space-y-1">
                        {presetRanges.map((preset) => (
                            <button
                                key={preset.label}
                                onClick={() => handlePresetClick(preset)}
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${value.label === preset.label
                                    ? 'bg-brand-gold/20 text-brand-gold'
                                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                                    }`}
                            >
                                {preset.label}
                                {value.label === preset.label && <Check className="h-4 w-4" />}
                            </button>
                        ))}
                    </div>

                    {/* Divider */}
                    <div className="border-t border-white/5" />

                    {/* Custom Range */}
                    <div className="p-4">
                        <p className="text-xs font-medium text-white/50 mb-3">PERÍODO PERSONALIZADO</p>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div>
                                <label className="block text-xs text-white/40 mb-1">Início</label>
                                <input
                                    type="date"
                                    value={customStart}
                                    onChange={(e) => setCustomStart(e.target.value)}
                                    className="w-full h-9 rounded-lg border border-white/10 bg-white/5 px-2 text-sm text-white focus:border-brand-gold/50 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-white/40 mb-1">Fim</label>
                                <input
                                    type="date"
                                    value={customEnd}
                                    onChange={(e) => setCustomEnd(e.target.value)}
                                    className="w-full h-9 rounded-lg border border-white/10 bg-white/5 px-2 text-sm text-white focus:border-brand-gold/50 focus:outline-none"
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleCustomApply}
                            disabled={!customStart || !customEnd}
                            className="w-full h-9 rounded-lg bg-brand-gold text-brand-black text-sm font-medium transition-all hover:bg-brand-gold-light disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Aplicar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// Hook para usar o filtro de datas
export function useDateFilter(initialDays = 30) {
    const [dateRange, setDateRange] = useState<DateRange>({
        startDate: subDays(new Date(), initialDays),
        endDate: new Date(),
        label: `Últimos ${initialDays} dias`,
    });

    return { dateRange, setDateRange };
}
