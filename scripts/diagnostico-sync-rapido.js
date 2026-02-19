const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://vynilpckcxkahcyavtgy.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5bmlscGNrY3hrYWhjeWF2dGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1MDk0NzgsImV4cCI6MjA2ODA4NTQ3OH0.FBQew2ByPELeVDlbLZjhKUhbnRQyWKwTrZz0CVXvEi0');

async function diagnostico() {
    console.log('📊 DIAGNÓSTICO RÁPIDO - AGENDAMENTOS ONTEM E HOJE\n');
    console.log('Data/Hora atual:', new Date().toLocaleString('pt-BR'));
    console.log('='.repeat(60));

    // Definir datas
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeFim = new Date();
    hojeFim.setHours(23, 59, 59, 999);

    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    ontem.setHours(0, 0, 0, 0);
    const ontemFim = new Date();
    ontemFim.setDate(ontemFim.getDate() - 1);
    ontemFim.setHours(23, 59, 59, 999);

    console.log('\n📅 ONTEM:', ontem.toLocaleDateString('pt-BR'));
    console.log('📅 HOJE:', hoje.toLocaleDateString('pt-BR'));

    // 1. Buscar mensagens de ontem e hoje com agendamento confirmado
    console.log('\n🔍 Buscando mensagens...');

    const { data: msgOntem, error: errOntem } = await supabase
        .from('taj_mensagens')
        .select('chatid, conversation, timestamp')
        .gte('timestamp', ontem.toISOString())
        .lte('timestamp', ontemFim.toISOString());

    if (errOntem) {
        console.log('Erro ao buscar mensagens de ontem:', errOntem.message);
        return;
    }

    const { data: msgHoje, error: errHoje } = await supabase
        .from('taj_mensagens')
        .select('chatid, conversation, timestamp')
        .gte('timestamp', hoje.toISOString())
        .lte('timestamp', hojeFim.toISOString());

    if (errHoje) {
        console.log('Erro ao buscar mensagens de hoje:', errHoje.message);
        return;
    }

    // Filtrar apenas confirmações
    const confirmadasOntem = (msgOntem || []).filter(m =>
        JSON.stringify(m.conversation || '').toLowerCase().includes('agendamento confirmado')
    );

    const confirmadasHoje = (msgHoje || []).filter(m =>
        JSON.stringify(m.conversation || '').toLowerCase().includes('agendamento confirmado')
    );

    // Extrair códigos
    function extrairCodigos(mensagens) {
        const codigos = new Map(); // codigo -> {chatid, timestamp}
        mensagens.forEach(m => {
            const texto = JSON.stringify(m.conversation || '');
            const matches = texto.match(/#(\d{6,})/g);
            if (matches) {
                matches.forEach(c => {
                    if (!codigos.has(c)) {
                        codigos.set(c, { chatid: m.chatid, timestamp: m.timestamp });
                    }
                });
            }
        });
        return codigos;
    }

    const codigosOntem = extrairCodigos(confirmadasOntem);
    const codigosHoje = extrairCodigos(confirmadasHoje);

    console.log('\n📨 MENSAGENS:');
    console.log(`   ONTEM: ${msgOntem?.length || 0} mensagens, ${confirmadasOntem.length} confirmações, ${codigosOntem.size} códigos únicos`);
    console.log(`   HOJE: ${msgHoje?.length || 0} mensagens, ${confirmadasHoje.length} confirmações, ${codigosHoje.size} códigos únicos`);

    // 2. Buscar agendamentos na tabela
    const { data: agOntem } = await supabase
        .from('taj_agendamentos')
        .select('codigo_agendamento, chatid, timestamp')
        .gte('timestamp', ontem.toISOString())
        .lte('timestamp', ontemFim.toISOString());

    const { data: agHoje } = await supabase
        .from('taj_agendamentos')
        .select('codigo_agendamento, chatid, timestamp')
        .gte('timestamp', hoje.toISOString())
        .lte('timestamp', hojeFim.toISOString());

    console.log('\n📋 TABELA TAJ_AGENDAMENTOS:');
    console.log(`   ONTEM: ${agOntem?.length || 0} registros`);
    console.log(`   HOJE: ${agHoje?.length || 0} registros`);

    // 3. Buscar TODOS os códigos existentes na tabela
    const { data: todosAg } = await supabase
        .from('taj_agendamentos')
        .select('codigo_agendamento');

    const codigosExistentes = new Set((todosAg || []).map(a => a.codigo_agendamento));

    // 4. Verificar códigos faltantes
    console.log('\n🔴 ANÁLISE DE DISCREPÂNCIA:');

    const faltandoOntem = [];
    codigosOntem.forEach((info, codigo) => {
        if (!codigosExistentes.has(codigo)) {
            faltandoOntem.push({ codigo, ...info });
        }
    });

    const faltandoHoje = [];
    codigosHoje.forEach((info, codigo) => {
        if (!codigosExistentes.has(codigo)) {
            faltandoHoje.push({ codigo, ...info });
        }
    });

    console.log(`   Códigos de ONTEM NÃO sincronizados: ${faltandoOntem.length}`);
    console.log(`   Códigos de HOJE NÃO sincronizados: ${faltandoHoje.length}`);

    // 5. Listar códigos faltantes
    if (faltandoOntem.length > 0) {
        console.log('\n❌ CÓDIGOS FALTANTES DE ONTEM:');
        faltandoOntem.forEach((f, i) => {
            console.log(`   ${i + 1}. ${f.codigo} | ChatID: ${f.chatid?.slice(0, 20)}... | ${new Date(f.timestamp).toLocaleString('pt-BR')}`);
        });
    }

    if (faltandoHoje.length > 0) {
        console.log('\n❌ CÓDIGOS FALTANTES DE HOJE:');
        faltandoHoje.forEach((f, i) => {
            console.log(`   ${i + 1}. ${f.codigo} | ChatID: ${f.chatid?.slice(0, 20)}... | ${new Date(f.timestamp).toLocaleString('pt-BR')}`);
        });
    }

    if (faltandoOntem.length === 0 && faltandoHoje.length === 0) {
        console.log('\n✅ Todos os códigos estão sincronizados!');
    }

    // 6. Verificar se há algum código que está na tabela mas com timestamp diferente
    console.log('\n🔄 VERIFICAÇÃO ADICIONAL - Códigos em período errado:');

    const codigosOntemHoje = new Set([...codigosOntem.keys(), ...codigosHoje.keys()]);
    let encontradosEmOutroPeriodo = 0;

    for (const codigo of codigosOntemHoje) {
        if (codigosExistentes.has(codigo)) {
            // Verificar se está no período correto
            const agEncontrado = [...(agOntem || []), ...(agHoje || [])].find(a => a.codigo_agendamento === codigo);
            if (!agEncontrado) {
                encontradosEmOutroPeriodo++;
                if (encontradosEmOutroPeriodo <= 5) {
                    console.log(`   ${codigo} - está na tabela, mas com timestamp fora do período de ontem/hoje`);
                }
            }
        }
    }

    if (encontradosEmOutroPeriodo > 5) {
        console.log(`   ... e mais ${encontradosEmOutroPeriodo - 5} códigos com timestamp incorreto`);
    }

    if (encontradosEmOutroPeriodo === 0) {
        console.log('   Nenhum código com timestamp fora do período.');
    }

    console.log('\n' + '='.repeat(60));
    console.log('Diagnóstico concluído!');
}

diagnostico().catch(e => console.error('Erro:', e.message));
