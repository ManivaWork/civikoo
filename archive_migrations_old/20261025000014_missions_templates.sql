-- 14: Mission Templates
-- ============================================================================

CREATE TABLE public.mission_templates (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code text UNIQUE NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    type text NOT NULL CHECK (type IN ('diaria', 'semanal')),
    metric text NOT NULL CHECK (metric IN ('reportes', 'confirmacoes', 'resolucoes', 'reportes_categoria')),
    category text CHECK (category IN ('buraco_asfalto', 'iluminacao', 'lixo_entulho', 'vazamento_agua', 'sinalizacao', 'acessibilidade', 'vegetacao', 'mobiliario_urbano', 'outro')),
    target int NOT NULL CHECK (target > 0),
    reward_xp int NOT NULL DEFAULT 0 CHECK (reward_xp >= 0),
    reward_coins int NOT NULL DEFAULT 0 CHECK (reward_coins >= 0),
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mission_templates_type ON public.mission_templates(type);
CREATE INDEX IF NOT EXISTS idx_mission_templates_active ON public.mission_templates(active);

ALTER TABLE public.mission_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mission_templates_public_select" ON public.mission_templates;
CREATE POLICY "mission_templates_public_select"
    ON public.mission_templates FOR SELECT
    USING (active = true);

COMMENT ON TABLE public.mission_templates IS 'Templates de missões diárias e semanais';
COMMENT ON COLUMN public.mission_templates.type IS 'diaria = reseta todo dia à 0h BRT; semanal = reseta segunda 0h BRT';
COMMENT ON COLUMN public.mission_templates.metric IS 'reportes = criar reporte; confirmacoes = confirmar "continua"; resolucoes = confirmar "resolvido"; reportes_categoria = reporte de categoria específica';
COMMENT ON COLUMN public.mission_templates.category IS 'Obrigatório apenas quando metric = reportes_categoria';
COMMENT ON COLUMN public.mission_templates.target IS 'Quantidade necessária para completar a missão';

-- Seed: ~10 templates
INSERT INTO public.mission_templates (code, title, description, type, metric, category, target, reward_xp, reward_coins) VALUES
('daily_report_1', 'Reporte 1 problema hoje', 'Envie pelo menos 1 reporte de qualquer categoria hoje', 'diaria', 'reportes', NULL, 1, 50, 20),
('daily_confirm_2', 'Confirme 2 problemas', 'Confirme como "continua" 2 problemas diferentes hoje', 'diaria', 'confirmacoes', NULL, 2, 40, 15),
('daily_resolve_1', 'Ajude a resolver 1 problema', 'Confirme como "resolvido" 1 problema hoje', 'diaria', 'resolucoes', NULL, 1, 60, 25),
('daily_report_buraco', 'Reporte 1 buraco hoje', 'Envie 1 reporte de buraco no asfalto hoje', 'diaria', 'reportes_categoria', 'buraco_asfalto', 1, 55, 22),
('daily_report_lixo', 'Reporte 1 lixo hoje', 'Envie 1 reporte de lixo/entulho hoje', 'diaria', 'reportes_categoria', 'lixo_entulho', 1, 55, 22),
('daily_report_acessib', 'Reporte 1 acessibilidade hoje', 'Envie 1 reporte de acessibilidade hoje', 'diaria', 'reportes_categoria', 'acessibilidade', 1, 70, 30),
('weekly_report_3', 'Reporte 3 problemas esta semana', 'Envie pelo menos 3 reportes de qualquer categoria esta semana', 'semanal', 'reportes', NULL, 3, 150, 60),
('weekly_confirm_5', 'Confirme 5 problemas esta semana', 'Confirme como "continua" 5 problemas diferentes esta semana', 'semanal', 'confirmacoes', NULL, 5, 120, 50),
('weekly_resolve_2', 'Ajude a resolver 2 problemas esta semana', 'Confirme como "resolvido" 2 problemas esta semana', 'semanal', 'resolucoes', NULL, 2, 180, 80),
('weekly_report_lixo_3', 'Reporte 3 lixos esta semana', 'Envie 3 reportes de lixo/entulho esta semana', 'semanal', 'reportes_categoria', 'lixo_entulho', 3, 160, 70),
('weekly_report_ilum_2', 'Reporte 2 iluminação esta semana', 'Envie 2 reportes de iluminação esta semana', 'semanal', 'reportes_categoria', 'iluminacao', 2, 140, 60)
ON CONFLICT (code) DO NOTHING;