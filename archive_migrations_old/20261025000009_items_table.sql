-- Tabela de itens da loja
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  slot text NOT NULL CHECK (slot IN ('cabeca', 'corpo', 'acessorio', 'fundo')),
  rarity text NOT NULL CHECK (rarity IN ('comum', 'raro', 'epico')),
  price_coins int NOT NULL CHECK (price_coins >= 0),
  min_level int NOT NULL DEFAULT 1 CHECK (min_level >= 1),
  asset text NOT NULL, -- chave do SVG (ex: 'boné_basico', 'colete_amarelo')
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_items_slot ON items(slot);
CREATE INDEX IF NOT EXISTS idx_items_active ON items(active);
CREATE INDEX IF NOT EXISTS idx_items_rarity ON items(rarity);

-- RLS: SELECT público para itens ativos
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Items são visíveis publicamente" ON items;
CREATE POLICY "Items são visíveis publicamente"
  ON items FOR SELECT
  USING (active = true);