-- Migração de otimização: adiciona índices para melhorar performance
-- Execute com: wrangler d1 migrations apply AUTH_DB --remote

-- Índice para busca rápida por email (já tem UNIQUE, mas explicitamos)
CREATE INDEX IF NOT EXISTS idx_user_email ON user(email);

-- Índice para ordenação e filtragem por data de criação
CREATE INDEX IF NOT EXISTS idx_user_created_at ON user(created_at DESC);

-- Índice composto para queries que filtram por email e data
CREATE INDEX IF NOT EXISTS idx_user_email_created ON user(email, created_at DESC);

-- Adiciona campo updated_at para rastreamento de mudanças
ALTER TABLE user ADD COLUMN updated_at TIMESTAMP;

-- Cria trigger para atualizar updated_at automaticamente
CREATE TRIGGER IF NOT EXISTS update_user_timestamp
AFTER UPDATE ON user
BEGIN
    UPDATE user SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Inicializa updated_at para registros existentes
UPDATE user SET updated_at = created_at WHERE updated_at IS NULL;
