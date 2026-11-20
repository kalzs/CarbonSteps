/*
 * KONTRAK INTEGRASI DIVANA / MUTHIA — sesuai migration 10_category_save_rpcs.sql.
 * Kedua kalkulator menyimpan detail ke satu carbon_calculations berstatus draft.
 * Kalkulator pertama menyimpan kategorinya; kalkulator kedua menyimpan kategorinya
 * lalu memfinalisasi setelah kedua kategori memiliki minimal satu activity log.
 *
 * Muat calculator-workflow.js pada kedua halaman. Contoh pemanggilan:
 */

async function saveTransportationForCurrentSession(user, year, month, transportRows, calculationIdFromUrl = null) {
  const calc = await CSCalc.getOrCreateDraft(user, year, month, calculationIdFromUrl);
  const payload = transportRows.map(row => ({
    emission_factor_id: row.emission_factor_id,
    round_trip_distance_km: row.round_trip_distance_km,
    travel_days_per_month: row.travel_days_per_month,
    passenger_count: row.passenger_count || 1,
    notes: row.notes || null
  }));
  await CSCalc.saveTransport(calc.id, payload);
  CSCalc.setActiveDraft(user, year, month, calc.id);
  const complete = await CSCalc.finalizeIfBothCategories(calc.id, user, year, month);
  return { calculationId: calc.id, completed: complete };
}

async function saveElectricityForCurrentSession(user, year, month, electricityRows, calculationIdFromUrl = null) {
  const calc = await CSCalc.getOrCreateDraft(user, year, month, calculationIdFromUrl);
  const payload = electricityRows.map(row => ({
    device_type_id: row.device_type_id || null,
    custom_device_name: row.custom_device_name || null,
    emission_factor_id: row.emission_factor_id,
    power_watt: row.power_watt,
    hours_per_day: row.hours_per_day,
    days_per_month: row.days_per_month,
    notes: row.notes || null
  }));
  await CSCalc.saveElectricity(calc.id, payload);
  CSCalc.setActiveDraft(user, year, month, calc.id);
  const complete = await CSCalc.finalizeIfBothCategories(calc.id, user, year, month);
  return { calculationId: calc.id, completed: complete };
}

/*
 * Catatan untuk integrasi:
 * - Setiap baris transport = satu moda, dengan jarak PP per hari dan jumlah hari/bulan.
 * - Jika UI mencatat frekuensi mingguan, normalisasi ke hari/bulan secara eksplisit
 *   sebelum memanggil RPC; jangan mengalikan jarak PP dengan dua lagi.
 * - Setiap baris listrik = satu perangkat.
 * - Jangan mengirim factor_value_used / factor_unit_used / factor_basis_used; trigger DB
 *   mengambil snapshot dari emission_factors dan menghitung generated columns.
 * - Jangan memanggil finalize sendiri sebelum kedua kategori tersimpan. Helper di atas
 *   memeriksa kedua tabel log sebelum finalisasi.
 */
