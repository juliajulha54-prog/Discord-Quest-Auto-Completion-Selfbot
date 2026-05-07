import { GatewayDispatchEvents } from 'discord-api-types/v10';
import { ClientQuest } from './src/client';

const token = process.env.TOKEN?.trim();

if (!token) {
	console.error('TOKEN não encontrada nas variáveis de ambiente.');
	process.exit(1);
}

// Configuração de Regiões para cobertura global
const ALL_LOCALES = [
	'en-US', // EUA (Principal)
	'en-GB', // Reino Unido
	'en-CA', // Canadá
	'fr-FR', // França
	'de-DE', // Alemanha
	'pt-BR', // Brasil
	'es-ES', // Espanha
	'ja-JP'  // Japão
];

const client = new ClientQuest(token);

let isChecking = false;
let initialized = false;

// Função para gerar um tempo de espera aleatório entre 15 e 20 segundos
const randomDelay = () => {
	const ms = Math.floor(Math.random() * (20000 - 15000 + 1) + 15000);
	return new Promise((r) => setTimeout(r, ms));
};

async function checkQuests() {
	if (isChecking) return;
	isChecking = true;

	try {
		console.log('--- [INICIANDO VARREDURA GLOBAL DE MISSÕES] ---');

		for (const locale of ALL_LOCALES) {
			console.log(`[WORLD] Mudando localidade para: ${locale}...`);
			
			// Tenta setar a localidade no client (se o seu client suportar setLocale)
			// Isso altera os headers das requisições para a API do Discord
			if (typeof client.setLocale === 'function') {
				client.setLocale(locale);
			}

			await client.fetchQuests(false);

			const quests = client
				.questManager!
				.filterQuestsValidToDo();

			if (quests.length === 0) {
				console.log(`[INFO] Nenhuma missão encontrada para ${locale}.`);
				continue;
			}

			console.log(`[QUEST] ${quests.length} missões encontradas em ${locale}!`);

			for (const quest of quests) {
				try {
					console.log(`[EXECUTANDO] Missão: ${quest.id}`);

					// Realiza a missão
					await client.questManager!.doingQuest(quest);

					console.log(`[SUCESSO] Missão ${quest.id} processada.`);

					// Espera de segurança entre 15 a 20 segundos antes da próxima missão
					console.log(`[WAIT] Aguardando intervalo de segurança...`);
					await randomDelay();
					
				} catch (err) {
					console.error(`[QUEST ERROR] Erro ao processar ${quest.id}:`, err);
				}
			}
		}
		console.log('--- [VARREDURA FINALIZADA. AGUARDANDO PRÓXIMO CICLO] ---');
	} catch (err) {
		console.error('[FETCH ERROR GLOBAL]', err);
	} finally {
		isChecking = false;
	}
}

client.once(GatewayDispatchEvents.Ready, async ({ data }) => {
	console.log(`BOT ONLINE: Logado como ${data.user.username}`);

	if (initialized) return;
	initialized = true;

	// Primeira execução ao ligar
	await checkQuests();

	// Loop infinito a cada 5 minutos
	setInterval(async () => {
		await checkQuests();
	}, 1000 * 60 * 5);
});

process.on('unhandledRejection', (reason) => {
	console.error('[FATAL ERROR] Rejeição não tratada:', reason);
});

process.on('uncaughtException', (error) => {
	console.error('[FATAL ERROR] Exceção não tratada:', error);
});

client.connect();
