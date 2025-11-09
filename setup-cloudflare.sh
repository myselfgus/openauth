#!/bin/bash
# Script de configuração automática do OpenAuth com KV, D1 e R2
# Execute este script após autenticar com: wrangler login

set -e  # Sair em caso de erro

echo "🚀 Iniciando configuração do OpenAuth com KV, D1 e R2..."
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar se wrangler está instalado
if ! command -v wrangler &> /dev/null && ! command -v npx &> /dev/null; then
    echo "❌ Erro: wrangler não encontrado. Instale com: npm install"
    exit 1
fi

WRANGLER="npx wrangler"

echo -e "${BLUE}📦 Passo 1: Verificando/Criando KV Namespace...${NC}"
# Verificar se o KV namespace já existe
KV_EXISTS=$(${WRANGLER} kv namespace list | grep "AUTH_STORAGE" || echo "")
if [ -z "$KV_EXISTS" ]; then
    echo "Criando novo KV namespace..."
    KV_ID=$(${WRANGLER} kv namespace create AUTH_STORAGE | grep -oP 'id = "\K[^"]+' || echo "")
    if [ -n "$KV_ID" ]; then
        echo -e "${GREEN}✓ KV Namespace criado com ID: $KV_ID${NC}"
        echo "⚠️  Atualize o 'id' em wrangler.json -> kv_namespaces"
    fi
else
    echo -e "${GREEN}✓ KV Namespace já existe${NC}"
fi

echo ""
echo -e "${BLUE}📦 Passo 2: Verificando/Criando D1 Database...${NC}"
# Verificar se o D1 database já existe
D1_EXISTS=$(${WRANGLER} d1 list | grep "openauth--auth-db" || echo "")
if [ -z "$D1_EXISTS" ]; then
    echo "Criando novo D1 database..."
    D1_OUTPUT=$(${WRANGLER} d1 create openauth--auth-db)
    echo "$D1_OUTPUT"
    D1_ID=$(echo "$D1_OUTPUT" | grep -oP 'database_id = "\K[^"]+' || echo "")
    if [ -n "$D1_ID" ]; then
        echo -e "${GREEN}✓ D1 Database criado com ID: $D1_ID${NC}"
        echo "⚠️  Atualize o 'database_id' em wrangler.json -> d1_databases"
    fi
else
    echo -e "${GREEN}✓ D1 Database já existe${NC}"
fi

echo ""
echo -e "${BLUE}📦 Passo 3: Executando migrações D1...${NC}"
if [ -d "migrations" ]; then
    ${WRANGLER} d1 migrations apply AUTH_DB --remote
    echo -e "${GREEN}✓ Migrações aplicadas com sucesso${NC}"
else
    echo -e "${YELLOW}⚠️  Pasta migrations não encontrada${NC}"
fi

echo ""
echo -e "${BLUE}📦 Passo 4: Criando R2 Bucket...${NC}"
# Verificar se o R2 bucket já existe
R2_EXISTS=$(${WRANGLER} r2 bucket list | grep "openauth-storage" || echo "")
if [ -z "$R2_EXISTS" ]; then
    echo "Criando novo R2 bucket..."
    ${WRANGLER} r2 bucket create openauth-storage
    echo -e "${GREEN}✓ R2 Bucket 'openauth-storage' criado com sucesso${NC}"
else
    echo -e "${GREEN}✓ R2 Bucket já existe${NC}"
fi

echo ""
echo -e "${BLUE}📦 Passo 5: Criando índices otimizados no D1...${NC}"
${WRANGLER} d1 execute AUTH_DB --remote --command="
CREATE INDEX IF NOT EXISTS idx_user_email ON user(email);
CREATE INDEX IF NOT EXISTS idx_user_created_at ON user(created_at);
"
echo -e "${GREEN}✓ Índices criados com sucesso${NC}"

echo ""
echo -e "${GREEN}✅ Configuração concluída!${NC}"
echo ""
echo -e "${BLUE}📋 Próximos passos:${NC}"
echo "1. Verifique os IDs gerados e atualize wrangler.json se necessário"
echo "2. Execute: npm run dev (para testar localmente)"
echo "3. Execute: npm run deploy (para fazer deploy)"
echo ""
echo -e "${BLUE}📚 Recursos criados:${NC}"
echo "  • KV Namespace: AUTH_STORAGE (sessões/autenticação)"
echo "  • D1 Database: openauth--auth-db (dados de usuários)"
echo "  • R2 Bucket: openauth-storage (armazenamento de arquivos)"
echo ""
