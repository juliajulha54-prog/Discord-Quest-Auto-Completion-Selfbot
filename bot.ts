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
// CONFIGURAÇÕES DOS STATUS E TEMPOS ADJUSTADOS
// ==========================================
let currentStatusMode: 'idle' | 'dnd' | 'transmitting' | 'rotating' = 'rotating';
let phrasesInterval: NodeJS.Timeout | null = null;
let statusInterval: NodeJS.Timeout | null = null;

const sasukePhrases = [
	{ text: 'TOMA TOMA SUA PIRANHA' },
	{ text: 'NA XERECA' },
	{ text: 'TOMA TOMA TOMA NA BCT' },
	{ text: 'OXIKKKKKKKK???💀💀' }
];
let phraseIndex = 0;

// Rotação otimizada para evitar bloqueios do Discord
const rotatingSchedule = [
	{ name: 'League of Legends', type: 0, status: PresenceUpdateStatus.Idle },
	{ name: 'Twitch', type: 1, url: 'https://twitch.tv/twitch', status: PresenceUpdateStatus.Online }, // Roxo obrigatório
	{ name: 'Spotify', type: 2, status: PresenceUpdateStatus.DoNotDisturb },
	{ name: 'Minecraft', type: 0, status: PresenceUpdateStatus.Idle }
];
let scheduleIndex = 0;

function updatePresence() {
	const shard = client.websocketManager['strategy']['shards']?.get(0);
	if (!shard) return;

	const currentPhrase = sasukePhrases[phraseIndex];
	let statusToGo: string;
	let activitiesPayload: any[] = [];

	if (currentStatusMode === 'transmitting') {
		// Modo Fixo Transmitindo: Focado apenas na Twitch para não bugar a propagação global
		statusToGo = PresenceUpdateStatus.Online; 
		activitiesPayload = [
			{
				name: 'Custom Status',
				type: 4, 
				state: currentPhrase.text,
				id: 'custom'
			},
			{
				name: 'Twitch', 
				type: 1, 
				url: 'https://twitch.tv/twitch', 
				flags: 1
			}
		];
	} else if (currentStatusMode === 'idle') {
		statusToGo = PresenceUpdateStatus.Idle;
		activitiesPayload = [{ name: 'Custom Status', type: 4, state: currentPhrase.text, id: 'custom' }];
	} else if (currentStatusMode === 'dnd') {
		statusToGo = PresenceUpdateStatus.DoNotDisturb;
		activitiesPayload = [{ name: 'Custom Status', type: 4, state: currentPhrase.text, id: 'custom' }];
	} else {
		// MODO ROTATIVO
		const currentItem = rotatingSchedule[scheduleIndex];
		statusToGo = currentItem.status;

		if (currentItem.type === 1) {
			activitiesPayload = [
				{ name: 'Custom Status', type: 4, state: currentPhrase.text, id: 'custom' },
				{ name: currentItem.name, type: 1, url: currentItem.url, flags: 1 }
			];
		} else {
			activitiesPayload = [
				{ name: 'Custom Status', type: 4, state: currentPhrase.text, id: 'custom' },
				{ name: currentItem.name, type: currentItem.type }
			];
		}
	}

	shard.send({
		op: 3,
		d: {
			since: null,
			activities: activitiesPayload,
			status: statusToGo,
			afk: false
		}
	}).catch(() => {});
}

function startSyncTimers() {
	if (phrasesInterval) clearInterval(phrasesInterval);
	if (statusInterval) clearInterval(statusInterval);

	// Mudança de frases
	phrasesInterval = setInterval(() => {
		phraseIndex = (phraseIndex + 1) % sasukePhrases.length;
		updatePresence();
	}, 900);

	// Mudança de atividades (Aumentado ligeiramente para o Discord aceitar sem travar a conta)
	statusInterval = setInterval(() => {
		if (currentStatusMode === 'rotating') {
			scheduleIndex = (scheduleIndex + 1) % rotatingSchedule.length;
		}
		updatePresence();
	}, 2500);

	updatePresence();
}
// ==========================================

async function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkQuests() {
	if (isChecking) return;
	isChecking = true;

	try {
		await client.fetchQuests(false);
		const quests = client.questManager?.filterQuestsValidToDo() || [];

		if (!quests.length) return;

		for (const quest of quests) {
			try {
				await client.questManager?.doingQuest(quest);
				await sleep(5000);
			} catch (err) {
				console.error(`[QUEST ERROR]`, err);
			}
		}
	} catch (err) {
		console.error('[FETCH ERROR]', err);
	} finaly {
		isChecking = false;
	}
}

client.once(GatewayDispatchEvents.Ready, async ({ data }) => {
	try {
		console.log(`[CLIENT] Logado como ${data.user.username}`);
		botId = data.user.id;

		startSyncTimers();

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
	} catch (err) {
		console.error('[READY ERROR]', err);
	}
});

client.on(GatewayDispatchEvents.MessageCreate, async ({ data: message }) => {
	try {
		if (!botId) return;

		if (message.author?.id === botId && message.content && message.content.includes('?say')) {
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
			} else if (comandoStatus === 'dnd') {
				currentStatusMode = 'dnd';
				updatePresence();
			} else if (comandoStatus === 'transmitting') {
				currentStatusMode = 'transmitting';
				updatePresence();
			} else if (comandoStatus === 'rotate') {
				currentStatusMode = 'rotating';
				updatePresence();
			}
		}
	} catch (err) {
		console.error('[MESSAGE EVENT ERROR]', err);
	}
});

process.on('unhandledRejection', () => {});
process.on('uncaughtException', () => {});

process.on('SIGINT', () => {
	if (phrasesInterval) clearInterval(phrasesInterval);
	if (statusInterval) clearInterval(statusInterval);
	if (interval) clearInterval(interval);
	process.exit(0);
});

client.connect().catch(() => {});
			
