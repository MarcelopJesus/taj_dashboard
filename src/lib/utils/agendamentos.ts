import { getSupabaseClient } from '@/lib/supabase/client';

interface AgendamentoInfo {
    chatid: string;
    codigo: string;
    dataAgendamento?: string;
}

/**
 * Busca agendamentos da tabela taj_agendamentos
 * Filtra por timestamp do agendamento e conta chatIds únicos
 */
export async function getAgendamentosDaTabela(
    startDate: Date,
    endDate: Date
): Promise<{ total: number; agendamentos: AgendamentoInfo[]; chatIdsConvertidos: Set<string> }> {
    const supabase = getSupabaseClient();

    try {
        // Buscar agendamentos no período (por timestamp do agendamento)
        const { data: agendamentos } = await supabase
            .from('taj_agendamentos')
            .select('*')
            .gte('timestamp', startDate.toISOString())
            .lte('timestamp', endDate.toISOString());

        if (!agendamentos || agendamentos.length === 0) {
            return { total: 0, agendamentos: [], chatIdsConvertidos: new Set() };
        }

        const chatIdsConvertidos = new Set<string>();
        const agendamentosList: AgendamentoInfo[] = [];

        agendamentos.forEach((ag: { chatid: string; codigo_agendamento?: string; data_agendamento?: string }) => {
            chatIdsConvertidos.add(ag.chatid);
            agendamentosList.push({
                chatid: ag.chatid,
                codigo: ag.codigo_agendamento || '#N/A',
                dataAgendamento: ag.data_agendamento,
            });
        });

        return {
            total: agendamentos.length,
            agendamentos: agendamentosList,
            chatIdsConvertidos,
        };
    } catch (error) {
        console.error('Erro ao buscar agendamentos da tabela:', error);
        return { total: 0, agendamentos: [], chatIdsConvertidos: new Set() };
    }
}

/**
 * Alias para manter compatibilidade com código existente
 */
export async function getAgendamentosConfirmados(
    startDate: Date,
    endDate: Date
): Promise<{ total: number; agendamentos: AgendamentoInfo[]; chatIdsConvertidos: Set<string> }> {
    return getAgendamentosDaTabela(startDate, endDate);
}

/**
 * Verifica se um lead específico tem agendamento confirmado
 */
export async function verificarAgendamentoLead(chatId: string): Promise<{
    temAgendamento: boolean;
    codigos: string[];
}> {
    const supabase = getSupabaseClient();

    try {
        // Buscar na tabela taj_agendamentos
        const { data: agendamentos } = await supabase
            .from('taj_agendamentos')
            .select('codigo_agendamento')
            .eq('chatid', chatId);

        if (agendamentos && agendamentos.length > 0) {
            return {
                temAgendamento: true,
                codigos: agendamentos.map((a: { codigo_agendamento?: string }) => a.codigo_agendamento || '#N/A'),
            };
        }

        return { temAgendamento: false, codigos: [] };
    } catch (error) {
        console.error('Erro ao verificar agendamento:', error);
        return { temAgendamento: false, codigos: [] };
    }
}

/**
 * Calcula métricas do dashboard baseado em agendamentos
 * IMPORTANTE: Conta LEADS ÚNICOS que agendaram, não total de registros de agendamento
 */
export async function calcularMetricasReais(startDate: Date, endDate: Date) {
    const supabase = getSupabaseClient();

    // Buscar total de leads no período
    const { count: totalLeads } = await supabase
        .from('taj_leads')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', startDate.toISOString())
        .lte('timestamp', endDate.toISOString());

    // Buscar agendamentos da nova tabela
    const { chatIdsConvertidos } = await getAgendamentosDaTabela(startDate, endDate);

    // CORREÇÃO: Usar chatIdsConvertidos.size para contar leads únicos que agendaram
    // Um lead com múltiplos agendamentos conta como 1 conversão, não múltiplas
    const leadsQueAgendaram = chatIdsConvertidos.size;

    // Calcular taxa de conversão real baseada em leads únicos
    const taxaConversao = totalLeads && totalLeads > 0
        ? (leadsQueAgendaram / totalLeads) * 100
        : 0;

    return {
        totalLeads: totalLeads || 0,
        agendamentos: leadsQueAgendaram, // Número de leads únicos que agendaram
        taxaConversao,
        chatIdsConvertidos,
    };
}
