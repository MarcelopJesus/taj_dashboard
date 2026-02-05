'use client';

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
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

interface FunnelStep {
    name: string;
    value: number;
}

interface FunnelChartProps {
    data: FunnelStep[];
    isLoading?: boolean;
}

export function FunnelChart({ data, isLoading = false }: FunnelChartProps) {
    // Gradient colors from gold to dark
    const getColor = (index: number) => {
        const colors = [
            '#D4AF37', // Gold
            '#C4A030',
            '#B49029',
            '#A48022',
            '#8A6D1B', // Darker gold
        ];
        return colors[index] || colors[colors.length - 1];
    };

    const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: FunnelStep }[] }) => {
        if (active && payload && payload.length) {
            const item = payload[0].payload;
            const total = data[0]?.value || 1;
            const percentual = ((item.value / total) * 100).toFixed(1);
            return (
                <div className="rounded-lg border border-white/10 bg-brand-gray/95 backdrop-blur-xl p-3 shadow-xl">
                    <p className="font-semibold text-white">{item.name}</p>
                    <p className="text-sm text-brand-gold">
                        {item.value.toLocaleString('pt-BR')} leads
                    </p>
                    <p className="text-xs text-white/60">
                        {percentual}% do total
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <Card gradient hover>
            <CardHeader>
                <CardTitle>Funil de Conversão</CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="h-[300px] shimmer rounded-xl" />
                ) : data.length === 0 ? (
                    <div className="h-[300px] flex items-center justify-center text-white/40">
                        Sem dados para exibir
                    </div>
                ) : (
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={data}
                                layout="vertical"
                                margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                                <XAxis
                                    type="number"
                                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }}
                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                    tickLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                    tickLine={false}
                                    width={100}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(212, 175, 55, 0.1)' }} />
                                <Bar
                                    dataKey="value"
                                    radius={[0, 8, 8, 0]}
                                    barSize={24}
                                >
                                    {data.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={getColor(index)} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
