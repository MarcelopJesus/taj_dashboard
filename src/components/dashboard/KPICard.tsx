'use client';

import { cn } from "@/lib/utils/cn";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPICardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: number;
    trendLabel?: string;
    icon?: React.ReactNode;
    variant?: 'default' | 'gold' | 'success' | 'warning' | 'danger';
}

export function KPICard({
    title,
    value,
    subtitle,
    trend,
    trendLabel,
    icon,
    variant = 'default',
}: KPICardProps) {
    const isPositive = trend !== undefined && trend > 0;
    const isNegative = trend !== undefined && trend < 0;
    const isNeutral = trend === 0;

    const variantStyles = {
        default: 'from-brand-gray/80 to-brand-black/80',
        gold: 'from-brand-gold/20 to-brand-gold/5 border-brand-gold/30',
        success: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
        warning: 'from-amber-500/20 to-amber-500/5 border-amber-500/30',
        danger: 'from-red-500/20 to-red-500/5 border-red-500/30',
    };

    return (
        <div
            className={cn(
                "group relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br p-6 transition-all duration-300 hover:border-brand-gold/20 hover:shadow-xl hover:shadow-brand-gold/5",
                variantStyles[variant]
            )}
        >
            {/* Glow effect on hover */}
            <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-brand-gold/10 blur-3xl" />
            </div>

            <div className="relative">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium text-white/60">{title}</span>
                    {icon && (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gold/10 text-brand-gold">
                            {icon}
                        </div>
                    )}
                </div>

                {/* Value */}
                <div className="mb-2">
                    <span className="text-3xl font-bold text-white">{value}</span>
                </div>

                {/* Trend & Subtitle */}
                <div className="flex items-center gap-2">
                    {trend !== undefined && (
                        <div
                            className={cn(
                                "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                                isPositive && "bg-emerald-500/20 text-emerald-400",
                                isNegative && "bg-red-500/20 text-red-400",
                                isNeutral && "bg-white/10 text-white/60"
                            )}
                        >
                            {isPositive && <TrendingUp className="h-3 w-3" />}
                            {isNegative && <TrendingDown className="h-3 w-3" />}
                            {isNeutral && <Minus className="h-3 w-3" />}
                            <span>
                                {isPositive && '+'}
                                {trend.toFixed(1)}%
                            </span>
                        </div>
                    )}
                    {(subtitle || trendLabel) && (
                        <span className="text-xs text-white/40">
                            {trendLabel || subtitle}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
