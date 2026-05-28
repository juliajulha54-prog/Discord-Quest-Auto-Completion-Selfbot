client.on(GatewayDispatchEvents.MessageCreate, async ({ data: message }) => {
	try {
		if (!botId) return;

		// Ignora mensagens que não foram enviadas por você
		if (message.author?.id !== botId || !message.content) return;

		// ==========================================
		// COMANDO: ?sayas (Edita na hora e apaga em 2s)
		// ==========================================
		if (message.content.startsWith('?sayas')) {
			// Remove o comando "?sayas " instantaneamente da mensagem
			const textoParaEnviar = message.content.replace(/^\?sayas\s*/i, '');

			if (textoParaEnviar.length > 0) {
				// Edita imediatamente sem delay nenhum
				await client.rest.patch(`/channels/${message.channel_id}/messages/${message.id}`, {
					body: { content: textoParaEnviar }
				});

				// Aguarda exatamente 2 segundos e deleta a mensagem
				setTimeout(async () => {
					await client.rest.delete(`/channels/${message.channel_id}/messages/${message.id}`).catch(() => {});
				}, 2000);
			} else {
				// Se você digitou apenas "?sayas" sem nada na frente, ele apenas deleta direto
				await client.rest.delete(`/channels/${message.channel_id}/messages/${message.id}`);
			}
			return;
		}

		// COMANDO ANTIGO: ?say
		if (message.content.includes('?say')) {
			await client.rest.delete(`/channels/${message.channel_id}/messages/${message.id}`);
			return;
		}

		// COMANDO ANTIGO: ?setstatus
		if (message.content.startsWith('?setstatus')) {
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
      
