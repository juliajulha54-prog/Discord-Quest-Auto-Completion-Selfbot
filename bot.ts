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
// CONFIGURAÇÕES DE PRESENÇA E TIMERS
// ==========================================
let currentStatusMode: 'idle' | 'dnd' | 'transmitting' | 'rotating' | 'after_effects' = 'rotating';
let phrasesInterval: NodeJS.Timeout | null = null;
let statusInterval: NodeJS.Timeout | null = null;

let phraseIndex = 0;

// ID público oficial do Adobe After Effects no Discord
const AFTER_EFFECTS_APP_ID = "994646706013618216";

// Lista do modo rotativo (Cores e Atividades trocam a cada 2 segundos)
const rotatingSchedule = [
	{ name: 'League of Legends', type: 0, status: PresenceUpdateStatus.Idle },
	{ 
		name: 'Twitch', 
		type: 1, 
		url: 'https://twitch.tv/shroud', 
		status: PresenceUpdateStatus.DoNotDisturb 
	}, 
	{ 
		name: 'After Effects', 
		type: 0, 
		status: PresenceUpdateStatus.DoNotDisturb,
		application_id: AFTER_EFFECTS_APP_ID,
		details: "Editando vídeo",
		state: "Renderizando composições"
	},
	{ name: 'Sua Mãe na cama', type: 0, status: PresenceUpdateStatus.Idle }
];
let scheduleIndex = 0;

function updatePresence() {
	const shard = client.websocketManager['strategy']['shards']?.get(0);
	if (!shard) return;

	let statusToGo: string;
	let activitiesPayload: any[] = [];

	if (currentStatusMode === 'transmitting') {
		// [FIXO] ?setstatus transmitting -> Apenas a atividade de stream pura (Garante o roxo perfeito)
		statusToGo = PresenceUpdateStatus.DoNotDisturb; 
		activitiesPayload = [
			{
				name: 'Twitch', 
				type: 1, 
				url: 'https://twitch.tv/shroud'
			}
		];
	} else if (currentStatusMode === 'after_effects') {
		// [FIXO] ?setstatus after -> Atividade pura do After Effects sem misturar com status customizado
		statusToGo = PresenceUpdateStatus.DoNotDisturb;
		activitiesPayload = [
			{
				name: 'After Effects',
				type: 0,
				application_id: AFTER_EFFECTS_APP_ID,
				details: "Editando vídeo",
				state: "Renderizando composições"
			}
		];
	} else if (currentStatusMode === 'idle') {
		statusToGo = PresenceUpdateStatus.Idle;
		activitiesPayload = [];
	} else if (currentStatusMode === 'dnd') {
		statusToGo = PresenceUpdateStatus.DoNotDisturb;
		activitiesPayload = [];
	} else {
		// [ROTATIVO] ?setstatus rotate
		const currentItem = rotatingSchedule[scheduleIndex];
		statusToGo = currentItem.status;

		if (currentItem.type === 1) {
			activitiesPayload = [
				{ name: currentItem.name, type: 1, url: currentItem.url }
			];
		} else {
			const activity: any = {
				name: currentItem.name,
				type: currentItem.type
			};

			if ('application_id' in currentItem) {
				activity.application_id = currentItem.application_id;
			}
			if ('details' in currentItem) {
				activity.details = currentItem.details;
			}
			if ('state' in currentItem) {
				activity.state = currentItem.state;
			}

			activitiesPayload = [activity];
		}
	}

	// Envia de forma limpa e direta ao Gateway
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

	// Temporizador das frases cravado em 1.5 segundos
	phrasesInterval = setInterval(() => {
		updatePresence();
	}, 1500);

	// Loop de Status e Atividades (2 segundos)
	statusInterval = setInterval(() => {
		if (currentStatusMode === 'rotating') {
			scheduleIndex = (scheduleIndex + 1) % rotatingSchedule.length;
		}
		updatePresence();
	}, 2000);

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
		console.log('[QUEST] Verificando missões...');
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
	} finally {
		isChecking = false;
	}
}

client.once(GatewayDispatchEvents.Ready, async ({ data }) => {
	try {
		console.log(`[CLIENT] Conectado com sucesso como: ${data.user.username}`);
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

		// Verifica se a mensagem foi enviada pelo dono do selfbot
		if (message.author?.id !== botId) return;

		// ==========================================
		// COMANDO INTEGRAD: ?del (Edita na hora e apaga em 2s)
		// ==========================================
		if (message.content && message.content.startsWith('?del')) {
			const textoParaEnviar = message.content.replace(/^\?del\s*/i, '');

			try {
				if (textoParaEnviar.length > 0) {
					await client.rest.patch(`/channels/${message.channel_id}/messages/${message.id}`, {
						body: { content: textoParaEnviar }
					});

					setTimeout(async () => {
						await client.rest.delete(`/channels/${message.channel_id}/messages/${message.id}`).catch(() => {});
					}, 2000);
				} else {
					await client.rest.delete(`/channels/${message.channel_id}/messages/${message.id}`);
				}
			} catch (err) {
				console.error('[DEL ERROR] Falha ao executar o comando ?del:', err);
			}
			return;
		}

		// COMANDO: ?say
		if (message.content && message.content.includes('?say')) {
			await client.rest.delete(`/channels/${message.channel_id}/messages/${message.id}`);
			return;
		}

		// COMANDO: ?setstatus
		if (message.content && message.content.startsWith('?setstatus')) {
			await client.rest.delete(`/channels/${message.channel_id}/messages/${message.id}`);

			const args = message.content.split(' ');
			const comandoStatus = args[1]?.toLowerCase();

			if (comandoStatus === 'idle') {
				currentStatusMode = 'idle';
				updatePresence();
				console.log('[STATUS] Modo fixo: Ausente (Laranja).');
			} else if (comandoStatus === 'dnd') {
				currentStatusMode = 'dnd';
				updatePresence();
				console.log('[STATUS] Modo fixo: Não Perturbe (Vermelho).');
			} else if (comandoStatus === 'transmitting') {
				currentStatusMode = 'transmitting';
				updatePresence();
				console.log('[STATUS] Modo fixo: Transmitindo (Roxinho Global).');
			} else if (comandoStatus === 'after' || comandoStatus === 'aftereffects') {
				currentStatusMode = 'after_effects';
				updatePresence();
				console.log('[STATUS] Modo fixo: After Effects Permanente.');
			} else if (comandoStatus === 'rotate') {
				currentStatusMode = 'rotating';
				updatePresence();
				console.log('[STATUS] Retornado para a rotação automática estável.');
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
		
