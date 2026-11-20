-- CarbonSteps v7: bersihkan faktor transportasi aktif yang ter-seed dua kali.
-- Penyebab umum: database pernah menjalankan seed TR_* (paket perbaikan awal)
-- dan seed EF-TR-* (migration v6). Keduanya mewakili opsi numerik yang sama.
-- Record yang sudah dipakai oleh transport_logs TIDAK dinonaktifkan agar relasi
-- riwayat dan pembacaan metadata lama tetap terjaga. UI v7 akan menyembunyikan
-- opsi duplikat dan memilih record EF-TR-* sebagai opsi kanonis.

BEGIN;

-- 1) Nonaktifkan kode alias dari seed lama jika tidak direferensikan log.
UPDATE public.emission_factors ef
SET is_active = FALSE
WHERE ef.category = 'transport'
  AND ef.is_active = TRUE
  AND ef.code IN (
    'TR_WALKING_DIRECT_CO2',
    'TR_BICYCLE_DIRECT_CO2',
    'TR_MOTORCYCLE_GASOLINE_RON92_WRI2020',
    'TR_CAR_GASOLINE_RON92_WRI2020',
    'TR_CAR_DIESEL_WRI2020',
    'TR_PARATRANSIT_GASOLINE_WRI2020',
    'TR_MEDIUM_BUS_DIESEL_WRI2020',
    'TR_BIG_BUS_DIESEL_WRI2020',
    'TR_URBAN_RAIL_8_CARS_JAMALI_2021',
    'TR_URBAN_RAIL_6_CARS_JAMALI_2021'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.transport_logs tl
    WHERE tl.emission_factor_id = ef.id
  );

-- 2) Tangani duplikat identik lain yang mungkin masuk dengan kode berbeda.
-- Pengelompokan memakai moda, basis, nilai, unit, tahun, dan masa berlaku.
-- EF-TR-* diprioritaskan sebagai kode kanonis v6. Record yang sudah dipakai
-- dalam transport_logs tetap aktif demi menjaga histori dan relasi RLS.
WITH ranked AS (
  SELECT
    ef.id,
    ROW_NUMBER() OVER (
      PARTITION BY
        ef.transport_mode_id,
        ef.factor_basis,
        ef.factor_value,
        ef.unit,
        ef.source_year,
        ef.effective_from,
        ef.effective_to
      ORDER BY
        CASE WHEN ef.code LIKE 'EF-TR-%' THEN 0 ELSE 1 END,
        ef.created_at ASC,
        ef.code ASC,
        ef.id ASC
    ) AS row_num
  FROM public.emission_factors ef
  WHERE ef.category = 'transport'
    AND ef.is_active = TRUE
)
UPDATE public.emission_factors ef
SET is_active = FALSE
FROM ranked r
WHERE ef.id = r.id
  AND r.row_num > 1
  AND NOT EXISTS (
    SELECT 1 FROM public.transport_logs tl
    WHERE tl.emission_factor_id = ef.id
  );

COMMIT;

-- 3) Verifikasi: hasil normalnya 10 opsi unik, tersebar pada 6 moda.
-- Jika jumlah active row masih lebih dari 10, periksa apakah record tambahan
-- tersebut sudah direferensikan oleh transport_logs (sengaja dipertahankan).
SELECT
  tm.name AS moda_transportasi,
  ef.code,
  ef.name AS pilihan_faktor,
  ef.factor_value,
  ef.unit,
  ef.factor_basis,
  ef.source_year,
  ef.is_active,
  EXISTS (SELECT 1 FROM public.transport_logs tl WHERE tl.emission_factor_id = ef.id) AS dipakai_riwayat
FROM public.emission_factors ef
JOIN public.transport_modes tm ON tm.id = ef.transport_mode_id
WHERE ef.category = 'transport'
ORDER BY tm.name, ef.is_active DESC, ef.name;

SELECT COUNT(*) FILTER (WHERE is_active) AS total_factor_transport_aktif
FROM public.emission_factors
WHERE category = 'transport';
