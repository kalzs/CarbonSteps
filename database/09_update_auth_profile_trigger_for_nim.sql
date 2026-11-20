-- Jalankan satu kali di Supabase SQL Editor SETELAH schema utama CarbonSteps.
-- Tujuan: menyimpan metadata full_name dan nim dari form registrasi ke public.profiles.
-- Tidak membuat tabel baru dan tidak mengubah layout/frontend.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, nim)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
        NULLIF(NEW.raw_user_meta_data ->> 'nim', '')
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Pastikan nama fungsi trigger tetap merujuk ke function di atas.
-- Jika trigger on_auth_user_created_carbonsteps dari schema utama sudah ada,
-- tidak perlu membuat trigger baru.


-- Backfill NIM for accounts created before this trigger update.
-- Skip values that are already used by another profile to preserve the UNIQUE constraint.
UPDATE public.profiles AS p
SET nim = NULLIF(u.raw_user_meta_data ->> 'nim', '')
FROM auth.users AS u
WHERE p.id = u.id
  AND p.nim IS NULL
  AND NULLIF(u.raw_user_meta_data ->> 'nim', '') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM public.profiles AS other
      WHERE other.nim = NULLIF(u.raw_user_meta_data ->> 'nim', '')
        AND other.id <> p.id
  );
