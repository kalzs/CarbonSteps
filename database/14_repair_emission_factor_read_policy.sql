-- Jalankan HANYA jika diagnosis menunjukkan policy/privilege SELECT faktor emisi
-- tidak tersedia. Tidak menonaktifkan RLS dan tidak membuka akses untuk anon.

ALTER TABLE public.emission_factors ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON TABLE public.emission_factors TO authenticated;

DROP POLICY IF EXISTS emission_factors_read_active ON public.emission_factors;
CREATE POLICY emission_factors_read_active
ON public.emission_factors
FOR SELECT
TO authenticated
USING (is_active = TRUE);

-- Verifikasi policy setelah dijalankan.
SELECT policyname, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'emission_factors';
