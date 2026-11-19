-- OPTIONAL BUT RECOMMENDED: atomic save function for the shared team workflow.
-- Run this AFTER the original schema and database/08_calculation_status_workflow.sql.
-- One RPC creates one carbon_calculations parent and all its child activity rows
-- in a single database transaction. If any child insert fails, the whole operation rolls back.

CREATE OR REPLACE FUNCTION public.save_carbon_calculation(
    p_period_year smallint,
    p_period_month smallint,
    p_transport_logs jsonb DEFAULT '[]'::jsonb,
    p_electricity_logs jsonb DEFAULT '[]'::jsonb,
    p_calculation_type text DEFAULT 'baseline',
    p_parent_calculation_id uuid DEFAULT NULL,
    p_scenario_name text DEFAULT NULL,
    p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid;
    v_calculation_id uuid;
    v_item jsonb;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF jsonb_typeof(COALESCE(p_transport_logs, '[]'::jsonb)) <> 'array'
       OR jsonb_typeof(COALESCE(p_electricity_logs, '[]'::jsonb)) <> 'array' THEN
        RAISE EXCEPTION 'Activity payloads must be JSON arrays.';
    END IF;

    IF jsonb_array_length(COALESCE(p_transport_logs, '[]'::jsonb)) = 0
       AND jsonb_array_length(COALESCE(p_electricity_logs, '[]'::jsonb)) = 0 THEN
        RAISE EXCEPTION 'At least one transport or electricity activity is required.';
    END IF;

    INSERT INTO public.carbon_calculations (
        user_id, period_year, period_month, calculation_type,
        parent_calculation_id, scenario_name, notes
    )
    VALUES (
        v_user_id, p_period_year, p_period_month, p_calculation_type,
        p_parent_calculation_id, p_scenario_name, p_notes
    )
    RETURNING id INTO v_calculation_id;

    FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_transport_logs, '[]'::jsonb))
    LOOP
        INSERT INTO public.transport_logs (
            calculation_id,
            emission_factor_id,
            round_trip_distance_km,
            travel_days_per_month,
            passenger_count,
            notes
        )
        VALUES (
            v_calculation_id,
            (v_item ->> 'emission_factor_id')::uuid,
            (v_item ->> 'round_trip_distance_km')::numeric,
            (v_item ->> 'travel_days_per_month')::smallint,
            COALESCE(NULLIF(v_item ->> 'passenger_count', '')::smallint, 1),
            NULLIF(v_item ->> 'notes', '')
        );
    END LOOP;

    FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_electricity_logs, '[]'::jsonb))
    LOOP
        INSERT INTO public.electricity_logs (
            calculation_id,
            device_type_id,
            custom_device_name,
            emission_factor_id,
            power_watt,
            hours_per_day,
            days_per_month,
            notes
        )
        VALUES (
            v_calculation_id,
            NULLIF(v_item ->> 'device_type_id', '')::uuid,
            NULLIF(v_item ->> 'custom_device_name', ''),
            (v_item ->> 'emission_factor_id')::uuid,
            (v_item ->> 'power_watt')::numeric,
            (v_item ->> 'hours_per_day')::numeric,
            (v_item ->> 'days_per_month')::smallint,
            NULLIF(v_item ->> 'notes', '')
        );
    END LOOP;

    -- Existing triggers snapshot factors and refresh totals. Finalization makes the row visible
    -- to Hasil/Riwayat/Rekomendasi only after at least one activity has been stored.
    PERFORM public.finalize_carbon_calculation(v_calculation_id);
    RETURN v_calculation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_carbon_calculation(
    smallint, smallint, jsonb, jsonb, text, uuid, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_carbon_calculation(
    smallint, smallint, jsonb, jsonb, text, uuid, text, text
) TO authenticated;
