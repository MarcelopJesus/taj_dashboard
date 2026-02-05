'use client';

import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    Settings,
    Database,
    Bell,
    Users,
    Palette,
    Shield,
    Save,
    Check,
    AlertCircle
} from 'lucide-react';

export default function ConfiguracoesPage() {
    const [activeTab, setActiveTab] = useState('conexao');
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        // Simular salvamento
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const tabs = [
        { id: 'conexao', label: 'Conexão', icon: Database },
        { id: 'notificacoes', label: 'Notificações', icon: Bell },
        { id: 'usuarios', label: 'Usuários', icon: Users },
        { id: 'aparencia', label: 'Aparência', icon: Palette },
        { id: 'seguranca', label: 'Segurança', icon: Shield },
    ];

    return (
        <div className="flex min-h-screen bg-brand-black">
            <Sidebar />

            <main className="flex-1 ml-64">
                <Header
                    title="Configurações"
                    subtitle="Gerencie as configurações do sistema"
                />

                <div className="p-8">
                    <div className="flex gap-8">
                        {/* Sidebar de Tabs */}
                        <div className="w-64 shrink-0">
                            <Card gradient>
                                <CardContent className="p-2">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all ${activeTab === tab.id
                                                    ? 'bg-brand-gold/20 text-brand-gold'
                                                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                                                }`}
                                        >
                                            <tab.icon className="h-5 w-5" />
                                            <span className="font-medium">{tab.label}</span>
                                        </button>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Conteúdo */}
                        <div className="flex-1">
                            {activeTab === 'conexao' && (
                                <Card gradient>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Database className="h-5 w-5 text-brand-gold" />
                                            Conexão Supabase
                                        </CardTitle>
                                        <CardDescription>
                                            Configure a conexão com o banco de dados
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-medium text-white/70 mb-2">
                                                Project URL
                                            </label>
                                            <input
                                                type="text"
                                                defaultValue="https://vynilpckcxkahcyavtgy.supabase.co"
                                                className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/40 focus:border-brand-gold/50 focus:outline-none"
                                                readOnly
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-white/70 mb-2">
                                                API Key (anon)
                                            </label>
                                            <input
                                                type="password"
                                                defaultValue="eyJhbGciOiJIUz..."
                                                className="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white placeholder:text-white/40 focus:border-brand-gold/50 focus:outline-none"
                                                readOnly
                                            />
                                        </div>
                                        <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                                            <Check className="h-5 w-5 text-emerald-400" />
                                            <span className="text-emerald-400">Conexão ativa e funcionando</span>
                                        </div>

                                        <div className="pt-4 border-t border-white/5">
                                            <h4 className="font-medium text-white mb-4">Tabelas Configuradas</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                                                    <p className="text-sm text-white/50">Leads</p>
                                                    <p className="font-medium text-white">taj_leads</p>
                                                </div>
                                                <div className="rounded-xl border border-white/5 bg-white/5 p-4">
                                                    <p className="text-sm text-white/50">Mensagens</p>
                                                    <p className="font-medium text-white">taj_mensagens</p>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {activeTab === 'notificacoes' && (
                                <Card gradient>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Bell className="h-5 w-5 text-brand-gold" />
                                            Notificações
                                        </CardTitle>
                                        <CardDescription>
                                            Configure alertas e notificações
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        {[
                                            { label: 'Novo lead recebido', description: 'Receba um alerta quando um novo lead chegar', enabled: true },
                                            { label: 'Lead convertido', description: 'Notificação quando um lead for convertido', enabled: true },
                                            { label: 'Queda na taxa de conversão', description: 'Alerta quando a taxa cair mais de 10%', enabled: false },
                                            { label: 'Relatório semanal', description: 'Enviar resumo toda segunda-feira', enabled: true },
                                        ].map((item, index) => (
                                            <div key={index} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4">
                                                <div>
                                                    <p className="font-medium text-white">{item.label}</p>
                                                    <p className="text-sm text-white/50">{item.description}</p>
                                                </div>
                                                <label className="relative inline-flex cursor-pointer items-center">
                                                    <input type="checkbox" className="peer sr-only" defaultChecked={item.enabled} />
                                                    <div className="h-6 w-11 rounded-full bg-white/10 peer-checked:bg-brand-gold after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
                                                </label>
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            )}

                            {activeTab === 'usuarios' && (
                                <Card gradient>
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <div>
                                            <CardTitle className="flex items-center gap-2">
                                                <Users className="h-5 w-5 text-brand-gold" />
                                                Usuários
                                            </CardTitle>
                                            <CardDescription>
                                                Gerencie os usuários com acesso ao dashboard
                                            </CardDescription>
                                        </div>
                                        <Button size="sm">+ Adicionar Usuário</Button>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            {[
                                                { nome: 'Marcelo', email: 'marcelo@neuroai.com.br', role: 'Admin', avatar: 'M' },
                                                { nome: 'Taj Mahal', email: 'contato@tajmahal.com.br', role: 'Viewer', avatar: 'T' },
                                            ].map((user, index) => (
                                                <div key={index} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4">
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gold/20 text-brand-gold font-semibold">
                                                            {user.avatar}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-white">{user.nome}</p>
                                                            <p className="text-sm text-white/50">{user.email}</p>
                                                        </div>
                                                    </div>
                                                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${user.role === 'Admin'
                                                            ? 'bg-brand-gold/20 text-brand-gold'
                                                            : 'bg-white/10 text-white/70'
                                                        }`}>
                                                        {user.role}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {activeTab === 'aparencia' && (
                                <Card gradient>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Palette className="h-5 w-5 text-brand-gold" />
                                            Aparência
                                        </CardTitle>
                                        <CardDescription>
                                            Personalize a aparência do dashboard
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-medium text-white/70 mb-3">
                                                Tema
                                            </label>
                                            <div className="grid grid-cols-3 gap-4">
                                                {['Escuro', 'Claro', 'Sistema'].map((tema, index) => (
                                                    <button
                                                        key={tema}
                                                        className={`rounded-xl border p-4 text-center transition-all ${index === 0
                                                                ? 'border-brand-gold bg-brand-gold/10 text-brand-gold'
                                                                : 'border-white/10 text-white/70 hover:border-white/30'
                                                            }`}
                                                    >
                                                        {tema}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-white/70 mb-3">
                                                Cor Principal
                                            </label>
                                            <div className="flex gap-3">
                                                {['#D4AF37', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899'].map((color, index) => (
                                                    <button
                                                        key={color}
                                                        className={`h-10 w-10 rounded-full border-2 transition-all ${index === 0 ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                                                            }`}
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {activeTab === 'seguranca' && (
                                <Card gradient>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Shield className="h-5 w-5 text-brand-gold" />
                                            Segurança
                                        </CardTitle>
                                        <CardDescription>
                                            Configure opções de segurança
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4">
                                            <div>
                                                <p className="font-medium text-white">Autenticação de Dois Fatores</p>
                                                <p className="text-sm text-white/50">Adicione uma camada extra de segurança</p>
                                            </div>
                                            <Button variant="outline" size="sm">Ativar</Button>
                                        </div>

                                        <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4">
                                            <div>
                                                <p className="font-medium text-white">Sessões Ativas</p>
                                                <p className="text-sm text-white/50">1 dispositivo conectado</p>
                                            </div>
                                            <Button variant="ghost" size="sm">Ver todas</Button>
                                        </div>

                                        <div className="flex items-center gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
                                            <AlertCircle className="h-5 w-5 text-amber-400" />
                                            <span className="text-amber-400 text-sm">
                                                Recomendamos ativar a autenticação de dois fatores
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Save Button */}
                            <div className="mt-6 flex justify-end">
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="gap-2"
                                >
                                    {isSaving ? (
                                        <>Salvando...</>
                                    ) : saved ? (
                                        <>
                                            <Check className="h-4 w-4" />
                                            Salvo!
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4" />
                                            Salvar Alterações
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
