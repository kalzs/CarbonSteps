-- Required migration for teams that save transport and electricity activities
-- from separate calculator pages but want them in ONE calculation/history row.
-- Run AFTER the original schema, BEFORE using the frontend module and RPC.

ALTER TABLE public.carbon_calculations
    ADD COLUMN IF NOT EXISTS status text;

-- Existing saved calculations are treated as complete.
UPDATE public.carbon_calculations
SET status = 'completed'
WHERE status IS NULL;

ALTER TABLE public.carbon_calculations
    ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE public.carbon_calculations
    ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'carbon_calculations_status_ck'
          AND conrelid = 'public.carbon_calculations'::regclass
    ) THEN
        ALTER TABLE public.carbon_calculations
            ADD CONSTRAINT carbon_calculations_status_ck
            CHECK (status IN ('draft', 'completed'));
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_carbon_calculations_user_status_history
    ON public.carbon_calculations(user_id, status, calculated_at DESC);

-- Finalize is the only operation needed to make a draft visible in user history/results.
-- SECURITY DEFINER is intentionally narrow: it checks auth.uid() and only updates status.
CREATE OR REPLACE FUNCTION public.finalize_carbon_calculation(p_calculation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid;
    v_owner_id uuid;
    v_status text;
    v_has_activity boolean;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT c.user_id, c.status
    INTO v_owner_id, v_status
    FROM public.carbon_calculations AS c
    WHERE c.id = p_calculation_id;

    IF NOT FOUND OR v_owner_id <> v_user_id THEN
        RAISE EXCEPTION 'Calculation not found or access denied.';
    END IF;

    IF v_status = 'completed' THEN
        RETURN;
    END IF;

    SELECT (
        EXISTS (SELECT 1 FROM public.transport_logs t WHERE t.calculation_id = p_calculation_id)
        OR
        EXISTS (SELECT 1 FROM public.electricity_logs e WHERE e.calculation_id = p_calculation_id)
    ) INTO v_has_activity;

    IF NOT v_has_activity THEN
        RAISE EXCEPTION 'Cannot finalize a calculation without activity details.';
    END IF;

    UPDATE public.carbon_calculations
    SET status = 'completed'
    WHERE id = p_calculation_id
      AND user_id = v_user_id
      AND status = 'draft';
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_carbon_calculation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_carbon_calculation(uuid) TO authenticated;
