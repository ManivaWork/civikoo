-- Tabela de itens do usuário
CREATE TABLE IF NOT EXISTS user_items (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  acquired_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

-- Índice para buscas por usuário
CREATE INDEX IF NOT EXISTS idx_user_items_user_id ON user_items(user_id);

-- Coluna equipped em profiles (JSONB com códigos dos itens equipados por slot)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS equipped jsonb DEFAULT '{}'::jsonb;

-- RLS: user_items - apenas o próprio usuário pode ver seus itens
ALTER TABLE user_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário vê seus próprios itens" ON user_items;
CREATE POLICY "Usuário vê seus próprios itens"
  ON user_items FOR SELECT
  USING (user_id = auth.uid());

-- Sem política de INSERT/UPDATE/DELETE direta - só via RPC buy_item