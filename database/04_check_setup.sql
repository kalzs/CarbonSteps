-- Read-only checks. Run in Supabase SQL Editor to inspect the current project.

-- 1) Confirm expected application tables exist.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles','transport_modes','device_types','emission_factors',
    'carbon_calculations','transport_logs','electricity_logs',
    'recommendations','calculation_recommendations'
  )
ORDER BY table_name;

-- 2) Check RLS status on the application tables.
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles','transport_modes','device_types','emission_factors',
    'carbon_calculations','transport_logs','electricity_logs',
    'recommendations','calculation_recommendations'
  )
ORDER BY tablename;

-- 3) Check whether master data has been populated.
SELECT 'transport_modes' AS table_name, COUNT(*) AS row_count FROM public.transport_modes
UNION ALL SELECT 'device_types', COUNT(*) FROM public.device_types
UNION ALL SELECT 'emission_factors', COUNT(*) FROM public.emission_factors
UNION ALL SELECT 'recommendations', COUNT(*) FROM public.recommendations;

-- 4) Check active emission factors and their source/units. Review values before use.
SELECT code, category, name, factor_value, unit, region, source_name, source_year,
       effective_from, effective_to, is_active
FROM public.emission_factors
ORDER BY category, name, effective_from DESC;
