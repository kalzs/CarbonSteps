(function () {
  const SELECT_CALC = [
    "id", "user_id", "period_year", "period_month", "calculation_type",
    "parent_calculation_id", "scenario_name", "transport_emission_kg_co2e",
    "electricity_emission_kg_co2e", "total_emission_kg_co2e",
    "dominant_category", "calculated_at", "notes", "status"
  ].join(", ");

  function explainError(error) {
    if (/column .*status.* does not exist|status.*schema cache/i.test(error?.message || "")) {
      return new Error("Kolom status belum tersedia. Jalankan database/08_calculation_status_workflow.sql setelah skema utama.");
    }
    return error;
  }

  async function loadCalculation(user, calculationId = null) {
    if (!user?.id) throw new Error("Sesi pengguna tidak ditemukan.");
    let query = window.csSupabase.from("carbon_calculations")
      .select(SELECT_CALC)
      .eq("user_id", user.id)
      .eq("status", "completed");

    if (calculationId) {
      query = query.eq("id", calculationId);
    } else {
      query = query.eq("calculation_type", "baseline")
        .order("calculated_at", { ascending: false })
        .limit(1);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw explainError(error);
    return data || null;
  }

  async function loadHistory(user, limit = 500) {
    if (!user?.id) throw new Error("Sesi pengguna tidak ditemukan.");
    const { data, error } = await window.csSupabase.from("carbon_calculations")
      .select(SELECT_CALC)
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("calculated_at", { ascending: false })
      .limit(limit);
    if (error) throw explainError(error);
    return data || [];
  }

  async function loadActivityLogs(calculationId) {
    const [transportResult, electricityResult] = await Promise.all([
      window.csSupabase.from("transport_logs")
        .select("id, round_trip_distance_km, travel_days_per_month, passenger_count, factor_basis_used, factor_value_used, factor_unit_used, emission_kg_co2e, notes, emission_factors(name, unit, region, source_name, source_year, transport_mode_id, transport_modes(name))")
        .eq("calculation_id", calculationId),
      window.csSupabase.from("electricity_logs")
        .select("id, custom_device_name, power_watt, hours_per_day, days_per_month, energy_kwh, factor_value_used, factor_unit_used, emission_kg_co2e, notes, device_types(name), emission_factors(name, unit, region, source_name, source_year)")
        .eq("calculation_id", calculationId)
    ]);
    if (transportResult.error) throw transportResult.error;
    if (electricityResult.error) throw electricityResult.error;
    return { transport: transportResult.data || [], electricity: electricityResult.data || [] };
  }

  async function loadRecommendationCatalog(dominantCategory) {
    const categories = dominantCategory === "transport"
      ? ["transport", "general"]
      : dominantCategory === "electricity"
        ? ["electricity", "general"]
        : dominantCategory === "equal"
          ? ["transport", "electricity", "general"]
          : ["general"];

    const { data, error } = await window.csSupabase.from("recommendations")
      .select("id, code, category, title, advice, priority, is_active")
      .in("category", categories)
      .eq("is_active", true)
      .order("priority", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  window.CSData = { loadCalculation, loadHistory, loadActivityLogs, loadRecommendationCatalog };
})();
