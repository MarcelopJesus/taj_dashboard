'use client';

import { Search, User } from "lucide-react";

interface HeaderProps {
    title: string;
    subtitle?: string;
}

export function Header({ title, subtitle }: HeaderProps) {
    return (
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-white/5 bg-brand-black/80 backdrop-blur-xl px-8">
            {/* Left side - Title */}
            <div>
                <h1 className="text-2xl font-bold text-white">{title}</h1>
                {subtitle && (
                    <p className="text-sm text-white/50">{subtitle}</p>
                )}
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        className="h-10 w-64 rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:border-brand-gold/50 focus:outline-none focus:ring-1 focus:ring-brand-gold/50 transition-all"
                    />
                </div>

                {/* User */}
                <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-gold to-brand-gold/70 text-brand-black shadow-lg shadow-brand-gold/20 transition-transform hover:scale-105">
                    <User className="h-4 w-4" />
                </button>
            </div>
        </header>
    );
}
