import { GatewayDispatchEvents } from 'discord-api-types/v10';
import { ClientQuest } from './src/client';

const token = process.env.TOKEN?.trim();

if (!token) {
	console.error('TOKEN não encontrada.');
	process.exit(1);
}

const ALL_LOCALES = [
	'en-US', 'en-GB', 'en-CA', 'fr-FR', 'de-DE', 'pt-BR', 'es-ES', 'ja-JP'
];

const client = new ClientQuest(token);

let isChecking = false;
let initialized = false;

const randomDelay = () => {
	const ms = Math.floor(Math.random() * (20000 - 15000 + 1) + 15000);
	return new Promise((r) => setTimeout(r, ms));
};

async function checkQuests() {
	if (isChecking) return;
	isChecking = true;

	try {
		console.log('--- [VARREDURA GLOBAL + AUTO-CLAIM] ---');

		for (const locale of ALL_LOCALES) {
			if (typeof client.setLocale === 'function') {
				client.setLocale(locale);
			}

			await client.fetchQuests(false);

			// Filtra quests que podem ser feitas ou que já foram terminadas mas não resgatadas
			const quests = client.questManager!.filterQuestsValidToDo();

			for (const quest of quests) {
				try {
					// 1. Completa o progresso da Quest
					console.log(`[PROCESSO] Fazendo missão: ${quest.id}`);
					await client.questManager!.doingQuest(quest);
					
					// Pequeno delay entre terminar e resgatar
					await new Promise((r) => setTimeout(r, 2000));

					// 2. REIVINDICAR ORBS (Claim)
					// Tentamos resgatar a recompensa imediatamente
					console.log(`[ORBS] Tentando resgatar recompensa da quest: ${quest.id}`);
					
					// Nota: O método claimReward costuma ser o padrão no ClientQuest para orbs/recompensas
					await client.questManager!.claimReward(quest);

					console.log(`[SUCESSO] Missão concluída e Orbs resgatadas: ${quest.id}`);

					// Intervalo de segurança humano
					await randomDelay();
					
				} catch (err) {
					console.error(`[ERRO NA QUEST/CLAIM] ${quest.id}:`, err);
				}
			}
		}
	} catch (err) {
		console.error('[FETCH ERROR]', err);
	} finally {
		isChecking = false;
	}
}

client.once(GatewayDispatchEvents.Ready, async ({ data }) => {
	console.log(`Logado como ${data.user.username} - Auto-Claim Ativado`);
	if (initialized) return;
	initialized = true;
	await checkQuests();
	setInterval(async () => await checkQuests(), 1000 * 60 * 5);
});

client.connect();
		
