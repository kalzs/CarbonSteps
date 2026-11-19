/*
 * KONTRAK INTEGRASI UNTUK DIVANA / MUTHIA.
 * Contoh ini menjelaskan cara menyimpan aktivitas dari DUA HALAMAN KALKULATOR
 * ke SATU carbon_calculations yang sama.
 *
 * Prasyarat: jalankan database/08_calculation_status_workflow.sql terlebih dahulu.
 * RLS tetap membatasi data ke auth.uid() yang sedang login.
 */

async function getOrCreateDraftCalculation(periodYear, periodMonth) {
  const { data: authData, error: authError } = await window.csSupabase.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("Mahasiswa harus login terlebih dahulu.");

  const userId = authData.user.id;
  const storageKey = `carbonsteps:draft:${userId}:${periodYear}-${periodMonth}`;
  const cachedId = localStorage.getItem(storageKey);

  // Reuse the shared draft if another calculator page already created it.
  if (cachedId) {
    const { data: cached, error } = await window.csSupabase
      .from("carbon_calculations")
      .select("id, status")
      .eq("id", cachedId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!error && cached?.status === "draft") return cached.id;
    localStorage.removeItem(storageKey);
  }

  // If the browser storage was cleared, reuse the most recent draft for the same period.
  const { data: existing, error: existingError } = await window.csSupabase
    .from("carbon_calculations")
    .select("id")
    .eq("user_id", userId)
    .eq("period_year", periodYear)
    .eq("period_month", periodMonth)
    .eq("calculation_type", "baseline")
    .eq("status", "draft")
    .order("calculated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) {
    localStorage.setItem(storageKey, existing.id);
    return existing.id;
  }

  // Only the FIRST calculator creates the parent. The second calculator reuses its ID.
  const { data: created, error: createError } = await window.csSupabase
    .from("carbon_calculations")
    .insert({
      user_id: userId,
      period_year: periodYear,
      period_month: periodMonth,
      calculation_type: "baseline"
    })
    .select("id")
    .single();
  if (createError) throw createError;

  localStorage.setItem(storageKey, created.id);
  return created.id;
}

async function appendTransportActivities(calculationId, transportLogs) {
  if (!Array.isArray(transportLogs) || transportLogs.length === 0) return;
  const payload = transportLogs.map(item => ({
    calculation_id: calculationId,
    emission_factor_id: item.emission_factor_id,
    round_trip_distance_km: item.round_trip_distance_km,
    travel_days_per_month: item.travel_days_per_month,
    passenger_count: item.passenger_count ?? 1,
    notes: item.notes ?? null
  }));
  const { error } = await window.csSupabase.from("transport_logs").insert(payload);
  if (error) throw error;
}

async function appendElectricityActivities(calculationId, electricityLogs) {
  if (!Array.isArray(electricityLogs) || electricityLogs.length === 0) return;
  const payload = electricityLogs.map(item => ({
    calculation_id: calculationId,
    device_type_id: item.device_type_id ?? null,
    custom_device_name: item.custom_device_name ?? null,
    emission_factor_id: item.emission_factor_id,
    power_watt: item.power_watt,
    hours_per_day: item.hours_per_day,
    days_per_month: item.days_per_month,
    notes: item.notes ?? null
  }));
  const { error } = await window.csSupabase.from("electricity_logs").insert(payload);
  if (error) throw error;
}

async function finalizeCarbonCalculation(calculationId, periodYear, periodMonth) {
  const { error } = await window.csSupabase.rpc("finalize_carbon_calculation", {
    p_calculation_id: calculationId
  });
  if (error) throw error;
  const { data: authData } = await window.csSupabase.auth.getUser();
  if (authData.user) {
    const storageKey = `carbonsteps:draft:${authData.user.id}:${periodYear}-${periodMonth}`;
    localStorage.removeItem(storageKey);
  }
  return calculationId;
}

/*
 * CONTOH ALUR PENGGUNAAN DI HALAMAN KALKULATOR TRANSPORTASI:
 *
 * const calculationId = await getOrCreateDraftCalculation(2026, 11);
 * await appendTransportActivities(calculationId, [
 *   {
 *     emission_factor_id: "UUID_FACTOR_TRANSPORT_VALID",
 *     round_trip_distance_km: 14,
 *     travel_days_per_month: 20,
 *     passenger_count: 1,
 *     notes: "Perjalanan kampus menggunakan sepeda motor"
 *   }
 * ]);
 * // Jangan finalisasi jika pengguna masih akan mengisi kalkulator listrik.
 *
 * CONTOH ALUR DI HALAMAN KALKULATOR LISTRIK:
 *
 * const calculationId = await getOrCreateDraftCalculation(2026, 11);
 * await appendElectricityActivities(calculationId, [
 *   {
 *     device_type_id: "UUID_DEVICE_LAPTOP",
 *     custom_device_name: null,
 *     emission_factor_id: "UUID_FACTOR_ELECTRICITY_VALID",
 *     power_watt: 65,
 *     hours_per_day: 8,
 *     days_per_month: 22,
 *     notes: "Pemakaian laptop untuk kegiatan akademik"
 *   }
 * ]);
 *
 * SETELAH PENGGUNA SELESAI MENGISI KEDUA KATEGORI:
 *
 * await finalizeCarbonCalculation(calculationId, 2026, 11);
 * window.location.href = `../pages/hasil.html?calculation_id=${calculationId}`;
 *
 * CATATAN PENTING:
 * - Transportasi dan listrik harus menggunakan calculationId yang SAMA.
 * - Satu activity log = satu moda atau satu perangkat.
 * - Jarak transport pada schema saat ini adalah jarak pulang-pergi (PP).
 * - Faktor harus aktif, berlaku pada periode itu, dan memiliki kategori/unit yang tepat.
 * - Jangan mengirim factor_value_used/unit/basis; trigger database mengisi snapshot tersebut.
 * - Jangan finalisasi sebelum input aktivitas yang memang diperlukan selesai disimpan.
 * - Helper ini contoh kontrak; integrasikan fungsi sesuai struktur kode halaman Divana/Muthia.
 */
