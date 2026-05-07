import { GatewayDispatchEvents } from 'discord-api-types/v10';
import { ClientQuest } from './src/client';

const token = process.env.TOKEN?.trim();

if (!token) {
    console.error('ERRO: TOKEN não encontrada.');
    process.exit(1);
}

// Foco exclusivo no Brasil para evitar flags de localidade
const LOCALE = 'pt-BR';

const client = new ClientQuest(token);

let isChecking = false;
let initialized = false;

async function checkQuests() {
    if (isChecking) return;
    isChecking = true;

    try {
        console.log(`\n[${new Date().toLocaleTimeString()}] Buscando missões (Brasil)...`);

        // Garante que a localidade está correta
        if (typeof client.setLocale === 'function') {
            client.setLocale(LOCALE);
        }

        await client.fetchQuests(false);

        const quests = client.questManager!.filterQuestsValidToDo();

        if (quests.length === 0) {
            console.log('[INFO] Nenhuma missão pendente encontrada.');
        } else {
            console.log(`[ALERTA] ${quests.length} missões detectadas! Iniciando conclusão rápida...`);

            // Processa todas as missões encontradas de forma sequencial rápida
            for (const quest of quests) {
                try {
                    console.log(`[EM PROGRESSO] Completando: ${quest.config?.messages?.quest_name || quest.id}`);

                    // O 'doingQuest' geralmente já lida com o tempo de vídeo/stream internamente
                    await client.questManager!.doingQuest(quest);

                    console.log(`[OK] Missão concluída: ${quest.id}`);
                    
                    // Pequeno delay de 2 segundos apenas para não sobrecarregar a API
                    await new Promise((r) => setTimeout(r, 2000));
                } catch (err) {
                    console.error(`[ERRO NA MISSÃO] ${quest.id}:`, err.message || err);
                }
            }
            console.log('[INFO] Todas as missões disponíveis foram processadas.');
        }
    } catch (err) {
        console.error('[ERRO DE CONEXÃO]', err);
    } finally {
        isChecking = false;
    }
}

client.once(GatewayDispatchEvents.Ready, async ({ data }) => {
    console.log(`========================================`);
    console.log(`BOT ONLINE | Usuário: ${data.user.username}`);
    console.log(`MODO: Somente Brasil | Auto-Claim: DESATIVADO`);
    console.log(`========================================`);

    if (initialized) return;
    initialized = true;

    // Executa a primeira vez
    await checkQuests();

    // Checagem contínua a cada 5 minutos
    setInterval(async () => {
        await checkQuests();
    }, 1000 * 60 * 5);
});

// Mantém o processo vivo 24h mesmo com erros
process.on('unhandledRejection', (reason) => console.error('[Erro de Rejeição]', reason));
process.on('uncaughtException', (error) => console.error('[Erro Crítico]', error));

client.connect();
