(async function () {
  const $ = CS.$;
  const relationObject = value => Array.isArray(value) ? value[0] : value;

  function showPageError(message) {
    CS.showAlert("pageAlert", message, "error");
  }

  async function loadCalculation(user) {
    const params = new URLSearchParams(window.location.search);
    return window.CSData.loadCalculation(user, params.get("calculation_id"));
  }

  async function loadRecommendationCatalog(dominant) {
    return window.CSData.loadRecommendationCatalog(dominant);
  }

  function recommendationCard(item) {
    return `<article class="recommendation-item"><h3>${CS.escapeHTML(item.title)}</h3><p>${CS.escapeHTML(item.advice)}</p></article>`;
  }

  function renderRecommendations(data, items) {
    const transportItems = items.filter(item => item.category === "transport");
    const electricityItems = items.filter(item => item.category === "electricity");
    const generalItems = items.filter(item => item.category === "general");

    $("#transportRecommendations").innerHTML = transportItems.length
      ? transportItems.map(recommendationCard).join("")
      : '<div class="empty-state">Tidak ada rekomendasi transportasi aktif untuk kondisi ini.</div>';
    $("#electricityRecommendations").innerHTML = electricityItems.length
      ? electricityItems.map(recommendationCard).join("")
      : '<div class="empty-state">Tidak ada rekomendasi penggunaan listrik aktif untuk kondisi ini.</div>';

    const generalSection = $("#generalRecommendationSection");
    generalSection.hidden = !generalItems.length;
    $("#generalRecommendations").innerHTML = generalItems.map(recommendationCard).join("");

    const transport = Number(data.transport_emission_kg_co2e || 0);
    const electricity = Number(data.electricity_emission_kg_co2e || 0);
    const total = Number(data.total_emission_kg_co2e || 0);
    const tPct = total > 0 ? transport / total * 100 : 0;
    const ePct = total > 0 ? electricity / total * 100 : 0;

    CS.setText("recommendationPeriod", `${CS.formatPeriod(data.period_month, data.period_year)} · ${CS.formatDate(data.calculated_at, false)}`);
    CS.setText("totalEmission", CS.formatCO2(total));
    CS.setText("calculationLabel", data.calculation_type === "scenario" ? (data.scenario_name || "Skenario") : "Kondisi awal / baseline");
    CS.setText("transportShare", `${CS.formatNumber(tPct)}% (${CS.formatCO2(transport)})`);
    CS.setText("electricityShare", `${CS.formatNumber(ePct)}% (${CS.formatCO2(electricity)})`);
    $("#transportBar").style.width = `${tPct}%`;
    $("#electricityBar").style.width = `${ePct}%`;

    let title = "Belum ada kategori dominan";
    let description = "Belum ada kontribusi emisi yang dapat dibandingkan.";
    let explanation = "Data aktivitas yang tersedia belum cukup untuk menetapkan kategori prioritas.";
    if (data.dominant_category === "transport") {
      title = "Transportasi Menuju Kampus";
      description = "Transportasi menjadi kategori dengan estimasi emisi lebih besar pada perhitungan yang dipilih.";
      explanation = `Estimasi emisi transportasi (${CS.formatCO2(transport)}) lebih besar daripada penggunaan listrik (${CS.formatCO2(electricity)}). Karena itu, rekomendasi transportasi ditampilkan sebagai prioritas.`;
    } else if (data.dominant_category === "electricity") {
      title = "Penggunaan Listrik Perangkat Elektronik";
      description = "Penggunaan listrik menjadi kategori dengan estimasi emisi lebih besar pada perhitungan yang dipilih.";
      explanation = `Estimasi emisi listrik (${CS.formatCO2(electricity)}) lebih besar daripada transportasi (${CS.formatCO2(transport)}). Karena itu, rekomendasi penghematan listrik ditampilkan sebagai prioritas.`;
    } else if (data.dominant_category === "equal") {
      title = "Transportasi dan Penggunaan Listrik";
      description = "Kedua kategori memiliki nilai estimasi emisi yang sama.";
      explanation = "Kedua kategori memiliki nilai estimasi yang sama, sehingga saran dari transportasi dan listrik ditampilkan bersama.";
    } else if (data.dominant_category === "none") {
      title = "Belum Ada Emisi Tercatat";
    }
    CS.setText("dominantTitle", title);
    CS.setText("dominantDescription", description);
    CS.setText("ruleExplanation", explanation + " Rekomendasi dipilih menggunakan aturan sederhana, bukan kecerdasan buatan.");

    const resultUrl = `hasil.html?calculation_id=${encodeURIComponent(data.id)}`;
    $("#backToResult").href = resultUrl;
    $("#recommendationContent").hidden = false;
    $("#emptyState").hidden = true;
  }

  async function init() {
    try {
      const user = await CS.getAuthenticatedUser();
      if (!user) return;
      await CS.loadProfileName(user); await CS.applySavedTheme(user);
      const calculation = await loadCalculation(user);
      if (!calculation) {
        $("#recommendationContent").hidden = true;
        $("#emptyState").hidden = false;
        return;
      }
      const recommendations = await loadRecommendationCatalog(calculation.dominant_category);
      try { await window.CSData.persistCalculationRecommendations(calculation.id, recommendations, calculation.dominant_category); }
      catch (persistError) { console.warn('Rekomendasi tampil, tetapi pencatatan relasinya belum berhasil:', persistError.message); }
      renderRecommendations(calculation, recommendations);
      if (!recommendations.length) {
        CS.showAlert("pageAlert", "Katalog rekomendasi masih kosong. Jalankan SQL seed recommendations yang tersedia pada folder database.", "info");
      }
    } catch (error) {
      console.error(error);
      showPageError(error.message || "Gagal memuat rekomendasi.");
    }
  }

  await init();
})();
