/**
 * Script de sincronização COMPLETA de agendamentos
 * 
 * O que faz:
 * 1. Remove duplicatas existentes na tabela taj_agendamentos
 * 2. Varre TODAS as mensagens do modelo buscando agendamentos confirmados
 * 3. Extrai: código, data, hora, terapeuta, nome do cliente
 * 4. Popula a tabela taj_agendamentos com dados completos
 * 5. Atualiza status dos leads correspondentes para "convertido"
 * 
 * Uso: node scripts/sync-agendamentos-completo.js
 * Opções:
 *   --dry-run   Apenas mostra o que faria, sem alterar o banco
 *   --days=N    Processar apenas os últimos N dias (padrão: todos)
 */

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://vynilpckcxkahcyavtgy.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0'
);

const DRY_RUN = process.argv.includes('--dry-run');
const daysArg = process.argv.find(function (a) { return a.startsWith('--days='); });
const DAYS_LIMIT = daysArg ? parseInt(daysArg.split('=')[1]) : null;

// ========== REGEX PATTERNS ==========

function extractCodigo(texto) {
    // Padrões: Código: #2134575, Código: **#2134575**, #2134575
    var patterns = [
        /[Cc][óo]digo:?\s*\*{0,2}\s*#?(\d{5,})/gi,
        /#(\d{5,})/g
    ];
    var codigos = [];
    for (var i = 0; i < patterns.length; i++) {
        var matches = texto.matchAll(patterns[i]);
        for (var m of matches) {
            if (!codigos.includes(m[1])) {
                codigos.push(m[1]);
            }
        }
    }
    return codigos;
}

function extractData(texto) {
    // Padrões: 📅 19/02/2026, Data: 19/02, **Data:** 19/02/2026
    var patterns = [
        /📅\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/,
        /\*{0,2}Data:?\*{0,2}\s*(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/i,
        /(\d{1,2})[\/](\d{1,2})[\/](\d{2,4})/
    ];
    for (var i = 0; i < patterns.length; i++) {
        var match = texto.match(patterns[i]);
        if (match) {
            var dia = (match[1] || '01').padStart(2, '0');
            var mes = (match[2] || '01').padStart(2, '0');
            var ano = match[3] || new Date().getFullYear().toString();
            if (ano.length === 2) ano = '20' + ano;
            return ano + '-' + mes + '-' + dia;
        }
    }
    return null;
}

function extractHora(texto) {
    // Padrões: 🕐 18:00, Hora: 18:00, às 18:00, **18:00**
    var patterns = [
        /🕐\s*(\d{1,2}):(\d{2})/,
        /\*{0,2}Hora:?\*{0,2}\s*(\d{1,2}):(\d{2})/i,
        /[àa]s\s+(\d{1,2}):(\d{2})/i,
        /(\d{1,2}):(\d{2})\s*(?:h|hr|hrs)?/i
    ];
    for (var i = 0; i < patterns.length; i++) {
        var match = texto.match(patterns[i]);
        if (match) {
            return match[1].padStart(2, '0') + ':' + match[2] + ':00';
        }
    }
    return null;
}

function extractTerapeuta(texto) {
    // Padrões: 💆‍♀️ Bella, Terapeuta: Bella, **Terapeuta:** Bella
    var patterns = [
        /💆[‍♀️]*\s*([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)?)/,
        /\*{0,2}Terapeuta:?\*{0,2}\s*([A-ZÀ-Ü][a-zà-ü]+(?:\s+[A-ZÀ-Ü][a-zà-ü]+)?)/i,
        /(?:com a|com o)\s+([A-ZÀ-Ü][a-zà-ü]+)/i
    ];
    for (var i = 0; i < patterns.length; i++) {
        var match = texto.match(patterns[i]);
        if (match) {
            return match[1].trim();
        }
    }
    return null;
}

// ========== MAIN ==========

async function main() {
    console.log('===========================================');
    console.log('  SYNC AGENDAMENTOS COMPLETO');
    console.log('  ' + (DRY_RUN ? '🔍 MODO DRY-RUN (sem alterações)' : '🔥 MODO REAL (vai alterar o banco)'));
    if (DAYS_LIMIT) console.log('  Processando últimos ' + DAYS_LIMIT + ' dias');
    console.log('===========================================\n');

    // ---------- STEP 1: Buscar leads para nome e origem ----------
    console.log('📋 STEP 1: Carregando mapa de leads...');
    var leadMap = new Map();
    var offset = 0;
    var PAGE = 1000;
    var hasMore = true;

    while (hasMore) {
        var { data: leadsPage } = await supabase
            .from('taj_leads')
            .select('chatid, nome, origem_cliente_taj, status_atendimento')
            .range(offset, offset + PAGE - 1);

        if (leadsPage && leadsPage.length > 0) {
            leadsPage.forEach(function (l) {
                leadMap.set(l.chatid, {
                    nome: l.nome || 'Sem nome',
                    origem: l.origem_cliente_taj || null,
                    status: l.status_atendimento
                });
            });
            offset += PAGE;
            hasMore = leadsPage.length === PAGE;
        } else {
            hasMore = false;
        }
    }
    console.log('  Leads carregados: ' + leadMap.size);

    // ---------- STEP 2: Limpar duplicatas existentes ----------
    console.log('\n🧹 STEP 2: Verificando duplicatas existentes...');

    var allAgendamentos = [];
    offset = 0;
    hasMore = true;

    while (hasMore) {
        var { data: agPage } = await supabase
            .from('taj_agendamentos')
            .select('id, chatid, codigo_agendamento')
            .range(offset, offset + PAGE - 1);

        if (agPage && agPage.length > 0) {
            allAgendamentos = allAgendamentos.concat(agPage);
            offset += PAGE;
            hasMore = agPage.length === PAGE;
        } else {
            hasMore = false;
        }
    }

    console.log('  Total agendamentos existentes: ' + allAgendamentos.length);

    // Encontrar duplicatas (mesmo chatid + codigo)
    var seen = {};
    var duplicateIds = [];
    allAgendamentos.forEach(function (ag) {
        var chave = ag.chatid + '|' + ag.codigo_agendamento;
        if (seen[chave]) {
            duplicateIds.push(ag.id); // manter o primeiro, remover os subsequentes
        } else {
            seen[chave] = ag.id;
        }
    });

    console.log('  Duplicatas encontradas: ' + duplicateIds.length);

    if (duplicateIds.length > 0 && !DRY_RUN) {
        // Deletar em lotes de 100
        for (var i = 0; i < duplicateIds.length; i += 100) {
            var batch = duplicateIds.slice(i, i + 100);
            await supabase.from('taj_agendamentos').delete().in('id', batch);
        }
        console.log('  ✅ Duplicatas removidas: ' + duplicateIds.length);
    }

    // ---------- STEP 3: Buscar mensagens e extrair agendamentos ----------
    console.log('\n🔍 STEP 3: Varrendo mensagens para encontrar agendamentos...');

    var dateFilter = null;
    if (DAYS_LIMIT) {
        dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - DAYS_LIMIT);
    }

    // Buscar códigos já existentes (após limpeza)
    var existingCodes = new Set();
    Object.keys(seen).forEach(function (chave) {
        existingCodes.add(chave);
    });

    var novosAgendamentos = [];
    var chatIdsQueAgendaram = new Set();
    var totalMensagens = 0;
    var msgOffset = 0;
    var msgHasMore = true;
    var MSG_PAGE = 1000;

    while (msgHasMore) {
        var query = supabase
            .from('taj_mensagens')
            .select('chatid, conversation, timestamp')
            .order('timestamp', { ascending: true })
            .range(msgOffset, msgOffset + MSG_PAGE - 1);

        if (dateFilter) {
            query = query.gte('timestamp', dateFilter.toISOString());
        }

        var { data: mensagens, error: msgErr } = await query;

        if (msgErr) {
            console.error('  ERRO ao buscar mensagens:', msgErr.message);
            break;
        }

        if (!mensagens || mensagens.length === 0) {
            msgHasMore = false;
            break;
        }

        totalMensagens += mensagens.length;

        mensagens.forEach(function (msg) {
            // Só processar mensagens do modelo (respostas da Duda)
            if (!msg.conversation || msg.conversation.role !== 'model') return;

            var texto = '';
            if (msg.conversation.parts && msg.conversation.parts[0]) {
                texto = msg.conversation.parts[0].text || '';
            }
            if (!texto) return;

            // Verificar se a mensagem contém confirmação de agendamento
            var textoLower = texto.toLowerCase();
            var temConfirmacao = textoLower.includes('agendamento confirmado') ||
                textoLower.includes('confirmado') && textoLower.includes('código');

            if (!temConfirmacao) return;

            // Extrair dados
            var codigos = extractCodigo(texto);
            var dataAg = extractData(texto);
            var horaAg = extractHora(texto);
            var terapeuta = extractTerapeuta(texto);
            var leadInfo = leadMap.get(msg.chatid) || { nome: 'Sem nome', origem: null };

            if (codigos.length === 0) {
                // Tem confirmação mas sem código
                codigos = ['SEM_CODIGO'];
            }

            codigos.forEach(function (codigo) {
                var codigoFormatado = '#' + codigo;
                if (codigo === 'SEM_CODIGO') codigoFormatado = '#SEM_CODIGO';

                var chave = msg.chatid + '|' + codigoFormatado;
                if (existingCodes.has(chave)) return; // já existe

                existingCodes.add(chave);
                chatIdsQueAgendaram.add(msg.chatid);

                novosAgendamentos.push({
                    chatid: msg.chatid,
                    'nome do cliente': leadInfo.nome,
                    timestamp: msg.timestamp,
                    codigo_agendamento: codigoFormatado,
                    data_agendamento: dataAg,
                    hora_agendamento: horaAg,
                    'nome da terapeuta': terapeuta,
                    'serviço': null,
                    status: 'confirmado'
                });
            });
        });

        msgOffset += MSG_PAGE;
        msgHasMore = mensagens.length === MSG_PAGE;

        if (msgOffset % 5000 === 0) {
            process.stdout.write('  Processadas ' + msgOffset + ' mensagens...\r');
        }
    }

    console.log('  Mensagens analisadas: ' + totalMensagens);
    console.log('  Novos agendamentos encontrados: ' + novosAgendamentos.length);
    console.log('  Leads únicos que agendaram: ' + chatIdsQueAgendaram.size);

    // ---------- STEP 4: Inserir novos agendamentos ----------
    if (novosAgendamentos.length > 0) {
        console.log('\n💾 STEP 4: Inserindo novos agendamentos...');

        if (DRY_RUN) {
            console.log('  [DRY-RUN] Seriam inseridos ' + novosAgendamentos.length + ' agendamentos');
            novosAgendamentos.slice(0, 5).forEach(function (ag, i) {
                console.log('  Exemplo ' + (i + 1) + ': ' + ag.codigo_agendamento + ' | ' + ag['nome do cliente'] + ' | ' + (ag.data_agendamento || 'sem data') + ' ' + (ag.hora_agendamento || '') + ' | Terapeuta: ' + (ag['nome da terapeuta'] || 'N/A'));
            });
        } else {
            var inserted = 0;
            for (var i = 0; i < novosAgendamentos.length; i += 50) {
                var batch = novosAgendamentos.slice(i, i + 50);
                var { data: result, error: insertErr } = await supabase
                    .from('taj_agendamentos')
                    .insert(batch)
                    .select();

                if (insertErr) {
                    console.error('  ERRO ao inserir lote ' + i + ': ' + insertErr.message);
                } else {
                    inserted += (result ? result.length : 0);
                }
            }
            console.log('  ✅ Agendamentos inseridos: ' + inserted);
        }
    } else {
        console.log('\n💾 STEP 4: Nenhum agendamento novo para inserir');
    }

    // ---------- STEP 5: Atualizar agendamentos existentes com dados faltantes ----------
    console.log('\n🔄 STEP 5: Atualizando agendamentos com dados incompletos...');

    // Buscar agendamentos sem nome ou sem terapeuta
    var { data: agIncompletos } = await supabase
        .from('taj_agendamentos')
        .select('id, chatid, codigo_agendamento, nome do cliente, nome da terapeuta, data_agendamento, hora_agendamento')
        .or('nome do cliente.is.null,nome da terapeuta.is.null,data_agendamento.is.null');

    var atualizados = 0;
    if (agIncompletos && agIncompletos.length > 0) {
        console.log('  Agendamentos incompletos: ' + agIncompletos.length);

        for (var i = 0; i < agIncompletos.length; i++) {
            var ag = agIncompletos[i];
            var updates = {};
            var needsUpdate = false;

            // Preencher nome do cliente a partir do lead
            if (!ag['nome do cliente']) {
                var leadInfo = leadMap.get(ag.chatid);
                if (leadInfo && leadInfo.nome && leadInfo.nome !== 'Sem nome') {
                    updates['nome do cliente'] = leadInfo.nome;
                    needsUpdate = true;
                }
            }

            // Se falta terapeuta/data/hora, buscar na mensagem original
            if (!ag['nome da terapeuta'] || !ag.data_agendamento || !ag.hora_agendamento) {
                // Buscar mensagem com o código do agendamento
                var { data: msgs } = await supabase
                    .from('taj_mensagens')
                    .select('conversation, timestamp')
                    .eq('chatid', ag.chatid)
                    .order('timestamp', { ascending: false })
                    .limit(50);

                if (msgs) {
                    for (var j = 0; j < msgs.length; j++) {
                        var msg = msgs[j];
                        if (!msg.conversation || msg.conversation.role !== 'model') continue;
                        var texto = (msg.conversation.parts && msg.conversation.parts[0] && msg.conversation.parts[0].text) || '';
                        if (!texto) continue;

                        // Verificar se esta mensagem contém o código
                        var codigoNum = ag.codigo_agendamento ? ag.codigo_agendamento.replace('#', '') : '';
                        if (codigoNum && texto.includes(codigoNum)) {
                            if (!ag['nome da terapeuta'] && !updates['nome da terapeuta']) {
                                var t = extractTerapeuta(texto);
                                if (t) { updates['nome da terapeuta'] = t; needsUpdate = true; }
                            }
                            if (!ag.data_agendamento && !updates.data_agendamento) {
                                var d = extractData(texto);
                                if (d) { updates.data_agendamento = d; needsUpdate = true; }
                            }
                            if (!ag.hora_agendamento && !updates.hora_agendamento) {
                                var h = extractHora(texto);
                                if (h) { updates.hora_agendamento = h; needsUpdate = true; }
                            }
                            break;
                        }
                    }
                }
            }

            if (needsUpdate && !DRY_RUN) {
                await supabase.from('taj_agendamentos').update(updates).eq('id', ag.id);
                atualizados++;
            } else if (needsUpdate) {
                atualizados++;
            }
        }
        console.log('  ' + (DRY_RUN ? '[DRY-RUN] Seriam atualizados: ' : '✅ Atualizados: ') + atualizados);
    } else {
        console.log('  Nenhum agendamento incompleto');
    }

    // ---------- STEP 6: Sincronizar status dos leads ----------
    console.log('\n🔗 STEP 6: Sincronizando status dos leads...');

    // Buscar TODOS os chatIds com agendamento
    var allAgChatIds = new Set();
    offset = 0;
    hasMore = true;
    while (hasMore) {
        var { data: agPage } = await supabase
            .from('taj_agendamentos')
            .select('chatid')
            .range(offset, offset + PAGE - 1);

        if (agPage && agPage.length > 0) {
            agPage.forEach(function (a) { allAgChatIds.add(a.chatid); });
            offset += PAGE;
            hasMore = agPage.length === PAGE;
        } else {
            hasMore = false;
        }
    }

    // Verificar quais desses leads NÃO estão marcados como convertidos
    var leadsParaAtualizar = [];
    allAgChatIds.forEach(function (chatid) {
        var lead = leadMap.get(chatid);
        if (lead && lead.status !== 'convertido') {
            leadsParaAtualizar.push(chatid);
        }
    });

    console.log('  ChatIDs com agendamento: ' + allAgChatIds.size);
    console.log('  Leads que precisam ser marcados como convertidos: ' + leadsParaAtualizar.length);

    if (leadsParaAtualizar.length > 0 && !DRY_RUN) {
        for (var i = 0; i < leadsParaAtualizar.length; i += 50) {
            var batch = leadsParaAtualizar.slice(i, i + 50);
            await supabase
                .from('taj_leads')
                .update({ status_atendimento: 'convertido' })
                .in('chatid', batch);
        }
        console.log('  ✅ Leads atualizados para convertido: ' + leadsParaAtualizar.length);
    } else if (leadsParaAtualizar.length > 0) {
        console.log('  [DRY-RUN] Seriam atualizados: ' + leadsParaAtualizar.length);
    }

    // ---------- RESUMO FINAL ----------
    console.log('\n===========================================');
    console.log('  RESUMO FINAL');
    console.log('===========================================');
    console.log('  Duplicatas removidas: ' + duplicateIds.length);
    console.log('  Novos agendamentos inseridos: ' + novosAgendamentos.length);
    console.log('  Agendamentos atualizados (dados faltantes): ' + atualizados);
    console.log('  Leads atualizados para convertido: ' + leadsParaAtualizar.length);

    // Contagem final
    var { count: finalCount } = await supabase.from('taj_agendamentos').select('*', { count: 'exact', head: true });
    console.log('  Total final taj_agendamentos: ' + (finalCount || 0));
    console.log('===========================================');
}

main().catch(function (e) { console.error('ERRO GERAL: ' + e.message); console.error(e.stack); });
