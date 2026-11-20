(async function () {
  const $ = CS.$;
  let emissionChart = null;

  function showPageError(message) {
    CS.showAlert("pageAlert", message, "error");
  }

  async function getCalculation(user) {
    const params = new URLSearchParams(window.location.search);
    const requestedId = params.get("calculation_id");
    return window.CSData.loadCalculation(user, requestedId);
  }

  async function getActivityLogs(calculationId) {
    return window.CSData.loadActivityLogs(calculationId);
  }

  function relationObject(value) {
    return Array.isArray(value) ? value[0] : value;
  }

  function renderTransport(rows) {
    const container = $("#transportDetails");
    if (!rows.length) {
      container.innerHTML = '<div class="empty-state">Tidak ada aktivitas transportasi yang dicatat pada sesi ini.</div>';
      return;
    }
    container.innerHTML = rows.map(row => {
      const factor = relationObject(row.emission_factors);
      const mode = relationObject(factor?.transport_modes);
      const modeName = mode?.name || factor?.name || "Moda transportasi";
      const detail = `${CS.formatNumber(row.round_trip_distance_km)} km PP · ${row.travel_days_per_month} hari/bulan`;
      const basis = row.factor_basis_used === "vehicle_km" ? "per kendaraan-km" : "per penumpang-km";
      const provenance = factor?.source_name
        ? `Sumber: ${factor.source_name}${factor.source_year ? ` (${factor.source_year})` : ""}${factor.region ? ` · ${factor.region}` : ""}`
        : "Sumber faktor mengikuti master data emission_factors.";
      return `<article class="activity-row"><div class="activity-icon">↗</div><div><div class="activity-name">${CS.escapeHTML(modeName)}</div><div class="activity-meta">${CS.escapeHTML(detail)} · Faktor ${CS.formatNumber(row.factor_value_used, 3)} ${CS.escapeHTML(row.factor_unit_used)} (${basis})</div><div class="activity-meta">${CS.escapeHTML(provenance)}</div></div><div class="activity-value">${CS.escapeHTML(CS.formatCO2(row.emission_kg_co2e))}</div></article>`;
    }).join("");
  }

  function renderElectricity(rows) {
    const container = $("#electricityDetails");
    if (!rows.length) {
      container.innerHTML = '<div class="empty-state">Tidak ada perangkat listrik yang dicatat pada sesi ini.</div>';
      return;
    }
    container.innerHTML = rows.map(row => {
      const device = relationObject(row.device_types);
      const factor = relationObject(row.emission_factors);
      const deviceName = device?.name || row.custom_device_name || "Perangkat khusus";
      const provenance = factor?.source_name
        ? `Sumber: ${factor.source_name}${factor.source_year ? ` (${factor.source_year})` : ""}${factor.region ? ` · ${factor.region}` : ""}`
        : "Sumber faktor mengikuti master data emission_factors.";
      return `<article class="activity-row"><div class="activity-icon gold">ϟ</div><div><div class="activity-name">${CS.escapeHTML(deviceName)}</div><div class="activity-meta">${CS.formatNumber(row.power_watt)} W · ${CS.formatNumber(row.hours_per_day)} jam/hari · ${row.days_per_month} hari/bulan · ${CS.formatNumber(row.energy_kwh, 2)} kWh</div><div class="activity-meta">Faktor ${CS.formatNumber(row.factor_value_used, 3)} ${CS.escapeHTML(row.factor_unit_used)}</div><div class="activity-meta">${CS.escapeHTML(provenance)}</div></div><div class="activity-value green">${CS.escapeHTML(CS.formatCO2(row.emission_kg_co2e))}</div></article>`;
    }).join("");
  }

  function renderChart(transport, electricity, total) {
    const canvas = $("#emissionChart");
    if (!canvas || !window.Chart) return;
    if (emissionChart) emissionChart.destroy();
    const hasValue = total > 0;
    emissionChart = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: ["Transportasi", "Penggunaan listrik"],
        datasets: [{ data: hasValue ? [transport, electricity] : [1, 1], backgroundColor: ["#82cce5", "#9bd59c"], borderWidth: 0, hoverOffset: 4 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: "70%",
        plugins: {
          legend: { display: false },
          tooltip: { enabled: hasValue, callbacks: { label: context => `${context.label}: ${CS.formatCO2(context.raw)}` } }
        }
      }
    });
  }

  function renderCalculation(data, logs) {
    const transport = Number(data.transport_emission_kg_co2e || 0);
    const electricity = Number(data.electricity_emission_kg_co2e || 0);
    const total = Number(data.total_emission_kg_co2e || 0);
    const transportPct = total > 0 ? transport / total * 100 : 0;
    const electricityPct = total > 0 ? electricity / total * 100 : 0;

    CS.setText("calculationPeriod", CS.formatPeriod(data.period_month, data.period_year));
    CS.setText("resultDate", `Disimpan ${CS.formatDate(data.calculated_at)}`);
    CS.setText("totalEmission", CS.formatCO2(total));
    CS.setText("transportEmission", CS.formatCO2(transport));
    CS.setText("electricityEmission", CS.formatCO2(electricity));
    CS.setText("transportPercentage", `${CS.formatNumber(transportPct)}%`);
    CS.setText("electricityPercentage", `${CS.formatNumber(electricityPct)}%`);
    CS.setText("transportSectionTotal", CS.formatCO2(transport));
    CS.setText("electricitySectionTotal", CS.formatCO2(electricity));
    CS.setText("legendTransport", `${CS.formatNumber(transportPct)}% · ${CS.formatCO2(transport)}`);
    CS.setText("legendElectricity", `${CS.formatNumber(electricityPct)}% · ${CS.formatCO2(electricity)}`);

    renderTransport(logs.transport);
    renderElectricity(logs.electricity);
    renderChart(transport, electricity, total);

    let dominantText = "Belum ada kontribusi emisi yang tercatat.";
    if (data.dominant_category === "transport") dominantText = "Transportasi merupakan kategori dengan estimasi emisi terbesar pada perhitungan ini.";
    else if (data.dominant_category === "electricity") dominantText = "Penggunaan listrik merupakan kategori dengan estimasi emisi terbesar pada perhitungan ini.";
    else if (data.dominant_category === "equal") dominantText = "Estimasi emisi transportasi dan listrik memiliki nilai yang sama. Pertimbangkan perbaikan pada kedua kategori.";
    CS.setText("dominantSummary", dominantText);

    const params = new URLSearchParams({ calculation_id: data.id });
    $("#recommendationLink").href = `rekomendasi.html?${params.toString()}`;
    $("#recommendationBottomLink").href = `rekomendasi.html?${params.toString()}`;
    $("#resultContent").hidden = false;
    $("#emptyState").hidden = true;
  }

  async function init() {
    try {
      const user = await CS.getAuthenticatedUser();
      if (!user) return;
      await CS.loadProfileName(user); await CS.applySavedTheme(user);
      const calculation = await getCalculation(user);
      if (!calculation) {
        $("#resultContent").hidden = true;
        $("#emptyState").hidden = false;
        CS.hideAlert("pageAlert");
        return;
      }
      const logs = await getActivityLogs(calculation.id);
      renderCalculation(calculation, logs);
    } catch (error) {
      console.error(error);
      showPageError(error.message || "Gagal memuat hasil perhitungan.");
    }
  }

  await init();
})();
