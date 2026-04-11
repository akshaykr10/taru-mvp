-- ============================================================
-- Taru MVP — Auth Trigger Migration
-- Auto-creates a parents row whenever Supabase Auth creates a user.
-- Run this AFTER 001_initial_schema.sql.
-- ============================================================

-- Function: fires on auth.users INSERT
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER           -- runs as postgres, not the calling user
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.parents (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    -- Use display name from signup metadata if provided, else derive from email
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
      SPLIT_PART(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;  -- idempotent: safe to re-run
  RETURN NEW;
END;
$$;

-- Trigger: runs after every new Supabase Auth user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user();
