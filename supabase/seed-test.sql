-- Seed script for 5000 test reports in São Paulo area
-- Run only in test environment!
-- ============================================================================

-- First, ensure we have test users
INSERT INTO auth.users (id, email, raw_user_meta_data, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'test1@test.com', '{"full_name": "Test User 1"}', now()),
  ('00000000-0000-0000-0000-000000000002', 'test2@test.com', '{"full_name": "Test User 2"}', now()),
  ('00000000-0000-0000-0000-000000000003', 'test3@test.com', '{"full_name": "Test User 3"}', now()),
  ('00000000-0000-0000-0000-000000000004', 'test4@test.com', '{"full_name": "Test User 4"}', now()),
  ('00000000-0000-0000-0000-000000000005', 'test5@test.com', '{"full_name": "Test User 5"}', now())
ON CONFLICT (id) DO NOTHING;

-- Insert profiles for test users (NEW schema: username, xp, coins, level, total_score, streak)
INSERT INTO public.profiles (id, username, xp, coins, level, total_score, streak_count, best_streak, avatar_url, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'testuser1', 1000, 50, 5, 1000, 3, 5, 'https://api.dicebear.com/7.x/avataaars/svg?seed=test1', now()),
  ('00000000-0000-0000-0000-000000000002', 'testuser2', 2000, 100, 7, 2000, 7, 7, 'https://api.dicebear.com/7.x/avataaars/svg?seed=test2', now()),
  ('00000000-0000-0000-0000-000000000003', 'testuser3', 500, 20, 3, 500, 1, 2, 'https://api.dicebear.com/7.x/avataaars/svg?seed=test3', now()),
  ('00000000-0000-0000-0000-000000000004', 'testuser4', 3000, 200, 9, 3000, 14, 14, 'https://api.dicebear.com/7.x/avataaars/svg?seed=test4', now()),
  ('00000000-0000-0000-0000-000000000005', 'testuser5', 1500, 80, 6, 1500, 5, 10, 'https://api.dicebear.com/7.x/avataaars/svg?seed=test5', now())
ON CONFLICT (id) DO NOTHING;

-- Initialize equipped items for test users
INSERT INTO public.user_equipped_items (user_id)
SELECT id FROM auth.users WHERE id IN (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005'
)
ON CONFLICT DO NOTHING;

-- Generate 5000 random reports in São Paulo bounding box
-- São Paulo bounds: lat -24.0 to -23.3, lng -47.0 to -46.3
-- NEW report_status enum: 'ativo', 'em_analise', 'em_andamento', 'resolvido', 'recusado'
DO $$
DECLARE
    v_categories text[] := ARRAY['buraco_asfalto', 'vazamento_agua', 'sinalizacao', 'acessibilidade'];
    v_statuses public.report_status[] := ARRAY['ativo'::public.report_status, 'em_analise'::public.report_status, 'resolvido'::public.report_status, 'recusado'::public.report_status];
    v_users uuid[] := ARRAY['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000005'];
    v_titles text[] := ARRAY[
        'Grande buraco na pista', 'Vazamento de água na rua', 'Placa de pare derrubada', 'Rampa de acessibilidade quebrada',
        'Buraco perigoso na faixa', 'Canos estourados', 'Sinalização apagada', 'Calçada esburacada',
        'Fiação exposta no poste', 'Vazamento em hidrante', 'Faixa de pedestres apagada', 'Guia rebaixada danificada',
        'Buraco na ciclofaixa', 'Tubo de água rompido', 'Semáforo quebrado', 'Piso tátil danificado'
    ];
    v_descriptions text[] := ARRAY[
        'Problema reportado por morador local. Necessita atenção urgente.',
        'Situação perigosa para pedestres e veículos. Já causou acidentes.',
        'Problema recorrente no bairro. Prefeitura já foi notificada anteriormente.',
        'Afeta a mobilidade e segurança dos moradores da região.',
        'Risco de acidentes, especialmente à noite.',
        'Dificulta acesso de cadeirantes e pessoas com mobilidade reduzida.'
    ];
    i int := 0;
    v_user uuid;
    v_category text;
    v_status public.report_status;
    v_lat double precision;
    v_lng double precision;
    v_title text;
    v_description text;
    v_created_at timestamptz;
    v_points int;
    v_report_id uuid;
    v_username text;
    v_avatar text;
    v_level int;
BEGIN
    -- Delete existing test reports (keep only real ones)
    DELETE FROM public.reports WHERE user_id = ANY(v_users);

    FOR i IN 1..5000 LOOP
        v_user := v_users[floor(random() * array_length(v_users, 1)) + 1];
        v_category := v_categories[floor(random() * array_length(v_categories, 1)) + 1];
        v_status := v_statuses[floor(random() * array_length(v_statuses, 1)) + 1];
        -- Random point in São Paulo metro area
        v_lat := -23.5505 + (random() - 0.5) * 0.4;  -- ~22km radius
        v_lng := -46.6333 + (random() - 0.5) * 0.4;
        v_title := v_titles[floor(random() * array_length(v_titles, 1)) + 1] || ' #' || i;
        v_description := v_descriptions[floor(random() * array_length(v_descriptions, 1)) + 1];
        v_created_at := now() - (random() * interval '90 days');
        v_points := CASE v_category
            WHEN 'buraco_asfalto' THEN 10
            WHEN 'vazamento_agua' THEN 15
            WHEN 'sinalizacao' THEN 8
            WHEN 'acessibilidade' THEN 12
            ELSE 5
        END;

        -- Get creator info for denormalized fields
        SELECT username, avatar_url, level INTO v_username, v_avatar, v_level
        FROM public.profiles WHERE id = v_user;

        INSERT INTO public.reports (
            user_id, latitude, longitude, category, title, description,
            photo_url, status, created_at, updated_at,
            creator_username, creator_avatar, creator_level,
            confirmations_continua, confirmations_resolvido
        ) VALUES (
            v_user, v_lat, v_lng, v_category, v_title, v_description,
            'https://picsum.photos/seed/' || md5(random()::text || clock_timestamp()::text) || '/800/600.jpg',
            v_status, v_created_at, v_created_at,
            v_username, v_avatar, v_level,
            0, 0
        ) RETURNING id INTO v_report_id;

        -- Add some confirmations for em_analise/resolvido
        IF v_status IN ('em_analise', 'resolvido') THEN
            INSERT INTO public.report_confirmations (report_id, user_id, type, user_lat, user_lng, created_at)
            SELECT v_report_id, v_users[j], 'continua',
                   v_lat + (random() - 0.5) * 0.001,
                   v_lng + (random() - 0.5) * 0.001,
                   v_created_at + (random() * interval '2 days')
            FROM generate_series(1, floor(random() * 5)::int + 1) j
            WHERE v_users[j] != v_user
            ON CONFLICT DO NOTHING;
        END IF;

        IF v_status = 'resolvido' THEN
            INSERT INTO public.report_confirmations (report_id, user_id, type, user_lat, user_lng, created_at)
            SELECT v_report_id, v_users[j], 'resolvido',
                   v_lat + (random() - 0.5) * 0.001,
                   v_lng + (random() - 0.5) * 0.001,
                   v_created_at + (random() * interval '5 days')
            FROM generate_series(1, 2) j
            WHERE v_users[j] != v_user
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;

    RAISE NOTICE 'Inserted 5000 test reports';
END $$;

-- Refresh the GIST index statistics
ANALYZE public.reports;

COMMENT ON TABLE public.reports IS 'Test data: 5000 reports seeded for performance testing';