import { WebSocketManager } from '@discordjs/ws';
import { GatewayPresenceUpdate, ActivityType, PresenceUpdateStatus } from 'discord-api-types/v10';

export class PresenceManager {
	private ws: WebSocketManager;
	private interval: NodeJS.Timeout | null = null;
	
	// Configurações iniciais editáveis
	public currentStatus: 'online' | 'idle' | 'dnd' | 'invisible' | 'rotating' = 'rotating';
	
	// Lista de Status de bolinha para o modo rotativo (6 segundos)
	public rotatingStatuses: PresenceUpdateStatus[] = [
		PresenceUpdateStatus.Online,
		PresenceUpdateStatus.DoNotDisturb,
		PresenceUpdateStatus.Idle
	];
	private statusIndex = 0;

	// Lista de Atividades e Textos Customizados (Balão ao lado da foto) - Pode editar as mensagens aqui!
	public rotatingActivities = [
		{ text: 'Legenda da foto 1', activity: 'Jogando LoL', type: ActivityType.Game },
		{ text: 'Legenda da foto 2', activity: 'Animes', type: ActivityType.Watching },
		{ text: 'Legenda da foto 3', activity: 'Spotify', type: ActivityType.Listening },
	];
	private activityIndex = 0;

	constructor(ws: WebSocketManager) {
		this.ws = ws;
	}

	public start() {
		if (this.interval) clearInterval(this.interval);
		
		// Executa a cada 6 segundos
		this.interval = setInterval(() => {
			this.updatePresence();
		}, 6000);

		this.updatePresence(); // Executa imediatamente ao iniciar
	}

	public stop() {
		if (this.interval) clearInterval(this.interval);
	}

	public setManualStatus(status: 'online' | 'idle' | 'dnd' | 'transmitting') {
		if (status === 'transmitting') {
			this.currentStatus = 'online'; // Transmitindo precisa estar online internamente
			this.updateToTransmitting();
		} else {
			this.currentStatus = status;
			this.updatePresence();
		}
	}

	private updatePresence() {
		// Se estiver no modo de transmissão manual, ignora a rotação padrão
		if ((this as any).isTransmitting) return;

		// 1. Determina o status da bolinha (Online, Ausente, Não Perturbe)
		let statusToGo = PresenceUpdateStatus.Online;
		if (this.currentStatus === 'rotating') {
			statusToGo = this.rotatingStatuses[this.statusIndex];
			this.statusIndex = (this.statusIndex + 1) % this.rotatingStatuses.length;
		} else {
			statusToGo = this.currentStatus as any;
		}

		// 2. Pega a atividade e o texto customizado atual da lista
		const currentItem = this.rotatingActivities[this.activityIndex];
		this.activityIndex = (this.activityIndex + 1) % this.rotatingActivities.length;

		const payload: GatewayPresenceUpdate = {
			since: null,
			activities: [
				// Esse primeiro objeto simula o "Status de Texto" (Balão ao lado da foto)
				{
					name: 'Custom Status',
					type: ActivityType.Custom,
					state: currentItem.text, // Texto do balãozinho
				},
				// Esse segundo objeto define a atividade (Jogando, Assistindo, Ouvindo)
				{
					name: currentItem.activity,
					type: currentItem.type,
				}
			],
			status: statusToGo,
			afk: false,
		};

		// Envia para o gateway do Discord em todas as shards ativas
		this.ws.broadcast(0, payload as any);
	}

	private updateToTransmitting() {
		(this as any).isTransmitting = true;

		const currentItem = this.rotatingActivities[this.activityIndex];

		const payload: GatewayPresenceUpdate = {
			since: null,
			activities: [
				{
					name: 'Custom Status',
					type: ActivityType.Custom,
					state: currentItem.text,
				},
				// Atividade do tipo Streaming (Tipo 1) ativa a cor roxa no perfil
				{
					name: 'Fazendo live de quests',
					type: ActivityType.Streaming,
					url: 'https://www.twitch.co/discord', // Twitch falsa necessária para ativar o roxo
				}
			],
			status: PresenceUpdateStatus.Online,
			afk: false,
		};

		this.ws.broadcast(0, payload as any);
	}

	// Cancela o modo roxo fixo e volta a girar tudo
	public disableTransmitting() {
		(this as any).isTransmitting = false;
		this.currentStatus = 'rotating';
		this.updatePresence();
	}
     }
  
