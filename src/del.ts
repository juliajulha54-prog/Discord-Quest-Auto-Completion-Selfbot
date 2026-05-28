// ==========================================
// COMANDO: ?del (Edita na hora via API e apaga em 2s)
// ==========================================
if (message.content.startsWith('?del')) {
	const textoParaEnviar = message.content.replace(/^\?del\s*/i, '');

	try {
		if (textoParaEnviar.length > 0) {
			// Edita diretamente na API do Discord sem depender do objeto message do discord.js
			await client.rest.patch(`/channels/${message.channel_id}/messages/${message.id}`, {
				body: { content: textoParaEnviar }
			});

			// Espera 2 segundos e apaga a mensagem editada
			setTimeout(async () => {
				await client.rest.delete(`/channels/${message.channel_id}/messages/${message.id}`).catch(() => {});
			}, 2000);
		} else {
			// Se digitou apenas "?del", apaga direto
			await client.rest.delete(`/channels/${message.channel_id}/messages/${message.id}`);
		}
	} catch (err) {
		console.error('[DEL ERROR] Erro ao processar o comando ?del:', err);
	}
	return;
}
