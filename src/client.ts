import { Client, APIGatewayBotInfo, WebhooksAPI } from '@discordjs/core';
import { RequestInit } from 'undici';
import { REST, DefaultRestOptions, ResponseLike } from '@discordjs/rest';
import { WebSocketManager, WebSocketShard } from '@discordjs/ws';
import { GatewaySendPayload, GatewayOpcodes } from 'discord-api-types/v10';
import { QuestManager } from './questManager';
import { AllQuestsResponse } from './interface';
import { Constants } from './constants';
import { Utils } from './utils';

async function makeRequest(
	url: string,
	init: RequestInit,
): Promise<ResponseLike> {
	// console.log(`Making request to ${url} with method ${init.method}...`);
	if (init.headers) {
		init.headers = Utils.makeHeaders(init.headers as any);
	}
	return DefaultRestOptions.makeRequest(url, init);
}

const originalSend = WebSocketShard.prototype.send;
WebSocketShard.prototype.send = async function (payload: GatewaySendPayload) {
	if (payload.op === GatewayOpcodes.Identify) {
		payload.d = {
			token: payload.d.token,
			properties: {
				...Constants.Properties,
				os: 'Windows',
				browser: 'Chrome',
				device: '',
				system_locale: 'pt-BR',
				browser_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				browser_version: '120.0.0.0',
				os_version: '10',
				referrer: '',
				referring_domain: '',
				referrer_current: '',
				referring_domain_current: '',
				release_channel: 'stable',
				client_build_number: 250000,
				client_event_source: null,
				is_fast_connect: false,
				gateway_connect_reasons: 'AppSkeleton',
			},
			capabilities: 65, // Envia as capabilities corretas de uma conta de usuário
			presence: payload.d.presence,
			compress: payload.d.compress,
			client_state: {
				guild_versions: {},
				highest_last_message_id: '0',
				read_state_version: 0,
				user_guild_settings_version: -1,
				user_settings_version: -1,
			},
		} as any;
	}
	return originalSend.call(this, payload);
};

export class ClientQuest extends Client {
	public questManager: QuestManager | null = null;
	public websocketManager: WebSocketManager;
	public webhook = new WebhooksAPI(new REST());
	#webhookId: string | null = null;
	#webhookToken: string | null = null;
	constructor(token: string) {
		if (!token) {
			throw new Error('Token is required to initialize the client.');
		}
		const rest = new REST({ version: '10', makeRequest }).setToken(token);
		rest.on('rateLimited', (info: any) => {
			console.warn(
				`\n[RateLimit]\n` +
					`  -> Route: ${info.method} ${info.route}\n` +
					`  -> Scope: ${info.scope}${info.global ? ' (Global)' : ''}\n` +
					`  -> Limit: ${info.limit} requests\n` +
					`  -> Retry after: ${info.retryAfter}ms (${(info.retryAfter / 1000).toFixed(2)}s)\n`,
			);
		});
		const gateway = new WebSocketManager({
			token: token,
			intents: 0, // Voltou para 0 para evitar o erro de Autenticação em Userbots
			rest,
		});
		gateway.fetchGatewayInformation = (
			force?: boolean,
		): Promise<APIGatewayBotInfo> => {
			return Promise.resolve({
				url: 'wss://gateway.discord.gg',
				shards: 1,
				session_start_limit: {
					total: 1000,
					remaining: 1000,
					reset_after: 14400000,
					max_concurrency: 1,
				},
			});
		};
		super({ rest, gateway });
		this.websocketManager = gateway;
		gateway.on('error', () => null);
	}
	connect() {
		return Promise.allSettled([
			Utils.updateLatestBuildVersion(),
			this.setupWebhook(),
		]).then(() => this.websocketManager.connect()).catch((e) => {
			console.error('Error during client connection:', e.message);
			return this.sendWebhookMessage('Error during client connection: ' + e.message);
		});
	}
	destroy() {
		return this.websocketManager.destroy();
	}
	setupWebhook() {
		return Utils.extractWebhookInfo().then((info) => {
			if (info) {
				this.#webhookId = info.id;
				this.#webhookToken = info.token;
				console.log('Webhook setup complete.');
			}
		});
	}
	fetchQuests(fetchExcludedQuests = false) {
		return this.rest
			.get('/quests/@me')
			.then((response) =>
				QuestManager.fromResponse(
					this,
					response as AllQuestsResponse,
					fetchExcludedQuests,
				),
			)
			.then((manager) => {
				this.questManager = manager;
				return manager;
			});
	}
	sendWebhookMessage(content: string) {
		if (this.#webhookId && this.#webhookToken) {
			this.webhook
				.execute(this.#webhookId, this.#webhookToken, {
					content,
				})
				.catch(() => {});
		}
	}
	emitQuestCompleted(questId: string) {
		return this.sendWebhookMessage(
			`[Quest Completed!](https://discord.com/quests/${questId})`,
		);
	}
				}
		
