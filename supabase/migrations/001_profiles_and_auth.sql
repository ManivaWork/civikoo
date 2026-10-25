-- 001: profiles table + auth integration
-- Single source of truth for user identity, XP, coins, streak
-- ============================================================================

-- Ensure PostGIS extension (needed by later migrations)
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create profiles table from scratch (no dependency on archived migration)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  avatar_url text,
  level int NOT NULL DEFAULT 1,
  xp bigint NOT NULL DEFAULT 0,
  coins int NOT NULL DEFAULT 0,
  total_score bigint NOT NULL DEFAULT 0,
  streak_count int NOT NULL DEFAULT 0,
  best_streak int NOT NULL DEFAULT 0,
  last_active_date date,
  banned boolean NOT NULL DEFAULT false,
  ban_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure all columns exist (idempotent for existing databases)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='streak_count') THEN
    ALTER TABLE public.profiles ADD COLUMN streak_count int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='best_streak') THEN
    ALTER TABLE public.profiles ADD COLUMN best_streak int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='last_active_date') THEN
    ALTER TABLE public.profiles ADD COLUMN last_active_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='total_score') THEN
    ALTER TABLE public.profiles ADD COLUMN total_score bigint NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='username') THEN
    ALTER TABLE public.profiles ADD COLUMN username text UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='level') THEN
    ALTER TABLE public.profiles ADD COLUMN level int NOT NULL DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='xp') THEN
    ALTER TABLE public.profiles ADD COLUMN xp bigint NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='coins') THEN
    ALTER TABLE public.profiles ADD COLUMN coins int NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='banned') THEN
    ALTER TABLE public.profiles ADD COLUMN banned boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='ban_reason') THEN
    ALTER TABLE public.profiles ADD COLUMN ban_reason text;
  END IF;
END $$;

-- Ensure primary key and FK to auth.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='profiles' AND constraint_type='PRIMARY KEY'
  ) THEN
    ALTER TABLE public.profiles ADD PRIMARY KEY (id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='profiles' AND constraint_name='profiles_id_fkey'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Trigger function: create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url, level, xp, coins, total_score, streak_count, best_streak, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    NEW.raw_user_meta_data->>'avatar_url',
    1, 0, 0, 0, 0, 0,
    now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Public profile info for leaderboards, report cards, etc.
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public" ON public.profiles
  FOR SELECT USING (true);

-- Function to get current user's profile (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.profiles WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_profile TO anon, authenticated;

COMMENT ON TABLE public.profiles IS 'Perfil do usuário: XP, moedas, nível, streak. id = auth.uid().';
COMMENT ON FUNCTION public.handle_new_user IS 'Trigger function: cria perfil ao cadastrar usuário em auth.users.';