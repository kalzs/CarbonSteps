(async function () {
  let chart = null;
  const $ = CS.$;
  function latestBaselinePerMonth(records) {
    const rows = records.filter(r => r.calculation_type === 'baseline');
    const map = new Map();
    for (const row of rows) {
      const key = `${row.period_year}-${String(row.period_month).padStart(2,'0')}`;
      const current = map.get(key);
      if (!current || new Date(row.calculated_at) > new Date(current.calculated_at)) map.set(key, row);
    }
    return [...map.values()].sort((a,b) => a.period_year - b.period_year || a.period_month - b.period_month);
  }
  function renderChart(rows) {
    const canvas = $('#dashboardTrendChart');
    if (!canvas || !window.Chart) return;
    if (chart) chart.destroy();
    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: rows.map(r => CS.formatPeriod(r.period_month, r.period_year)),
        datasets: [
          { label: 'Transportasi', data: rows.map(r => Number(r.transport_emission_kg_co2e || 0)), backgroundColor: '#82cce5', borderRadius: 5 },
          { label: 'Listrik', data: rows.map(r => Number(r.electricity_emission_kg_co2e || 0)), backgroundColor: '#9bd59c', borderRadius: 5 }
        ]
      },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{labels:{color:'#a6b4aa'}}, tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${CS.formatCO2(c.parsed.y)}`}} }, scales:{ x:{stacked:true,ticks:{color:'#a6b4aa'},grid:{display:false}}, y:{stacked:true,beginAtZero:true,ticks:{color:'#a6b4aa'},grid:{color:'rgba(255,255,255,.06)'}} } }
    });
  }
  function renderEmpty() {
    CS.setText('dashTotal','—'); CS.setText('dashTransport','—'); CS.setText('dashElectricity','—');
    CS.setText('dashDominantTitle','Belum ada perhitungan');
    CS.setText('dashDominantText','Isi Kalkulator Transportasi dan Kalkulator Listrik untuk melihat ringkasan emisi.');
    $('#dashboardRecent').innerHTML = '<div class="empty-state">Belum ada perhitungan tersimpan. Mulai dari salah satu kalkulator.</div>';
    CS.setText('dashboardPeriod','Belum tersedia');
    renderChart([]);
  }
  async function init() {
    try {
      const user = await CS.getAuthenticatedUser(); if (!user) return;
      await CS.loadProfileName(user); await CS.applySavedTheme(user);
      const { data: profile } = await window.csSupabase.from('profiles').select('full_name').eq('id',user.id).maybeSingle();
      if (profile?.full_name) CS.setText('dashboardGreeting',`Selamat datang, ${profile.full_name}`);
      const records = await CSData.loadHistory(user,500);
      if (!records.length) { renderEmpty(); return; }
      const baseline = latestBaselinePerMonth(records);
      const latest = records[0];
      const latestBaseline = baseline.length ? baseline[baseline.length-1] : latest;
      const t = Number(latestBaseline.transport_emission_kg_co2e || 0);
      const e = Number(latestBaseline.electricity_emission_kg_co2e || 0);
      const total = Number(latestBaseline.total_emission_kg_co2e || 0);
      const tp = total ? t / total * 100 : 0; const ep = total ? e / total * 100 : 0;
      CS.setText('dashTotal',CS.formatCO2(total));
      CS.setText('dashTransport',CS.formatCO2(t));
      CS.setText('dashElectricity',CS.formatCO2(e));
      CS.setText('dashTransportShare',`${CS.formatNumber(tp)}% dari total estimasi emisi`);
      CS.setText('dashElectricityShare',`${CS.formatNumber(ep)}% dari total estimasi emisi`);
      CS.setText('dashLegendTransport',CS.formatCO2(t));
      CS.setText('dashLegendElectricity',CS.formatCO2(e));
      CS.setText('dashboardPeriod',CS.formatPeriod(latestBaseline.period_month,latestBaseline.period_year));
      if (baseline.length >= 2) {
        const prev = Number(baseline[baseline.length-2].total_emission_kg_co2e || 0);
        const change = prev > 0 ? ((total-prev)/prev)*100 : null;
        CS.setText('dashTrendCaption',change === null ? 'Perbandingan periode sebelumnya tidak tersedia.' : `${change > 0 ? 'Naik' : change < 0 ? 'Turun' : 'Tidak berubah'} ${CS.formatNumber(Math.abs(change))}% dibanding periode baseline sebelumnya.`);
      } else CS.setText('dashTrendCaption','Belum cukup periode baseline untuk membandingkan tren.');
      const dominant = latestBaseline.dominant_category;
      CS.setText('dashDominantTitle', dominant === 'transport' ? 'Transportasi menjadi kategori terbesar' : dominant === 'electricity' ? 'Penggunaan listrik menjadi kategori terbesar' : dominant === 'equal' ? 'Kedua kategori memiliki nilai sama' : 'Belum ada kontribusi emisi');
      CS.setText('dashDominantText',`Transportasi ${CS.formatCO2(t)} · Listrik ${CS.formatCO2(e)}. Rekomendasi didasarkan pada hasil ini.`);
      const recUrl = new URL('rekomendasi.html',location.href); recUrl.searchParams.set('calculation_id',latestBaseline.id); $('#dashRecommendationLink').href = recUrl.href;
      $('#dashboardRecent').innerHTML = records.slice(0,5).map(row => {
        const label = row.calculation_type === 'scenario' ? (row.scenario_name || 'Skenario') : 'Baseline';
        const href = `riwayat.html?calculation_id=${encodeURIComponent(row.id)}`;
        return `<a class="recent-row" href="${href}"><div><b>${CS.escapeHTML(label)}</b><span class="muted">${CS.escapeHTML(CS.formatPeriod(row.period_month,row.period_year))} · ${CS.escapeHTML(CS.formatDate(row.calculated_at))}</span></div><span class="recent-value">${CS.escapeHTML(CS.formatCO2(row.total_emission_kg_co2e))}</span></a>`;
      }).join('');
      renderChart(baseline.slice(-6));
    } catch (error) { console.error(error); CS.showAlert('pageAlert',error.message || 'Gagal memuat dashboard.','error'); }
  }
  await init();
})();
