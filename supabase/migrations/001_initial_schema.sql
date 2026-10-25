-- Civikoo Database Schema for Supabase (PostgreSQL)
-- Migration: 001_initial_schema
-- Description: Core tables for urban maintenance gamified app

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE report_category AS ENUM (
    'buraco_asfalto',        -- Pothole
    'iluminacao',            -- Street lighting
    'lixo_entulho',          -- Trash/debris
    'vazamento_agua',        -- Water leak
    'sinalizacao',           -- Signage
    'acessibilidade',        -- Accessibility
    'vegetacao',             -- Vegetation/overgrowth
    'mobiliario_urbano',     -- Urban furniture
    'outro'                  -- Other
);

CREATE TYPE report_status AS ENUM (
    'ativo',                 -- Active/reported
    'em_analise',            -- Under analysis
    'em_andamento',          -- In progress
    'resolvido',             -- Resolved
    'recusado'               -- Rejected/false report
);

CREATE TYPE verification_type AS ENUM (
    'confirmacao',           -- Confirms the problem exists
    'negacao'                -- Denies the problem exists
);

CREATE TYPE reward_type AS ENUM (
    'desconto_percentual',   -- Percentage discount
    'desconto_fixo',         -- Fixed value discount
    'brinde',                -- Freebie/gift
    'servico_gratis'         -- Free service
);

-- ============================================================================
-- USERS TABLE
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Auth integration (Supabase Auth)
    auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Profile
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,

    -- Gamification
    level INTEGER NOT NULL DEFAULT 1,
    total_score INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    longest_streak INTEGER NOT NULL DEFAULT 0,

    -- Location (for nearby reports)
    last_known_latitude DECIMAL(10, 8),
    last_known_longitude DECIMAL(11, 8),
    last_location_update TIMESTAMPTZ,

    -- Preferences
    notification_radius INTEGER DEFAULT 1000, -- meters
    push_notifications_enabled BOOLEAN DEFAULT TRUE,
    email_notifications_enabled BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT users_username_format CHECK (username ~ '^[a-zA-Z0-9_]+$'),
    CONSTRAINT users_level_positive CHECK (level > 0),
    CONSTRAINT users_score_non_negative CHECK (total_score >= 0)
);

-- Indexes for users
CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_location ON users(last_known_latitude, last_known_longitude)
    WHERE last_known_latitude IS NOT NULL AND last_known_longitude IS NOT NULL;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- REPORTS TABLE
-- ============================================================================

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Creator
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

    -- Location (PostGIS)
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    latitude DECIMAL(10, 8) GENERATED ALWAYS AS (ST_Y(location::geometry)) STORED,
    longitude DECIMAL(11, 8) GENERATED ALWAYS AS (ST_X(location::geometry)) STORED,
    address TEXT, -- Reverse geocoded address

    -- Problem details
    category report_category NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    photo_url TEXT NOT NULL, -- Supabase Storage URL
    photo_thumbnail_url TEXT, -- Optimized thumbnail

    -- Status workflow
    status report_status NOT NULL DEFAULT 'ativo',
    status_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution_notes TEXT,

    -- Verification counters (denormalized for performance)
    confirmations_count INTEGER NOT NULL DEFAULT 0,
    denials_count INTEGER NOT NULL DEFAULT 0,

    -- Gamification
    score_awarded INTEGER NOT NULL DEFAULT 10, -- Base score for reporting
    bonus_score INTEGER NOT NULL DEFAULT 0,    -- Bonus for first report in area, etc.

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT reports_title_not_empty CHECK (trim(title) <> ''),
    CONSTRAINT reports_photo_url_not_empty CHECK (trim(photo_url) <> '')
);

-- Indexes for reports
CREATE INDEX idx_reports_creator ON reports(creator_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_category ON reports(category);
CREATE INDEX idx_reports_location ON reports USING GIST (location);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX idx_reports_pending_verification ON reports(status, confirmations_count, denials_count)
    WHERE status = 'ativo';

-- Trigger for updated_at
CREATE TRIGGER update_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VERIFICATIONS TABLE
-- ============================================================================

CREATE TABLE verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- References
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    verifier_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Verification type
    type verification_type NOT NULL,

    -- Optional: photo evidence for verification
    photo_url TEXT,
    notes TEXT,

    -- Gamification
    score_awarded INTEGER NOT NULL DEFAULT 2,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT verifications_unique_per_user_report UNIQUE (report_id, verifier_id),
    CONSTRAINT verifications_not_own_report CHECK (
        verifier_id <> (SELECT creator_id FROM reports WHERE id = report_id)
    )
);

-- Indexes for verifications
CREATE INDEX idx_verifications_report ON verifications(report_id);
CREATE INDEX idx_verifications_verifier ON verifications(verifier_id);
CREATE INDEX idx_verifications_type ON verifications(type);

-- Trigger to update report counters
CREATE OR REPLACE FUNCTION update_report_verification_counters()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.type = 'confirmacao' THEN
            UPDATE reports SET
                confirmations_count = confirmations_count + 1,
                updated_at = NOW()
            WHERE id = NEW.report_id;
        ELSIF NEW.type = 'negacao' THEN
            UPDATE reports SET
                denials_count = denials_count + 1,
                updated_at = NOW()
            WHERE id = NEW.report_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.type = 'confirmacao' THEN
            UPDATE reports SET
                confirmations_count = confirmations_count - 1,
                updated_at = NOW()
            WHERE id = OLD.report_id;
        ELSIF OLD.type = 'negacao' THEN
            UPDATE reports SET
                denials_count = denials_count - 1,
                updated_at = NOW()
            WHERE id = OLD.report_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_report_verification_counters
    AFTER INSERT OR DELETE ON verifications
    FOR EACH ROW
    EXECUTE FUNCTION update_report_verification_counters();

-- ============================================================================
-- REWARDS TABLE (Local commerce coupons)
-- ============================================================================

CREATE TABLE rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Partner info
    partner_name VARCHAR(100) NOT NULL,
    partner_logo_url TEXT,
    partner_address TEXT,
    partner_latitude DECIMAL(10, 8),
    partner_longitude DECIMAL(11, 8),
    partner_category VARCHAR(50), -- 'restaurante', 'cafe', 'loja', 'servico', etc.
    partner_phone VARCHAR(20),
    partner_website TEXT,

    -- Reward details
    title VARCHAR(200) NOT NULL,
    description TEXT,
    type reward_type NOT NULL,

    -- Value (depends on type)
    discount_percent INTEGER,      -- For 'desconto_percentual' (1-100)
    discount_value DECIMAL(10, 2), -- For 'desconto_fixo' (in BRL)
    gift_description TEXT,         -- For 'brinde' or 'servico_gratis'

    -- Conditions
    min_purchase_value DECIMAL(10, 2) DEFAULT 0,
    max_uses_per_user INTEGER DEFAULT 1,
    total_quantity INTEGER, -- NULL = unlimited
    used_quantity INTEGER NOT NULL DEFAULT 0,

    -- Validity
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ NOT NULL,

    -- Gamification cost
    cost_in_points INTEGER NOT NULL DEFAULT 100,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT rewards_valid_dates CHECK (valid_until > valid_from),
    CONSTRAINT rewards_discount_percent_range CHECK (
        discount_percent IS NULL OR (discount_percent > 0 AND discount_percent <= 100)
    ),
    CONSTRAINT rewards_discount_value_positive CHECK (
        discount_value IS NULL OR discount_value > 0
    ),
    CONSTRAINT rewards_cost_positive CHECK (cost_in_points > 0),
    CONSTRAINT rewards_quantity_positive CHECK (
        total_quantity IS NULL OR total_quantity > 0
    )
);

-- Indexes for rewards
CREATE INDEX idx_rewards_active ON rewards(is_active, valid_from, valid_until)
    WHERE is_active = TRUE;
CREATE INDEX idx_rewards_partner ON rewards(partner_name);
CREATE INDEX idx_rewards_category ON rewards(partner_category);
CREATE INDEX idx_rewards_location ON rewards(partner_latitude, partner_longitude)
    WHERE partner_latitude IS NOT NULL AND partner_longitude IS NOT NULL;
CREATE INDEX idx_rewards_featured ON rewards(is_featured)
    WHERE is_featured = TRUE;

-- Trigger for updated_at
CREATE TRIGGER update_rewards_updated_at
    BEFORE UPDATE ON rewards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- USER_REWARDS TABLE (Redemptions)
-- ============================================================================

CREATE TABLE user_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- References
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,

    -- Redemption details
    points_spent INTEGER NOT NULL,
    redemption_code VARCHAR(20) UNIQUE NOT NULL, -- Unique code for partner validation
    qr_code_data TEXT, -- For QR code generation

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'usado', 'expirado', 'cancelado')),
    used_at TIMESTAMPTZ,
    used_at_partner BOOLEAN DEFAULT FALSE, -- Confirmed by partner

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,

    -- Constraints
    CONSTRAINT user_rewards_points_positive CHECK (points_spent > 0),
    CONSTRAINT user_rewards_expires_after_created CHECK (expires_at > created_at)
);

-- Indexes for user_rewards
CREATE INDEX idx_user_rewards_user ON user_rewards(user_id);
CREATE INDEX idx_user_rewards_reward ON user_rewards(reward_id);
CREATE INDEX idx_user_rewards_status ON user_rewards(status);
CREATE INDEX idx_user_rewards_code ON user_rewards(redemption_code);
CREATE INDEX idx_user_rewards_expires ON user_rewards(expires_at)
    WHERE status = 'ativo';

-- ============================================================================
-- ADDITIONAL GAMIFICATION TABLES
-- ============================================================================

-- User achievements/badges
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'first_report', 'streak_7', 'verifier_10'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url TEXT,
    category VARCHAR(30) NOT NULL, -- 'reporter', 'verifier', 'streak', 'social', 'explorer'
    requirement_type VARCHAR(30) NOT NULL, -- 'count', 'streak', 'distance', 'variety'
    requirement_value INTEGER NOT NULL,
    points_reward INTEGER NOT NULL DEFAULT 0,
    is_hidden BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, achievement_id)
);

CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX idx_achievements_category ON achievements(category);

-- Leaderboards (materialized view refreshed periodically)
CREATE TABLE leaderboards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'all_time')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    rank INTEGER NOT NULL,
    score INTEGER NOT NULL,
    reports_count INTEGER NOT NULL DEFAULT 0,
    verifications_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, period_type, period_start)
);

CREATE INDEX idx_leaderboards_period ON leaderboards(period_type, period_start, rank);

-- User sessions/activity log (for streak calculation)
CREATE TABLE user_activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_type VARCHAR(30) NOT NULL, -- 'report_created', 'verification', 'reward_redeemed', 'login'
    reference_id UUID, -- ID of report, verification, or reward
    points_earned INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_activity_user_date ON user_activity_log(user_id, created_at DESC);
CREATE INDEX idx_user_activity_type ON user_activity_log(activity_type);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all profiles" ON users
    FOR SELECT USING (TRUE);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (auth_user_id = auth.uid());

-- Reports policies
CREATE POLICY "Anyone can view active reports" ON reports
    FOR SELECT USING (status IN ('ativo', 'em_analise', 'em_andamento', 'resolvido'));

CREATE POLICY "Users can create reports" ON reports
    FOR INSERT WITH CHECK (creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Creators can update own reports" ON reports
    FOR UPDATE USING (creator_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Verifications policies
CREATE POLICY "Anyone can view verifications" ON verifications
    FOR SELECT USING (TRUE);

CREATE POLICY "Users can create verifications" ON verifications
    FOR INSERT WITH CHECK (
        verifier_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
        AND verifier_id <> (SELECT creator_id FROM reports WHERE id = report_id)
    );

-- Rewards policies
CREATE POLICY "Anyone can view active rewards" ON rewards
    FOR SELECT USING (is_active = TRUE AND valid_until > NOW());

-- User rewards policies
CREATE POLICY "Users can view own rewards" ON user_rewards
    FOR SELECT USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can create reward redemptions" ON user_rewards
    FOR INSERT WITH CHECK (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Achievements policies
CREATE POLICY "Anyone can view achievements" ON achievements
    FOR SELECT USING (TRUE);

CREATE POLICY "Users can view own achievements" ON user_achievements
    FOR SELECT USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- Leaderboards policies
CREATE POLICY "Anyone can view leaderboards" ON leaderboards
    FOR SELECT USING (TRUE);

-- Activity log policies
CREATE POLICY "Users can view own activity" ON user_activity_log
    FOR SELECT USING (user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Get or create user profile from auth
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO users (auth_user_id, username, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (auth_user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Calculate user level from total score
CREATE OR REPLACE FUNCTION calculate_level(score INTEGER) RETURNS INTEGER AS $$
BEGIN
    -- Level formula: level = floor(sqrt(score / 100)) + 1
    -- Level 1: 0-99, Level 2: 100-399, Level 3: 400-899, Level 4: 900-1599, etc.
    RETURN FLOOR(SQRT(score::numeric / 100))::INTEGER + 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update user level and score after activity
CREATE OR REPLACE FUNCTION update_user_gamification(
    p_user_id UUID,
    p_points INTEGER,
    p_activity_type VARCHAR
) RETURNS VOID AS $$
DECLARE
    v_new_score INTEGER;
    v_new_level INTEGER;
BEGIN
    UPDATE users
    SET
        total_score = total_score + p_points,
        last_active_at = NOW(),
        current_streak = CASE
            WHEN last_active_at::DATE = CURRENT_DATE - 1 THEN current_streak + 1
            WHEN last_active_at::DATE = CURRENT_DATE THEN current_streak
            ELSE 1
        END,
        longest_streak = GREATEST(longest_streak,
            CASE
                WHEN last_active_at::DATE = CURRENT_DATE - 1 THEN current_streak + 1
                WHEN last_active_at::DATE = CURRENT_DATE THEN current_streak
                ELSE 1
            END
        ),
        level = calculate_level(total_score + p_points)
    WHERE id = p_user_id
    RETURNING total_score, level INTO v_new_score, v_new_level;

    -- Log activity
    INSERT INTO user_activity_log (user_id, activity_type, points_earned)
    VALUES (p_user_id, p_activity_type, p_points);

    -- Check for new achievements (could be expanded)
    -- This is a simplified version - in production, use a more robust achievement system
END;
$$ LANGUAGE plpgsql;

-- Check and update report status based on verifications
CREATE OR REPLACE FUNCTION check_report_status(p_report_id UUID) RETURNS VOID AS $$
DECLARE
    v_report RECORD;
    v_total_verifications INTEGER;
    v_confirmation_ratio NUMERIC;
BEGIN
    SELECT * INTO v_report FROM reports WHERE id = p_report_id;

    v_total_verifications := v_report.confirmations_count + v_report.denials_count;

    IF v_total_verifications >= 3 THEN
        v_confirmation_ratio := v_report.confirmations_count::NUMERIC / v_total_verifications;

        IF v_confirmation_ratio >= 0.6 AND v_report.status = 'ativo' THEN
            UPDATE reports
            SET status = 'em_analise', status_changed_at = NOW(), updated_at = NOW()
            WHERE id = p_report_id;
        ELSIF v_confirmation_ratio < 0.4 AND v_report.status = 'ativo' THEN
            UPDATE reports
            SET status = 'recusado', status_changed_at = NOW(), updated_at = NOW()
            WHERE id = p_report_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_report_status
    AFTER INSERT OR DELETE ON verifications
    FOR EACH ROW
    EXECUTE FUNCTION check_report_status(NEW.report_id);

-- ============================================================================
-- INITIAL DATA: DEFAULT ACHIEVEMENTS
-- ============================================================================

INSERT INTO achievements (code, name, description, icon_url, category, requirement_type, requirement_value, points_reward) VALUES
('first_report', 'Primeiro Relatório', 'Envie seu primeiro relato de problema', '🎯', 'reporter', 'count', 1, 50),
('reporter_10', 'Reporter Ativo', 'Envie 10 relatos de problemas', '📝', 'reporter', 'count', 10, 200),
('reporter_50', 'Reporter Veterano', 'Envie 50 relatos de problemas', '🏆', 'reporter', 'count', 50, 1000),
('first_verification', 'Primeira Verificação', 'Confirme ou negue seu primeiro problema', '✅', 'verifier', 'count', 1, 30),
('verifier_20', 'Verificador Confiável', 'Realize 20 verificações', '🔍', 'verifier', 'count', 20, 300),
('streak_3', 'Iniciante Consistente', 'Mantenha uma sequência de 3 dias', '🔥', 'streak', 'streak', 3, 100),
('streak_7', 'Semana Completa', 'Mantenha uma sequência de 7 dias', '📅', 'streak', 'streak', 7, 300),
('streak_30', 'Mestre da Consistência', 'Mantenha uma sequência de 30 dias', '💎', 'streak', 'streak', 30, 2000),
('category_explorer', 'Explorador de Categorias', 'Reporte problemas em 5 categorias diferentes', '🗺️', 'explorer', 'variety', 5, 500),
('first_reward', 'Primeiro Resgate', 'Resgate sua primeira recompensa', '🎁', 'social', 'count', 1, 100);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Reports with creator info
CREATE VIEW v_reports_with_creator AS
SELECT
    r.*,
    u.username as creator_username,
    u.avatar_url as creator_avatar,
    u.level as creator_level
FROM reports r
JOIN users u ON r.creator_id = u.id;

-- View: User stats summary
CREATE VIEW v_user_stats AS
SELECT
    u.id,
    u.username,
    u.avatar_url,
    u.level,
    u.total_score,
    u.current_streak,
    u.longest_streak,
    COUNT(DISTINCT r.id) as reports_count,
    COUNT(DISTINCT v.id) as verifications_count,
    COUNT(DISTINCT ur.id) as rewards_redeemed_count
FROM users u
LEFT JOIN reports r ON r.creator_id = u.id
LEFT JOIN verifications v ON v.verifier_id = u.id
LEFT JOIN user_rewards ur ON ur.user_id = u.id AND ur.status = 'usado'
GROUP BY u.id;

-- View: Active rewards with partner location
CREATE VIEW v_active_rewards AS
SELECT
    r.*,
    ST_SetSRID(ST_MakePoint(r.partner_longitude, r.partner_latitude), 4326)::GEOGRAPHY as partner_location
FROM rewards r
WHERE r.is_active = TRUE
  AND r.valid_until > NOW()
  AND r.used_quantity < COALESCE(r.total_quantity, 999999);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE users IS 'User profiles with gamification data';
COMMENT ON TABLE reports IS 'Urban maintenance problem reports with geolocation';
COMMENT ON TABLE verifications IS 'Community verifications of reported problems';
COMMENT ON TABLE rewards IS 'Local commerce discount coupons and rewards';
COMMENT ON TABLE user_rewards IS 'User reward redemptions with validation codes';
COMMENT ON TABLE achievements IS 'Gamification achievements/badges definitions';
COMMENT ON TABLE user_achievements IS 'User earned achievements';
COMMENT ON TABLE leaderboards IS 'Periodic leaderboard snapshots';
COMMENT ON TABLE user_activity_log IS 'User activity audit log for streaks and analytics';

COMMENT ON COLUMN reports.location IS 'PostGIS geography point for spatial queries';
COMMENT ON COLUMN reports.confirmations_count IS 'Denormalized count of positive verifications';
COMMENT ON COLUMN reports.denials_count IS 'Denormalized count of negative verifications';
COMMENT ON COLUMN user_rewards.redemption_code IS 'Unique code for partner validation (format: CIV-XXXXXX)';
COMMENT ON COLUMN rewards.cost_in_points IS 'Points required to redeem this reward';