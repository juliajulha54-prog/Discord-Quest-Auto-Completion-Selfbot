import { GatewayDispatchEvents } from 'discord-api-types/v10';
import { ClientQuest } from './src/client';

const token = process.env.TOKEN?.trim();

if (!token) {
	console.error('ERRO: TOKEN não encontrada no ambiente.');
	process.exit(1);
}

// Lista global de localidades para varredura
const ALL_LOCALES = [
	'pt-BR', // Brasil primeiro para sua conveniência
	'en-US', // EUA
	'en-GB', // Reino Unido
	'en-CA', // Canadá
	'fr-FR', // França
	'de-DE', // Alemanha
	'es-ES', // Espanha
	'ja-JP'  // Japão
];

const client = new ClientQuest(token);

let isChecking = false;
let initialized = false;

// Delay aleatório entre 15 e 20 segundos para simular comportamento humano
const randomDelay = () => {
	const ms = Math.floor(Math.random() * (20000 - 15000 + 1) + 15000);
	return new Promise((r) => setTimeout(r, ms));
};

async function checkQuests() {
	if (isChecking) return;
	isChecking = true;

	try {
		console.log('\n--- [INICIANDO VARREDURA MUNDIAL] ---');

		for (const locale of ALL_LOCALES) {
			console.log(`[LOCAL] Mudando para: ${locale}`);
			
			if (typeof client.setLocale === 'function') {
				client.setLocale(locale);
			}

			// Atualiza a lista de missões do Discord para essa região
			await client.fetchQuests(false);

			const quests = client.questManager!.filterQuestsValidToDo();

			if (quests.length === 0) {
				continue;
			}

			console.log(`[INFO] Encontradas ${quests.length} missões em ${locale}.`);

			for (const quest of quests) {
				try {
					console.log(`[QUEST] Iniciando: ${quest.id}`);

					// 1. ACEITAR A MISSÃO (Essencial para missões fora do seu país)
					if (typeof client.questManager!.acceptQuest === 'function') {
						await client.questManager!.acceptQuest(quest.id).catch(() => {});
					}

					// 2. EXECUTAR A MISSÃO
					await client.questManager!.doingQuest(quest);
					
					// Pequena pausa de 3s para o servidor processar o fim da missão
					await new Promise((r) => setTimeout(r, 3000));

					// 3. REIVINDICAR RECOMPENSA (ORBS)
					console.log(`[REINVIDICAR] Solicitando Orbs da missão ${quest.id}...`);
					
					// Tenta os nomes de métodos mais comuns em bibliotecas de automação
					if (typeof client.questManager!.claimReward === 'function') {
						await client.questManager!.claimReward(quest);
					} else if (typeof client.questManager!.claimQuest === 'function') {
						await client.questManager!.claimQuest(quest.id);
					}

					console.log(`[SUCESSO] Missão ${quest.id} finalizada e Orbs solicitadas.`);

					// Intervalo de segurança anti-ban
					console.log(`[WAIT] Aguardando intervalo de segurança...`);
					await randomDelay();
					
				} catch (err) {
					console.error(`[ERRO NA MISSÃO] ${quest.id}:`, err.message || err);
				}
			}
		}
		console.log('--- [VARREDURA FINALIZADA] ---\n');
	} catch (err) {
		console.error('[ERRO GLOBAL]', err);
	} finally {
		isChecking = false;
	}
}

client.once(GatewayDispatchEvents.Ready, async ({ data }) => {
	console.log(`>>> BOT ONLINE | Usuário: ${data.user.username}`);

	if (initialized) return;
	initialized = true;

	// Execução inicial
	await checkQuests();

	// Loop infinito a cada 5 minutos
	setInterval(async () => {
		await checkQuests();
	}, 1000 * 60 * 5);
});

// Tratamento de erros para manter o processo vivo 24h
process.on('unhandledRejection', (reason) => console.error('[UnhandledRejection]', reason));
process.on('uncaughtException', (error) => console.error('[UncaughtException]', error));

client.connect();
