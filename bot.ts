import { GatewayDispatchEvents } from 'discord-api-types/v10';
import { ClientQuest } from './src/client';

const token = process.env.TOKEN?.trim();

if (!token) {
	console.error('[ERROR] TOKEN não encontrada nas variáveis de ambiente.');
	process.exit(1);
}

const client = new ClientQuest(token);

let isChecking = false;
let initialized = false;
let interval: NodeJS.Timeout | null = null;

async function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkQuests() {
	if (isChecking) {
		console.log('[QUEST] Já existe uma verificação em andamento.');
		return;
	}

	isChecking = true;

	try {
		console.log('[QUEST] Buscando quests...');

		await client.fetchQuests(false);

		const quests = client.questManager?.filterQuestsValidToDo() || [];

		console.log(`[QUEST] ${quests.length} quests válidas encontradas.`);

		if (!quests.length) {
			console.log('[QUEST] Nenhuma quest disponível.');
			return;
		}

		for (const quest of quests) {
			try {
				console.log(`[QUEST] Iniciando: ${quest.id}`);

				await client.questManager?.doingQuest(quest);

				console.log(`[QUEST] Finalizada: ${quest.id}`);

				await sleep(5000);
			} catch (err) {
				console.error(`[QUEST ERROR] Erro na quest ${quest.id}:`, err);
			}
		}
	} catch (err) {
		console.error('[FETCH ERROR]', err);
	} finally {
		isChecking = false;
	}
}

client.once(GatewayDispatchEvents.Ready, async ({ data }) => {
	try {
		console.log(`[CLIENT] Logado como ${data.user.username}`);

		if (initialized) return;
		initialized = true;

		await checkQuests();

		if (interval) clearInterval(interval);

		interval = setInterval(async () => {
			try {
				await checkQuests();
			} catch (err) {
				console.error('[INTERVAL ERROR]', err);
			}
		}, 1000 * 60 * 5);

		console.log('[CLIENT] Sistema automático iniciado.');
	} catch (err) {
		console.error('[READY ERROR]', err);
	}
});

process.on('unhandledRejection', (reason) => {
	console.error('[UnhandledRejection]', reason);
});

process.on('uncaughtException', (error) => {
	console.error('[UncaughtException]', error);
});

process.on('SIGINT', () => {
	console.log('[CLIENT] Encerrando aplicação...');

	if (interval) clearInterval(interval);

	process.exit(0);
});

client.connect().catch((err: any) => {
	console.error('[CONNECT ERROR]', err);
});
