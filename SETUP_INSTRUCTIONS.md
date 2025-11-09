# 🚨 INSTRUÇÕES OBRIGATÓRIAS DE SETUP

## Você PRECISA executar estes comandos para criar os recursos:

### Opção 1: Setup Automático (Recomendado)
```bash
# 1. Autenticar
npx wrangler login

# 2. Executar setup automático
npm run setup
```

### Opção 2: Manual (Passo a Passo)

#### 1. Criar KV Namespace
```bash
npx wrangler kv namespace create AUTH_STORAGE
```
**IMPORTANTE:** Copie o ID gerado e atualize em `wrangler.json`:
```json
"kv_namespaces": [
  {
    "binding": "AUTH_STORAGE",
    "id": "COLE_O_ID_AQUI"  // ← Atualize este valor!
  }
]
```

#### 2. Criar D1 Database
```bash
npx wrangler d1 create openauth--auth-db
```
**IMPORTANTE:** Copie o ID gerado e atualize em `wrangler.json`:
```json
"d1_databases": [
  {
    "binding": "AUTH_DB",
    "database_name": "openauth--auth-db",
    "database_id": "COLE_O_ID_AQUI"  // ← Atualize este valor!
  }
]
```

#### 3. Aplicar Migrações do D1
```bash
npm run migrate
```

#### 4. Criar R2 Bucket
```bash
npx wrangler r2 bucket create openauth-storage
```
**Nota:** R2 usa nome do bucket, não precisa atualizar ID.

#### 5. Verificar Recursos Criados
```bash
npm run kv:list
npm run r2:list
npx wrangler d1 list
```

#### 6. Deploy
```bash
npm run deploy
```

## ⚠️ Status Atual

**Recursos criados no Cloudflare:** ❌ NENHUM

Os IDs em `wrangler.json` são placeholders do commit anterior. Você DEVE:
1. Criar os recursos reais
2. Atualizar os IDs no `wrangler.json` se necessário
3. Fazer deploy

## 🔍 Como Verificar

Após executar os comandos, verifique:
```bash
# Deve mostrar AUTH_STORAGE
npx wrangler kv namespace list

# Deve mostrar openauth--auth-db  
npx wrangler d1 list

# Deve mostrar openauth-storage
npx wrangler r2 bucket list
```

Se não aparecer nada, os recursos NÃO foram criados!
