'use client';

import { cn } from "@/lib/utils/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    BarChart3,
    MessageSquare,
    Target,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Users,
    Brain,
} from "lucide-react";
import { useState } from "react";

const navigation = [
    {
        name: 'Dashboard',
        href: '/',
        icon: LayoutDashboard,
    },
    {
        name: 'Análise de Abandono',
        href: '/analytics',
        icon: BarChart3,
    },
    {
        name: 'Conversas',
        href: '/conversas',
        icon: MessageSquare,
    },
    {
        name: 'Segmentação de Leads',
        href: '/segmentacao',
        icon: Users,
    },
    {
        name: 'Insights IA',
        href: '/insights',
        icon: Brain,
    },
    {
        name: 'Origem de Leads',
        href: '/origens',
        icon: Target,
    },
    {
        name: 'Configurações',
        href: '/configuracoes',
        icon: Settings,
    },
];

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={cn(
                "fixed left-0 top-0 z-40 h-screen border-r border-white/5 bg-brand-black transition-all duration-300",
                collapsed ? "w-20" : "w-64"
            )}
        >
            {/* Logo */}
            <div className="flex h-20 items-center justify-between border-b border-white/5 px-4">
                <Link href="/" className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-gold to-brand-gold/70 shadow-lg shadow-brand-gold/20">
                        <Sparkles className="h-5 w-5 text-brand-black" />
                    </div>
                    {!collapsed && (
                        <div>
                            <h1 className="font-bold text-white">NeuroAI</h1>
                            <p className="text-[10px] text-brand-gold">Analytics</p>
                        </div>
                    )}
                </Link>
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/5 hover:text-white"
                >
                    {collapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <ChevronLeft className="h-4 w-4" />
                    )}
                </button>
            </div>

            {/* Tenant Selector */}
            {!collapsed && (
                <div className="border-b border-white/5 p-4">
                    <div className="rounded-xl bg-white/5 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">
                            Cliente
                        </p>
                        <p className="font-semibold text-white">Taj Mahal Spa</p>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <nav className="flex-1 space-y-1 p-4">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                "group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200",
                                isActive
                                    ? "bg-gradient-to-r from-brand-gold/20 to-transparent text-brand-gold shadow-sm"
                                    : "text-white/60 hover:bg-white/5 hover:text-white",
                                collapsed && "justify-center px-2"
                            )}
                        >
                            <item.icon
                                className={cn(
                                    "h-5 w-5 shrink-0 transition-colors",
                                    isActive ? "text-brand-gold" : "text-white/40 group-hover:text-white/70"
                                )}
                            />
                            {!collapsed && <span>{item.name}</span>}
                            {isActive && !collapsed && (
                                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-gold" />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="border-t border-white/5 p-4">
                <button
                    className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-white/60 transition-colors hover:bg-red-500/10 hover:text-red-400",
                        collapsed && "justify-center px-2"
                    )}
                >
                    <LogOut className="h-5 w-5 shrink-0" />
                    {!collapsed && <span>Sair</span>}
                </button>
            </div>
        </aside>
    );
}
