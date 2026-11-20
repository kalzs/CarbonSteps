-- CarbonSteps category-specific save functions.
-- Run AFTER 00_existing_schema_reference.sql and 08_calculation_status_workflow.sql.
-- SECURITY INVOKER means the caller's RLS policies remain active.

CREATE OR REPLACE FUNCTION public.save_transport_activity_logs(
    p_calculation_id uuid,
    p_logs jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_owner_id uuid;
    v_status text;
    v_item jsonb;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
    IF p_logs IS NULL OR jsonb_typeof(p_logs) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Transport activities must be a JSON array.';
    END IF;
    IF jsonb_array_length(p_logs) < 1 THEN
        RAISE EXCEPTION 'At least one transport activity is required.';
    END IF;

    SELECT user_id, status INTO v_owner_id, v_status
    FROM public.carbon_calculations WHERE id = p_calculation_id;
    IF NOT FOUND OR v_owner_id <> v_user_id THEN RAISE EXCEPTION 'Calculation not found or access denied.'; END IF;
    IF v_status <> 'draft' THEN RAISE EXCEPTION 'Only draft calculations can be edited.'; END IF;

    DELETE FROM public.transport_logs WHERE calculation_id = p_calculation_id;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_logs)
    LOOP
        INSERT INTO public.transport_logs (
            calculation_id, emission_factor_id, round_trip_distance_km,
            travel_days_per_month, passenger_count, notes
        ) VALUES (
            p_calculation_id,
            (v_item ->> 'emission_factor_id')::uuid,
            (v_item ->> 'round_trip_distance_km')::numeric,
            (v_item ->> 'travel_days_per_month')::smallint,
            COALESCE(NULLIF(v_item ->> 'passenger_count','')::smallint,1),
            NULLIF(v_item ->> 'notes','')
        );
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_electricity_activity_logs(
    p_calculation_id uuid,
    p_logs jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_owner_id uuid;
    v_status text;
    v_item jsonb;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
    IF p_logs IS NULL OR jsonb_typeof(p_logs) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Electricity activities must be a JSON array.';
    END IF;
    IF jsonb_array_length(p_logs) < 1 THEN
        RAISE EXCEPTION 'At least one electricity activity is required.';
    END IF;

    SELECT user_id, status INTO v_owner_id, v_status
    FROM public.carbon_calculations WHERE id = p_calculation_id;
    IF NOT FOUND OR v_owner_id <> v_user_id THEN RAISE EXCEPTION 'Calculation not found or access denied.'; END IF;
    IF v_status <> 'draft' THEN RAISE EXCEPTION 'Only draft calculations can be edited.'; END IF;

    DELETE FROM public.electricity_logs WHERE calculation_id = p_calculation_id;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_logs)
    LOOP
        INSERT INTO public.electricity_logs (
            calculation_id, device_type_id, custom_device_name, emission_factor_id,
            power_watt, hours_per_day, days_per_month, notes
        ) VALUES (
            p_calculation_id,
            NULLIF(v_item ->> 'device_type_id','')::uuid,
            NULLIF(v_item ->> 'custom_device_name',''),
            (v_item ->> 'emission_factor_id')::uuid,
            (v_item ->> 'power_watt')::numeric,
            (v_item ->> 'hours_per_day')::numeric,
            (v_item ->> 'days_per_month')::smallint,
            NULLIF(v_item ->> 'notes','')
        );
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.save_transport_activity_logs(uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_electricity_activity_logs(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_transport_activity_logs(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_electricity_activity_logs(uuid,jsonb) TO authenticated;

-- Require both categories before a baseline/scenario becomes visible as completed.
CREATE OR REPLACE FUNCTION public.finalize_carbon_calculation(p_calculation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_owner_id uuid;
    v_status text;
    v_has_transport boolean;
    v_has_electricity boolean;
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required.'; END IF;
    SELECT c.user_id, c.status INTO v_owner_id, v_status
    FROM public.carbon_calculations AS c WHERE c.id = p_calculation_id;
    IF NOT FOUND OR v_owner_id <> v_user_id THEN RAISE EXCEPTION 'Calculation not found or access denied.'; END IF;
    IF v_status = 'completed' THEN RETURN; END IF;

    SELECT EXISTS(SELECT 1 FROM public.transport_logs WHERE calculation_id=p_calculation_id),
           EXISTS(SELECT 1 FROM public.electricity_logs WHERE calculation_id=p_calculation_id)
    INTO v_has_transport, v_has_electricity;
    IF NOT v_has_transport THEN RAISE EXCEPTION 'Transport activity is required before finalizing.'; END IF;
    IF NOT v_has_electricity THEN RAISE EXCEPTION 'Electricity activity is required before finalizing.'; END IF;

    UPDATE public.carbon_calculations
    SET status='completed'
    WHERE id=p_calculation_id AND user_id=v_user_id AND status='draft';
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_carbon_calculation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_carbon_calculation(uuid) TO authenticated;
