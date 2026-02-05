'use client';

import { useState } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface TrendData {
    date: string;
    leads: number;
    conversoes: number;
}

interface TrendChartProps {
    data: TrendData[];
    isLoading?: boolean;
    onPeriodChange?: (days: number) => void;
}

const periodOptions = [
    { label: '7 dias', value: 7 },
    { label: '30 dias', value: 30 },
    { label: '60 dias', value: 60 },
    { label: '90 dias', value: 90 },
];

export function TrendChart({ data, isLoading = false, onPeriodChange }: TrendChartProps) {
    const [selectedPeriod, setSelectedPeriod] = useState(7);

    const handlePeriodChange = (days: number) => {
        setSelectedPeriod(days);
        if (onPeriodChange) {
            onPeriodChange(days);
        }
    };

    const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
        if (active && payload && payload.length) {
            return (
                <div className="rounded-lg border border-white/10 bg-brand-gray/95 backdrop-blur-xl p-3 shadow-xl">
                    <p className="font-semibold text-white mb-2">{label}</p>
                    {payload.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                            <div
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: item.color }}
                            />
                            <span className="text-white/60">{item.name === 'leads' ? 'Leads' : 'Agendamentos'}:</span>
                            <span className="font-medium text-white">{item.value}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <Card gradient hover>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Tendência</CardTitle>

                {/* Period Selector */}
                <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1">
                    {periodOptions.map((option) => (
                        <button
                            key={option.value}
                            onClick={() => handlePeriodChange(option.value)}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${selectedPeriod === option.value
                                    ? 'bg-brand-gold text-brand-black'
                                    : 'text-white/60 hover:text-white hover:bg-white/10'
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="h-[250px] shimmer rounded-xl" />
                ) : data.length === 0 ? (
                    <div className="h-[250px] flex items-center justify-center text-white/40">
                        Sem dados para exibir
                    </div>
                ) : (
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart
                                data={data}
                                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                            >
                                <defs>
                                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorConversoes" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                    tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                    // Mostrar menos labels quando tem muitos dados
                                    interval={data.length > 30 ? Math.floor(data.length / 10) : data.length > 14 ? 2 : 0}
                                />
                                <YAxis
                                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                    tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    wrapperStyle={{ paddingTop: '10px' }}
                                    formatter={(value) => (
                                        <span className="text-white/70 text-sm">
                                            {value === 'leads' ? 'Leads' : 'Agendamentos'}
                                        </span>
                                    )}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="leads"
                                    stroke="#D4AF37"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorLeads)"
                                />
                                <Area
                                    type="monotone"
                                    dataKey="conversoes"
                                    stroke="#10B981"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorConversoes)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
