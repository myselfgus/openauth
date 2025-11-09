/**
 * Exemplos de uso do StorageManager (KV, D1, R2)
 *
 * Este arquivo demonstra como usar os helpers de storage de forma otimizada
 */

import { StorageManager, KVStorage, D1Storage, R2Storage } from "./storage";

// ============================================================================
// Exemplo 1: Usando o StorageManager completo
// ============================================================================

export async function exampleFullStorageManager(env: Env) {
	// Inicializa o gerenciador de storage
	const storage = new StorageManager({
		kv: env.AUTH_STORAGE,
		db: env.AUTH_DB,
		r2: env.STORAGE,
	});

	// Cache de usuário (KV + D1)
	const user = await storage.getCachedUser("user-id-123");
	console.log("Usuário do cache:", user);

	// Backup de usuário para R2
	await storage.backupUser("user-id-123");
	console.log("Backup criado no R2");
}

// ============================================================================
// Exemplo 2: KV Storage - Cache e sessões
// ============================================================================

export async function exampleKVStorage(env: Env) {
	const kv = new KVStorage({
		namespace: env.AUTH_STORAGE,
		defaultTTL: 3600, // 1 hora
	});

	// Armazenar dados de sessão
	await kv.set("session:abc123", {
		userId: "user-123",
		email: "user@example.com",
		loginAt: Date.now(),
	}, 7200); // 2 horas

	// Buscar sessão
	const session = await kv.get<{
		userId: string;
		email: string;
		loginAt: number;
	}>("session:abc123");
	console.log("Sessão:", session);

	// Cache com gerador automático
	const expensiveData = await kv.cached(
		"cache:expensive-query",
		async () => {
			// Esta função só é executada se o cache não existir
			console.log("Executando query cara...");
			return { result: "dados complexos" };
		},
		1800 // 30 minutos
	);
	console.log("Dados do cache:", expensiveData);

	// Listar chaves com prefixo
	const sessions = await kv.list("session:");
	console.log("Todas as sessões:", sessions.keys);

	// Deletar sessão
	await kv.delete("session:abc123");
}

// ============================================================================
// Exemplo 3: D1 Storage - Banco de dados relacional
// ============================================================================

export async function exampleD1Storage(env: Env) {
	const db = new D1Storage({
		database: env.AUTH_DB,
	});

	// Criar ou atualizar usuário
	const user = await db.upsertUser("user@example.com");
	console.log("Usuário criado/atualizado:", user);

	// Buscar usuário por email
	const foundUser = await db.getUserByEmail("user@example.com");
	console.log("Usuário encontrado:", foundUser);

	// Buscar por ID
	if (foundUser) {
		const userById = await db.getUserById(foundUser.id);
		console.log("Usuário por ID:", userById);
	}

	// Listar usuários com paginação
	const users = await db.listUsers({
		limit: 10,
		offset: 0,
	});
	console.log("Lista de usuários:", users);

	// Contar usuários
	const count = await db.countUsers();
	console.log("Total de usuários:", count);

	// Buscar usuários criados nas últimas 24h
	const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
	const recentUsers = await db.getUsersCreatedAfter(yesterday);
	console.log("Usuários recentes:", recentUsers);

	// Query customizada
	const customResult = await db.query(
		"SELECT COUNT(*) as total, DATE(created_at) as date FROM user GROUP BY DATE(created_at)"
	);
	console.log("Estatísticas personalizadas:", customResult);

	// Batch de queries (transação)
	await db.batch([
		{
			sql: "INSERT INTO user (email) VALUES (?)",
			params: ["user1@example.com"],
		},
		{
			sql: "INSERT INTO user (email) VALUES (?)",
			params: ["user2@example.com"],
		},
	]);
	console.log("Batch executado com sucesso");
}

// ============================================================================
// Exemplo 4: R2 Storage - Armazenamento de arquivos
// ============================================================================

export async function exampleR2Storage(env: Env) {
	const r2 = new R2Storage({
		bucket: env.STORAGE,
	});

	// Upload de texto
	await r2.upload("files/readme.txt", "Conteúdo do arquivo", {
		contentType: "text/plain",
		customMetadata: {
			author: "Admin",
			version: "1.0",
		},
	});

	// Upload de JSON
	await r2.uploadJSON("config/settings.json", {
		theme: "dark",
		language: "pt-BR",
		notifications: true,
	});

	// Download de arquivo
	const file = await r2.download("files/readme.txt");
	if (file) {
		const content = await file.text();
		console.log("Conteúdo:", content);
	}

	// Download de JSON
	const settings = await r2.downloadJSON<{
		theme: string;
		language: string;
		notifications: boolean;
	}>("config/settings.json");
	console.log("Settings:", settings);

	// Verificar se arquivo existe
	const exists = await r2.exists("files/readme.txt");
	console.log("Arquivo existe?", exists);

	// Obter metadata
	const metadata = await r2.getMetadata("files/readme.txt");
	console.log("Metadata:", metadata);

	// Listar arquivos
	const fileList = await r2.list({
		prefix: "files/",
		limit: 100,
	});
	console.log("Arquivos encontrados:", fileList.objects.length);

	// Copiar arquivo
	await r2.copy("files/readme.txt", "backups/readme-backup.txt");
	console.log("Arquivo copiado");

	// Mover arquivo (copia e deleta)
	await r2.move("files/readme.txt", "archive/readme.txt");
	console.log("Arquivo movido");

	// Deletar arquivo
	await r2.delete("archive/readme.txt");
	console.log("Arquivo deletado");

	// Deletar múltiplos arquivos
	await r2.deleteMany([
		"backups/readme-backup.txt",
		"config/settings.json",
	]);
	console.log("Múltiplos arquivos deletados");
}

// ============================================================================
// Exemplo 5: Caso de uso completo - Upload de avatar do usuário
// ============================================================================

export async function exampleUserAvatarUpload(
	env: Env,
	userId: string,
	avatarData: ArrayBuffer,
	contentType: string
) {
	const storage = new StorageManager({
		kv: env.AUTH_STORAGE,
		db: env.AUTH_DB,
		r2: env.STORAGE,
	});

	// 1. Verificar se usuário existe
	const user = await storage.db.getUserById(userId);
	if (!user) {
		throw new Error("Usuário não encontrado");
	}

	// 2. Upload do avatar para R2
	const avatarKey = `avatars/${userId}/avatar.jpg`;
	await storage.r2.upload(avatarKey, avatarData, {
		contentType,
		customMetadata: {
			userId,
			uploadedAt: new Date().toISOString(),
		},
	});

	// 3. Atualizar cache do usuário com URL do avatar
	const cacheKey = `user:${userId}`;
	await storage.kv.set(
		cacheKey,
		{
			...user,
			avatarUrl: `/avatars/${userId}/avatar.jpg`,
		},
		3600 // 1 hora
	);

	console.log(`Avatar do usuário ${userId} atualizado com sucesso`);
}

// ============================================================================
// Exemplo 6: Sistema de logs com rotação automática
// ============================================================================

export async function exampleLogSystem(env: Env, logMessage: string) {
	const r2 = new R2Storage({ bucket: env.STORAGE });
	const kv = new KVStorage({ namespace: env.AUTH_STORAGE });

	const today = new Date().toISOString().split("T")[0];
	const logKey = `logs/${today}.jsonl`;

	// Buscar contador de logs do dia
	const logCount = (await kv.get<number>(`log-count:${today}`)) || 0;

	// Adicionar log ao arquivo do dia
	const logEntry = JSON.stringify({
		timestamp: Date.now(),
		message: logMessage,
		index: logCount,
	});

	// Fazer append ao arquivo (buscar existente + adicionar nova linha)
	const existingLogs = await r2.downloadText(logKey);
	const newContent = existingLogs
		? `${existingLogs}\n${logEntry}`
		: logEntry;

	await r2.upload(logKey, newContent, {
		contentType: "application/x-ndjson",
	});

	// Atualizar contador
	await kv.set(`log-count:${today}`, logCount + 1, 86400); // 24 horas

	console.log(`Log adicionado: ${logMessage}`);
}

// ============================================================================
// Exemplo 7: Rate limiting com KV
// ============================================================================

export async function exampleRateLimit(
	env: Env,
	userId: string,
	maxRequests: number,
	windowSeconds: number
): Promise<boolean> {
	const kv = new KVStorage({
		namespace: env.AUTH_STORAGE,
		defaultTTL: windowSeconds,
	});

	const key = `ratelimit:${userId}`;
	const current = (await kv.get<number>(key)) || 0;

	if (current >= maxRequests) {
		console.log(`Rate limit atingido para ${userId}`);
		return false;
	}

	await kv.set(key, current + 1, windowSeconds);
	return true;
}

// ============================================================================
// Exemplo 8: Worker handler completo com storage
// ============================================================================

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// Inicializar storage
		const storage = new StorageManager({
			kv: env.AUTH_STORAGE,
			db: env.AUTH_DB,
			r2: env.STORAGE,
		});

		// Exemplo de rota para listar usuários
		if (url.pathname === "/api/users") {
			const users = await storage.db.listUsers({ limit: 50 });
			return Response.json({ users });
		}

		// Exemplo de rota para upload de arquivo
		if (url.pathname === "/api/upload" && request.method === "POST") {
			const formData = await request.formData();
			const file = formData.get("file") as File;
			if (!file) {
				return Response.json({ error: "No file provided" }, { status: 400 });
			}

			const buffer = await file.arrayBuffer();
			const key = `uploads/${Date.now()}-${file.name}`;

			await storage.r2.upload(key, buffer, {
				contentType: file.type,
			});

			return Response.json({ success: true, key });
		}

		// Exemplo de rota para buscar arquivo
		if (url.pathname.startsWith("/api/files/")) {
			const key = url.pathname.replace("/api/files/", "");
			const file = await storage.r2.download(key);

			if (!file) {
				return Response.json({ error: "File not found" }, { status: 404 });
			}

			return new Response(file.body, {
				headers: {
					"Content-Type": file.httpMetadata?.contentType || "application/octet-stream",
				},
			});
		}

		return Response.json({ message: "OpenAuth Storage API" });
	},
} satisfies ExportedHandler<Env>;
