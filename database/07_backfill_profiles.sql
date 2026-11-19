-- Optional safe backfill for Auth accounts that existed before the profile trigger was installed.
-- Existing profile records are not overwritten.
INSERT INTO public.profiles (id, full_name)
SELECT u.id, COALESCE(u.raw_user_meta_data ->> 'full_name', '')
FROM auth.users AS u
ON CONFLICT (id) DO NOTHING;
