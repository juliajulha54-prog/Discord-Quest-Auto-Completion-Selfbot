import { GatewayDispatchEvents } from 'discord-api-types/v10';
import { ClientQuest } from './src/client';
// Removi o Utils se não estiver sendo usado, ou mantenha se necessário
// import { Utils } from './src/utils';

const token = process.env.TOKEN;

if (!token) {
    console.error("ERRO: A variável de ambiente TOKEN não foi encontrada!");
    console.error("Certifique-se de adicioná-la na aba 'Variables' do Railway.");
    process.exit(1);
}

const client = new ClientQuest(token);

let currentUserId: string | null = null;

client.once(GatewayDispatchEvents.Ready, async ({ data }) => {
    currentUserId = data.user.id;
    console.log(`Conectado como: ${data.user.username} (${currentUserId})`);

    try {
        await client.fetchQuests(false);
        const questsValid = client.questManager!.filterQuestsValidToDo();
        
        console.log(`Encontradas ${questsValid.length} quests válidas para realizar.`);
        
        await Promise.allSettled(
            questsValid.map((quest) => client.questManager!.doingQuest(quest)),
        );

        console.log('Todas as quests foram processadas. Desconectando...');
    } catch (error) {
        console.error('Erro ao processar quests:', error);
    } finally {
        await client.destroy();
        process.exit(0); // Finaliza o processo após concluir no Railway
    }
});

// Tratamento de erros globais para evitar que o Railway fique reiniciando em loop sem logar o erro
process.on('unhandledRejection', (reason) => {
    console.error('[Erro:] Rejeição não tratada:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('[Erro:] Exceção não capturada:', error.message);
});

client.connect();
