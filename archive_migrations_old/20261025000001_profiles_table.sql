-- 02: profiles table + auto-create trigger on auth.users

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL UNIQUE,
  xp int NOT NULL DEFAULT 0,
  coins int NOT NULL DEFAULT 0,
  level int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_profiles_xp_desc ON public.profiles (xp DESC);

-- Function to generate unique username from email
CREATE OR REPLACE FUNCTION public.generate_username_from_email(p_email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  base text;
  candidate text;
  suffix int := 1;
BEGIN
  -- Take part before @, lowercase, alphanum + underscore only
  base := regexp_replace(split_part(p_email, '@', 1), '[^a-zA-Z0-9_]', '', 'g');
  base := lower(base);
  IF length(base) < 3 THEN
    base := base || 'user';
  END IF;
  IF length(base) > 20 THEN
    base := left(base, 20);
  END IF;

  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    suffix := suffix + 1;
    candidate := base || '_' || suffix;
    IF length(candidate) > 20 THEN
      candidate := left(base, 20 - length(suffix::text) - 1) || '_' || suffix;
    END IF;
  END LOOP;

  RETURN candidate;
END;
$$;

-- Trigger on auth.users to auto-create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, public.generate_username_from_email(NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON TABLE public.profiles IS 'Perfil do jogador: XP, moedas, nível, username único.';
COMMENT ON COLUMN public.profiles.username IS 'Único, 3-20 chars alfanuméricos/underscore. Gerado do e-mail no cadastro, editável depois.';