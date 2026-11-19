-- CarbonSteps - Supabase / PostgreSQL schema
-- Version: proposed MVP schema aligned with Project Akhir SIB (1).pdf
-- Run in Supabase SQL Editor on a NEW project/schema, or adapt carefully if tables already exist.
-- Authentication credentials are managed by Supabase Auth (auth.users); do NOT create/store password_hash.

-- -----------------------------------------------------------------------------
-- 1. PROFILE: one profile row for each Supabase Auth user
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name           text NOT NULL DEFAULT '',
    nim                 text UNIQUE,
    study_program       text,
    faculty             text,
    campus              text,
    avatar_path         text,
    theme_preference    text NOT NULL DEFAULT 'dark'
                        CHECK (theme_preference IN ('dark', 'light')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. LOOKUP / MASTER DATA
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transport_modes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL UNIQUE,
    mode_group      text NOT NULL
                    CHECK (mode_group IN ('private', 'public', 'active')),
    fuel_type       text,
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.device_types (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                text NOT NULL UNIQUE,
    device_category     text,
    default_power_watt  numeric(8,2) CHECK (default_power_watt IS NULL OR default_power_watt >= 0),
    is_active           boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- Keep old factor rows immutable in normal operation. When a factor changes,
-- INSERT a new row with a new validity period instead of overwriting an old one.
CREATE TABLE IF NOT EXISTS public.emission_factors (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code                text NOT NULL UNIQUE,
    name                text NOT NULL,
    category            text NOT NULL CHECK (category IN ('transport', 'electricity')),
    transport_mode_id   uuid REFERENCES public.transport_modes(id) ON DELETE RESTRICT,
    unit                text NOT NULL
                        CHECK (unit IN ('kgCO2e/passenger-km', 'kgCO2e/vehicle-km', 'kgCO2e/kWh')),
    factor_basis        text NOT NULL
                        CHECK (factor_basis IN ('passenger_km', 'vehicle_km', 'kwh')),
    factor_value        numeric(14,6) NOT NULL CHECK (factor_value >= 0),
    region              text, -- e.g. national / grid region; nullable when source is not region-specific
    source_name         text NOT NULL,
    source_url          text,
    source_year         smallint CHECK (source_year IS NULL OR source_year BETWEEN 1900 AND 2200),
    effective_from      date NOT NULL,
    effective_to        date,
    is_active           boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT emission_factor_validity_ck
        CHECK (effective_to IS NULL OR effective_to >= effective_from),
    CONSTRAINT emission_factor_category_unit_ck CHECK (
        (category = 'transport' AND transport_mode_id IS NOT NULL AND
            ((factor_basis = 'passenger_km' AND unit = 'kgCO2e/passenger-km') OR
             (factor_basis = 'vehicle_km' AND unit = 'kgCO2e/vehicle-km')))
        OR
        (category = 'electricity' AND transport_mode_id IS NULL AND
            factor_basis = 'kwh' AND unit = 'kgCO2e/kWh')
    )
);

CREATE INDEX IF NOT EXISTS idx_emission_factors_category_active
    ON public.emission_factors(category, is_active, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_emission_factors_mode
    ON public.emission_factors(transport_mode_id);

-- -----------------------------------------------------------------------------
-- 3. CALCULATION HEADER / HISTORY
-- One row = one saved calculation run. Multiple runs in the same month are allowed.
-- A scenario is a calculation row linked to its baseline calculation.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.carbon_calculations (
    id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    period_year                     smallint NOT NULL CHECK (period_year BETWEEN 2000 AND 2200),
    period_month                    smallint NOT NULL CHECK (period_month BETWEEN 1 AND 12),
    calculation_type                text NOT NULL DEFAULT 'baseline'
                                    CHECK (calculation_type IN ('baseline', 'scenario')),
    parent_calculation_id           uuid,
    scenario_name                   text,
    transport_emission_kg_co2e      numeric(14,4) NOT NULL DEFAULT 0
                                    CHECK (transport_emission_kg_co2e >= 0),
    electricity_emission_kg_co2e    numeric(14,4) NOT NULL DEFAULT 0
                                    CHECK (electricity_emission_kg_co2e >= 0),
    total_emission_kg_co2e          numeric(14,4)
        GENERATED ALWAYS AS (transport_emission_kg_co2e + electricity_emission_kg_co2e) STORED,
    dominant_category               text
        GENERATED ALWAYS AS (
            CASE
                WHEN transport_emission_kg_co2e = 0 AND electricity_emission_kg_co2e = 0 THEN 'none'
                WHEN transport_emission_kg_co2e > electricity_emission_kg_co2e THEN 'transport'
                WHEN electricity_emission_kg_co2e > transport_emission_kg_co2e THEN 'electricity'
                ELSE 'equal'
            END
        ) STORED,
    notes                           text,
    calculated_at                   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT carbon_calculations_id_user_uk UNIQUE (id, user_id),
    CONSTRAINT carbon_calculations_scenario_ck CHECK (
        (calculation_type = 'baseline' AND parent_calculation_id IS NULL AND scenario_name IS NULL)
        OR
        (calculation_type = 'scenario' AND parent_calculation_id IS NOT NULL
             AND scenario_name IS NOT NULL AND length(btrim(scenario_name)) > 0)
    ),
    CONSTRAINT carbon_calculations_parent_same_user_fk
        FOREIGN KEY (parent_calculation_id, user_id)
        REFERENCES public.carbon_calculations(id, user_id) ON DELETE CASCADE,
    CONSTRAINT carbon_calculations_not_own_parent_ck
        CHECK (parent_calculation_id IS NULL OR parent_calculation_id <> id)
);

CREATE INDEX IF NOT EXISTS idx_carbon_calculations_user_history
    ON public.carbon_calculations(user_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_carbon_calculations_period
    ON public.carbon_calculations(user_id, period_year DESC, period_month DESC);
CREATE INDEX IF NOT EXISTS idx_carbon_calculations_parent
    ON public.carbon_calculations(parent_calculation_id);

-- -----------------------------------------------------------------------------
-- 4. ACTIVITY DETAIL TABLES
-- Input distance follows the UI: ROUND-TRIP distance per campus day. Do NOT multiply by 2 again.
-- The selected emission factor and its unit/basis are snapshotted for reproducibility.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transport_logs (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_id          uuid NOT NULL REFERENCES public.carbon_calculations(id) ON DELETE CASCADE,
    emission_factor_id      uuid NOT NULL REFERENCES public.emission_factors(id) ON DELETE RESTRICT,
    round_trip_distance_km     numeric(9,2) NOT NULL CHECK (round_trip_distance_km > 0),
    travel_days_per_month   smallint NOT NULL CHECK (travel_days_per_month BETWEEN 1 AND 31),
    passenger_count         smallint NOT NULL DEFAULT 1 CHECK (passenger_count >= 1),
    factor_basis_used       text NOT NULL CHECK (factor_basis_used IN ('passenger_km', 'vehicle_km')),
    factor_value_used       numeric(14,6) NOT NULL CHECK (factor_value_used >= 0),
    factor_unit_used        text NOT NULL
                            CHECK (factor_unit_used IN ('kgCO2e/passenger-km', 'kgCO2e/vehicle-km')),
    emission_kg_co2e       numeric(14,4)
        GENERATED ALWAYS AS (
            round(
                CASE
                    WHEN factor_basis_used = 'passenger_km'
                        THEN round_trip_distance_km * travel_days_per_month * factor_value_used
                    ELSE round_trip_distance_km * travel_days_per_month * factor_value_used / passenger_count
                END,
                4
            )
        ) STORED,
    notes                   text,
    created_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT transport_factor_snapshot_ck CHECK (
        (factor_basis_used = 'passenger_km' AND factor_unit_used = 'kgCO2e/passenger-km')
        OR
        (factor_basis_used = 'vehicle_km' AND factor_unit_used = 'kgCO2e/vehicle-km')
    )
);

CREATE TABLE IF NOT EXISTS public.electricity_logs (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    calculation_id          uuid NOT NULL REFERENCES public.carbon_calculations(id) ON DELETE CASCADE,
    device_type_id          uuid REFERENCES public.device_types(id) ON DELETE SET NULL,
    custom_device_name      text,
    emission_factor_id      uuid NOT NULL REFERENCES public.emission_factors(id) ON DELETE RESTRICT,
    power_watt              numeric(9,2) NOT NULL CHECK (power_watt > 0),
    hours_per_day           numeric(5,2) NOT NULL CHECK (hours_per_day > 0 AND hours_per_day <= 24),
    days_per_month          smallint NOT NULL CHECK (days_per_month BETWEEN 1 AND 31),
    factor_value_used       numeric(14,6) NOT NULL CHECK (factor_value_used >= 0),
    factor_unit_used        text NOT NULL DEFAULT 'kgCO2e/kWh'
                            CHECK (factor_unit_used = 'kgCO2e/kWh'),
    energy_kwh              numeric(14,6)
        GENERATED ALWAYS AS ((power_watt * hours_per_day * days_per_month) / 1000) STORED,
    emission_kg_co2e        numeric(14,4)
        GENERATED ALWAYS AS (round(((power_watt * hours_per_day * days_per_month) / 1000) * factor_value_used, 4)) STORED,
    notes                   text,
    created_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT electricity_device_label_ck CHECK (
        device_type_id IS NOT NULL OR (custom_device_name IS NOT NULL AND length(btrim(custom_device_name)) > 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_transport_logs_calculation
    ON public.transport_logs(calculation_id);
CREATE INDEX IF NOT EXISTS idx_electricity_logs_calculation
    ON public.electricity_logs(calculation_id);

-- -----------------------------------------------------------------------------
-- 5. RECOMMENDATIONS MASTER + RECOMMENDATIONS SHOWN FOR A CALCULATION
-- The app chooses the category based on dominant_category. No AI is implied.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recommendations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code            text NOT NULL UNIQUE,
    category        text NOT NULL CHECK (category IN ('transport', 'electricity', 'general')),
    title           text NOT NULL,
    advice          text NOT NULL,
    priority        smallint NOT NULL DEFAULT 1 CHECK (priority >= 1),
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.calculation_recommendations (
    calculation_id      uuid NOT NULL REFERENCES public.carbon_calculations(id) ON DELETE CASCADE,
    recommendation_id   uuid NOT NULL REFERENCES public.recommendations(id) ON DELETE RESTRICT,
    reason_category     text NOT NULL CHECK (reason_category IN ('transport', 'electricity', 'equal', 'general')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (calculation_id, recommendation_id)
);

-- -----------------------------------------------------------------------------
-- 6. INTEGRITY HELPERS / TRIGGERS
-- Factors are copied from the selected master record when an activity log is created.
-- This avoids old calculations changing when a factor catalog is revised later.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''))
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_carbonsteps ON auth.users;
CREATE TRIGGER on_auth_user_created_carbonsteps
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.reset_new_calculation_totals()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Totals are recalculated from child activity rows by database triggers.
    NEW.transport_emission_kg_co2e := 0;
    NEW.electricity_emission_kg_co2e := 0;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reset_new_calculation_totals
BEFORE INSERT ON public.carbon_calculations
FOR EACH ROW EXECUTE FUNCTION public.reset_new_calculation_totals();

CREATE OR REPLACE FUNCTION public.validate_scenario_parent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_parent_type text;
BEGIN
    IF NEW.calculation_type = 'scenario' THEN
        SELECT calculation_type INTO v_parent_type
        FROM public.carbon_calculations
        WHERE id = NEW.parent_calculation_id AND user_id = NEW.user_id;
        IF v_parent_type IS DISTINCT FROM 'baseline' THEN
            RAISE EXCEPTION 'A scenario must reference a baseline calculation owned by the same user.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_scenario_parent
BEFORE INSERT OR UPDATE OF calculation_type, parent_calculation_id, user_id
ON public.carbon_calculations
FOR EACH ROW EXECUTE FUNCTION public.validate_scenario_parent();

CREATE OR REPLACE FUNCTION public.validate_and_snapshot_transport_factor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_category text;
    v_basis text;
    v_value numeric(14,6);
    v_unit text;
    v_period_date date;
BEGIN
    SELECT make_date(period_year, period_month, 1) INTO v_period_date
    FROM public.carbon_calculations WHERE id = NEW.calculation_id;

    SELECT category, factor_basis, factor_value, unit
    INTO v_category, v_basis, v_value, v_unit
    FROM public.emission_factors
    WHERE id = NEW.emission_factor_id AND is_active = true
      AND effective_from <= v_period_date
      AND (effective_to IS NULL OR effective_to >= v_period_date);

    IF NOT FOUND OR v_category <> 'transport' THEN
        RAISE EXCEPTION 'Selected factor is not an active, currently valid transport factor.';
    END IF;

    NEW.factor_basis_used := v_basis;
    NEW.factor_value_used := v_value;
    NEW.factor_unit_used := v_unit;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transport_factor_snapshot
BEFORE INSERT ON public.transport_logs
FOR EACH ROW EXECUTE FUNCTION public.validate_and_snapshot_transport_factor();

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

    IF NOT FOUND OR v_category <> 'electricity' OR v_unit <> 'kgCO2e/kWh' THEN
        RAISE EXCEPTION 'Selected factor is not an active, currently valid electricity factor.';
    END IF;

    NEW.factor_value_used := v_value;
    NEW.factor_unit_used := v_unit;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_electricity_factor_snapshot
BEFORE INSERT ON public.electricity_logs
FOR EACH ROW EXECUTE FUNCTION public.validate_and_snapshot_electricity_factor();

-- Keep calculation header totals in sync with the detailed activity rows.
CREATE OR REPLACE FUNCTION public.refresh_carbon_calculation_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_calculation_id uuid;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_calculation_id := OLD.calculation_id;
    ELSE
        v_calculation_id := NEW.calculation_id;
    END IF;

    UPDATE public.carbon_calculations c
    SET transport_emission_kg_co2e = COALESCE((
            SELECT SUM(t.emission_kg_co2e)
            FROM public.transport_logs t
            WHERE t.calculation_id = v_calculation_id
        ), 0),
        electricity_emission_kg_co2e = COALESCE((
            SELECT SUM(e.emission_kg_co2e)
            FROM public.electricity_logs e
            WHERE e.calculation_id = v_calculation_id
        ), 0)
    WHERE c.id = v_calculation_id;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transport_logs_refresh_totals
AFTER INSERT OR DELETE ON public.transport_logs
FOR EACH ROW EXECUTE FUNCTION public.refresh_carbon_calculation_totals();

CREATE TRIGGER trg_electricity_logs_refresh_totals
AFTER INSERT OR DELETE ON public.electricity_logs
FOR EACH ROW EXECUTE FUNCTION public.refresh_carbon_calculation_totals();

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_recommendations_updated_at
BEFORE UPDATE ON public.recommendations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS)
-- Each student can only read/write their own profile and calculation data.
-- Lookup tables are read-only for normal authenticated users.
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emission_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carbon_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.electricity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculation_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS transport_modes_read_active ON public.transport_modes;
CREATE POLICY transport_modes_read_active ON public.transport_modes
FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS device_types_read_active ON public.device_types;
CREATE POLICY device_types_read_active ON public.device_types
FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS emission_factors_read_active ON public.emission_factors;
CREATE POLICY emission_factors_read_active ON public.emission_factors
FOR SELECT TO authenticated USING (is_active = true);
DROP POLICY IF EXISTS recommendations_read_active ON public.recommendations;
CREATE POLICY recommendations_read_active ON public.recommendations
FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS calculations_select_own ON public.carbon_calculations;
CREATE POLICY calculations_select_own ON public.carbon_calculations
FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS calculations_insert_own ON public.carbon_calculations;
CREATE POLICY calculations_insert_own ON public.carbon_calculations
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS calculations_delete_own ON public.carbon_calculations;
CREATE POLICY calculations_delete_own ON public.carbon_calculations
FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS transport_logs_select_own ON public.transport_logs;
CREATE POLICY transport_logs_select_own ON public.transport_logs
FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.carbon_calculations c
            WHERE c.id = calculation_id AND c.user_id = auth.uid())
);
DROP POLICY IF EXISTS transport_logs_insert_own ON public.transport_logs;
CREATE POLICY transport_logs_insert_own ON public.transport_logs
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.carbon_calculations c
            WHERE c.id = calculation_id AND c.user_id = auth.uid())
);
DROP POLICY IF EXISTS transport_logs_delete_own ON public.transport_logs;
CREATE POLICY transport_logs_delete_own ON public.transport_logs
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.carbon_calculations c
            WHERE c.id = calculation_id AND c.user_id = auth.uid())
);

DROP POLICY IF EXISTS electricity_logs_select_own ON public.electricity_logs;
CREATE POLICY electricity_logs_select_own ON public.electricity_logs
FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.carbon_calculations c
            WHERE c.id = calculation_id AND c.user_id = auth.uid())
);
DROP POLICY IF EXISTS electricity_logs_insert_own ON public.electricity_logs;
CREATE POLICY electricity_logs_insert_own ON public.electricity_logs
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.carbon_calculations c
            WHERE c.id = calculation_id AND c.user_id = auth.uid())
);
DROP POLICY IF EXISTS electricity_logs_delete_own ON public.electricity_logs;
CREATE POLICY electricity_logs_delete_own ON public.electricity_logs
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.carbon_calculations c
            WHERE c.id = calculation_id AND c.user_id = auth.uid())
);

DROP POLICY IF EXISTS calculation_recommendations_select_own ON public.calculation_recommendations;
CREATE POLICY calculation_recommendations_select_own ON public.calculation_recommendations
FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.carbon_calculations c
            WHERE c.id = calculation_id AND c.user_id = auth.uid())
);
DROP POLICY IF EXISTS calculation_recommendations_insert_own ON public.calculation_recommendations;
CREATE POLICY calculation_recommendations_insert_own ON public.calculation_recommendations
FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.carbon_calculations c
            WHERE c.id = calculation_id AND c.user_id = auth.uid())
);
DROP POLICY IF EXISTS calculation_recommendations_delete_own ON public.calculation_recommendations;
CREATE POLICY calculation_recommendations_delete_own ON public.calculation_recommendations
FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.carbon_calculations c
            WHERE c.id = calculation_id AND c.user_id = auth.uid())
);

-- Privileges complement RLS; RLS alone does not grant table access.
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.transport_modes, public.device_types,
                public.emission_factors, public.recommendations TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.carbon_calculations,
                public.transport_logs, public.electricity_logs,
                public.calculation_recommendations TO authenticated;

-- IMPORTANT:
-- 1) Do not expose the Supabase service_role key in browser JavaScript.
-- 2) Keep emission-factor and recommendation master data admin-managed.
-- 3) Populate transport_modes, device_types, emission_factors, and recommendations
--    with source-verified values before treating calculations as meaningful.
-- 4) For each new run: insert carbon_calculations first, then the selected transport_logs
--    and electricity_logs, then calculation_recommendations. Header totals update by trigger.
-- 5) This script is a proposed schema; test it in a Supabase development project before production.
