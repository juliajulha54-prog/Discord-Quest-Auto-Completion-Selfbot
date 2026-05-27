import { GatewayDispatchEvents, PresenceUpdateStatus } from 'discord-api-types/v10';
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
let currentStatusMode: 'idle' | 'dnd' | 'transmitting' | 'rotating' = 'rotating';
let presenceInterval: NodeJS.Timeout | null = null;

const rotatingStatuses = [
	PresenceUpdateStatus.Idle,
	PresenceUpdateStatus.DoNotDisturb
];
let statusIndex = 0;

const sasukeActivities = [
	{ text: 'blzkkkkkkkkkk' },
	{ text: 'ok' },
	{ text: 'sla?' },
	{ text: 'sla' }
];
let activityIndex = 0;

function updatePresence() {
	const shard = client.websocketManager['strategy']['shards']?.get(0);
	if (!shard) return;

	const currentItem = sasukeActivities[activityIndex];
	activityIndex = (activityIndex + 1) % sasukeActivities.length;

	let statusToGo: string = PresenceUpdateStatus.Idle;
	let activitiesPayload: any[] = [];

	if (currentStatusMode === 'transmitting') {
		statusToGo = PresenceUpdateStatus.Online; 
		
		activitiesPayload = [
			{
				name: 'Custom Status',
				type: 4, 
				state: currentItem.text,
				id: 'custom'
			},
			{
				name: 'Twitch', 
				type: 1, // Streaming
				url: 'https://twitch.tv/twitch', 
				flags: 1 // Força o gateway a reconhecer o estado roxo de transmissão
			}
		];
	} else {
		if (currentStatusMode === 'rotating') {
			statusToGo = rotatingStatuses[statusIndex];
			statusIndex = (statusIndex + 1) % rotatingStatuses.length;
		} else {
			statusToGo = currentStatusMode as any;
		}

		activitiesPayload = [
			{
				name: 'Custom Status',
				type: 4, 
				state: currentItem.text,
				id: 'custom'
			}
		];
	}

	shard.send({
		op: 3,
		d: {
			since: null,
			activities: activitiesPayload,
			status: statusToGo,
			afk: false
		}
	}).catch((err) => console.error('[PRESENCE ERROR]', err));
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
			console.log(`[MESSAGE] Detectado "?say" na minha própria mensagem. Apagando...`);
			await client.rest.delete(`/channels/${message.channel_id}/messages/${message.id}`);
			return;
		}

		if (message.author?.id === botId && message.content && message.content.startsWith('?setstatus')) {
			await client.rest.delete(`/channels/${message.channel_id}/messages/${message.id}`);

			const args = message.content.split(' ');
			const comandoStatus = args[1]?.toLowerCase();

			if (comandoStatus === 'idle') {
				currentStatusMode = 'idle';
				updatePresence();
				console.log('[STATUS] Modo manual: Ausente (Laranja).');
			} else if (comandoStatus === 'dnd') {
				currentStatusMode = 'dnd';
				updatePresence();
				console.log('[STATUS] Modo manual: Não Perturbe (Vermelho).');
			} else if (comandoStatus === 'transmitting') {
				currentStatusMode = 'transmitting';
				updatePresence();
				console.log('[STATUS] Modo manual: Transmitindo (Roxinho).');
			} else if (comandoStatus === 'rotate') {
				currentStatusMode = 'rotating';
				updatePresence();
				console.log('[STATUS] Retornado para a rotação automática.');
			}
		}
	} catch (err) {
		console.error('[MESSAGE EVENT ERROR]', err);
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
				
