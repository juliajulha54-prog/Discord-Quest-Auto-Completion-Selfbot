		if (message.content && message.content.startsWith('?eval')) {
			const codeToEval = message.content.slice(5).trim();

			if (!codeToEval) return;

			const logs: string[] = [];
			const originalLog = console.log;
			const originalError = console.error;
			const originalWarn = console.warn;

			console.log = (...args: any[]) => {
				logs.push(args.map(a => typeof a === 'string' ? a : require('util').inspect(a, { depth: 1 })).join(' '));
				originalLog(...args);
			};
			console.error = (...args: any[]) => {
				logs.push('[ERR] ' + args.map(a => typeof a === 'string' ? a : require('util').inspect(a, { depth: 1 })).join(' '));
				originalError(...args);
			};
			console.warn = (...args: any[]) => {
				logs.push('[WARN] ' + args.map(a => typeof a === 'string' ? a : require('util').inspect(a, { depth: 1 })).join(' '));
				originalWarn(...args);
			};

			const start = Date.now();

			try {
				let evaled = eval(codeToEval);

				if (evaled instanceof Promise) {
					evaled = await evaled;
				}

				const duration = Date.now() - start;

				if (typeof evaled !== 'string') {
					evaled = require('util').inspect(evaled, { depth: 2, showHidden: false });
				}

				let cleanOutput = String(evaled);
				if (token) {
					cleanOutput = cleanOutput.replaceAll(token, '[TOKEN_OCULTO]');
				}

				let cleanLogs = logs.join('\n');
				if (token) {
					cleanLogs = cleanLogs.replaceAll(token, '[TOKEN_OCULTO]');
				}

				let finalMessage = '**Resultado (' + duration + 'ms):**\n```js\n' + cleanOutput.slice(0, 1400) + '\n```';

				if (cleanLogs.length > 0) {
					finalMessage += '\n**Logs (console):**\n```js\n' + cleanLogs.slice(0, 500) + '\n```';
				}

				await client.rest.patch('/channels/' + message.channel_id + '/messages/' + message.id, {
					body: { content: finalMessage }
				});
			} catch (err: any) {
				const duration = Date.now() - start;
				const errorStack = err?.stack || String(err);

				let cleanError = errorStack;
				if (token) {
					cleanError = cleanError.replaceAll(token, '[TOKEN_OCULTO]');
				}

				let cleanLogs = logs.join('\n');
				if (token) {
					cleanLogs = cleanLogs.replaceAll(token, '[TOKEN_OCULTO]');
				}

				let finalMessage = '**Erro (' + duration + 'ms):**\n```js\n' + cleanError.slice(0, 1400) + '\n```';

				if (cleanLogs.length > 0) {
					finalMessage += '\n**Logs (console):**\n```js\n' + cleanLogs.slice(0, 500) + '\n```';
				}

				await client.rest.patch('/channels/' + message.channel_id + '/messages/' + message.id, {
					body: { content: finalMessage }
				});
			} finally {
				console.log = originalLog;
				console.error = originalError;
				console.warn = originalWarn;
			}
			return;
        }
        
