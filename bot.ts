import { GatewayDispatchEvents } from 'discord-api-types/v10';
import { ClientQuest } from './src/client';
import { PresenceManager } from './src/presenceManager'; // Importa o novo sistema

const token = process.env.TOKEN?.trim();

if (!token) {
	console.error('[ERROR] TOKEN não encontrada nas variáveis de ambiente.');
	process.exit(1);
}

const client = new ClientQuest(token);
let presenceManager: PresenceManager | null = null; // Instância global

let isChecking = false;
let initialized = false;
let interval: NodeJS.Timeout | null = null;
let botId: string | null = null;

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
		
		botId = data.user.id;

		// Inicializa e liga o sistema de status rotativo a cada 6s
		presenceManager = new PresenceManager(client.websocketManager);
		presenceManager.start();

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

client.on(GatewayDispatchEvents.MessageCreate, async ({ data: message }) => {
	try {
		if (!botId) return;

		// Filtro antigo para apagar o comando ?say da própria conta
		if (message.author?.id === botId && message.content && message.content.includes('?say')) {
			console.log(`[MESSAGE] Detectado "?say" na minha própria mensagem (${message.id}). Apagando...`);
			await client.rest.delete(`/channels/${message.channel_id}/messages/${message.id}`);
			return;
		}

		// NOVO: Ouvinte do comando ?setstatus da própria conta
		if (message.author?.id === botId && message.content && message.content.startsWith('?setstatus')) {
			// Apaga a mensagem do comando imediatamente
			await client.rest.delete(`/channels/${message.channel_id}/messages/${message.id}`);

			const args = message.content.split(' ');
			const comandoStatus = args[1]?.toLowerCase(); // Pega o argumento (ex: online, dnd, transmitting)

			if (!presenceManager) return;

			if (comandoStatus === 'online') {
				presenceManager.disableTransmitting();
				presenceManager.setManualStatus('online');
				console.log('[STATUS] Alterado manualmente para Online fixo.');
			} else if (comandoStatus === 'idle') {
				presenceManager.disableTransmitting();
				presenceManager.setManualStatus('idle');
				console.log('[STATUS] Alterado manualmente para Ausente fixo.');
			} else if (comandoStatus === 'dnd') {
				presenceManager.disableTransmitting();
				presenceManager.setManualStatus('dnd');
				console.log('[STATUS] Alterado manualmente para Não Perturbe fixo.');
			} else if (comandoStatus === 'transmitting') {
				presenceManager.setManualStatus('transmitting');
				console.log('[STATUS] Alterado para Modo Transmissão (Roxinho fixo).');
			} else if (comandoStatus === 'rotate') {
				presenceManager.disableTransmitting();
				console.log('[STATUS] Voltou para o modo Rotativo Automático.');
			}
		}
	} catch (err) {
		console.error('[MESSAGE EVENT ERROR] Erro no processamento da mensagem:', err);
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
	if (presenceManager) presenceManager.stop();
	if (interval) clearInterval(interval);
	process.exit(0);
});

client.connect().catch((err: any) => {
	console.error('[CONNECT ERROR]', err);
});
					  
