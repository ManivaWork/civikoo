-- Função para comprar item
CREATE OR REPLACE FUNCTION buy_item(p_item_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item record;
  v_profile record;
  v_result jsonb;
BEGIN
  -- Exige autenticação
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NÃO_AUTENTICADO: Você precisa estar logado para comprar itens.';
  END IF;

  -- Busca o item
  SELECT * INTO v_item
  FROM items
  WHERE code = p_item_code AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ITEM_INEXISTENTE: Item não encontrado ou indisponível.';
  END IF;

  -- Trava a linha do profile para evitar race condition
  SELECT * INTO v_profile
  FROM profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PERFIL_INEXISTENTE: Perfil não encontrado.';
  END IF;

  -- Valida nível mínimo
  IF v_profile.level < v_item.min_level THEN
    RAISE EXCEPTION 'NÍVEL_INSUFICIENTE: Você precisa ser nível % para comprar este item.', v_item.min_level;
  END IF;

  -- Valida saldo de moedas
  IF v_profile.coins < v_item.price_coins THEN
    RAISE EXCEPTION 'SALDO_INSUFICIENTE: Você precisa de % moedas para comprar este item. Seu saldo: % moedas.', v_item.price_coins, v_profile.coins;
  END IF;

  -- Verifica se já possui o item
  IF EXISTS (
    SELECT 1 FROM user_items ui
    JOIN items i ON i.id = ui.item_id
    WHERE ui.user_id = v_user_id AND i.code = p_item_code
  ) THEN
    RAISE EXCEPTION 'ITEM_JA_POSSUIDO: Você já possui este item.';
  END IF;

  -- Insere na tabela user_items
  INSERT INTO user_items (user_id, item_id)
  VALUES (v_user_id, v_item.id);

  -- Deduz moedas do perfil
  UPDATE profiles
  SET coins = coins - v_item.price_coins
  WHERE id = v_user_id;

  -- Registra gasto em reward_events
  INSERT INTO reward_events (user_id, type, xp, coins, description, related_id, state)
  VALUES (v_user_id, 'gasto_item', 0, -v_item.price_coins, 'Compra de item: ' || v_item.name, v_item.id, 'liberado');

  -- Retorna sucesso
  SELECT jsonb_build_object(
    'success', true,
    'message', 'Item "' || v_item.name || '" comprado com sucesso!',
    'item_code', v_item.code,
    'coins_spent', v_item.price_coins,
    'new_balance', v_profile.coins - v_item.price_coins
  ) INTO v_result;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- Re-lança exceções conhecidas
  IF SQLERRM LIKE '%NÃO_AUTENTICADO:%' OR
     SQLERRM LIKE '%ITEM_INEXISTENTE:%' OR
     SQLERRM LIKE '%NÍVEL_INSUFICIENTE:%' OR
     SQLERRM LIKE '%SALDO_INSUFICIENTE:%' OR
     SQLERRM LIKE '%ITEM_JA_POSSUIDO:%' OR
     SQLERRM LIKE '%PERFIL_INEXISTENTE:%' THEN
    RAISE;
  END IF;
  RAISE EXCEPTION 'ERRO_INTERNO: Falha ao processar compra.';
END;
$$;

-- Função para equipar/desequipar item
CREATE OR REPLACE FUNCTION equip_item(p_item_code text, p_slot text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item record;
  v_user_item record;
  v_equipped jsonb;
  v_result jsonb;
BEGIN
  -- Exige autenticação
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NÃO_AUTENTICADO: Você precisa estar logado.';
  END IF;

  -- Valida slot
  IF p_slot NOT IN ('cabeca', 'corpo', 'acessorio', 'fundo') THEN
    RAISE EXCEPTION 'SLOT_INVÁLIDO: Slot inválido.';
  END IF;

  -- Se p_item_code for vazio ou 'none', desequipa
  IF p_item_code IS NULL OR p_item_code = '' OR p_item_code = 'none' THEN
    UPDATE profiles
    SET equipped = jsonb_set(coalesce(equipped, '{}'::jsonb), '{' || p_slot || '}', 'null'::jsonb)
    WHERE id = v_user_id;

    SELECT jsonb_build_object(
      'success', true,
      'message', 'Item desequipado.',
      'slot', p_slot,
      'item_code', NULL
    ) INTO v_result;

    RETURN v_result;
  END IF;

  -- Busca o item pelo código
  SELECT * INTO v_item
  FROM items
  WHERE code = p_item_code AND active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ITEM_INEXISTENTE: Item não encontrado.';
  END IF;

  -- Valida se o slot do item corresponde
  IF v_item.slot <> p_slot THEN
    RAISE EXCEPTION 'SLOT_INCOMPATÍVEL: Este item não pode ser equipado neste slot.';
  END IF;

  -- Verifica se o usuário possui o item
  SELECT ui.* INTO v_user_item
  FROM user_items ui
  JOIN items i ON i.id = ui.item_id
  WHERE ui.user_id = v_user_id AND i.code = p_item_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ITEM_NÃO_POSSUIDO: Você não possui este item.';
  END IF;

  -- Atualiza o equipped do perfil
  UPDATE profiles
  SET equipped = jsonb_set(coalesce(equipped, '{}'::jsonb), '{' || p_slot || '}', to_jsonb(p_item_code))
  WHERE id = v_user_id;

  SELECT jsonb_build_object(
    'success', true,
    'message', 'Item "' || v_item.name || '" equipado!',
    'slot', p_slot,
    'item_code', p_item_code
  ) INTO v_result;

  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE '%NÃO_AUTENTICADO:%' OR
     SQLERRM LIKE '%ITEM_INEXISTENTE:%' OR
     SQLERRM LIKE '%SLOT_INVÁLIDO:%' OR
     SQLERRM LIKE '%SLOT_INCOMPATÍVEL:%' OR
     SQLERRM LIKE '%ITEM_NÃO_POSSUIDO:%' THEN
    RAISE;
  END IF;
  RAISE EXCEPTION 'ERRO_INTERNO: Falha ao equipar item.';
END;
$$;