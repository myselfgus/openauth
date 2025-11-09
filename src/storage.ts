/**
 * Storage Helpers para OpenAuth
 * Gerenciamento otimizado de KV, D1 e R2
 */

// ============================================================================
// KV Storage - Para cache e sessões temporárias
// ============================================================================

export interface KVStorageConfig {
	namespace: KVNamespace;
	defaultTTL?: number; // TTL padrão em segundos (1 hora = 3600)
}

/**
 * Helper para KV com TTL otimizado e tipos seguros
 */
export class KVStorage {
	private kv: KVNamespace;
	private defaultTTL: number;

	constructor(config: KVStorageConfig) {
		this.kv = config.namespace;
		this.defaultTTL = config.defaultTTL || 3600; // 1 hora padrão
	}

	/**
	 * Armazena valor no KV com TTL
	 */
	async set<T>(key: string, value: T, ttl?: number): Promise<void> {
		const serialized = JSON.stringify(value);
		const expirationTtl = ttl || this.defaultTTL;

		await this.kv.put(key, serialized, {
			expirationTtl,
			metadata: {
				createdAt: Date.now(),
				type: typeof value,
			},
		});
	}

	/**
	 * Busca valor no KV
	 */
	async get<T>(key: string): Promise<T | null> {
		const value = await this.kv.get(key, { type: "text" });
		if (!value) return null;

		try {
			return JSON.parse(value) as T;
		} catch {
			return null;
		}
	}

	/**
	 * Busca com metadata
	 */
	async getWithMetadata<T>(key: string) {
		const { value, metadata } = await this.kv.getWithMetadata(key, {
			type: "text",
		});
		if (!value) return null;

		return {
			value: JSON.parse(value) as T,
			metadata,
		};
	}

	/**
	 * Remove valor do KV
	 */
	async delete(key: string): Promise<void> {
		await this.kv.delete(key);
	}

	/**
	 * Lista chaves com prefixo
	 */
	async list(prefix: string, limit = 100) {
		return await this.kv.list({ prefix, limit });
	}

	/**
	 * Cache com função geradora
	 */
	async cached<T>(
		key: string,
		generator: () => Promise<T>,
		ttl?: number
	): Promise<T> {
		const cached = await this.get<T>(key);
		if (cached !== null) return cached;

		const value = await generator();
		await this.set(key, value, ttl);
		return value;
	}
}

// ============================================================================
// D1 Storage - Para dados relacionais persistentes
// ============================================================================

export interface D1StorageConfig {
	database: D1Database;
}

/**
 * Helper para D1 com queries otimizadas
 */
export class D1Storage {
	private db: D1Database;

	constructor(config: D1StorageConfig) {
		this.db = config.database;
	}

	/**
	 * Busca usuário por ID
	 */
	async getUserById(id: string) {
		return await this.db
			.prepare("SELECT * FROM user WHERE id = ? LIMIT 1")
			.bind(id)
			.first<User>();
	}

	/**
	 * Busca usuário por email
	 */
	async getUserByEmail(email: string) {
		return await this.db
			.prepare("SELECT * FROM user WHERE email = ? LIMIT 1")
			.bind(email)
			.first<User>();
	}

	/**
	 * Cria ou atualiza usuário (upsert)
	 */
	async upsertUser(email: string) {
		const result = await this.db
			.prepare(
				`INSERT INTO user (email)
         VALUES (?)
         ON CONFLICT (email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
         RETURNING id, email, created_at, updated_at`
			)
			.bind(email)
			.first<User>();

		return result;
	}

	/**
	 * Lista usuários com paginação
	 */
	async listUsers(options: { limit?: number; offset?: number } = {}) {
		const limit = options.limit || 50;
		const offset = options.offset || 0;

		const results = await this.db
			.prepare(
				`SELECT * FROM user
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
			)
			.bind(limit, offset)
			.all<User>();

		return results.results;
	}

	/**
	 * Conta total de usuários
	 */
	async countUsers() {
		const result = await this.db
			.prepare("SELECT COUNT(*) as count FROM user")
			.first<{ count: number }>();

		return result?.count || 0;
	}

	/**
	 * Deleta usuário
	 */
	async deleteUser(id: string) {
		await this.db.prepare("DELETE FROM user WHERE id = ?").bind(id).run();
	}

	/**
	 * Busca usuários criados após uma data
	 */
	async getUsersCreatedAfter(date: string) {
		return await this.db
			.prepare(
				`SELECT * FROM user
         WHERE created_at > ?
         ORDER BY created_at DESC`
			)
			.bind(date)
			.all<User>();
	}

	/**
	 * Executa query customizada
	 */
	async query<T = any>(sql: string, ...params: any[]) {
		let statement = this.db.prepare(sql);

		if (params.length > 0) {
			statement = statement.bind(...params);
		}

		return await statement.all<T>();
	}

	/**
	 * Executa batch de queries (transação)
	 */
	async batch(queries: { sql: string; params?: any[] }[]) {
		const statements = queries.map((q) => {
			const stmt = this.db.prepare(q.sql);
			return q.params ? stmt.bind(...q.params) : stmt;
		});

		return await this.db.batch(statements);
	}
}

// ============================================================================
// R2 Storage - Para arquivos e blobs
// ============================================================================

export interface R2StorageConfig {
	bucket: R2Bucket;
}

/**
 * Helper para R2 com gestão de arquivos
 */
export class R2Storage {
	private bucket: R2Bucket;

	constructor(config: R2StorageConfig) {
		this.bucket = config.bucket;
	}

	/**
	 * Upload de arquivo
	 */
	async upload(
		key: string,
		data: ArrayBuffer | ReadableStream | string,
		options?: {
			contentType?: string;
			metadata?: Record<string, string>;
			customMetadata?: Record<string, string>;
		}
	): Promise<void> {
		await this.bucket.put(key, data, {
			httpMetadata: options?.contentType
				? { contentType: options.contentType }
				: undefined,
			customMetadata: options?.customMetadata,
		});
	}

	/**
	 * Download de arquivo
	 */
	async download(key: string): Promise<R2ObjectBody | null> {
		return await this.bucket.get(key);
	}

	/**
	 * Download como texto
	 */
	async downloadText(key: string): Promise<string | null> {
		const object = await this.bucket.get(key);
		if (!object) return null;
		return await object.text();
	}

	/**
	 * Download como JSON
	 */
	async downloadJSON<T>(key: string): Promise<T | null> {
		const text = await this.downloadText(key);
		if (!text) return null;

		try {
			return JSON.parse(text) as T;
		} catch {
			return null;
		}
	}

	/**
	 * Verifica se arquivo existe
	 */
	async exists(key: string): Promise<boolean> {
		const object = await this.bucket.head(key);
		return object !== null;
	}

	/**
	 * Deleta arquivo
	 */
	async delete(key: string): Promise<void> {
		await this.bucket.delete(key);
	}

	/**
	 * Deleta múltiplos arquivos
	 */
	async deleteMany(keys: string[]): Promise<void> {
		await this.bucket.delete(keys);
	}

	/**
	 * Lista arquivos
	 */
	async list(options?: { prefix?: string; limit?: number; cursor?: string }) {
		return await this.bucket.list({
			prefix: options?.prefix,
			limit: options?.limit || 1000,
			cursor: options?.cursor,
		});
	}

	/**
	 * Obtém metadata do arquivo
	 */
	async getMetadata(key: string) {
		return await this.bucket.head(key);
	}

	/**
	 * Upload de JSON
	 */
	async uploadJSON<T>(
		key: string,
		data: T,
		metadata?: Record<string, string>
	): Promise<void> {
		const json = JSON.stringify(data);
		await this.upload(key, json, {
			contentType: "application/json",
			customMetadata: metadata,
		});
	}

	/**
	 * Copia arquivo
	 */
	async copy(sourceKey: string, destKey: string): Promise<void> {
		const object = await this.bucket.get(sourceKey);
		if (!object) throw new Error(`Source key not found: ${sourceKey}`);

		await this.bucket.put(destKey, object.body, {
			httpMetadata: object.httpMetadata,
			customMetadata: object.customMetadata,
		});
	}

	/**
	 * Move arquivo (copia e deleta original)
	 */
	async move(sourceKey: string, destKey: string): Promise<void> {
		await this.copy(sourceKey, destKey);
		await this.delete(sourceKey);
	}

	/**
	 * Obtém URL assinada (se configurado)
	 */
	// Nota: R2 não suporta URLs assinadas diretamente
	// Você precisaria implementar isso no worker usando crypto
}

// ============================================================================
// Storage Manager - Gerenciador unificado
// ============================================================================

export interface StorageManagerConfig {
	kv: KVNamespace;
	db: D1Database;
	r2: R2Bucket;
}

/**
 * Gerenciador unificado de todos os storages
 */
export class StorageManager {
	public kv: KVStorage;
	public db: D1Storage;
	public r2: R2Storage;

	constructor(config: StorageManagerConfig) {
		this.kv = new KVStorage({ namespace: config.kv });
		this.db = new D1Storage({ database: config.db });
		this.r2 = new R2Storage({ bucket: config.r2 });
	}

	/**
	 * Cache de usuário com KV + D1
	 * Busca no cache primeiro, depois no banco
	 */
	async getCachedUser(userId: string, cacheTTL = 300): Promise<User | null> {
		const cacheKey = `user:${userId}`;

		return await this.kv.cached(
			cacheKey,
			async () => {
				const user = await this.db.getUserById(userId);
				return user;
			},
			cacheTTL
		);
	}

	/**
	 * Invalida cache de usuário
	 */
	async invalidateUserCache(userId: string): Promise<void> {
		await this.kv.delete(`user:${userId}`);
	}

	/**
	 * Backup de dados do usuário para R2
	 */
	async backupUser(userId: string): Promise<void> {
		const user = await this.db.getUserById(userId);
		if (!user) throw new Error("User not found");

		const backupKey = `backups/users/${userId}/${Date.now()}.json`;
		await this.r2.uploadJSON(backupKey, user, {
			userId: userId,
			backupDate: new Date().toISOString(),
		});
	}
}

// ============================================================================
// Types
// ============================================================================

export interface User {
	id: string;
	email: string;
	created_at: string;
	updated_at?: string;
}
