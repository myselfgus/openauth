# 🗄️ Guia Completo de Storage - OpenAuth

Este guia explica como configurar e usar KV, D1 e R2 no OpenAuth para garantir persistência e otimização de dados.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Configuração Inicial](#configuração-inicial)
- [KV Storage](#kv-storage)
- [D1 Database](#d1-database)
- [R2 Storage](#r2-storage)
- [Storage Manager](#storage-manager)
- [Scripts de Manutenção](#scripts-de-manutenção)
- [Otimizações](#otimizações)
- [Exemplos de Uso](#exemplos-de-uso)

---

## 🎯 Visão Geral

O OpenAuth utiliza três tipos de storage do Cloudflare:

| Storage | Uso Principal | Características |
|---------|---------------|-----------------|
| **KV** | Cache, sessões temporárias | - Baixa latência global<br>- TTL automático<br>- Eventual consistency |
| **D1** | Dados relacionais, usuários | - SQL completo<br>- Transações<br>- Índices otimizados |
| **R2** | Arquivos, backups, logs | - Object storage<br>- Sem custos de egress<br>- S3-compatible |

### Arquitetura de Dados

```
┌─────────────────────────────────────────────────────┐
│                   Cloudflare Worker                  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │    KV    │  │    D1    │  │    R2    │          │
│  │          │  │          │  │          │          │
│  │ Sessions │  │  Users   │  │  Files   │          │
│  │  Cache   │  │  Logs    │  │ Backups  │          │
│  │  Tokens  │  │  Auth    │  │ Uploads  │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                      │
│              StorageManager (Unified API)           │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 Configuração Inicial

### Passo 1: Autenticar no Cloudflare

```bash
npx wrangler login
```

### Passo 2: Executar Setup Automático

```bash
npm run setup
```

Este comando irá:
- ✅ Criar KV namespace `AUTH_STORAGE`
- ✅ Criar D1 database `openauth--auth-db`
- ✅ Criar R2 bucket `openauth-storage`
- ✅ Aplicar migrações do banco
- ✅ Criar índices otimizados

### Passo 3: Verificar Configuração

```bash
# Listar recursos criados
npm run kv:list
npm run r2:list
wrangler d1 list
```

### Passo 4: Atualizar IDs (se necessário)

Se os IDs gerados forem diferentes, atualize `wrangler.json`:

```json
{
  "kv_namespaces": [
    {
      "binding": "AUTH_STORAGE",
      "id": "SEU_KV_ID_AQUI"
    }
  ],
  "d1_databases": [
    {
      "binding": "AUTH_DB",
      "database_name": "openauth--auth-db",
      "database_id": "SEU_D1_ID_AQUI"
    }
  ],
  "r2_buckets": [
    {
      "binding": "STORAGE",
      "bucket_name": "openauth-storage"
    }
  ]
}
```

---

## 🔑 KV Storage

### Características

- **Latência**: < 10ms globalmente
- **TTL**: Expiração automática
- **Limit**: 25 MiB por valor
- **Uso ideal**: Cache, sessões, rate limiting

### Uso Básico

```typescript
import { KVStorage } from "./storage";

const kv = new KVStorage({
  namespace: env.AUTH_STORAGE,
  defaultTTL: 3600 // 1 hora
});

// Armazenar
await kv.set("session:abc", { userId: "123" }, 7200);

// Buscar
const session = await kv.get<{ userId: string }>("session:abc");

// Cache automático
const data = await kv.cached("key", async () => {
  return await fetchExpensiveData();
}, 1800);

// Deletar
await kv.delete("session:abc");
```

### Casos de Uso

#### 1. Sessões de Usuário
```typescript
await kv.set(`session:${sessionId}`, {
  userId: user.id,
  email: user.email,
  loginAt: Date.now()
}, 86400); // 24 horas
```

#### 2. Rate Limiting
```typescript
const key = `ratelimit:${userId}`;
const count = (await kv.get<number>(key)) || 0;

if (count >= 100) {
  throw new Error("Rate limit exceeded");
}

await kv.set(key, count + 1, 3600);
```

#### 3. Cache de Queries
```typescript
const users = await kv.cached(
  "users:active",
  async () => {
    return await db.query("SELECT * FROM user WHERE active = 1");
  },
  600 // 10 minutos
);
```

---

## 🗃️ D1 Database

### Características

- **Engine**: SQLite
- **Limites**: 10 GB por database
- **Transações**: Suportadas
- **Uso ideal**: Dados estruturados, usuários, logs

### Schema

```sql
-- users table
CREATE TABLE user (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- Índices otimizados
CREATE INDEX idx_user_email ON user(email);
CREATE INDEX idx_user_created_at ON user(created_at DESC);
```

### Uso Básico

```typescript
import { D1Storage } from "./storage";

const db = new D1Storage({
  database: env.AUTH_DB
});

// Criar/atualizar usuário
const user = await db.upsertUser("user@example.com");

// Buscar por email
const found = await db.getUserByEmail("user@example.com");

// Listar com paginação
const users = await db.listUsers({ limit: 50, offset: 0 });

// Query customizada
const result = await db.query(
  "SELECT COUNT(*) as total FROM user WHERE created_at > ?",
  Date.now() - 86400000
);
```

### Casos de Uso

#### 1. Autenticação
```typescript
async function authenticate(email: string) {
  const user = await db.getUserByEmail(email);
  if (!user) {
    return await db.upsertUser(email);
  }
  return user;
}
```

#### 2. Analytics
```typescript
const stats = await db.query(`
  SELECT
    DATE(created_at) as date,
    COUNT(*) as signups
  FROM user
  WHERE created_at > datetime('now', '-30 days')
  GROUP BY DATE(created_at)
  ORDER BY date DESC
`);
```

#### 3. Batch Operations
```typescript
await db.batch([
  { sql: "INSERT INTO user (email) VALUES (?)", params: ["a@test.com"] },
  { sql: "INSERT INTO user (email) VALUES (?)", params: ["b@test.com"] }
]);
```

---

## ☁️ R2 Storage

### Características

- **Limites**: Sem limite de tamanho
- **Custo**: $0 de egress
- **API**: S3-compatible
- **Uso ideal**: Arquivos, backups, uploads

### Uso Básico

```typescript
import { R2Storage } from "./storage";

const r2 = new R2Storage({
  bucket: env.STORAGE
});

// Upload
await r2.upload("files/doc.pdf", fileBuffer, {
  contentType: "application/pdf",
  customMetadata: { userId: "123" }
});

// Download
const file = await r2.download("files/doc.pdf");
const content = await file.text();

// Upload JSON
await r2.uploadJSON("config/settings.json", {
  theme: "dark",
  language: "pt-BR"
});

// Download JSON
const settings = await r2.downloadJSON("config/settings.json");

// Listar
const files = await r2.list({ prefix: "files/", limit: 100 });

// Deletar
await r2.delete("files/doc.pdf");
```

### Casos de Uso

#### 1. Upload de Avatar
```typescript
async function uploadAvatar(userId: string, imageBuffer: ArrayBuffer) {
  const key = `avatars/${userId}/avatar.jpg`;
  await r2.upload(key, imageBuffer, {
    contentType: "image/jpeg",
    customMetadata: {
      userId,
      uploadedAt: new Date().toISOString()
    }
  });
  return `/api/avatars/${userId}`;
}
```

#### 2. Backup Automático
```typescript
async function backupDatabase(data: any) {
  const timestamp = Date.now();
  const key = `backups/db-${timestamp}.json`;
  await r2.uploadJSON(key, data, {
    backup: "true",
    timestamp: timestamp.toString()
  });
}
```

#### 3. Sistema de Logs
```typescript
async function appendLog(message: string) {
  const today = new Date().toISOString().split("T")[0];
  const key = `logs/${today}.jsonl`;

  const existing = await r2.downloadText(key) || "";
  const newLog = `${existing}\n${JSON.stringify({
    timestamp: Date.now(),
    message
  })}`;

  await r2.upload(key, newLog, {
    contentType: "application/x-ndjson"
  });
}
```

---

## 🎯 Storage Manager

Gerenciador unificado para todos os storages.

### Inicialização

```typescript
import { StorageManager } from "./storage";

const storage = new StorageManager({
  kv: env.AUTH_STORAGE,
  db: env.AUTH_DB,
  r2: env.STORAGE
});
```

### Funcionalidades

#### Cache Multi-Layer (KV + D1)
```typescript
// Busca no KV primeiro, depois no D1
const user = await storage.getCachedUser("user-123", 300);
```

#### Backup Automático
```typescript
// Salva usuário no R2
await storage.backupUser("user-123");
```

#### Invalidação de Cache
```typescript
await storage.invalidateUserCache("user-123");
```

---

## 🛠️ Scripts de Manutenção

### Migrações

```bash
# Aplicar migrações no remoto
npm run migrate

# Aplicar migrações localmente
npm run migrate:local
```

### Backup

```bash
# Fazer backup do D1
npm run backup
```

### Otimização

```bash
# Otimizar banco de dados
npm run optimize
```

Este script executa:
- `ANALYZE` - Atualiza estatísticas do query planner
- `VACUUM` - Recupera espaço e desfragmenta
- `PRAGMA integrity_check` - Verifica integridade

### Limpeza de KV

Configure um Cron Trigger para executar limpeza automática:

```toml
# wrangler.toml
[triggers]
crons = ["0 2 * * *"]  # Todos os dias às 2h
```

---

## ⚡ Otimizações

### KV

1. **Use TTL apropriado**
   - Sessions: 24h - 7 dias
   - Cache: 10min - 1h
   - Rate limit: 1min - 1h

2. **Prefixos organizados**
   ```typescript
   session:*
   cache:*
   ratelimit:*
   user:*
   ```

3. **Metadata para cleanup**
   ```typescript
   await kv.set(key, value, ttl, {
     metadata: { createdAt: Date.now() }
   });
   ```

### D1

1. **Índices estratégicos**
   ```sql
   CREATE INDEX idx_user_email ON user(email);
   CREATE INDEX idx_user_created_at ON user(created_at DESC);
   ```

2. **Batch queries**
   ```typescript
   await db.batch([
     { sql: "...", params: [...] },
     { sql: "...", params: [...] }
   ]);
   ```

3. **Prepared statements**
   ```typescript
   const stmt = db.prepare("SELECT * FROM user WHERE id = ?");
   const user = await stmt.bind(userId).first();
   ```

### R2

1. **Estrutura de pastas**
   ```
   avatars/{userId}/
   backups/{date}/
   uploads/{userId}/{timestamp}-{filename}
   logs/{date}/
   ```

2. **Metadata rica**
   ```typescript
   await r2.upload(key, data, {
     customMetadata: {
       userId: "123",
       uploadedAt: new Date().toISOString(),
       originalName: "file.pdf",
       fileSize: "12345"
     }
   });
   ```

3. **Lifecycle policies** (configure no dashboard)
   - Deletar backups > 30 dias
   - Migrar logs antigos para Archive

---

## 📚 Exemplos de Uso

### Sistema Completo de Autenticação

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const storage = new StorageManager({
      kv: env.AUTH_STORAGE,
      db: env.AUTH_DB,
      r2: env.STORAGE
    });

    const url = new URL(request.url);

    // Login
    if (url.pathname === "/login" && request.method === "POST") {
      const { email } = await request.json();

      // Rate limiting
      const allowed = await checkRateLimit(storage.kv, email);
      if (!allowed) {
        return new Response("Rate limit exceeded", { status: 429 });
      }

      // Buscar/criar usuário
      const user = await storage.db.upsertUser(email);

      // Criar sessão
      const sessionId = crypto.randomUUID();
      await storage.kv.set(`session:${sessionId}`, {
        userId: user.id,
        email: user.email,
        loginAt: Date.now()
      }, 86400);

      return Response.json({ sessionId });
    }

    // Upload de arquivo
    if (url.pathname === "/upload" && request.method === "POST") {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      const sessionId = request.headers.get("X-Session-ID");

      // Validar sessão
      const session = await storage.kv.get(`session:${sessionId}`);
      if (!session) {
        return new Response("Unauthorized", { status: 401 });
      }

      // Upload para R2
      const buffer = await file.arrayBuffer();
      const key = `uploads/${session.userId}/${Date.now()}-${file.name}`;
      await storage.r2.upload(key, buffer, {
        contentType: file.type,
        customMetadata: {
          userId: session.userId,
          originalName: file.name
        }
      });

      return Response.json({ success: true, key });
    }

    return new Response("Not found", { status: 404 });
  }
};

async function checkRateLimit(
  kv: KVStorage,
  identifier: string
): Promise<boolean> {
  const key = `ratelimit:${identifier}`;
  const count = (await kv.get<number>(key)) || 0;

  if (count >= 10) return false;

  await kv.set(key, count + 1, 300); // 5 minutos
  return true;
}
```

---

## 🔗 Links Úteis

- [Cloudflare KV Docs](https://developers.cloudflare.com/kv/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [OpenAuth Docs](https://openauth.js.org/)

---

## 📞 Suporte

Para problemas ou dúvidas:

1. Verifique os logs: `wrangler tail`
2. Execute testes: `npm run check`
3. Consulte a documentação oficial

---

**Última atualização**: 2025-11-09
