-- CarbonSteps v6: faktor emisi transportasi dan penyelarasan satuan CO2.
-- Jalankan pada Supabase setelah schema utama (00) dan workflow/RPC (08/10).
-- Aman dijalankan ulang: kode faktor stabil, ID faktor yang sudah ada dipertahankan.
-- Tidak menghapus transport_logs/electricity_logs dan tidak menghitung ulang histori.
--
-- Catatan satuan:
-- WRI Indonesia EMISI (2020) Table 2 menyatakan faktor bahan bakar sebagai kg CO2/liter.
-- Lampiran Kepmen ESDM 163.K/HK.02/MEM.S/2021 menyatakan faktor grid dalam ton CO2/MWh.
-- Karena itu faktor baru menggunakan kgCO2, bukan kgCO2e. Nama kolom legacy *_co2e
-- dipertahankan agar aplikasi lama dan relasi database tidak rusak.

BEGIN;

-- 1. Perluas unit check agar mendukung CO2 dan tetap membaca snapshot/data CO2e lama.
ALTER TABLE public.emission_factors
  DROP CONSTRAINT IF EXISTS emission_factors_unit_check;
ALTER TABLE public.emission_factors
  ADD CONSTRAINT emission_factors_unit_check CHECK (
    unit IN (
      'kgCO2/passenger-km', 'kgCO2/vehicle-km', 'kgCO2/kWh',
      'kgCO2e/passenger-km', 'kgCO2e/vehicle-km', 'kgCO2e/kWh'
    )
  );

ALTER TABLE public.emission_factors
  DROP CONSTRAINT IF EXISTS emission_factor_category_unit_ck;
ALTER TABLE public.emission_factors
  ADD CONSTRAINT emission_factor_category_unit_ck CHECK (
    (category = 'transport' AND transport_mode_id IS NOT NULL AND
      ((factor_basis = 'passenger_km' AND unit IN ('kgCO2/passenger-km','kgCO2e/passenger-km')) OR
       (factor_basis = 'vehicle_km' AND unit IN ('kgCO2/vehicle-km','kgCO2e/vehicle-km'))))
    OR
    (category = 'electricity' AND transport_mode_id IS NULL AND factor_basis = 'kwh'
      AND unit IN ('kgCO2/kWh','kgCO2e/kWh'))
  );

ALTER TABLE public.transport_logs
  DROP CONSTRAINT IF EXISTS transport_logs_factor_unit_used_check;
ALTER TABLE public.transport_logs
  ADD CONSTRAINT transport_logs_factor_unit_used_check CHECK (
    factor_unit_used IN (
      'kgCO2/passenger-km','kgCO2/vehicle-km',
      'kgCO2e/passenger-km','kgCO2e/vehicle-km'
    )
  );

ALTER TABLE public.transport_logs
  DROP CONSTRAINT IF EXISTS transport_factor_snapshot_ck;
ALTER TABLE public.transport_logs
  ADD CONSTRAINT transport_factor_snapshot_ck CHECK (
    (factor_basis_used = 'passenger_km' AND factor_unit_used IN ('kgCO2/passenger-km','kgCO2e/passenger-km'))
    OR
    (factor_basis_used = 'vehicle_km' AND factor_unit_used IN ('kgCO2/vehicle-km','kgCO2e/vehicle-km'))
  );

ALTER TABLE public.electricity_logs
  DROP CONSTRAINT IF EXISTS electricity_logs_factor_unit_used_check;
ALTER TABLE public.electricity_logs
  ADD CONSTRAINT electricity_logs_factor_unit_used_check CHECK (
    factor_unit_used IN ('kgCO2/kWh','kgCO2e/kWh')
  );
ALTER TABLE public.electricity_logs
  ALTER COLUMN factor_unit_used SET DEFAULT 'kgCO2/kWh';

-- The trigger must accept the new CO2 unit and still support old CO2e factor records.
CREATE OR REPLACE FUNCTION public.validate_and_snapshot_electricity_factor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_category text;
    v_value numeric(14,6);
    v_unit text;
    v_period_date date;
BEGIN
    SELECT make_date(period_year, period_month, 1) INTO v_period_date
    FROM public.carbon_calculations WHERE id = NEW.calculation_id;

    SELECT category, factor_value, unit
    INTO v_category, v_value, v_unit
    FROM public.emission_factors
    WHERE id = NEW.emission_factor_id AND is_active = true
      AND effective_from <= v_period_date
      AND (effective_to IS NULL OR effective_to >= v_period_date);

    IF NOT FOUND OR v_category <> 'electricity' OR v_unit NOT IN ('kgCO2/kWh','kgCO2e/kWh') THEN
        RAISE EXCEPTION 'Selected factor is not an active, currently valid electricity factor.';
    END IF;

    NEW.factor_value_used := v_value;
    NEW.factor_unit_used := v_unit;
    RETURN NEW;
END;
$$;

-- 2. Pastikan enam moda yang dipakai UI memang tersedia; jangan membuat duplikat moda.
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(required.name, ', ' ORDER BY required.name)
    INTO v_missing
  FROM (VALUES
    ('Berjalan Kaki'), ('Sepeda'), ('Mobil Pribadi'),
    ('Sepeda Motor'), ('Bus / Angkutan Umum'), ('KRL / MRT')
  ) AS required(name)
  LEFT JOIN public.transport_modes tm ON tm.name = required.name AND tm.is_active = true
  WHERE tm.id IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Moda transportasi aktif berikut belum ada di public.transport_modes: %. Jalankan seed master choices atau aktifkan nama moda yang sesuai terlebih dahulu.', v_missing;
  END IF;
END $$;

-- 3. Benahi faktor listrik JAMALI yang menjadi dasar konsumsi listrik KRL/MRT.
-- Kepmen ESDM Table Lampiran memakai satuan ton CO2/MWh; 0,87 setara 0,87 kg CO2/kWh.
INSERT INTO public.emission_factors (
  code, name, category, transport_mode_id, unit, factor_basis,
  factor_value, region, source_name, source_url, source_year,
  effective_from, effective_to, is_active
)
VALUES (
  'EF-ELEC-JAMALI-2019',
  'Faktor emisi listrik grid JAMALI (Kepmen ESDM 163.K/HK.02/MEM.S/2021)',
  'electricity', NULL, 'kgCO2/kWh', 'kwh', 0.87,
  'Jawa-Madura-Bali',
  'Kementerian ESDM — Kepmen 163.K/HK.02/MEM.S/2021; faktor grid JAMALI 0,87 ton CO2/MWh',
  'https://jdih.esdm.go.id/dokumen/view?id=2183', 2021,
  DATE '2021-08-30', NULL, TRUE
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  transport_mode_id = EXCLUDED.transport_mode_id,
  unit = EXCLUDED.unit,
  factor_basis = EXCLUDED.factor_basis,
  factor_value = EXCLUDED.factor_value,
  region = EXCLUDED.region,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  source_year = EXCLUDED.source_year,
  effective_from = EXCLUDED.effective_from,
  effective_to = EXCLUDED.effective_to,
  is_active = EXCLUDED.is_active;

-- 4. Faktor transportasi.
-- WRI EMISI (2020): Table 1 (efisiensi energi), Table 2 (faktor CO2 bahan bakar),
-- bagian asumsi load factor 70%/kapasitas penumpang, dan faktor urban rail.
-- Faktor per penumpang-km diturunkan dengan membagi faktor per kendaraan-km
-- oleh kapasitas efektif penumpang sesuai asumsi WRI.
WITH seed AS (
  SELECT * FROM (VALUES
    ('EF-TR-WALK-DIRECT-V1', 'Berjalan kaki — emisi operasional langsung', 'Berjalan Kaki',
      'kgCO2/passenger-km', 'passenger_km', 0.000000::numeric, NULL::text,
      'Asumsi batas sistem CarbonSteps: tidak ada emisi CO2 langsung dari penggunaan moda; tidak mencakup metabolisme maupun emisi daur hidup.',
      NULL::text, NULL::smallint, DATE '2020-10-06'),
    ('EF-TR-BICYCLE-DIRECT-V1', 'Sepeda — emisi operasional langsung', 'Sepeda',
      'kgCO2/passenger-km', 'passenger_km', 0.000000::numeric, NULL::text,
      'Asumsi batas sistem CarbonSteps: tidak ada emisi CO2 langsung dari penggunaan moda; tidak mencakup produksi dan emisi daur hidup sepeda.',
      NULL::text, NULL::smallint, DATE '2020-10-06'),
    ('EF-TR-MOTOR-PETROL-RON92-WRI2020', 'Sepeda motor bensin RON 92 (28 km/liter)', 'Sepeda Motor',
      'kgCO2/vehicle-km', 'vehicle_km', 0.085357::numeric, 'Indonesia (asumsi WRI EMISI)',
      'WRI Indonesia EMISI (2020), Table 1 dan Table 2; 2,39 kg CO2/liter dibagi 28 km/liter.',
      'https://wri-indonesia.org/sites/default/files/TN_Indonesia%20Zero%20Emissions%20Application%20%28EMISI%29_1.pdf', 2020, DATE '2020-10-06'),
    ('EF-TR-CAR-PETROL-RON92-WRI2020', 'Mobil bensin RON 92 (9,8 km/liter)', 'Mobil Pribadi',
      'kgCO2/vehicle-km', 'vehicle_km', 0.243878::numeric, 'Indonesia (asumsi WRI EMISI)',
      'WRI Indonesia EMISI (2020), Table 1 dan Table 2; 2,39 kg CO2/liter dibagi 9,8 km/liter.',
      'https://wri-indonesia.org/sites/default/files/TN_Indonesia%20Zero%20Emissions%20Application%20%28EMISI%29_1.pdf', 2020, DATE '2020-10-06'),
    ('EF-TR-CAR-DIESEL-WRI2020', 'Mobil diesel (10,3 km/liter)', 'Mobil Pribadi',
      'kgCO2/vehicle-km', 'vehicle_km', 0.260194::numeric, 'Indonesia (asumsi WRI EMISI)',
      'WRI Indonesia EMISI (2020), Table 1 dan Table 2; 2,68 kg CO2/liter dibagi 10,3 km/liter.',
      'https://wri-indonesia.org/sites/default/files/TN_Indonesia%20Zero%20Emissions%20Application%20%28EMISI%29_1.pdf', 2020, DATE '2020-10-06'),
    ('EF-TR-PARATRANSIT-PETROL-WRI2020', 'Angkutan umum kecil / paratransit bensin (7,5 km/liter; 14 orang; okupansi 70%)', 'Bus / Angkutan Umum',
      'kgCO2/passenger-km', 'passenger_km', 0.032517::numeric, 'Indonesia (asumsi WRI EMISI)',
      'WRI Indonesia EMISI (2020), Table 1 dan Table 2 serta asumsi kapasitas paratransit 14 orang dan load factor 70%; faktor hasil turunan.',
      'https://wri-indonesia.org/sites/default/files/TN_Indonesia%20Zero%20Emissions%20Application%20%28EMISI%29_1.pdf', 2020, DATE '2020-10-06'),
    ('EF-TR-MEDIUM-BUS-DIESEL-WRI2020', 'Bus sedang diesel (4,0 km/liter; 73 orang; okupansi 70%)', 'Bus / Angkutan Umum',
      'kgCO2/passenger-km', 'passenger_km', 0.013112::numeric, 'Indonesia (asumsi WRI EMISI)',
      'WRI Indonesia EMISI (2020), Table 1 dan Table 2 serta asumsi kapasitas bus 73 orang dan load factor 70%; faktor hasil turunan.',
      'https://wri-indonesia.org/sites/default/files/TN_Indonesia%20Zero%20Emissions%20Application%20%28EMISI%29_1.pdf', 2020, DATE '2020-10-06'),
    ('EF-TR-BIG-BUS-DIESEL-WRI2020', 'Bus besar diesel (3,5 km/liter; 73 orang; okupansi 70%)', 'Bus / Angkutan Umum',
      'kgCO2/passenger-km', 'passenger_km', 0.014985::numeric, 'Indonesia (asumsi WRI EMISI)',
      'WRI Indonesia EMISI (2020), Table 1 dan Table 2 serta asumsi kapasitas bus 73 orang dan load factor 70%; faktor hasil turunan.',
      'https://wri-indonesia.org/sites/default/files/TN_Indonesia%20Zero%20Emissions%20Application%20%28EMISI%29_1.pdf', 2020, DATE '2020-10-06'),
    ('EF-TR-URBAN-RAIL-8CAR-WRI2020-JAMALI2021', 'Kereta urban listrik 8 gerbong (asumsi 250 orang/gerbong; okupansi 70%)', 'KRL / MRT',
      'kgCO2/passenger-km', 'passenger_km', 0.019121::numeric, 'Jawa-Madura-Bali',
      'Faktor turunan: WRI Indonesia EMISI (2020), Table 1 (0,0325 km/kWh; 8 gerbong; kapasitas 250 orang/gerbong; okupansi 70%) + Kepmen ESDM 163.K/HK.02/MEM.S/2021 (0,87 kg CO2/kWh).',
      'https://jdih.esdm.go.id/dokumen/view?id=2183', 2021, DATE '2021-08-30'),
    ('EF-TR-URBAN-RAIL-6CAR-WRI2020-JAMALI2021', 'Kereta urban listrik 6 gerbong (asumsi 250 orang/gerbong; okupansi 70%)', 'KRL / MRT',
      'kgCO2/passenger-km', 'passenger_km', 0.019136::numeric, 'Jawa-Madura-Bali',
      'Faktor turunan: WRI Indonesia EMISI (2020), Table 1 (0,0433 km/kWh; 6 gerbong; asumsi 250 orang/gerbong; okupansi 70%) + Kepmen ESDM 163.K/HK.02/MEM.S/2021 (0,87 kg CO2/kWh). Kapasitas 250 orang/gerbong diterapkan sebagai asumsi turunan.',
      'https://jdih.esdm.go.id/dokumen/view?id=2183', 2021, DATE '2021-08-30')
  ) AS v(code, name, mode_name, unit, factor_basis, factor_value, region,
        source_name, source_url, source_year, effective_from)
), resolved AS (
  SELECT s.*, tm.id AS transport_mode_id
  FROM seed s
  JOIN public.transport_modes tm ON tm.name = s.mode_name AND tm.is_active = TRUE
)
INSERT INTO public.emission_factors (
  code, name, category, transport_mode_id, unit, factor_basis, factor_value,
  region, source_name, source_url, source_year, effective_from, effective_to, is_active
)
SELECT code, name, 'transport', transport_mode_id, unit, factor_basis, factor_value,
       region, source_name, source_url, source_year, effective_from, NULL, TRUE
FROM resolved
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  transport_mode_id = EXCLUDED.transport_mode_id,
  unit = EXCLUDED.unit,
  factor_basis = EXCLUDED.factor_basis,
  factor_value = EXCLUDED.factor_value,
  region = EXCLUDED.region,
  source_name = EXCLUDED.source_name,
  source_url = EXCLUDED.source_url,
  source_year = EXCLUDED.source_year,
  effective_from = EXCLUDED.effective_from,
  effective_to = EXCLUDED.effective_to,
  is_active = EXCLUDED.is_active;

COMMIT;

-- 5. Verifikasi hasil seed: seharusnya menampilkan 10 faktor transportasi dan 1 faktor listrik JAMALI.
SELECT
  tm.name AS moda_transportasi,
  tm.mode_group,
  ef.code,
  ef.name AS pilihan_faktor,
  ef.factor_value,
  ef.unit,
  ef.factor_basis,
  ef.region,
  ef.source_name,
  ef.source_year,
  ef.effective_from,
  ef.is_active
FROM public.emission_factors ef
JOIN public.transport_modes tm ON tm.id = ef.transport_mode_id
WHERE ef.category = 'transport'
  AND ef.is_active = TRUE
ORDER BY tm.mode_group, tm.name, ef.name;

SELECT code, factor_value, unit, region, source_name, source_year, effective_from, is_active
FROM public.emission_factors
WHERE code = 'EF-ELEC-JAMALI-2019';
