#!/bin/bash
# Script de otimização e manutenção do banco de dados

set -e

WRANGLER="npx wrangler"

echo "🔧 Iniciando otimização do banco de dados..."
echo ""

# ANALYZE para atualizar estatísticas do query planner
echo "📊 Atualizando estatísticas do query planner..."
$WRANGLER d1 execute AUTH_DB --remote --command="ANALYZE;"

# VACUUM para recuperar espaço e desfragmentar
echo "🗑️  Executando VACUUM..."
$WRANGLER d1 execute AUTH_DB --remote --command="VACUUM;"

# Verificar integridade
echo "✔️  Verificando integridade do banco..."
$WRANGLER d1 execute AUTH_DB --remote --command="PRAGMA integrity_check;"

# Estatísticas do banco
echo ""
echo "📈 Estatísticas do banco de dados:"
$WRANGLER d1 execute AUTH_DB --remote --command="
SELECT
    'Usuários totais' as metric,
    COUNT(*) as value
FROM user
UNION ALL
SELECT
    'Usuários últimas 24h' as metric,
    COUNT(*) as value
FROM user
WHERE created_at > datetime('now', '-1 day')
UNION ALL
SELECT
    'Usuários última semana' as metric,
    COUNT(*) as value
FROM user
WHERE created_at > datetime('now', '-7 days');
"

echo ""
echo "✅ Otimização concluída!"
