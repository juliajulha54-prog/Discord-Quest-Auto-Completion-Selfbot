import { GatewayDispatchEvents, GatewayPresenceUpdate, ActivityType, PresenceUpdateStatus } from 'discord-api-types/v10';
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
let botId: string | null = null;

// ==========================================
// CONFIGURAÇÕES DOS STATUS ROTATIVOS (6s)
// ==========================================
let currentStatusMode: 'online' | 'idle' | 'dnd' | 'transmitting' | 'rotating' = 'rotating';
let presenceInterval: NodeJS.Timeout | null = null;

const rotatingStatuses = [
	PresenceUpdateStatus.Online,
	PresenceUpdateStatus.DoNotDisturb,
	PresenceUpdateStatus.Idle
];
let statusIndex = 0;

// Edite suas frases e atividades aqui!
const rotatingActivities = [
	{ text: 'Legenda da foto 1', activity: 'Jogando', type: ActivityType.Playing },
	{ text: 'Legenda da foto 2', activity: 'Anime', type: ActivityType.Watching },
	{ text: 'Legenda da foto 3', activity: 'Spotify', type: ActivityType.Listening },
];
let activityIndex = 0;

function updatePresence() {
	if (!client.websocketManager) return;

	// Se for modo Transmitindo (Roxinho) fixo
	if (currentStatusMode === 'transmitting') {
		const currentItem = rotatingActivities[activityIndex];
		activityIndex = (activityIndex + 1) % rotatingActivities.length;

		const payload: GatewayPresenceUpdate = {
			since: null,
			activities: [
				{ name: 'Custom Status', type: ActivityType.Custom, state: currentItem.text },
				{ name: 'Fazendo live de quests', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' }
			],
			status: PresenceUpdateStatus.Online,
			afk: false,
		};
		client.websocketManager.broadcast(0, payload as any);
		return;
	}

	// Modo Normal ou Rotativo de bolinhas
	let statusToGo = PresenceUpdateStatus.Online;
	if (currentStatusMode === 'rotating') {
		statusToGo = rotatingStatuses[statusIndex];
		statusIndex = (statusIndex + 1) % rotatingStatuses.length;
	} else {
		statusToGo = currentStatusMode as any;
	}

	const currentItem = rotatingActivities[activityIndex];
	activityIndex = (activityIndex + 1) % rotatingActivities.length;

	const payload: GatewayPresenceUpdate = {
		since: null,
		activities: [
			{ name: 'Custom Status', type: ActivityType.Custom, state: currentItem.text },
			{ name: currentItem.activity, type: currentItem.type }
		],
		status: statusToGo,
		afk: false,
	};

	client.websocketManager.broadcast(0, payload as any);
}

function startPresenceRotation() {
	if (presenceInterval) clearInterval(presenceInterval);
	presenceInterval = setInterval(() => {
		updatePresence();
	}, 6000);
	updatePresence();
}
// ==========================================

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

		// Inicia o sistema de status integrado
		startPresenceRotation();

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

		if (message.author?.id === botId && message.content && message.content.includes('?say')) {
			console.log(`[MESSAGE] Detectado "?say" na minha própria mensagem (${message.id}). Apagando...`);
			await client.rest.delete(`/channels/${message.channel_id}/messages/${message.id}`);
			return;
		}

		if (message.author?.id === botId && message.content && message.content.startsWith('?setstatus')) {
			await client.rest.delete(`/channels/${message.channel_id}/messages/${message.id}`);

			const args = message.content.split(' ');
			const comandoStatus = args[1]?.toLowerCase();

			if (comandoStatus === 'online') {
				currentStatusMode = 'online';
				updatePresence();
				console.log('[STATUS] Alterado manualmente para Online fixo.');
			} else if (comandoStatus === 'idle') {
				currentStatusMode = 'idle';
				updatePresence();
				console.log('[STATUS] Alterado manualmente para Ausente fixo.');
			} else if (comandoStatus === 'dnd') {
				currentStatusMode = 'dnd';
				updatePresence();
				console.log('[STATUS] Alterado manualmente para Não Perturbe fixo.');
			} else if (comandoStatus === 'transmitting') {
				currentStatusMode = 'transmitting';
				updatePresence();
				console.log('[STATUS] Alterado para Modo Transmissão (Roxinho fixo).');
			} else if (comandoStatus === 'rotate') {
				currentStatusMode = 'rotating';
				updatePresence();
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
	if (presenceInterval) clearInterval(presenceInterval);
	if (interval) clearInterval(interval);
	process.exit(0);
});

client.connect().catch((err: any) => {
	console.error('[CONNECT ERROR]', err);
});
		
