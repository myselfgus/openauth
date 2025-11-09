/**
 * Script de limpeza de KV
 * Remove entradas antigas e desnecessárias do KV
 *
 * Execute com: wrangler dev scripts/cleanup-kv.ts
 */

interface Env {
	AUTH_STORAGE: KVNamespace;
}

export default {
	async scheduled(
		event: ScheduledEvent,
		env: Env,
		ctx: ExecutionContext
	): Promise<void> {
		console.log("🧹 Iniciando limpeza do KV...");

		let deletedCount = 0;
		let cursor: string | undefined;

		do {
			const listResult = await env.AUTH_STORAGE.list({
				cursor,
				limit: 1000,
			});

			for (const key of listResult.keys) {
				// Deletar chaves de sessão antigas (prefixo session:)
				if (key.name.startsWith("session:")) {
					const { value, metadata } = await env.AUTH_STORAGE.getWithMetadata(
						key.name
					);

					if (metadata && typeof metadata === "object") {
						const meta = metadata as { createdAt?: number };
						const age = Date.now() - (meta.createdAt || 0);
						const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 dias

						if (age > maxAge) {
							await env.AUTH_STORAGE.delete(key.name);
							deletedCount++;
							console.log(`Deleted old session: ${key.name}`);
						}
					}
				}

				// Deletar cache antigo (prefixo cache:)
				if (key.name.startsWith("cache:")) {
					const { metadata } = await env.AUTH_STORAGE.getWithMetadata(
						key.name
					);

					if (metadata && typeof metadata === "object") {
						const meta = metadata as { createdAt?: number };
						const age = Date.now() - (meta.createdAt || 0);
						const maxAge = 24 * 60 * 60 * 1000; // 24 horas

						if (age > maxAge) {
							await env.AUTH_STORAGE.delete(key.name);
							deletedCount++;
							console.log(`Deleted old cache: ${key.name}`);
						}
					}
				}
			}

			cursor = listResult.cursor;
		} while (cursor);

		console.log(`✅ Limpeza concluída. ${deletedCount} entradas deletadas.`);
	},
};
