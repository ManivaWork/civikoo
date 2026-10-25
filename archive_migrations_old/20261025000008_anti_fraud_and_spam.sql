-- Anti-fraude e spam protections
-- 1. Trigger: máximo 20 reportes por usuário nas últimas 24h
-- 2. Trigger: rejeita reporte duplicado (mesma categoria, não resolvido, < 15m)
-- 3. Limites em confirm_report: 30 confirmações/dia, cooldown 30s
-- 4. Tabela report_flags + coluna hidden em reports + cancelamento de rewards
-- 5. Registra GPS accuracy nas confirmações e rejeita se > 100m

-- 1. Função para checar limite de reportes (24h)
CREATE OR REPLACE FUNCTION check_report_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recent_count integer;
BEGIN
  SELECT count(*) INTO recent_count
  FROM reports
  WHERE creator_id = NEW.creator_id
    AND created_at > now() - interval '24 hours';

  IF recent_count >= 20 THEN
    RAISE EXCEPTION 'LIMITE_EXCEDIDO: Você atingiu o limite de 20 reportes nas últimas 24 horas. Tente novamente mais tarde.';
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Função para checar reporte duplicado próximo (15m, mesma categoria, não resolvido)
CREATE OR REPLACE FUNCTION check_duplicate_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_report record;
BEGIN
  SELECT id, title, latitude, longitude
  INTO existing_report
  FROM reports
  WHERE category = NEW.category
    AND status IN ('aberto', 'confirmado')
    AND ST_DWithin(
      ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
      ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography,
      15
    )
    AND id != NEW.id
  ORDER BY ST_Distance(
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography
  )
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'REPORTE_DUPLICADO: Já existe um reporte "%" não resolvido a menos de 15m nesta categoria. Considere confirmar o existente.', existing_report.title;
  END IF;

  RETURN NEW;
END;
$$;

-- Triggers para reports
DROP TRIGGER IF EXISTS trigger_report_rate_limit ON reports;
CREATE TRIGGER trigger_report_rate_limit
  BEFORE INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION check_report_rate_limit();

DROP TRIGGER IF EXISTS trigger_duplicate_report ON reports;
CREATE TRIGGER trigger_duplicate_report
  BEFORE INSERT ON reports
  FOR EACH ROW EXECUTE FUNCTION check_duplicate_report();

-- 3. Atualizar confirm_report com limites de confirmação
CREATE OR REPLACE FUNCTION confirm_report(
  p_report_id uuid,
  p_user_id uuid,
  p_tipo text, -- 'continua' ou 'resolvido'
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_report record;
  v_distance double precision;
  v_existing_confirmation record;
  v_confirmations_today integer;
  v_last_confirmation timestamp with time zone;
  v_result jsonb;
BEGIN
  -- Validar GPS accuracy (rejeita se > 100m)
  IF p_accuracy IS NOT NULL AND p_accuracy > 100 THEN
    RAISE EXCEPTION 'GPS_PRECISAO_BAIXA: A precisão do GPS (%.0f m) é insuficiente. Mova-se para um local com melhor sinal e tente novamente.', p_accuracy;
  END IF;

  -- Buscar reporte
  SELECT * INTO v_report
  FROM reports
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPORTE_NAO_ENCONTRADO: Reporte não encontrado.';
  END IF;

  -- Checar proximidade (50m)
  SELECT ST_Distance(
    ST_SetSRID(ST_MakePoint(v_report.longitude, v_report.latitude), 4326)::geography,
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
  ) INTO v_distance;

  IF v_distance > 50 THEN
    RAISE EXCEPTION 'FORA_DE_ALCANCE: Você precisa estar a até 50 metros do local (distância: %.0f m).', v_distance;
  END IF;

  -- Checar limite diário de confirmações (30/dia)
  SELECT count(*) INTO v_confirmations_today
  FROM report_confirmations
  WHERE user_id = p_user_id
    AND created_at > now() - interval '24 hours';

  IF v_confirmations_today >= 30 THEN
    RAISE EXCEPTION 'LIMITE_CONFIRMACOES: Você atingiu o limite de 30 confirmações nas últimas 24 horas.';
  END IF;

  -- Checar cooldown de 30 segundos
  SELECT created_at INTO v_last_confirmation
  FROM report_confirmations
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_confirmation IS NOT NULL AND (now() - v_last_confirmation) < interval '30 seconds' THEN
    RAISE EXCEPTION 'COOLDOWN_CONFIRMACAO: Aguarde 30 segundos antes de confirmar novamente.';
  END IF;

  -- Checar se já confirmou este reporte neste tipo
  SELECT * INTO v_existing_confirmation
  FROM report_confirmations
  WHERE report_id = p_report_id
    AND user_id = p_user_id
    AND tipo = p_tipo;

  IF FOUND THEN
    RAISE EXCEPTION 'JA_CONFIRMOU: Você já confirmou este reporte como %.', p_tipo;
  END IF;

  -- Inserir confirmação com accuracy
  INSERT INTO report_confirmations (report_id, user_id, tipo, latitude, longitude, accuracy)
  VALUES (p_report_id, p_user_id, p_tipo, p_latitude, p_longitude, p_accuracy);

  -- Atualizar contadores no reporte
  IF p_tipo = 'continua' THEN
    UPDATE reports SET confirmations_continua = confirmations_continua + 1 WHERE id = p_report_id;
  ELSE
    UPDATE reports SET confirmations_resolvido = confirmations_resolvido + 1 WHERE id = p_report_id;
  END IF;

  -- Verificar se deve mudar status para 'resolvido' (2 confirmações de usuários diferentes)
  IF p_tipo = 'resolvido' THEN
    UPDATE reports
    SET status = 'resolvido', resolved_at = now()
    WHERE id = p_report_id
      AND confirmations_resolvido >= 2
      AND status != 'resolvido';
  END IF;

  -- Verificar se deve mudar para 'confirmado' (pelo menos 1 confirmação 'continua')
  IF p_tipo = 'continua' THEN
    UPDATE reports
    SET status = 'confirmado'
    WHERE id = p_report_id
      AND status = 'aberto';
  END IF;

  -- Retornar resultado
  SELECT jsonb_build_object(
    'success', true,
    'message', CASE
      WHEN p_tipo = 'continua' THEN 'Confirmação de "problema continua" registrada!'
      ELSE 'Confirmação de "problema resolvido" registrada!'
    END,
    'distance_m', round(v_distance),
    'accuracy_m', p_accuracy
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 4. Tabela de denúncias (report_flags)
CREATE TABLE IF NOT EXISTS report_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('falso', 'duplicado', 'ofensivo', 'outro')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(report_id, user_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_report_flags_report_id ON report_flags(report_id);
CREATE INDEX IF NOT EXISTS idx_report_flags_user_id ON report_flags(user_id);

-- Coluna hidden em reports
ALTER TABLE reports ADD COLUMN IF NOT EXISTS hidden boolean DEFAULT false;

-- Índice para consultas públicas (exclui hidden)
CREATE INDEX IF NOT EXISTS idx_reports_public ON reports(status, hidden) WHERE hidden = false;

-- Função para processar denúncia
CREATE OR REPLACE FUNCTION flag_report(
  p_report_id uuid,
  p_user_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_flag_count integer;
  v_report record;
  v_result jsonb;
BEGIN
  -- Inserir denúncia
  INSERT INTO report_flags (report_id, user_id, reason)
  VALUES (p_report_id, p_user_id, p_reason)
  ON CONFLICT (report_id, user_id) DO NOTHING;

  -- Contar denúncias únicas
  SELECT count(*) INTO v_flag_count
  FROM report_flags
  WHERE report_id = p_report_id;

  -- Se atingir 3 denúncias, ocultar reporte
  IF v_flag_count >= 3 THEN
    UPDATE reports SET hidden = true WHERE id = p_report_id;

    -- Cancelar reward_events pendentes do autor
    UPDATE reward_events
    SET state = 'cancelled',
        metadata = jsonb_set(coalesce(metadata, '{}'), '{cancel_reason}', '"hidden_by_community"')
    WHERE user_id = (SELECT creator_id FROM reports WHERE id = p_report_id)
      AND state = 'pendente';
  END IF;

  SELECT jsonb_build_object(
    'success', true,
    'message', 'Denúncia registrada. Obrigado por ajudar a manter a qualidade.',
    'flags_count', v_flag_count,
    'hidden', v_flag_count >= 3
  ) INTO v_result;

  RETURN v_result;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'JA_DENUNCIOU: Você já denunciou este reporte.';
END;
$$;

-- 5. Atualizar report_confirmations para incluir accuracy
ALTER TABLE report_confirmations ADD COLUMN IF NOT EXISTS accuracy double precision;

-- Comentário: Limitações conhecidas
-- GPS pode ser falsificado no cliente (mock location, GPS spoofing apps, etc.)
-- Mitigações futuras sugeridas:
-- 1. Verificação de consistência de movimento (velocidade impossível, teleport)
-- 2. Cross-reference com Wi-Fi/Cell tower triangulation (quando disponível)
-- 3. Reputação do usuário: usuários novos têm peso menor
-- 4. Anomalia estatística: padrões de confirmação suspeitos (mesmo horário, mesma rota)
-- 5. Integração com APIs de verificação de localização (Google Play Integrity, App Attest)
-- 6. Requerir foto com EXIF GPS metadata (verificar consistência com coordenadas enviadas)

-- Atualizar view/consulta pública para excluir hidden
-- A view reports_nearby já deve filtrar hidden = false (verificar na implementação)