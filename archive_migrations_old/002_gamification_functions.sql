-- Migration: 002_gamification_functions.sql
-- Description: RPC functions and triggers for gamification and anti-fraud

-- ============================================================================
-- RPC FUNCTION: Increment user score atomically
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_user_score(
    p_user_id UUID,
    p_points INTEGER,
    p_activity_type VARCHAR,
    p_reference_id UUID
) RETURNS VOID AS $$
DECLARE
    v_new_score INTEGER;
    v_new_level INTEGER;
    v_current_streak INTEGER;
    v_longest_streak INTEGER;
    v_last_active_date DATE;
BEGIN
    -- Get current user state
    SELECT total_score, current_streak, longest_streak, last_active_at::DATE
    INTO v_new_score, v_current_streak, v_longest_streak, v_last_active_date
    FROM users
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found: %', p_user_id;
    END IF;

    -- Calculate new score
    v_new_score := v_new_score + p_points;

    -- Calculate new level: floor(sqrt(score / 100)) + 1
    v_new_level := FLOOR(SQRT(v_new_score::numeric / 100))::INTEGER + 1;

    -- Calculate streak
    IF v_last_active_date = CURRENT_DATE - 1 THEN
        v_current_streak := v_current_streak + 1;
    ELSIF v_last_active_date = CURRENT_DATE THEN
        -- Same day, keep streak
        v_current_streak := v_current_streak;
    ELSE
        -- Streak broken
        v_current_streak := 1;
    END IF;

    v_longest_streak := GREATEST(v_longest_streak, v_current_streak);

    -- Update user
    UPDATE users
    SET
        total_score = v_new_score,
        level = v_new_level,
        current_streak = v_current_streak,
        longest_streak = v_longest_streak,
        last_active_at = NOW(),
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Log activity
    INSERT INTO user_activity_log (user_id, activity_type, reference_id, points_earned)
    VALUES (p_user_id, p_activity_type, p_reference_id, p_points);

    -- Check for new achievements (simplified)
    PERFORM check_and_award_achievements(p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION: Check and award achievements
-- ============================================================================

CREATE OR REPLACE FUNCTION check_and_award_achievements(p_user_id UUID) RETURNS VOID AS $$
DECLARE
    v_user RECORD;
    v_achievement RECORD;
BEGIN
    -- Get user stats
    SELECT u.*,
           COUNT(DISTINCT r.id) as reports_count,
           COUNT(DISTINCT v.id) as verifications_count
    INTO v_user
    FROM users u
    LEFT JOIN reports r ON r.creator_id = u.id
    LEFT JOIN verifications v ON v.verifier_id = u.id
    WHERE u.id = p_user_id
    GROUP BY u.id;

    -- Check each unearned achievement
    FOR v_achievement IN
        SELECT a.* FROM achievements a
        WHERE a.id NOT IN (SELECT achievement_id FROM user_achievements WHERE user_id = p_user_id)
    LOOP
        IF check_achievement_requirement(v_user, v_achievement) THEN
            INSERT INTO user_achievements (user_id, achievement_id)
            VALUES (p_user_id, v_achievement.id);

            -- Award achievement points
            IF v_achievement.points_reward > 0 THEN
                PERFORM increment_user_score(p_user_id, v_achievement.points_reward, 'achievement', v_achievement.id);
            END IF;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check achievement requirements
CREATE OR REPLACE FUNCTION check_achievement_requirement(p_user RECORD, p_achievement achievements) RETURNS BOOLEAN AS $$
BEGIN
    CASE p_achievement.requirement_type
        WHEN 'count' THEN
            CASE p_achievement.category
                WHEN 'reporter' THEN RETURN p_user.reports_count >= p_achievement.requirement_value;
                WHEN 'verifier' THEN RETURN p_user.verifications_count >= p_achievement.requirement_value;
                ELSE RETURN FALSE;
            END CASE;
        WHEN 'streak' THEN RETURN p_user.current_streak >= p_achievement.requirement_value;
        WHEN 'variety' THEN
            RETURN (
                SELECT COUNT(DISTINCT category)
                FROM reports
                WHERE creator_id = p_user.id
            ) >= p_achievement.requirement_value;
        ELSE RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Update report verification counters (already in initial schema)
-- ============================================================================

-- ============================================================================
-- TRIGGER: Auto-update report status based on verifications
-- ============================================================================

CREATE OR REPLACE FUNCTION update_report_status_on_verification() RETURNS TRIGGER AS $$
DECLARE
    v_total_verifications INTEGER;
    v_confirmation_ratio NUMERIC;
BEGIN
    -- Only run on INSERT/DELETE of verifications
    IF TG_OP = 'INSERT' THEN
        v_total_verifications := (
            SELECT confirmations_count + denials_count
            FROM reports WHERE id = NEW.report_id
        );
    ELSIF TG_OP = 'DELETE' THEN
        v_total_verifications := (
            SELECT confirmations_count + denials_count
            FROM reports WHERE id = OLD.report_id
        );
    ELSE
        RETURN NEW;
    END IF;

    -- Only auto-transition if we have at least 3 verifications
    IF v_total_verifications >= 3 THEN
        v_confirmation_ratio := (
            SELECT confirmations_count::NUMERIC / (confirmations_count + denials_count)
            FROM reports WHERE id = COALESCE(NEW.report_id, OLD.report_id)
        );

        IF v_confirmation_ratio >= 0.6 THEN
            -- 60%+ confirmations -> move to analysis
            UPDATE reports
            SET status = 'em_analise', status_changed_at = NOW(), updated_at = NOW()
            WHERE id = COALESCE(NEW.report_id, OLD.report_id)
              AND status = 'ativo';
        ELSIF v_confirmation_ratio < 0.4 THEN
            -- Less than 40% confirmations -> reject
            UPDATE reports
            SET status = 'recusado', status_changed_at = NOW(), updated_at = NOW()
            WHERE id = COALESCE(NEW.report_id, OLD.report_id)
              AND status = 'ativo';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_report_status
    AFTER INSERT OR DELETE ON verifications
    FOR EACH ROW
    EXECUTE FUNCTION update_report_status_on_verification();

-- ============================================================================
-- ANTI-FRAUD: Prevent self-verification (already in initial schema)
-- ============================================================================

-- ============================================================================
-- ANTI-FRAUD: Rate limiting helper table (optional, for stricter control)
-- ============================================================================

CREATE TABLE IF NOT EXISTS rate_limit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_rate_limit_log_user_action_time
ON rate_limit_log(user_id, action, created_at DESC);

-- Function to log rate limit events
CREATE OR REPLACE FUNCTION log_rate_limit_event(
    p_user_id UUID,
    p_action VARCHAR,
    p_metadata JSONB DEFAULT '{}'
) RETURNS VOID AS $$
BEGIN
    INSERT INTO rate_limit_log (user_id, action, metadata)
    VALUES (p_user_id, p_action, p_metadata);

    -- Clean old entries (keep last 1000 per user/action)
    DELETE FROM rate_limit_log
    WHERE user_id = p_user_id
      AND action = p_action
      AND id NOT IN (
        SELECT id FROM rate_limit_log
        WHERE user_id = p_user_id AND action = p_action
        ORDER BY created_at DESC
        LIMIT 1000
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ANTI-FRAUD: Suspicious activity detection
-- ============================================================================

CREATE TABLE IF NOT EXISTS fraud_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_fraud_alerts_user_status ON fraud_alerts(user_id, status);
CREATE INDEX idx_fraud_alerts_type ON fraud_alerts(alert_type);

-- Function to detect and create fraud alerts
CREATE OR REPLACE FUNCTION detect_suspicious_activity(
    p_user_id UUID,
    p_action VARCHAR,
    p_metadata JSONB DEFAULT '{}'
) RETURNS VOID AS $$
DECLARE
    v_recent_reports INTEGER;
    v_recent_verifications INTEGER;
    v_same_location_reports INTEGER;
BEGIN
    -- Check for rapid report creation (more than 5 in 10 minutes)
    IF p_action = 'report_created' THEN
        SELECT COUNT(*) INTO v_recent_reports
        FROM reports
        WHERE creator_id = p_user_id
          AND created_at > NOW() - INTERVAL '10 minutes';

        IF v_recent_reports > 5 THEN
            INSERT INTO fraud_alerts (user_id, alert_type, severity, description, metadata)
            VALUES (p_user_id, 'rapid_reporting', 'medium',
                    'User created ' || v_recent_reports || ' reports in 10 minutes', p_metadata);
        END IF;

        -- Check for reports at same location
        SELECT COUNT(*) INTO v_same_location_reports
        FROM reports r1
        WHERE r1.creator_id = p_user_id
          AND EXISTS (
            SELECT 1 FROM reports r2
            WHERE r2.creator_id = p_user_id
              AND r2.id != r1.id
              AND ST_Distance(r1.location::geography, r2.location::geography) < 10
          );

        IF v_same_location_reports > 3 THEN
            INSERT INTO fraud_alerts (user_id, alert_type, severity, description, metadata)
            VALUES (p_user_id, 'duplicate_location', 'high',
                    'User reported multiple issues at nearly identical locations', p_metadata);
        END IF;
    END IF;

    -- Check for rapid verifications
    IF p_action = 'verification' THEN
        SELECT COUNT(*) INTO v_recent_verifications
        FROM verifications
        WHERE verifier_id = p_user_id
          AND created_at > NOW() - INTERVAL '5 minutes';

        IF v_recent_verifications > 10 THEN
            INSERT INTO fraud_alerts (user_id, alert_type, severity, description, metadata)
            VALUES (p_user_id, 'rapid_verification', 'medium',
                    'User performed ' || v_recent_verifications || ' verifications in 5 minutes', p_metadata);
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to detect suspicious activity after report/verification
CREATE OR REPLACE FUNCTION trigger_detect_suspicious_activity() RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'reports' AND TG_OP = 'INSERT' THEN
        PERFORM detect_suspicious_activity(NEW.creator_id, 'report_created',
            jsonb_build_object('report_id', NEW.id));
    ELSIF TG_TABLE_NAME = 'verifications' AND TG_OP = 'INSERT' THEN
        PERFORM detect_suspicious_activity(NEW.verifier_id, 'verification',
            jsonb_build_object('verification_id', NEW.id, 'report_id', NEW.report_id));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_suspicious_activity_reports
    AFTER INSERT ON reports
    FOR EACH ROW
    EXECUTE FUNCTION trigger_detect_suspicious_activity();

CREATE TRIGGER trigger_suspicious_activity_verifications
    AFTER INSERT ON verifications
    FOR EACH ROW
    EXECUTE FUNCTION trigger_detect_suspicious_activity();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION increment_user_score TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_and_award_achievements TO service_role;
GRANT EXECUTE ON FUNCTION check_achievement_requirement TO service_role;
GRANT EXECUTE ON FUNCTION log_rate_limit_event TO service_role;
GRANT EXECUTE ON FUNCTION detect_suspicious_activity TO service_role;