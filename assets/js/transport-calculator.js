(async function () {
  const $ = CS.$; const $$ = CS.$$;
  const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  let user=null, modes=[], factors=[], rawFactors=[], rawFactorCount=0, rows=[], draftId=null;
  const money = v => Number(v||0).toLocaleString('id-ID',{minimumFractionDigits:1,maximumFractionDigits:2});
  function setPeriodControls(period) {
    $('#transportMonth').innerHTML = months.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('');
    $('#transportMonth').value = String(period.month); $('#transportYear').value = String(period.year);
  }
  function period() { return {month:Number($('#transportMonth').value),year:Number($('#transportYear').value)}; }
  function factorIdentity(f) {
    // Signature ini mendeteksi dua record yang mewakili faktor numerik yang sama,
    // meskipun code/ID atau redaksi metadata sumbernya berbeda.
    return [
      f.transport_mode_id || '',
      f.factor_basis || '',
      f.unit || '',
      Number(f.factor_value || 0).toFixed(6),
      f.source_year ?? '',
      String(f.effective_from || '').slice(0,10),
      f.effective_to ? String(f.effective_to).slice(0,10) : ''
    ].join('|');
  }
  function dedupeTransportFactors(list) {
    const preferred = [...(list || [])].sort((a,b) => {
      const score = f => String(f.code || '').startsWith('EF-TR-') ? 0 : 1;
      return score(a)-score(b) || String(a.code || '').localeCompare(String(b.code || ''));
    });
    const seen = new Set();
    return preferred.filter(f => {
      const key = factorIdentity(f);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  function selectedFactors(modeId) { return factors.filter(f=>f.transport_mode_id===modeId); }
  function factorLabel(f) { const region=f.region ? `${f.region} · ` : ''; const year=f.source_year ? ` (${f.source_year})` : ''; return `${f.name} · ${region}${CS.formatNumber(f.factor_value,6)} ${f.unit} · ${f.source_name}${year}`; }
  function factorOptionsMarkup(modeId, selectedId='') {
    const options=selectedFactors(modeId);
    const placeholder=modeId ? (options.length ? 'Pilih faktor emisi' : 'Faktor belum tersedia untuk moda ini') : 'Pilih moda terlebih dahulu';
    return ['<option value="">'+placeholder+'</option>', ...options.map(f=>`<option value="${f.id}" ${selectedId===f.id?'selected':''}>${CS.escapeHTML(factorLabel(f))}</option>`)].join('');
  }
  function rowMarkup(index, values={}) {
    const modeOptions = ['<option value="">Pilih moda</option>',...modes.map(m=>`<option value="${m.id}" ${values.modeId===m.id?'selected':''}>${CS.escapeHTML(m.name)}</option>`)].join('');
    const factorOptions = factorOptionsMarkup(values.modeId, values.factorId || '');
    return `<div class="calc-row" data-transport-row="${index}">
      <div class="form-field"><label>Moda transportasi</label><select class="select" data-field="mode">${modeOptions}</select></div>
      <div class="form-field"><label>Faktor emisi</label><select class="select" data-field="factor">${factorOptions}</select></div>
      <div class="form-field"><label>Jarak PP (km/hari)</label><input class="input" data-field="distance" type="number" min="0.1" step="0.1" value="${values.distance ?? ''}" placeholder="Contoh 14" required></div>
      <div class="form-field"><label>Hari perjalanan/bulan</label><input class="input" data-field="days" type="number" min="1" max="31" step="1" value="${values.days ?? ''}" placeholder="20" required></div>
      <div class="form-field" data-passenger-wrap><label>Orang dalam kendaraan (termasuk pengemudi)</label><input class="input" data-field="passengers" type="number" min="1" max="99" step="1" value="${values.passengers ?? 1}" title="Jumlah orang yang berbagi emisi kendaraan, termasuk pengemudi" required></div>
      <button class="remove-row" type="button" data-remove title="Hapus aktivitas">×</button>
      <div class="form-field full"><label>Catatan (opsional)</label><input class="input" data-field="notes" maxlength="250" value="${CS.escapeHTML(values.notes||'')}" placeholder="Contoh: perjalanan ke kampus"></div>
    </div>`;
  }
  function addRow(values={}) { const index=rows.length?Math.max(...rows.map(x=>x.index))+1:0; rows.push({index}); $('#transportRows').insertAdjacentHTML('beforeend',rowMarkup(index,values)); bindRow(document.querySelector(`[data-transport-row="${index}"]`)); updatePreview(); }
  function bindRow(row) {
    const mode = row.querySelector('[data-field="mode"]'); const factor = row.querySelector('[data-field="factor"]');
    mode.addEventListener('change',()=>{factor.innerHTML=factorOptionsMarkup(mode.value); updatePassengerVisibility(row); updatePreview();});
    factor.addEventListener('change',()=>{updatePassengerVisibility(row);updatePreview();});
    row.querySelectorAll('input').forEach(input=>input.addEventListener('input',updatePreview));
    row.querySelector('[data-remove]').addEventListener('click',()=>{row.remove();rows=rows.filter(x=>x.index!==Number(row.dataset.transportRow));updatePreview();});
    updatePassengerVisibility(row);
  }
  function getRowData(row) {
    const factorId=row.querySelector('[data-field="factor"]').value;
    const f=factors.find(x=>x.id===factorId);
    return {row,factor:f,modeId:row.querySelector('[data-field="mode"]').value,distance:Number(row.querySelector('[data-field="distance"]').value),days:Number(row.querySelector('[data-field="days"]').value),passengers:Number(row.querySelector('[data-field="passengers"]').value||1),notes:row.querySelector('[data-field="notes"]').value.trim()};
  }
  function updatePassengerVisibility(row) {
    const factor=factors.find(f=>f.id===row.querySelector('[data-field="factor"]').value);
    const wrap=row.querySelector('[data-passenger-wrap]');
    if(wrap) wrap.hidden = factor?.factor_basis !== 'vehicle_km';
  }
  function calculateRow(data) {
    if(!data.factor || !(data.distance>0) || !(data.days>=1) || !(data.passengers>=1)) return 0;
    let value=data.distance*data.days*Number(data.factor.factor_value);
    if(data.factor.factor_basis==='vehicle_km') value/=data.passengers;
    return value;
  }
  function updatePreview() {
    const data=$$('[data-transport-row]').map(getRowData);
    const valid=data.filter(d=>d.factor && d.distance>0 && d.days>=1 && d.passengers>=1);
    const total=valid.reduce((sum,d)=>sum+calculateRow(d),0);
    CS.setText('transportPreviewTotal',`${money(total)} kg CO₂`);
    CS.setText('transportPreviewPeriod',`${valid.length} aktivitas valid · estimasi bulanan`);
    $('#transportPreviewRows').innerHTML=valid.length?valid.map(d=>`<div class="preview-item"><div><b>${CS.escapeHTML(CS.relationObject(d.factor.transport_modes)?.name || d.factor.name)}</b><br><span>${money(d.distance)} km PP × ${d.days} hari/bulan</span></div><strong>${money(calculateRow(d))} kg</strong></div>`).join(''):'<div class="empty-state">Lengkapi moda, faktor, jarak, dan frekuensi.</div>';
  }
  function fillExisting(logs) {
    if(!logs.length) return;
    $('#transportRows').innerHTML='';rows=[];
    logs.forEach(log=>{
      const storedFactor=rawFactors.find(x=>x.id===log.emission_factor_id);
      // Draft lama mungkin menunjuk ke record duplikat. Arahkan pilihan ke
      // record kanonis yang setara agar dapat diedit dan disimpan kembali.
      const canonicalFactor=storedFactor
        ? factors.find(x=>factorIdentity(x)===factorIdentity(storedFactor))
        : factors.find(x=>x.id===log.emission_factor_id);
      const f=canonicalFactor || storedFactor;
      const modeId=f?.transport_mode_id || '';
      addRow({modeId,factorId:f?.id || '',distance:log.round_trip_distance_km,days:log.travel_days_per_month,passengers:log.passenger_count,notes:log.notes});
    });
  }
  async function refreshFactorInfo() {
    const active=factors.length;
    const duplicates=Math.max(0,rawFactorCount-active);
    const missing=modes.filter(mode=>selectedFactors(mode.id).length===0).map(mode=>CS.escapeHTML(mode.name));
    $('#transportFactorInfo').innerHTML=active
      ? `<strong>${active} faktor transportasi unik tersedia.</strong> Pilihan faktor mengikuti moda dan jenis kendaraan. Faktor vehicle-km meminta jumlah orang dalam kendaraan; faktor passenger-km sudah dialokasikan per penumpang. ${duplicates?`${duplicates} record faktor duplikat disembunyikan dari pilihan. `:''}${missing.length?`Belum tersedia: ${missing.join(', ')}.`:''}`
      : '<strong>Faktor emisi belum tersedia.</strong> Jalankan migration database/16_seed_transport_factors_and_standardize_co2_units.sql pada Supabase. Kalkulator tidak akan mengarang hasil tanpa faktor.';
  }
  async function init() {
    user=await CSCalc.getUser();if(!user)return;await CS.loadProfileName(user); await CS.applySavedTheme(user);
    const p=CSCalc.getPeriodFromUrlOrNow();setPeriodControls(p);
    const [loadedModes,loadedFactors]=await Promise.all([CSCalc.loadTransportModes(),CSCalc.loadFactors('transport',p.year,p.month)]);
    modes=loadedModes;rawFactors=loadedFactors;rawFactorCount=loadedFactors.length;factors=dedupeTransportFactors(loadedFactors);await refreshFactorInfo();
    const draft=await CSCalc.findDraft(user,p.year,p.month,p.calculationId);draftId=draft?.id||null;
    addRow();
    if(draftId){const logs=await CSCalc.loadDraftLogs(draftId);fillExisting(logs.transport);$('#calcStatus').hidden=false;$('#calcStatus').textContent='Draft ditemukan. Aktivitas yang telah disimpan dapat dilanjutkan atau diganti sebelum sesi diselesaikan.';}
    updatePreview();
    if(!factors.length) CS.showAlert('pageAlert','Belum ada faktor emisi transportasi aktif untuk periode ini. Jalankan migration database/16_seed_transport_factors_and_standardize_co2_units.sql pada Supabase, lalu muat ulang halaman.','info');
  }
  $('#addTransportRow').addEventListener('click',()=>addRow());
  $('#transportRows').addEventListener('input',updatePreview);
  $('#transportRows').addEventListener('change',updatePreview);
  function reloadForPeriod(){const p=period();const url=new URL(location.href);url.searchParams.set('year',p.year);url.searchParams.set('month',p.month);url.searchParams.delete('calculation_id');location.href=url.href;}
  $('#transportMonth').addEventListener('change',reloadForPeriod);$('#transportYear').addEventListener('change',reloadForPeriod);
  $('#resetTransportButton').addEventListener('click',()=>{rows=[];$('#transportRows').innerHTML='';addRow();});
  $('#saveTransportButton').addEventListener('click',async()=>{
    const button=$('#saveTransportButton');button.disabled=true;button.textContent='Menyimpan...';CS.hideAlert('pageAlert');
    try{
      const p=period();if(!Number.isInteger(p.year)||p.year<2000||p.year>2200||!Number.isInteger(p.month)||p.month<1||p.month>12)throw new Error('Periode bulan dan tahun tidak valid.');
      const data=$$('[data-transport-row]').map(getRowData);
      if(!data.length)throw new Error('Tambahkan minimal satu aktivitas transportasi.');
      for(const d of data){if(!d.modeId)throw new Error('Pilih moda transportasi untuk setiap baris.');if(!d.factor)throw new Error('Pilih faktor emisi yang sesuai untuk setiap moda.');if(!(d.distance>0))throw new Error('Jarak PP harus lebih besar dari nol.');if(!Number.isInteger(d.days)||d.days<1||d.days>31)throw new Error('Hari perjalanan harus 1–31 hari per bulan.');if(d.factor.factor_basis==='vehicle_km'&&(!Number.isInteger(d.passengers)||d.passengers<1))throw new Error('Jumlah orang dalam kendaraan minimal satu, termasuk pengemudi.');}
      const calc=await CSCalc.getOrCreateDraft(user,p.year,p.month,new URLSearchParams(location.search).get('calculation_id'));
      const payload=data.map(d=>({emission_factor_id:d.factor.id,round_trip_distance_km:d.distance,travel_days_per_month:d.days,passenger_count:d.factor.factor_basis==='vehicle_km'?d.passengers:1,notes:d.notes||null}));
      await CSCalc.saveTransport(calc.id,payload);draftId=calc.id;CSCalc.setActiveDraft(user,p.year,p.month,calc.id);
      const complete=await CSCalc.finalizeIfBothCategories(calc.id,user,p.year,p.month);
      if(complete){CS.showToast('Kedua kategori sudah tersimpan. Perhitungan selesai.','success');location.href=`hasil.html?calculation_id=${encodeURIComponent(calc.id)}`;return;}
      CS.showAlert('calcStatus','Aktivitas transportasi tersimpan sebagai draft. Lanjutkan ke Kalkulator Listrik dengan periode yang sama untuk menyelesaikan satu sesi perhitungan.','success');
      CSCalc.redirectToOtherCalculator('kalkulator-listrik.html',calc.id,p.year,p.month);
    }catch(error){console.error(error);CS.showAlert('pageAlert',error.message||'Gagal menyimpan aktivitas transportasi.','error');}
    finally{button.disabled=false;button.textContent='Simpan Aktivitas Transportasi →';}
  });
  try{await init();}catch(error){console.error(error);CS.showAlert('pageAlert',error.message||'Gagal memuat kalkulator transportasi.','error');$('#saveTransportButton').disabled=true;}
})();
