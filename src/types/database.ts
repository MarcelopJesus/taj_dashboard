// Types for Supabase Database Tables

export interface Lead {
  id: number;
  chatid: string;
  nome: string | null;
  timestamp: string;
  follow_up: string | null;
  status_atendimento: StatusAtendimento;
  origem: string | null;
  origem_cliente: OrigemCliente | null;
  // Campos adicionais (a serem criados)
  agendamento_id?: string | null;
  agendamento_data?: string | null;
  etapa_abandono?: EtapaConversa | null;
  ultima_interacao?: string | null;
  total_mensagens?: number;
}

export interface Mensagem {
  id: number;
  chatid: string;
  conversation: {
    role: 'user' | 'model';
    parts: { text: string }[];
  };
  timestamp: string;
  follow_up: string | null;
}

export type StatusAtendimento = 'ativo' | 'convertido' | 'abandonado' | 'pendente';

export type OrigemCliente = 
  | 'instagram' 
  | 'google' 
  | 'indicacao' 
  | 'facebook' 
  | 'site' 
  | 'whatsapp_direto' 
  | 'outro';

export type EtapaConversa = 
  | 'saudacao'
  | 'identificacao_interesse'
  | 'apresentacao_servicos'
  | 'discussao_preco'
  | 'disponibilidade_horario'
  | 'escolha_terapeuta'
  | 'confirmacao_agendamento'
  | 'pos_agendamento'
  | 'sem_resposta_inicial';

// Dashboard Types
export interface DashboardKPIs {
  totalLeads: number;
  taxaConversao: number;
  leadsAtivos: number;
  tempoMedioConversao: number;
  variacaoLeads: number;
  variacaoConversao: number;
}

export interface FunnelStep {
  nome: string;
  quantidade: number;
  percentual: number;
}

export interface LeadRecente {
  chatid: string;
  nome: string;
  origem: string;
  status: StatusAtendimento;
  ultimaMensagem: string;
  tempoDecorrido: string;
}

export interface AbandonoPorEtapa {
  etapa: EtapaConversa;
  quantidade: number;
  percentual: number;
}

export interface OrigemStats {
  origem: OrigemCliente;
  quantidade: number;
  percentual: number;
  conversao: number;
}

export interface TendenciaDiaria {
  data: string;
  leads: number;
  conversoes: number;
}
