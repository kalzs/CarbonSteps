(async function () {
  const state = { user: null, records: [], filtered: [], page: 0, pageSize: 10, selectedId: null, chart: null };
  const $ = CS.$;

  function alertError(message) { CS.showAlert("pageAlert", message, "error"); }

  function getPeriodKey(row) {
    return `${row.period_year}-${String(row.period_month).padStart(2, "0")}`;
  }

  function populateYearFilter(records) {
    const select = $("#yearFilter");
    if (!select) return;
    const years = [...new Set(records.map(row => row.period_year))].sort((a, b) => b - a);
    select.innerHTML = '<option value="all">Semua tahun</option>' + years.map(year => `<option value="${Number(year)}">${Number(year)}</option>`).join("");
  }

  function calculateStats(records) {
    const baseline = records.filter(row => row.calculation_type === "baseline");
    const totals = baseline.map(row => Number(row.total_emission_kg_co2e)).filter(Number.isFinite);
    const average = totals.length ? totals.reduce((sum, value) => sum + value, 0) / totals.length : null;
    const lowest = baseline.reduce((best, row) => {
      const value = Number(row.total_emission_kg_co2e);
      if (!Number.isFinite(value)) return best;
      return !best || value < Number(best.total_emission_kg_co2e) ? row : best;
    }, null);

    CS.setText("totalCalculations", String(records.length));
    CS.setText("averageEmission", average === null ? "— kg CO₂e" : `${CS.formatNumber(average, 1)} kg CO₂e`);
    CS.setText("lowestEmission", lowest ? `${CS.formatNumber(lowest.total_emission_kg_co2e, 1)} kg CO₂e` : "— kg CO₂e");
    CS.setText("lowestDate", lowest ? `${CS.formatPeriod(lowest.period_month, lowest.period_year)}` : "Belum ada baseline");

    const latestByMonth = new Map();
    baseline.forEach(row => {
      const key = getPeriodKey(row);
      const current = latestByMonth.get(key);
      if (!current || new Date(row.calculated_at) > new Date(current.calculated_at)) latestByMonth.set(key, row);
    });
    const trendRows = [...latestByMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-2);
    let trendText = "—";
    let trendCaption = "Belum cukup data baseline untuk membandingkan tren.";
    if (trendRows.length === 2) {
      const before = Number(trendRows[0][1].total_emission_kg_co2e);
      const after = Number(trendRows[1][1].total_emission_kg_co2e);
      if (before > 0) {
        const change = ((after - before) / before) * 100;
        trendText = `${change > 0 ? "+" : ""}${CS.formatNumber(change, 1)}%`;
        trendCaption = `${change <= 0 ? "Turun" : "Naik"} dibanding ${CS.formatPeriod(trendRows[0][1].period_month, trendRows[0][1].period_year)}`;
      }
    }
    CS.setText("emissionTrend", trendText);
    CS.setText("trendCaption", trendCaption);
    renderTrendChart([...latestByMonth.values()].sort((a, b) => getPeriodKey(a).localeCompare(getPeriodKey(b))).slice(-6));
  }

  function renderTrendChart(rows) {
    const canvas = $("#historyTrendChart");
    if (!canvas || !window.Chart) return;
    if (state.chart) state.chart.destroy();
    state.chart = new Chart(canvas, {
      type: "line",
      data: {
        labels: rows.map(row => CS.formatPeriod(row.period_month, row.period_year)),
        datasets: [{
          label: "Baseline (kg CO₂e)",
          data: rows.map(row => Number(row.total_emission_kg_co2e)),
          borderColor: "#89d5b3", backgroundColor: "rgba(137,213,179,.12)",
          pointBackgroundColor: "#89d5b3", pointBorderColor: "#89d5b3", tension: .3, fill: true
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => `${CS.formatNumber(context.parsed.y)} kg CO₂e` } } },
        scales: {
          x: { ticks: { color: "#a6b4aa" }, grid: { color: "rgba(255,255,255,.04)" } },
          y: { beginAtZero: true, ticks: { color: "#a6b4aa" }, grid: { color: "rgba(255,255,255,.06)" } }
        }
      }
    });
  }

  function applyFilters() {
    const search = $("#historySearch").value.trim().toLowerCase();
    const type = $("#periodFilter").value;
    const year = $("#yearFilter").value;
    state.filtered = state.records.filter(row => {
      const searchText = [row.scenario_name, row.notes, CS.formatPeriod(row.period_month, row.period_year), row.calculation_type].join(" ").toLowerCase();
      const matchesSearch = !search || searchText.includes(search);
      const matchesType = type === "all" || row.calculation_type === type;
      const matchesYear = year === "all" || String(row.period_year) === year;
      return matchesSearch && matchesType && matchesYear;
    });
    state.page = 0;
    renderTable();
  }

  function renderTable() {
    const tbody = $("#historyTableBody");
    const start = state.page * state.pageSize;
    const rows = state.filtered.slice(start, start + state.pageSize);
    CS.setText("historyCountLabel", `${state.filtered.length} perhitungan`);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">Belum ada perhitungan yang sesuai filter.</div></td></tr>';
    } else {
      tbody.innerHTML = rows.map(row => {
        const type = row.calculation_type === "scenario" ? '<span class="tag gold">Skenario</span>' : '<span class="tag green">Baseline</span>';
        const label = row.calculation_type === "scenario" ? (row.scenario_name || "Skenario") : "Kondisi awal";
        return `<tr>
          <td>${CS.escapeHTML(CS.formatDate(row.calculated_at))}<div class="muted">${CS.escapeHTML(label)}</div></td>
          <td>${CS.escapeHTML(CS.formatPeriod(row.period_month, row.period_year))}</td>
          <td>${type}</td>
          <td class="num">${CS.escapeHTML(CS.formatNumber(row.transport_emission_kg_co2e))}</td>
          <td class="num">${CS.escapeHTML(CS.formatNumber(row.electricity_emission_kg_co2e))}</td>
          <td class="num">${CS.escapeHTML(CS.formatCO2(row.total_emission_kg_co2e))}</td>
          <td><button class="table-action" data-detail-id="${CS.escapeHTML(row.id)}">Detail</button></td>
        </tr>`;
      }).join("");
    }
    const totalPages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
    CS.setText("paginationInfo", state.filtered.length ? `Menampilkan ${start + 1}–${Math.min(start + state.pageSize, state.filtered.length)} dari ${state.filtered.length}` : "Tidak ada data");
    CS.setText("pageNumber", String(state.page + 1));
    $("#previousPage").disabled = state.page <= 0;
    $("#nextPage").disabled = state.page + 1 >= totalPages;
  }

  async function loadDetail(id) {
    const row = state.records.find(item => item.id === id);
    if (!row) return;
    state.selectedId = id;
    const container = $("#selectedCalculationDetail");
    container.innerHTML = '<div class="empty-state">Memuat detail perhitungan...</div>';
    CS.setText("detailType", row.calculation_type === "scenario" ? "Skenario" : "Baseline");

    let logs;
    try {
      logs = await window.CSData.loadActivityLogs(id);
    } catch (error) {
      console.error(error);
      container.innerHTML = '<div class="empty-state">Detail aktivitas belum dapat dimuat. Periksa relasi tabel dan kebijakan RLS.</div>';
      return;
    }
    const transportItems = logs.transport;
    const electricityItems = logs.electricity;

    const transportHTML = transportItems.length ? transportItems.map(item => {
      const factor = Array.isArray(item.emission_factors) ? item.emission_factors[0] : item.emission_factors;
      const modeRelation = factor?.transport_modes;
      const modeName = CS.getNestedName(modeRelation, factor?.name || "Moda transportasi");
      return `<div class="detail-item"><div><b>${CS.escapeHTML(modeName)}</b><br><span>${CS.formatNumber(item.round_trip_distance_km)} km PP · ${item.travel_days_per_month} hari/bulan</span><br><span>EF ${CS.formatNumber(item.factor_value_used, 3)} ${CS.escapeHTML(item.factor_unit_used)}</span></div><b>${CS.escapeHTML(CS.formatCO2(item.emission_kg_co2e))}</b></div>`;
    }).join("") : '<p class="small">Tidak ada rincian transportasi pada sesi ini.</p>';
    const electricityHTML = electricityItems.length ? electricityItems.map(item => {
      const name = CS.getNestedName(item.device_types, item.custom_device_name || "Perangkat khusus");
      return `<div class="detail-item"><div><b>${CS.escapeHTML(name)}</b><br><span>${CS.formatNumber(item.power_watt)} W · ${CS.formatNumber(item.hours_per_day)} jam/hari · ${item.days_per_month} hari/bulan</span><br><span>${CS.formatNumber(item.energy_kwh, 2)} kWh</span></div><b>${CS.escapeHTML(CS.formatCO2(item.emission_kg_co2e))}</b></div>`;
    }).join("") : '<p class="small">Tidak ada rincian listrik pada sesi ini.</p>';

    container.innerHTML = `
      <div class="detail-list">
        <div class="detail-item"><span>Periode aktivitas</span><b>${CS.escapeHTML(CS.formatPeriod(row.period_month, row.period_year))}</b></div>
        <div class="detail-item"><span>Waktu disimpan</span><b>${CS.escapeHTML(CS.formatDate(row.calculated_at))}</b></div>
        <div class="detail-item"><span>Total emisi</span><b>${CS.escapeHTML(CS.formatCO2(row.total_emission_kg_co2e))}</b></div>
      </div>
      <h3 style="font-size:12px;margin:17px 0 8px">Transportasi</h3>${transportHTML}
      <h3 style="font-size:12px;margin:17px 0 8px">Penggunaan listrik</h3>${electricityHTML}
      <a class="btn btn-primary btn-block" style="margin-top:14px" href="hasil.html?calculation_id=${encodeURIComponent(row.id)}">Buka Hasil Perhitungan →</a>`;
  }

  async function init() {
    try {
      state.user = await CS.getAuthenticatedUser();
      if (!state.user) return;
      await CS.loadProfileName(state.user);
      const data = await window.CSData.loadHistory(state.user, 500);
      state.records = data || [];
      populateYearFilter(state.records);
      calculateStats(state.records);
      state.filtered = [...state.records];
      renderTable();
      if (state.records.length) await loadDetail(state.records[0].id);
      if (state.records.length === 500) CS.showAlert("pageAlert", "Menampilkan maksimal 500 catatan terbaru pada modul ini. Gunakan filter periode untuk mempersempit hasil.", "info");
    } catch (error) {
      console.error(error);
      alertError(error.message || "Gagal memuat riwayat.");
    }
  }

  $("#historySearch")?.addEventListener("input", applyFilters);
  $("#periodFilter")?.addEventListener("change", applyFilters);
  $("#yearFilter")?.addEventListener("change", applyFilters);
  $("#previousPage")?.addEventListener("click", () => { if (state.page > 0) { state.page--; renderTable(); } });
  $("#nextPage")?.addEventListener("click", () => { if ((state.page + 1) * state.pageSize < state.filtered.length) { state.page++; renderTable(); } });
  $("#historyTableBody")?.addEventListener("click", event => {
    const button = event.target.closest("[data-detail-id]");
    if (button) loadDetail(button.dataset.detailId);
  });
  $("#exportCsv")?.addEventListener("click", () => {
    const rows = state.filtered.map(row => ({
      tanggal: CS.formatDate(row.calculated_at),
      periode: CS.formatPeriod(row.period_month, row.period_year),
      jenis: row.calculation_type,
      skenario: row.scenario_name || "",
      transportasi_kg_co2e: row.transport_emission_kg_co2e,
      listrik_kg_co2e: row.electricity_emission_kg_co2e,
      total_kg_co2e: row.total_emission_kg_co2e
    }));
    CS.downloadCSV("carbonsteps-riwayat.csv", rows);
  });

  await init();
})();
