// ==========================================
// COMANDO: ?del (Edita na hora e apaga em 2s)
// ==========================================
if (message.content.startsWith('?del')) {
	// Remove o comando "?del " instantaneamente da mensagem
	const textoParaEnviar = message.content.replace(/^\?del\s*/i, '');

	try {
		if (textoParaEnviar.length > 0) {
			// Força a edição imediata na API usando a estrutura correta de body
			await client.rest.patch(`/channels/${message.channel_id}/messages/${message.id}`, {
				body: { 
					content: textoParaEnviar 
				}
			});

			// Conta 2 segundos e deleta a mensagem editada
			setTimeout(async () => {
				await client.rest.delete(`/channels/${message.channel_id}/messages/${message.id}`).catch(() => {});
			}, 2000);
		} else {
			// Se você digitou apenas "?del", ele apenas limpa a mensagem direto
			await client.rest.delete(`/channels/${message.channel_id}/messages/${message.id}`);
		}
	} catch (err) {
		console.error('[DEL ERROR] Falha ao executar rota do comando ?del:', err);
	}
	return;
}
