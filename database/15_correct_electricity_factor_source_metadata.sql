-- LEGACY: migration metadata sebelum v6. Migration 16 memperbarui satuan faktor JAMALI ke kgCO2/kWh.
-- Migration CarbonSteps: koreksi metadata faktor listrik JAMALI 0.87.
-- Jalankan SETELAH migration skema/faktor sebelumnya.
-- Aman untuk record yang sudah dipakai electricity_logs: ID tidak diganti.
-- Snapshot factor_value_used pada log historis tidak dihitung ulang atau diubah.

BEGIN;

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
            'electricity', NULL, 'kgCO2e/kWh', 'kwh', 0.87,
            'Jawa-Madura-Bali',
            'Kementerian ESDM',
            'https://jdih.esdm.go.id/dokumen/view?id=2183',
            2021, DATE '2021-08-30', NULL, TRUE
        );
    ELSE
        IF v_existing.category <> 'electricity'
           OR v_existing.transport_mode_id IS NOT NULL
           OR v_existing.unit <> 'kgCO2e/kWh'
           OR v_existing.factor_basis <> 'kwh'
           OR v_existing.factor_value <> 0.87
           OR COALESCE(v_existing.region, '') <> 'Jawa-Madura-Bali' THEN
            RAISE EXCEPTION 'Record EF-ELEC-JAMALI-2019 tidak cocok dengan faktor listrik JAMALI 0.87; migration dibatalkan agar data yang berbeda tidak tertimpa.';
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
    END IF;
END $$;

COMMIT;

-- Verifikasi setelah commit.
SELECT id, code, category, factor_value, unit, factor_basis, region,
       source_name, source_url, source_year, effective_from, effective_to, is_active
FROM public.emission_factors
WHERE code = 'EF-ELEC-JAMALI-2019';
