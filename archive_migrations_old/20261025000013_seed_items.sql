-- Seed de itens da loja (~15 itens)
INSERT INTO items (code, name, slot, rarity, price_coins, min_level, asset, active) VALUES
-- Cabeça (4 itens)
('bone_basico', 'Boné Básico', 'cabeca', 'comum', 20, 1, 'bone_basico', true),
('bone_civikoo', 'Boné Civikoo', 'cabeca', 'raro', 80, 5, 'bone_civikoo', true),
('capacete_obra', 'Capacete de Obra', 'cabeca', 'raro', 120, 8, 'capacete_obra', true),
('chapeu_explorador', 'Chapéu de Explorador', 'cabeca', 'epico', 300, 15, 'chapeu_explorador', true),

-- Corpo (4 itens)
('colete_amarelo', 'Colete Amarelo', 'corpo', 'comum', 30, 1, 'colete_amarelo', true),
('colete_laranja', 'Colete Laranja Refletivo', 'corpo', 'raro', 100, 6, 'colete_laranja', true),
('jaqueta_jeans', 'Jaqueta Jeans', 'corpo', 'raro', 150, 10, 'jaqueta_jeans', true),
('casaco_premium', 'Casaco Premium Civikoo', 'corpo', 'epico', 280, 12, 'casaco_premium', true),

-- Acessório (4 itens)
('oculos_sol', 'Óculos de Sol', 'acessorio', 'comum', 25, 1, 'oculos_sol', true),
('oculos_aviador', 'Óculos Aviador', 'acessorio', 'raro', 90, 7, 'oculos_aviador', true),
('relogio_digital', 'Relógio Digital', 'acessorio', 'raro', 110, 9, 'relogio_digital', true),
('fone_oversized', 'Fone Oversized', 'acessorio', 'epico', 250, 14, 'fone_oversized', true),

-- Fundo (3 itens)
('fundo_cidade', 'Fundo: Cidade ao Entardecer', 'fundo', 'comum', 15, 1, 'fundo_cidade', true),
('fundo_parque', 'Fundo: Parque Verde', 'fundo', 'raro', 60, 4, 'fundo_parque', true),
('fundo_espacial', 'Fundo: Estação Espacial', 'fundo', 'epico', 200, 10, 'fundo_espacial', true)

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  slot = EXCLUDED.slot,
  rarity = EXCLUDED.rarity,
  price_coins = EXCLUDED.price_coins,
  min_level = EXCLUDED.min_level,
  asset = EXCLUDED.asset,
  active = EXCLUDED.active;