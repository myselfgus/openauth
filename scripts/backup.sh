#!/bin/bash
# Script de backup automático do D1 para R2
# Execute periodicamente com cron ou Cloudflare Cron Triggers

set -e

WRANGLER="npx wrangler"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backups/d1-backup-${TIMESTAMP}.sql"

echo "🔄 Iniciando backup do D1..."

# Exportar dados do D1
echo "📦 Exportando dados do D1..."
$WRANGLER d1 export AUTH_DB --remote --output="./temp-backup.sql"

echo "☁️  Uploading para R2..."
# Nota: Você precisará implementar upload para R2 via wrangler ou API
# Por enquanto, o arquivo fica local

echo "✅ Backup concluído: temp-backup.sql"
echo "📝 Próximos passos:"
echo "   1. Implemente upload automático para R2"
echo "   2. Configure Cron Trigger no Cloudflare"
echo "   3. Mantenha apenas backups dos últimos 30 dias"
