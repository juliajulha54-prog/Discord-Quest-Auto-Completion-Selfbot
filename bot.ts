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
// CONFIGURAÇÕES DOS STATUS E TEMPOS
// ==========================================
let currentStatusMode: 'idle' | 'dnd' | 'transmitting' | 'rotating' = 'rotating';
let phrasesInterval: NodeJS.Timeout | null = null;
let statusInterval: NodeJS.Timeout | null = null;

// Frases fixas do Sasuke mudando a cada 900ms
const sasukePhrases = [
	{ text: 'blzkkkkkkkkkk' },
	{ text: 'TOMA TOMA TOMA SUA CACHORRA NA XERECA' },
	{ text: 'KKKKKKKKK??????' },
	{ text: 'TOMA TOMA SUA PIRANHA' }
];
let phraseIndex = 0;

// Lista de atividades e cores mudando a cada 2 segundos
// Nota: Para o Roxo se propagar em todo lugar, o status de fundo DEVE ser 'online'.
const rotatingSchedule = [
	{ name: 'League of Legends', type: 0, status: PresenceUpdateStatus.Idle },          // Laranja
	{ name: 'Twitch', type: 1, url: 'https://twitch.tv/twitch', status: PresenceUpdateStatus.Online }, // Roxo (Ícone e Bolinha funcionais)
	{ name: 'Spotify', type: 2, status: PresenceUpdateStatus.DoNotDisturb },    // Vermelho
	{ name: 'Minecraft', type: 0, status: PresenceUpdateStatus.Idle }            // Laranja
];
let scheduleIndex = 0;

function updatePresence() {
	const shard = client.websocketManager['strategy']['shards']?.get(0);
	if (!shard) return;

	// Pega a frase atual que muda super rápido
	const currentPhrase = sasukePhrases[phraseIndex];

	let statusToGo: string;
	let activitiesPayload: any[] = [];

	if (currentStatusMode === 'transmitting') {
		// Comando manual ?setstatus transmitting: FIXO no roxo perfeito com o ícone original da Twitch
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
		// Comando manual ?setstatus idle: Fixo no Laranja
		statusToGo = PresenceUpdateStatus.Idle;
		activitiesPayload = [{ name: 'Custom Status', type: 4, state: currentPhrase.text, id: 'custom' }];
	} else if (currentStatusMode === 'dnd') {
		// Comando manual ?setstatus dnd: Fixo no Vermelho
		statusToGo = PresenceUpdateStatus.DoNotDisturb;
		activitiesPayload = [{ name: 'Custom Status', type: 4, state: currentPhrase.text, id: 'custom' }];
	} else {
		// MODO ROTATIVO PADRÃO (Troca de bolinha/atividade a cada 2 segundos)
		const currentItem = rotatingSchedule[scheduleIndex];
		statusToGo = currentItem.status;

		if (currentItem.type === 1) {
			// Item de Transmissão dentro do rotativo (Ativa a bolinha roxa globalmente)
			activitiesPayload = [
				{ name: 'Custom Status', type: 4, state: currentPhrase.text, id: 'custom' },
				{ name: currentItem.name, type: 1, url: currentItem.url, flags: 1 }
			];
		} else {
			// Atividades normais (Jogando, ouvindo...)
			activitiesPayload = [
				{ name: 'Custom Status', type: 4, state: currentPhrase.text, id: 'custom' },
				{ name: currentItem.name, type: currentItem.type }
			];
		}
	}

	// Envia o payload final corrigido para o gateway do Discord
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

	// Trocador das frases: 900 milésimos de segundo
	phrasesInterval = setInterval(() => {
		phraseIndex = (phraseIndex + 1) % sasukePhrases.length;
		updatePresence();
	}, 900);

	// Trocador dos status e atividades: 2 segundos (2000ms)
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

		// Ativa os novos temporizadores rápidos e independentes
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
				console.log('[STATUS] Modo manual: Ausente (Laranja fixo).');
			} else if (comandoStatus === 'dnd') {
				currentStatusMode = 'dnd';
				updatePresence();
				console.log('[STATUS] Modo manual: Não Perturbe (Vermelho fixo).');
			} else if (comandoStatus === 'transmitting') {
				currentStatusMode = 'transmitting';
				updatePresence();
				console.log('[STATUS] Modo manual: Transmitindo Roxo Fixo.');
			} else if (comandoStatus === 'rotate') {
				currentStatusMode = 'rotating';
				updatePresence();
				console.log('[STATUS] Retornado para a rotação automática rápida.');
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
	if (phrasesInterval) clearInterval(phrasesInterval);
	if (statusInterval) clearInterval(statusInterval);
	if (interval) clearInterval(interval);
	process.exit(0);
});

client.connect().catch((err: any) => {
	console.error('[CONNECT ERROR]', err);
});
