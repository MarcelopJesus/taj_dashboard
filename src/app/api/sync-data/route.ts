
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Configuração do Supabase
// Usando variáveis de ambiente ou valores hardcoded se necessário no backend (embora seja melhor usar env vars)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vynilpckcxkahcyavtgy.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Regex patterns para detectar agendamentos
const PATTERNS = {
    codigo: /[Cc][óo]digo:?\s*[\*]*\s*#?(\d{5,})/gi,
    confirmado: /agendamento\s+(confirmado|realizado|feito)/gi,
};

function extractDataFromText(texto: string) {
    const dataRegex = /\*?\*?Data:?\*?\*?\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/i;
    const match = texto.match(dataRegex);
    if (match) {
        const dia = (match[1] || '01').padStart(2, '0');
        const mes = (match[2] || '01').padStart(2, '0');
        let ano = match[3] || new Date().getFullYear().toString();
        if (ano.length === 2) ano = '20' + ano;
        return `${ano}-${mes}-${dia}`;
    }
    return null;
}

function extractHoraFromText(texto: string) {
    const horaRegex = /\*?\*?Hora:?\*?\*?\s*(\d{1,2}):(\d{2})/i;
    const match = texto.match(horaRegex);
    if (match) {
        return `${match[1].padStart(2, '0')}:${match[2]}:00`;
    }
    return null;
}

function extractTerapeutaFromText(texto: string) {
    const terapeutaRegex = /\*?\*?Terapeuta:?\*?\*?\s*([^\n\*]+)/i;
    const match = texto.match(terapeutaRegex);
    if (match) {
        return match[1].trim();
    }
    return null;
}

function extractAgendamentosFromMessage(texto: string, chatid: string, timestamp: string, nomeCliente: string) {
    const agendamentos: any[] = [];

    const codigoMatches = [...texto.matchAll(PATTERNS.codigo)];
    const confirmadoMatch = texto.match(PATTERNS.confirmado);

    if (codigoMatches.length === 0 && !confirmadoMatch) {
        return agendamentos;
    }

    const dataAgendamento = extractDataFromText(texto);
    const horaAgendamento = extractHoraFromText(texto);
    const terapeuta = extractTerapeutaFromText(texto);

    if (codigoMatches.length > 0) {
        for (const match of codigoMatches) {
            const codigo = match[1];

            agendamentos.push({
                chatid,
                'nome do cliente': nomeCliente,
                timestamp: timestamp,
                codigo_agendamento: `#${codigo}`,
                data_agendamento: dataAgendamento,
                hora_agendamento: horaAgendamento,
                'nome da terapeuta': terapeuta,
                'serviço': null,
                status: 'confirmado',
            });
        }
    } else if (confirmadoMatch) {
        agendamentos.push({
            chatid,
            'nome do cliente': nomeCliente,
            timestamp: timestamp,
            codigo_agendamento: '#SEM_CODIGO',
            data_agendamento: dataAgendamento,
            hora_agendamento: horaAgendamento,
            'nome da terapeuta': terapeuta,
            'serviço': null,
            status: 'confirmado',
        });
    }

    return agendamentos;
}

export async function POST() {
    try {
        // 1. Buscar leads para ter os nomes
        const { data: leads } = await supabase
            .from('taj_leads')
            .select('chatid, nome');

        const leadMap = new Map();
        if (leads) {
            leads.forEach(l => leadMap.set(l.chatid, l.nome || 'Sem nome'));
        }

        // 2. Data de hoje (UTC e Local ajustado)
        // Pegar todas as mensagens das últimas 24 horas para garantir que não perdeu nada
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);

        const { data: mensagens, error: msgError } = await supabase
            .from('taj_mensagens')
            .select('chatid, conversation, timestamp')
            .gte('timestamp', yesterday.toISOString())
            .order('timestamp', { ascending: true });

        if (msgError) {
            return NextResponse.json({ error: msgError.message }, { status: 500 });
        }

        if (!mensagens || mensagens.length === 0) {
            return NextResponse.json({ message: 'Nenhuma mensagem recente encontrada', inserted: 0 });
        }

        // 3. Processar mensagens
        const todosAgendamentos: any[] = [];
        const codigosProcessados = new Set();

        for (const msg of mensagens) {
            // @ts-ignore
            if (!msg.conversation || msg.conversation.role !== 'model') continue;

            // @ts-ignore
            const texto = (msg.conversation.parts && msg.conversation.parts[0] && msg.conversation.parts[0].text) || '';
            if (!texto) continue;

            const nomeCliente = leadMap.get(msg.chatid) || 'Sem nome';
            const agendamentos = extractAgendamentosFromMessage(
                texto,
                msg.chatid,
                msg.timestamp,
                nomeCliente
            );

            for (const ag of agendamentos) {
                const chave = `${ag.chatid}-${ag.codigo_agendamento}`;
                if (!codigosProcessados.has(chave)) {
                    codigosProcessados.add(chave);
                    todosAgendamentos.push(ag);
                }
            }
        }

        if (todosAgendamentos.length === 0) {
            return NextResponse.json({ message: 'Nenhum agendamento detectado nas mensagens recentes', inserted: 0 });
        }

        // 4. Verificar e filtrar existentes
        const { data: existentes } = await supabase
            .from('taj_agendamentos')
            .select('chatid, codigo_agendamento');

        const existentesSet = new Set();
        if (existentes) {
            existentes.forEach(e => existentesSet.add(`${e.chatid}-${e.codigo_agendamento}`));
        }

        const novosAgendamentos = todosAgendamentos.filter(ag => {
            const chave = `${ag.chatid}-${ag.codigo_agendamento}`;
            return !existentesSet.has(chave);
        });

        if (novosAgendamentos.length === 0) {
            return NextResponse.json({ message: 'Todos os agendamentos já estavam sincronizados', inserted: 0 });
        }

        // 5. Inserir novos
        const { data: inserted, error: insertError } = await supabase
            .from('taj_agendamentos')
            .insert(novosAgendamentos)
            .select();

        if (insertError) {
            return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        return NextResponse.json({
            message: 'Sincronização concluída com sucesso',
            inserted: inserted.length,
            details: inserted
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
