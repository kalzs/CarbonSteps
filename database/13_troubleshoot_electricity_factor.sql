-- CarbonSteps: diagnosis faktor emisi listrik tidak tampil di browser.
-- Jalankan di Supabase SQL Editor. Ganti v_period sesuai bulan yang dipilih
-- pada halaman Kalkulator Listrik.

-- 1) Pastikan record faktor memang ada dan lihat status/tanggal/sumber resminya.
SELECT
  id, code, name, category, factor_value, unit, factor_basis, region,
  source_name, source_url, source_year, effective_from, effective_to, is_active
FROM public.emission_factors
WHERE code = 'EF-ELEC-JAMALI-2019';

-- 2) Periksa apakah faktor cocok untuk periode aktivitas.
-- Contoh November 2026. Ganti tanggal ini bila periode pada form berbeda.
WITH settings AS (
  SELECT DATE '2026-11-01' AS v_period
)
SELECT
  ef.id, ef.code, ef.name, ef.factor_value, ef.unit, ef.region,
  ef.effective_from, ef.effective_to, ef.is_active,
  (ef.category = 'electricity') AS category_ok,
  (ef.unit IN ('kgCO2/kWh','kgCO2e/kWh')) AS unit_ok,
  (ef.factor_basis = 'kwh') AS basis_ok,
  (ef.is_active = TRUE) AS active_ok,
  (ef.effective_from <= settings.v_period) AS started_ok,
  (ef.effective_to IS NULL OR ef.effective_to >= settings.v_period) AS not_expired_ok,
  (
    ef.category = 'electricity'
    AND ef.unit IN ('kgCO2/kWh','kgCO2e/kWh')
    AND ef.factor_basis = 'kwh'
    AND ef.is_active = TRUE
    AND ef.effective_from <= settings.v_period
    AND (ef.effective_to IS NULL OR ef.effective_to >= settings.v_period)
  ) AS should_appear_in_calculator
FROM public.emission_factors ef
CROSS JOIN settings
WHERE ef.category = 'electricity'
ORDER BY ef.effective_from DESC;

-- 3) Periksa apakah RLS aktif pada tabel faktor emisi.
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'emission_factors';

-- 4) Periksa policy SELECT yang tersedia untuk faktor emisi.
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'emission_factors'
ORDER BY policyname;

-- 5) Periksa privilege SELECT untuk role authenticated.
SELECT
  has_table_privilege('authenticated', 'public.emission_factors', 'SELECT')
    AS authenticated_can_select_emission_factors;

-- Catatan interpretasi:
-- - Jika query (1) tidak mengembalikan baris: jalankan 12_seed_electricity_factor_jamali_2019.sql.
-- - Jika record lama masih memakai effective_from 2026-01-01/source_url NULL,
--   jalankan migration 15_correct_electricity_factor_source_metadata.sql.
-- - Metadata hukum: Kepmen ESDM No. 163.K/HK.02/MEM.S/2021 (30-08-2021).
-- - Jika should_appear_in_calculator = false: periksa kategori, unit, basis,
--   is_active, effective_from, dan effective_to.
-- - Jika data cocok tetapi website tidak menampilkan: periksa sesi login,
--   policy RLS SELECT, privilege, API schema exposure, dan error Console/Network.
