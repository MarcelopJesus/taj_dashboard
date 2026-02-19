import { getSupabaseClient } from '../supabase/client';
import type { Lead, DashboardKPIs, FunnelStep, TendenciaDiaria, LeadRecente } from '@/types/database';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

const supabase = getSupabaseClient();

interface DateRange {
    startDate: Date;
    endDate: Date;
}

// Busca KPIs principais do dashboard
export async function fetchDashboardKPIs(dateRange?: DateRange): Promise<DashboardKPIs> {
    const endDate = dateRange?.endDate || new Date();
    const startDate = dateRange?.startDate || subDays(endDate, 30);

    // Período anterior para comparação
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const previousStartDate = subDays(startDate, daysDiff);
    const previousEndDate = subDays(startDate, 1);

    // Total de leads no período atual
    const { count: totalLeads } = await supabase
        .from('taj_leads')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

    // Total de leads no período anterior
    const { count: previousLeads } = await supabase
        .from('taj_leads')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', previousStartDate.toISOString())
        .lte('timestamp', previousEndDate.toISOString());

    // Leads convertidos no período atual
    const { count: convertidos } = await supabase
        .from('taj_leads')
        .select('*', { count: 'exact', head: true })
        .eq('status_atendimento', 'convertido')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

    // Leads convertidos no período anterior
    const { count: previousConvertidos } = await supabase
        .from('taj_leads')
        .select('*', { count: 'exact', head: true })
        .eq('status_atendimento', 'convertido')
        .gte('timestamp', previousStartDate.toISOString())
        .lte('timestamp', previousEndDate.toISOString());

    // Leads ativos
    const { count: leadsAtivos } = await supabase
        .from('taj_leads')
        .select('*', { count: 'exact', head: true })
        .eq('status_atendimento', 'ativo');

    const taxaConversao = totalLeads ? ((convertidos || 0) / totalLeads) * 100 : 0;
    const previousTaxaConversao = previousLeads ? ((previousConvertidos || 0) / previousLeads) * 100 : 0;

    const variacaoLeads = previousLeads ? (((totalLeads || 0) - previousLeads) / previousLeads) * 100 : 0;
    const variacaoConversao = previousTaxaConversao ? (taxaConversao - previousTaxaConversao) : 0;

    return {
        totalLeads: totalLeads || 0,
        taxaConversao,
        leadsAtivos: leadsAtivos || 0,
        tempoMedioConversao: 4.5, // TODO: calcular baseado em dados reais
        variacaoLeads,
        variacaoConversao,
    };
}

// Busca dados para o funil de conversão
export async function fetchFunnelData(dateRange?: DateRange): Promise<FunnelStep[]> {
    const endDate = dateRange?.endDate || new Date();
    const startDate = dateRange?.startDate || subDays(endDate, 30);

    // Total de leads
    const { count: totalLeads } = await supabase
        .from('taj_leads')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

    // Leads que responderam (têm mensagens)
    const { data: leadsComMensagens } = await supabase
        .from('taj_leads')
        .select('chatid')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

    const chatIds = leadsComMensagens?.map(l => l.chatid) || [];

    // Contar leads com mais de 1 mensagem (engajaram)
    let engajaram = 0;
    if (chatIds.length > 0) {
        // Para performance, vamos estimar baseado no status
        const { count } = await supabase
            .from('taj_leads')
            .select('*', { count: 'exact', head: true })
            .in('status_atendimento', ['ativo', 'convertido'])
            .gte('timestamp', startDate.toISOString())
            .lte('timestamp', endDate.toISOString());
        engajaram = count || 0;
    }

    // Leads convertidos
    const { count: convertidos } = await supabase
        .from('taj_leads')
        .select('*', { count: 'exact', head: true })
        .eq('status_atendimento', 'convertido')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

    const total = totalLeads || 1;

    return [
        {
            nome: 'Leads Totais',
            quantidade: totalLeads || 0,
            percentual: 100
        },
        {
            nome: 'Engajaram',
            quantidade: engajaram,
            percentual: (engajaram / total) * 100
        },
        {
            nome: 'Perguntaram Preço',
            quantidade: Math.round(engajaram * 0.7), // Estimativa
            percentual: (Math.round(engajaram * 0.7) / total) * 100
        },
        {
            nome: 'Verificaram Horário',
            quantidade: Math.round(engajaram * 0.5), // Estimativa
            percentual: (Math.round(engajaram * 0.5) / total) * 100
        },
        {
            nome: 'Agendaram',
            quantidade: convertidos || 0,
            percentual: ((convertidos || 0) / total) * 100
        },
    ];
}

// Busca tendência diária
export async function fetchTrendData(dateRange?: DateRange): Promise<TendenciaDiaria[]> {
    const endDate = dateRange?.endDate || new Date();
    const startDate = dateRange?.startDate || subDays(endDate, 7);

    const data: TendenciaDiaria[] = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        const dayStart = startOfDay(currentDate).toISOString();
        const dayEnd = endOfDay(currentDate).toISOString();

        const { count: leads } = await supabase
            .from('taj_leads')
            .select('*', { count: 'exact', head: true })
            .gte('timestamp', dayStart)
            .lte('timestamp', dayEnd);

        const { count: conversoes } = await supabase
            .from('taj_leads')
            .select('*', { count: 'exact', head: true })
            .eq('status_atendimento', 'convertido')
            .gte('timestamp', dayStart)
            .lte('timestamp', dayEnd);

        data.push({
            data: format(currentDate, 'dd/MM'),
            leads: leads || 0,
            conversoes: conversoes || 0,
        });

        currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    }

    return data;
}

// Busca leads recentes
export async function fetchRecentLeads(limit: number = 10): Promise<LeadRecente[]> {
    const { data: leads } = await supabase
        .from('taj_leads')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(limit);

    if (!leads) return [];

    return leads.map(lead => ({
        chatid: lead.chatid,
        nome: lead.nome || 'Sem nome',
        origem: lead.origem_cliente_taj || 'Não identificado',
        status: lead.status_atendimento,
        ultimaMensagem: 'Ver conversa',
        tempoDecorrido: lead.timestamp,
    }));
}

// Busca estatísticas por origem
export async function fetchOrigemStats(dateRange?: DateRange) {
    const endDate = dateRange?.endDate || new Date();
    const startDate = dateRange?.startDate || subDays(endDate, 30);

    const { data: leads } = await supabase
        .from('taj_leads')
        .select('origem_cliente_taj, status_atendimento')
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

    if (!leads) return [];

    // Agrupar por origem
    const stats: Record<string, { total: number; convertidos: number }> = {};

    leads.forEach(lead => {
        const origem = lead.origem_cliente_taj || 'outro';
        if (!stats[origem]) {
            stats[origem] = { total: 0, convertidos: 0 };
        }
        stats[origem].total++;
        if (lead.status_atendimento === 'convertido') {
            stats[origem].convertidos++;
        }
    });

    const total = leads.length || 1;

    return Object.entries(stats).map(([origem, data]) => ({
        origem,
        quantidade: data.total,
        percentual: (data.total / total) * 100,
        conversao: data.total ? (data.convertidos / data.total) * 100 : 0,
    }));
}
