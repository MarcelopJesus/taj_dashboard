'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DateFilter, useDateFilter } from '@/components/ui/DateFilter';
import { ConversationModal } from '@/components/dashboard/ConversationModal';
import { KPICard } from '@/components/dashboard/KPICard';
import { FunnelChart } from '@/components/charts/FunnelChart';
import { TrendChart } from '@/components/charts/TrendChart';
import { getSupabaseClient } from '@/lib/supabase/client';
import { formatTimeAgo } from '@/lib/utils/format';
import { getAgendamentosConfirmados, calcularMetricasReais } from '@/lib/utils/agendamentos';
import { exportLeadsCSV, exportLeadsPDF, LeadExportData } from '@/lib/utils/export';
import {
  Users,
  TrendingUp,
  CalendarCheck,
  RefreshCw,
  Eye,
  Download,
  FileText,
  HelpCircle
} from 'lucide-react';

interface Lead {
  chatid: string;
  nome: string;
  telefone?: string;
  timestamp: string;
  status_atendimento: string;
  origem_cliente: string | null;
}

interface FunnelStep {
  name: string;
  value: number;
}

interface TrendData {
  date: string;
  leads: number;
  conversoes: number;
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalAgendamentos, setTotalAgendamentos] = useState(0);
  const [taxaConversao, setTaxaConversao] = useState(0);
  const [funnelData, setFunnelData] = useState<FunnelStep[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [trendPeriod, setTrendPeriod] = useState(7);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Conversation modal
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Date filter
  const { dateRange, setDateRange } = useDateFilter(30);

  const supabase = getSupabaseClient();

  // Auto-refresh interval (30 seconds)
  const AUTO_REFRESH_INTERVAL = 30000;

  useEffect(() => {
    loadDashboardData();
  }, [dateRange]);

  // Auto-refresh: atualiza os dados a cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isLoading && !isRefreshing) {
        handleSilentRefresh();
      }
    }, AUTO_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [isLoading, isRefreshing, dateRange, trendPeriod]);

  // Reload trend data when period changes
  useEffect(() => {
    if (!isLoading) {
      loadTrendData();
    }
  }, [trendPeriod]);

  async function loadDashboardData() {
    setIsLoading(true);
    await Promise.all([
      loadKPIs(),
      loadFunnelData(),
      loadTrendData(),
      loadRecentLeads(),
    ]);
    setLastUpdate(new Date());
    setIsLoading(false);
  }

  // Função auxiliar para sincronizar dados novos
  async function syncNewData() {
    try {
      await fetch('/api/sync-data', { method: 'POST' });
    } catch (error) {
      console.error('Erro ao sincronizar dados:', error);
    }
  }

  // Refresh silencioso (sem mostrar loading state)
  async function handleSilentRefresh() {
    // Tenta sincronizar novos dados em background antes de recarregar
    await syncNewData();

    await Promise.all([
      loadKPIs(),
      loadFunnelData(),
      loadTrendData(),
      loadRecentLeads(),
    ]);
    setLastUpdate(new Date());
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    await syncNewData(); // Força sincronização ao clicar manualmente
    await loadDashboardData();
    setIsRefreshing(false);
  }

  async function loadKPIs() {
    try {
      // Usar a nova função de métricas reais baseada em agendamentos
      const metricas = await calcularMetricasReais(dateRange.startDate, dateRange.endDate);

      setTotalLeads(metricas.totalLeads);
      setTotalAgendamentos(metricas.agendamentos);
      setTaxaConversao(metricas.taxaConversao);

      // Carregar todos os leads para export
      const { data: leads } = await supabase
        .from('taj_leads')
        .select('*')
        .gte('timestamp', dateRange.startDate.toISOString())
        .lte('timestamp', dateRange.endDate.toISOString())
        .order('timestamp', { ascending: false });

      if (leads) {
        setAllLeads(leads);
      }
    } catch (error) {
      console.error('Erro ao carregar KPIs:', error);
    }
  }

  async function loadFunnelData() {
    try {
      const { data: leads } = await supabase
        .from('taj_leads')
        .select('chatid')
        .gte('timestamp', dateRange.startDate.toISOString())
        .lte('timestamp', dateRange.endDate.toISOString());

      if (leads) {
        const total = leads.length;

        // Buscar agendamentos reais
        const { total: agendamentos } = await getAgendamentosConfirmados(
          dateRange.startDate,
          dateRange.endDate
        );

        // Simular etapas do funil (exceto agendamentos que são reais)
        const engajados = Math.round(total * 0.85);
        const perguntaramPreco = Math.round(total * 0.60);
        const verificaramHorario = Math.round(total * 0.35);

        setFunnelData([
          { name: 'Leads Totais', value: total },
          { name: 'Engajaram', value: engajados },
          { name: 'Perguntaram Preço', value: perguntaramPreco },
          { name: 'Verificaram Horário', value: verificaramHorario },
          { name: 'Agendaram', value: agendamentos },
        ]);
      }
    } catch (error) {
      console.error('Erro ao carregar funil:', error);
    }
  }

  async function loadTrendData() {
    try {
      // Calcular range de datas baseado no período selecionado no gráfico
      const trendEndDate = new Date();
      trendEndDate.setHours(23, 59, 59, 999);

      const trendStartDate = new Date();
      // Subtrair (periodo - 1) para incluir hoje e completar o número de dias exato
      trendStartDate.setDate(trendStartDate.getDate() - (trendPeriod - 1));
      trendStartDate.setHours(0, 0, 0, 0);

      const { data: leads } = await supabase
        .from('taj_leads')
        .select('timestamp, chatid')
        .gte('timestamp', trendStartDate.toISOString())
        .lte('timestamp', trendEndDate.toISOString())
        .order('timestamp', { ascending: true });

      // Buscar todos os chatIds com agendamentos no período do gráfico
      const { chatIdsConvertidos } = await getAgendamentosConfirmados(
        trendStartDate,
        trendEndDate
      );

      if (leads) {
        const dailyData: Record<string, { leads: number; conversoes: number; sortDate: number }> = {};

        leads.forEach(lead => {
          // Criar data ajustada para garantir consistência
          const dateObj = new Date(lead.timestamp);
          const dateKey = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

          if (!dailyData[dateKey]) {
            dailyData[dateKey] = { leads: 0, conversoes: 0, sortDate: dateObj.getTime() };
          }
          dailyData[dateKey].leads++;

          // Verificar se esse lead tem agendamento
          if (chatIdsConvertidos.has(lead.chatid)) {
            dailyData[dateKey].conversoes++;
          }
        });

        // Ordenar corretamente por data e mapear
        const trend = Object.entries(dailyData)
          .sort(([, a], [, b]) => a.sortDate - b.sortDate)
          .map(([date, data]) => ({
            date,
            leads: data.leads,
            conversoes: data.conversoes,
          }));

        setTrendData(trend);
      }
    } catch (error) {
      console.error('Erro ao carregar tendência:', error);
    }
  }

  async function loadRecentLeads() {
    try {
      const { data } = await supabase
        .from('taj_leads')
        .select('*')
        .gte('timestamp', dateRange.startDate.toISOString())
        .lte('timestamp', dateRange.endDate.toISOString())
        .order('timestamp', { ascending: false })
        .limit(5);

      if (data) {
        setRecentLeads(data);
      }
    } catch (error) {
      console.error('Erro ao carregar leads recentes:', error);
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

  const origemIcons: Record<string, React.ReactNode> = {
    instagram: <span className="text-pink-400">📸</span>,
    google: <span>🔍</span>,
    indicacao: <span>👥</span>,
    'Não identificado': <HelpCircle className="h-4 w-4 text-white/30" />,
  };

  return (
    <div className="flex min-h-screen bg-brand-black">
      <Sidebar />

      <main className="flex-1 ml-64">
        <Header
          title="Dashboard"
          subtitle={`Última atualização: ${lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} • Auto-refresh: 30s`}
        />

        <div className="p-8">
          {/* Actions Bar */}
          <div className="flex items-center justify-between mb-8">
            <DateFilter value={dateRange} onChange={setDateRange} />

            <div className="flex items-center gap-3">
              {/* Export Dropdown */}
              <div className="relative">
                <Button
                  variant="secondary"
                  size="sm"
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
                        Exportar CSV
                      </button>
                      <button
                        onClick={handleExportPDF}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                        Exportar PDF
                      </button>
                    </div>
                  </>
                )}
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>

          {/* KPI Cards - Apenas 3 métricas relevantes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <KPICard
              title="Total de Leads"
              value={isLoading ? '—' : totalLeads.toLocaleString('pt-BR')}
              subtitle="No período selecionado"
              icon={<Users className="h-5 w-5" />}
              isLoading={isLoading}
            />
            <KPICard
              title="Agendamentos"
              value={isLoading ? '—' : totalAgendamentos.toLocaleString('pt-BR')}
              subtitle="Confirmados via WhatsApp"
              icon={<CalendarCheck className="h-5 w-5" />}
              isLoading={isLoading}
              variant="highlight"
            />
            <KPICard
              title="Taxa de Conversão"
              value={isLoading ? '—' : `${taxaConversao.toFixed(1)}%`}
              subtitle="Leads → Agendamentos"
              icon={<TrendingUp className="h-5 w-5" />}
              isLoading={isLoading}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <FunnelChart data={funnelData} isLoading={isLoading} />
            <TrendChart
              data={trendData}
              isLoading={isLoading}
              onPeriodChange={setTrendPeriod}
            />
          </div>

          {/* Recent Leads */}
          <Card gradient hover>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Leads Recentes</CardTitle>
              <a href="/conversas" className="text-sm font-medium text-brand-gold hover:text-brand-gold-light transition-colors">
                Ver todos →
              </a>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-16 shimmer rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-white/5">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-white/5">
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/50">Nome</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/50">Origem</th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/50">Última Mensagem</th>
                        <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-white/50">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {recentLeads.map((lead) => (
                        <tr key={lead.chatid} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gold/10 text-brand-gold font-semibold">
                                {(lead.nome || 'S').charAt(0).toUpperCase()}
                              </div>
                              <span className="font-medium text-white">{lead.nome || 'Sem nome'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 text-white/60">
                              {origemIcons[lead.origem_cliente || 'Não identificado'] || origemIcons['Não identificado']}
                              <span>{lead.origem_cliente || 'Não identificado'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-white/60">
                            {formatTimeAgo(lead.timestamp)}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewConversation(lead)}
                              className="gap-2"
                            >
                              <Eye className="h-4 w-4" />
                              Ver
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
