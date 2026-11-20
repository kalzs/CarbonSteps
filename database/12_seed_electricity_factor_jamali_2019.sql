-- LEGACY: untuk database sebelum v6. Setelah menjalankan migration 16, gunakan unit kgCO2/kWh; jangan jalankan ulang file ini.
-- CarbonSteps: Faktor emisi listrik sistem interkoneksi Jawa-Madura-Bali (JAMALI)
-- Nilai yang digunakan dalam laporan: 0.87 kgCO2e/kWh.
-- Suffix kode EF-ELEC-JAMALI-2019 dipertahankan sebagai kode legacy agar record
-- yang sudah ada tidak terduplikasi; source_year merekam tahun keputusan (2021).
-- Rujukan hukum: Kepmen ESDM No. 163.K/HK.02/MEM.S/2021,
-- ditetapkan 30 Agustus 2021. source_year mencatat tahun dokumen hukum (2021).
-- URL metadata resmi JDIH: https://jdih.esdm.go.id/dokumen/view?id=2183
--
-- Skrip idempoten: mempertahankan ID existing agar foreign key pada electricity_logs
-- tidak putus, dan tidak mengubah snapshot faktor yang sudah dipakai pada log lama.

DO $$
DECLARE
    v_existing public.emission_factors%ROWTYPE;
BEGIN
    SELECT *
      INTO v_existing
      FROM public.emission_factors
     WHERE code = 'EF-ELEC-JAMALI-2019'
     FOR UPDATE;

    IF NOT FOUND THEN
        INSERT INTO public.emission_factors (
            code, name, category, transport_mode_id, unit, factor_basis,
            factor_value, region, source_name, source_url, source_year,
            effective_from, effective_to, is_active
        ) VALUES (
            'EF-ELEC-JAMALI-2019',
            'Faktor Emisi Grid JAMALI (Kepmen ESDM No. 163.K/HK.02/MEM.S/2021)',
            'electricity',
            NULL,
            'kgCO2e/kWh',
            'kwh',
            0.87,
            'Jawa-Madura-Bali',
            'Kementerian ESDM',
            'https://jdih.esdm.go.id/dokumen/view?id=2183',
            2021,
            DATE '2021-08-30',
            NULL,
            TRUE
        );
        RAISE NOTICE 'Faktor listrik JAMALI 0.87 kgCO2e/kWh berhasil ditambahkan.';
    ELSE
        IF v_existing.category <> 'electricity'
           OR v_existing.transport_mode_id IS NOT NULL
           OR v_existing.unit <> 'kgCO2e/kWh'
           OR v_existing.factor_basis <> 'kwh'
           OR v_existing.factor_value <> 0.87
           OR COALESCE(v_existing.region, '') <> 'Jawa-Madura-Bali' THEN
            RAISE EXCEPTION 'Code EF-ELEC-JAMALI-2019 sudah digunakan oleh record yang tidak cocok. Periksa record secara manual; tidak ada data yang diubah.';
        END IF;

        UPDATE public.emission_factors
           SET name = 'Faktor Emisi Grid JAMALI (Kepmen ESDM No. 163.K/HK.02/MEM.S/2021)',
               source_name = 'Kementerian ESDM',
               source_url = 'https://jdih.esdm.go.id/dokumen/view?id=2183',
               source_year = 2021,
               effective_from = DATE '2021-08-30',
               effective_to = NULL,
               is_active = TRUE
         WHERE id = v_existing.id;
        RAISE NOTICE 'Metadata faktor existing diperbarui tanpa mengganti ID atau snapshot log.';
    END IF;
END $$;

-- Verifikasi record faktor.
SELECT
    id, code, name, category, factor_value, unit, factor_basis, region,
    source_name, source_url, source_year, effective_from, effective_to, is_active
FROM public.emission_factors
WHERE code = 'EF-ELEC-JAMALI-2019';

-- Verifikasi faktor tersedia untuk periode contoh November 2026.
SELECT
    id, name, factor_value, unit, region, source_name, source_year,
    effective_from, effective_to
FROM public.emission_factors
WHERE category = 'electricity'
  AND factor_basis = 'kwh'
  AND unit = 'kgCO2e/kWh'
  AND is_active = TRUE
  AND effective_from <= DATE '2026-11-01'
  AND (effective_to IS NULL OR effective_to >= DATE '2026-11-01');
