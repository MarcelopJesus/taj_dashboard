import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST() {
    try {
        // Buscar mensagens das últimas 24 horas
        const ontem = new Date();
        ontem.setDate(ontem.getDate() - 1);

        const { data: mensagens } = await supabase
            .from('taj_mensagens')
            .select('chatid, conversation, timestamp')
            .gte('timestamp', ontem.toISOString())
            .order('timestamp', { ascending: false });

        // Buscar agendamentos já existentes
        const { data: agendamentosExistentes } = await supabase
            .from('taj_agendamentos')
            .select('codigo_agendamento');

        const codigosExistentes = new Set(agendamentosExistentes?.map(a => a.codigo_agendamento) || []);

        // Extrair novos agendamentos das mensagens
        const novosAgendamentos: { chatid: string; codigo_agendamento: string; timestamp: string }[] = [];
        const processados = new Set<string>();

        mensagens?.forEach(msg => {
            const texto = JSON.stringify(msg.conversation || '');

            if (texto.toLowerCase().includes('agendamento confirmado')) {
                const matches = texto.match(/#(\d{6,})/g);

                if (matches) {
                    for (const match of matches) {
                        const codigo = match;

                        if (!codigosExistentes.has(codigo) && !processados.has(codigo)) {
                            novosAgendamentos.push({
                                chatid: msg.chatid,
                                codigo_agendamento: codigo,
                                timestamp: msg.timestamp
                            });
                            processados.add(codigo);
                            codigosExistentes.add(codigo);
                        }
                    }
                }
            }
        });

        // Inserir novos agendamentos
        let inserted = 0;
        if (novosAgendamentos.length > 0) {
            const { data } = await supabase
                .from('taj_agendamentos')
                .insert(novosAgendamentos)
                .select();

            inserted = data?.length || 0;
        }

        return NextResponse.json({
            success: true,
            novosAgendamentos: inserted,
            mensagensAnalisadas: mensagens?.length || 0
        });

    } catch (error) {
        console.error('Erro na sincronização:', error);
        return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ message: 'Use POST para sincronizar' });
}
