-- 008: items and avatar system
-- ============================================================================
-- Depends on: 001 (profiles)

CREATE TYPE public.item_slot AS ENUM ('cabeca', 'corpo', 'acessorio', 'fundo');
CREATE TYPE public.item_rarity AS ENUM ('comum', 'raro', 'epico');

CREATE TABLE IF NOT EXISTS public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  slot public.item_slot NOT NULL,
  rarity public.item_rarity NOT NULL,
  price_coins int NOT NULL DEFAULT 0,
  min_level int NOT NULL DEFAULT 1,
  asset text NOT NULL, -- SVG key
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_items (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);

CREATE TABLE IF NOT EXISTS public.user_equipped_items (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  cabeca uuid REFERENCES public.items(id),
  corpo uuid REFERENCES public.items(id),
  acessorio uuid REFERENCES public.items(id),
  fundo uuid REFERENCES public.items(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_equipped_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "items_select_active" ON public.items;
CREATE POLICY "items_select_active" ON public.items
  FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "user_items_select_own" ON public.user_items;
CREATE POLICY "user_items_select_own" ON public.user_items
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "equipped_select_own" ON public.user_equipped_items;
CREATE POLICY "equipped_select_own" ON public.user_equipped_items
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "equipped_update_own" ON public.user_equipped_items;
CREATE POLICY "equipped_update_own" ON public.user_equipped_items
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RPC: buy item
CREATE OR REPLACE FUNCTION public.buy_item(p_item_code text)
RETURNS TABLE (success boolean, message text, item_code text, coins_spent int, new_balance int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_item public.items;
  v_profile public.profiles;
  v_user_id uuid := auth.uid();
  v_exists boolean;
BEGIN
  SELECT * INTO v_item FROM public.items WHERE code = p_item_code AND active = true;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Item não encontrado ou indisponível', '', 0, 0;
    RETURN;
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Perfil não encontrado', '', 0, 0;
    RETURN;
  END IF;

  IF v_profile.level < v_item.min_level THEN
    RETURN QUERY SELECT false, 'Nível insuficiente (mín. ' || v_item.min_level || ')', '', 0, 0;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_items WHERE user_id = v_user_id AND item_id = v_item.id) INTO v_exists;
  IF v_exists THEN
    RETURN QUERY SELECT false, 'Item já possuído', '', 0, 0;
  END IF;

  IF v_profile.coins < v_item.price_coins THEN
    RETURN QUERY SELECT false, 'Moedas insuficientes', '', 0, 0;
  END IF;

  -- Atomic: deduct coins + grant item
  UPDATE public.profiles SET coins = coins - v_item.price_coins WHERE id = v_user_id;
  INSERT INTO public.user_items (user_id, item_id) VALUES (v_user_id, v_item.id);

  RETURN QUERY SELECT true, 'Comprado com sucesso', v_item.code, v_item.price_coins, v_profile.coins - v_item.price_coins;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buy_item TO authenticated;

-- RPC: equip/unequip item
CREATE OR REPLACE FUNCTION public.equip_item(p_item_code text, p_slot public.item_slot)
RETURNS TABLE (success boolean, message text, slot public.item_slot, item_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_item public.items;
  v_user_id uuid := auth.uid();
  v_equipped public.user_equipped_items;
BEGIN
  -- Unequip if null
  IF p_item_code IS NULL THEN
    UPDATE public.user_equipped_items
    SET p_slot = NULL, updated_at = now()
    WHERE user_id = v_user_id;
    RETURN QUERY SELECT true, 'Desequipado', p_slot, NULL;
  END IF;

  SELECT * INTO v_item FROM public.items WHERE code = p_item_code AND slot = p_slot;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Item inválido para este slot', p_slot, '';
    RETURN;
  END IF;

  -- Check ownership
  IF NOT EXISTS (SELECT 1 FROM public.user_items WHERE user_id = v_user_id AND item_id = v_item.id) THEN
    RETURN QUERY SELECT false, 'Item não possuído', p_slot, '';
  END IF;

  INSERT INTO public.user_equipped_items (user_id, p_slot)
  VALUES (v_user_id, v_item.id)
  ON CONFLICT (user_id) DO UPDATE SET p_slot = v_item.id, updated_at = now();

  RETURN QUERY SELECT true, 'Equipado', p_slot, v_item.code;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.equip_item TO authenticated;

-- Seed items
INSERT INTO public.items (code, name, slot, rarity, price_coins, min_level, asset) VALUES
  -- Cabeça
  ('hat_cap', 'Boné Civikoo', 'cabeca', 'comum', 50, 1, 'hat_cap'),
  ('hat_helmet', 'Capacete Obras', 'cabeca', 'raro', 200, 5, 'hat_helmet'),
  ('hat_crown', 'Coroa Prefeito', 'cabeca', 'epico', 1000, 15, 'hat_crown'),
  -- Corpo
  ('shirt_basic', 'Camiseta Básica', 'corpo', 'comum', 30, 1, 'shirt_basic'),
  ('shirt_vest', 'Coletes Reflexivo', 'corpo', 'raro', 150, 3, 'shirt_vest'),
  ('shirt_suit', 'Terno Prefeito', 'corpo', 'epico', 800, 12, 'shirt_suit'),
  -- Acessório
  ('acc_glasses', 'Óculos', 'acessorio', 'comum', 40, 1, 'acc_glasses'),
  ('acc_watch', 'Relógio', 'acessorio', 'raro', 180, 4, 'acc_watch'),
  ('acc_medal', 'Medalha Honra', 'acessorio', 'epico', 500, 10, 'acc_medal'),
  -- Fundo
  ('bg_city', 'Cidade', 'fundo', 'comum', 20, 1, 'bg_city'),
  ('bg_park', 'Parque', 'fundo', 'raro', 120, 3, 'bg_park'),
  ('bg_hall', 'Paço Municipal', 'fundo', 'epico', 600, 10, 'bg_hall')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  slot = EXCLUDED.slot,
  rarity = EXCLUDED.rarity,
  price_coins = EXCLUDED.price_coins,
  min_level = EXCLUDED.min_level,
  asset = EXCLUDED.asset,
  active = EXCLUDED.active;

COMMENT ON TABLE public.items IS 'Itens da loja (roupas, acessórios, fundos).';
COMMENT ON TABLE public.user_items IS 'Itens possuídos pelo usuário.';
COMMENT ON TABLE public.user_equipped_items IS 'Itens equipados no avatar.';