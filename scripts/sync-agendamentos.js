/**
 * Script de Sincronização de Agendamentos
 * 
 * Analisa as mensagens da tabela taj_mensagens e extrai agendamentos confirmados
 * que ainda não estão na tabela taj_agendamentos.
 * 
 * Pode ser executado manualmente ou via cron/n8n
 * 
 * Uso: node scripts/sync-agendamentos.js [--all] [--days=N]
 *   --all: Sincroniza TODOS os agendamentos (não apenas os de hoje)
 *   --days=N: Sincroniza os últimos N dias (padrão: 1 = hoje)
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://vynilpckcxkahcyavtgy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0'
);

// Parse argumentos
const args = process.argv.slice(2);
const syncAll = args.includes('--all');
const daysArg = args.find(a => a.startsWith('--days='));
const days = daysArg ? parseInt(daysArg.split('=')[1]) : 1;

async function syncAgendamentos() {
    const startTime = new Date();
    console.log('🔄 Iniciando sincronização de agendamentos...');
    console.log(`📅 Modo: ${syncAll ? 'TODOS' : `Últimos ${days} dia(s)`}`);
    console.log(`⏰ Início: ${startTime.toLocaleString('pt-BR')}\n`);

    try {
        // Calcular data de início
        let dataInicio;
        if (syncAll) {
            dataInicio = new Date('2020-01-01');
        } else {
            dataInicio = new Date();
            dataInicio.setDate(dataInicio.getDate() - days + 1);
            dataInicio.setHours(0, 0, 0, 0);
        }

        console.log(`🔍 Buscando mensagens desde: ${dataInicio.toLocaleDateString('pt-BR')}`);

        // Buscar todas as mensagens no período
        let allMessages = [];
        let offset = 0;
        const limit = 1000;

        while (true) {
            const { data: mensagens, error } = await supabase
                .from('taj_mensagens')
                .select('chatid, conversation, timestamp')
                .gte('timestamp', dataInicio.toISOString())
                .order('timestamp', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) {
                console.error('❌ Erro ao buscar mensagens:', error.message);
                break;
            }

            if (!mensagens || mensagens.length === 0) break;

            allMessages = allMessages.concat(mensagens);
            offset += limit;

            if (mensagens.length < limit) break;
        }

        console.log(`📨 Total de mensagens analisadas: ${allMessages.length}`);

        // Buscar agendamentos já existentes
        const { data: agendamentosExistentes, error: agError } = await supabase
            .from('taj_agendamentos')
            .select('codigo_agendamento, chatid');

        if (agError) {
            console.error('❌ Erro ao buscar agendamentos:', agError.message);
            return;
        }

        const codigosExistentes = new Set(agendamentosExistentes?.map(a => a.codigo_agendamento) || []);
        console.log(`📋 Agendamentos já registrados: ${codigosExistentes.size}`);

        // Extrair agendamentos das mensagens
        const novosAgendamentos = [];
        const processados = new Set();

        for (const msg of allMessages) {
            const texto = JSON.stringify(msg.conversation || '');

            // Verificar se é uma mensagem de confirmação de agendamento
            if (texto.toLowerCase().includes('agendamento confirmado')) {
                // Extrair código #XXXXXXX
                const matches = texto.match(/#(\d{6,})/g);

                if (matches) {
                    for (const match of matches) {
                        const codigo = match;

                        // Verificar se já existe ou já foi processado nesta execução
                        // Usar APENAS o código como chave para evitar duplicatas
                        if (!codigosExistentes.has(codigo) && !processados.has(codigo)) {
                            // Tentar extrair data do agendamento da mensagem
                            let dataAgendamento = null;
                            const dataMatch = texto.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
                            if (dataMatch) {
                                const dia = parseInt(dataMatch[1]);
                                const mes = parseInt(dataMatch[2]) - 1;
                                const ano = dataMatch[3] ? (dataMatch[3].length === 2 ? 2000 + parseInt(dataMatch[3]) : parseInt(dataMatch[3])) : new Date().getFullYear();
                                dataAgendamento = new Date(ano, mes, dia).toISOString().split('T')[0];
                            }

                            novosAgendamentos.push({
                                chatid: msg.chatid,
                                codigo_agendamento: codigo,
                                timestamp: msg.timestamp,
                                data_agendamento: dataAgendamento
                            });
                            processados.add(codigo); // Usar apenas código como chave
                            codigosExistentes.add(codigo); // Evitar duplicatas
                        }
                    }
                }
            }
        }

        console.log(`\n🆕 Novos agendamentos encontrados: ${novosAgendamentos.length}`);

        if (novosAgendamentos.length > 0) {
            // Mostrar os novos agendamentos
            console.log('\nDetalhes:');
            novosAgendamentos.slice(0, 20).forEach((a, i) => {
                console.log(`  ${i + 1}. ${a.codigo_agendamento} | ChatID: ${a.chatid?.slice(0, 18)}... | ${new Date(a.timestamp).toLocaleString('pt-BR')}`);
            });

            if (novosAgendamentos.length > 20) {
                console.log(`  ... e mais ${novosAgendamentos.length - 20} agendamentos`);
            }

            // Inserir em batches de 100
            const batchSize = 100;
            let inserted = 0;
            let errors = 0;

            for (let i = 0; i < novosAgendamentos.length; i += batchSize) {
                const batch = novosAgendamentos.slice(i, i + batchSize);

                const { data, error } = await supabase
                    .from('taj_agendamentos')
                    .insert(batch)
                    .select();

                if (error) {
                    console.error(`  ❌ Erro no batch ${Math.floor(i / batchSize) + 1}:`, error.message);
                    errors += batch.length;
                } else {
                    inserted += data?.length || 0;
                }
            }

            console.log(`\n✅ Inseridos com sucesso: ${inserted} agendamentos`);
            if (errors > 0) {
                console.log(`⚠️ Erros: ${errors} agendamentos`);
            }
        } else {
            console.log('✅ Nenhum novo agendamento para sincronizar.');
        }

        const endTime = new Date();
        const duration = (endTime - startTime) / 1000;
        console.log(`\n⏱️ Tempo de execução: ${duration.toFixed(2)}s`);

    } catch (error) {
        console.error('❌ Erro fatal:', error.message);
        process.exit(1);
    }
}

// Executar
syncAgendamentos();
