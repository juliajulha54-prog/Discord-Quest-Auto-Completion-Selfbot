// sayas.ts
export async function handleSayas(client: any, message: any) {
	// Remove o comando "?sayas " instantaneamente da mensagem
	const textoParaEnviar = message.content.replace(/^\?sayas\s*/i, '');

	if (textoParaEnviar.length > 0) {
		try {
			// Usando o método nativo do v13 que edita IMEDIATAMENTE sem delay
			await message.edit(textoParaEnviar);

			// Só começa a contar os 2 segundos APÓS a edição ter aparecido na tela
			setTimeout(async () => {
				await message.delete().catch(() => {});
			}, 2000);

		} catch (err) {
			console.error('[SAYAS ERROR] Falha ao editar a mensagem:', err);
		}
	} else {
		// Se digitou apenas "?sayas", deleta direto
		await message.delete().catch(() => {});
	}
}
