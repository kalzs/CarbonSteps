SELECT 'profiles' AS object_name, COUNT(*) AS row_count FROM public.profiles
UNION ALL SELECT 'transport_modes', COUNT(*) FROM public.transport_modes
UNION ALL SELECT 'device_types', COUNT(*) FROM public.device_types
UNION ALL SELECT 'emission_factors_transport', COUNT(*) FROM public.emission_factors WHERE category='transport' AND is_active
UNION ALL SELECT 'emission_factors_electricity', COUNT(*) FROM public.emission_factors WHERE category='electricity' AND is_active
UNION ALL SELECT 'recommendations', COUNT(*) FROM public.recommendations WHERE is_active;

SELECT to_regprocedure('public.save_transport_activity_logs(uuid,jsonb)') AS save_transport_rpc,
       to_regprocedure('public.save_electricity_activity_logs(uuid,jsonb)') AS save_electricity_rpc,
       to_regprocedure('public.finalize_carbon_calculation(uuid)') AS finalize_rpc;

SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname='public'
  AND tablename IN ('profiles','transport_modes','device_types','emission_factors','carbon_calculations','transport_logs','electricity_logs','recommendations','calculation_recommendations')
ORDER BY tablename;
