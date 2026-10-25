-- 16: Streak Columns in Profiles
-- ============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS streak_count int NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS best_streak int NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_active_date date;

COMMENT ON COLUMN public.profiles.streak_count IS 'Dias consecutivos de atividade (reporte ou confirmação válida)';
COMMENT ON COLUMN public.profiles.best_streak IS 'Maior sequência já alcançada pelo usuário';
COMMENT ON COLUMN public.profiles.last_active_date IS 'Última data (BRT) em que o usuário teve atividade válida';

-- Index for streak queries
CREATE INDEX IF NOT EXISTS idx_profiles_streak ON public.profiles (streak_count DESC);

-- ============================================================================
-- Milestone rewards table (recompensas por marcos de sequência)
-- ============================================================================
CREATE TABLE public.streak_milestones (
    id int PRIMARY KEY, -- dias do marco: 3, 7, 14, 30
    reward_xp int NOT NULL DEFAULT 0,
    reward_coins int NOT NULL DEFAULT 0,
    description text NOT NULL
);

INSERT INTO public.streak_milestones (id, reward_xp, reward_coins, description) VALUES
(3, 50, 20, '3 dias seguidos - Iniciante Consistente'),
(7, 150, 50, '7 dias seguidos - Semana Completa'),
(14, 400, 150, '14 dias seguidos - Duas Semanas'),
(30, 1000, 400, '30 dias seguidos - Mês Inteiro')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.streak_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "streak_milestones_public_select" ON public.streak_milestones;
CREATE POLICY "streak_milestones_public_select"
    ON public.streak_milestones FOR SELECT
    USING (true);

COMMENT ON TABLE public.streak_milestones IS 'Recompensas por marcos de sequência diária (streak)';

-- ============================================================================
-- User streak milestones earned (para evitar duplicatas)
-- ============================================================================
CREATE TABLE public.user_streak_milestones (
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    milestone_days int NOT NULL REFERENCES public.streak_milestones(id),
    earned_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, milestone_days)
);

ALTER TABLE public.user_streak_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_streak_milestones_own_select" ON public.user_streak_milestones;
CREATE POLICY "user_streak_milestones_own_select"
    ON public.user_streak_milestones FOR SELECT
    USING (user_id = auth.uid());

COMMENT ON TABLE public.user_streak_milestones IS 'Marcos de sequência já resgatados pelo usuário';