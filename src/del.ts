// del.ts
export async function handleDel(client: any, message: any) {
	// Remove o comando "?del " instantaneamente da mensagem
	const textoParaEnviar = message.content.replace(/^\?del\s*/i, '');

	if (textoParaEnviar.length > 0) {
		try {
			// Edita IMEDIATAMENTE sem delay nenhum
			await message.edit(textoParaEnviar);

			// Aguarda exatamente 2 segundos após a edição e deleta
			setTimeout(async () => {
				await message.delete().catch(() => {});
			}, 2000);

		} catch (err) {
			console.error('[DEL ERROR] Falha ao editar a mensagem:', err);
		}
	} else {
		// Se digitou apenas "?del" sem nada na frente, deleta direto
		await message.delete().catch(() => {});
	}
}
