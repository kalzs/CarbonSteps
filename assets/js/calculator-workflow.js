(function () {
  const supabase = () => window.csSupabase;

  function draftKey(userId, year, month) {
    return `carbonsteps:draft:${userId}:${year}-${String(month).padStart(2, '0')}`;
  }

  async function getUser() {
    return CS.getAuthenticatedUser();
  }

  async function getCalculationById(id, userId) {
    const { data, error } = await supabase().from('carbon_calculations')
      .select('id,user_id,period_year,period_month,calculation_type,status')
      .eq('id', id).eq('user_id', userId).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function findDraft(user, year, month, explicitId = null) {
    const key = draftKey(user.id, year, month);
    if (explicitId) {
      const explicit = await getCalculationById(explicitId, user.id);
      if (explicit && explicit.status === 'draft') {
        if (Number(explicit.period_year) !== Number(year) || Number(explicit.period_month) !== Number(month)) {
          throw new Error('Periode sesi ini berbeda dari periode pada formulir. Gunakan periode yang sama dengan sesi draft.');
        }
        localStorage.setItem(key, explicit.id);
        return explicit;
      }
      throw new Error('Sesi perhitungan pada tautan tidak ditemukan atau sudah selesai. Mulai sesi baru.');
    }

    const cachedId = localStorage.getItem(key);
    if (cachedId) {
      try {
        const cached = await getCalculationById(cachedId, user.id);
        if (cached && cached.status === 'draft') return cached;
      } catch (error) {
        console.warn('Draft lokal tidak dapat dipakai:', error.message);
      }
      localStorage.removeItem(key);
    }

    const { data, error } = await supabase().from('carbon_calculations')
      .select('id,user_id,period_year,period_month,calculation_type,status')
      .eq('user_id', user.id).eq('period_year', year).eq('period_month', month)
      .eq('calculation_type', 'baseline').eq('status', 'draft')
      .order('calculated_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (data?.id) localStorage.setItem(key, data.id);
    return data || null;
  }

  async function getOrCreateDraft(user, year, month, explicitId = null) {
    const existing = await findDraft(user, year, month, explicitId);
    if (existing) return existing;
    const { data, error } = await supabase().from('carbon_calculations')
      .insert({ user_id: user.id, period_year: year, period_month: month, calculation_type: 'baseline' })
      .select('id,user_id,period_year,period_month,calculation_type,status').single();
    if (error) throw error;
    localStorage.setItem(draftKey(user.id, year, month), data.id);
    return data;
  }

  async function loadFactors(category, year, month) {
    // Query master factors first, then apply the validity-window filter in JS.
    // This avoids PostgREST .or() syntax differences and avoids requesting the
    // transport_modes relationship for electricity factors (where it is NULL).
    const periodDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const baseColumns = [
      'id', 'code', 'name', 'category', 'transport_mode_id', 'unit',
      'factor_basis', 'factor_value', 'region', 'source_name', 'source_url',
      'source_year', 'effective_from', 'effective_to'
    ];
    const columns = category === 'transport'
      ? `${baseColumns.join(',')},transport_modes(id,name,mode_group)`
      : baseColumns.join(',');

    const { data, error } = await supabase().from('emission_factors')
      .select(columns)
      .eq('category', category)
      .eq('is_active', true)
      .order('effective_from', { ascending: false });

    if (error) {
      const detail = error.message || 'Kesalahan tidak diketahui';
      throw new Error(`Gagal membaca faktor emisi kategori ${category} dari Supabase: ${detail}. Periksa tabel, hak SELECT, RLS, dan sesi login.`);
    }

    return (data || []).filter((factor) => {
      const start = String(factor.effective_from || '').slice(0, 10);
      const end = factor.effective_to ? String(factor.effective_to).slice(0, 10) : null;
      return Boolean(start) && start <= periodDate && (!end || end >= periodDate);
    });
  }

  async function loadTransportModes() {
    const { data, error } = await supabase().from('transport_modes')
      .select('id,name,mode_group,fuel_type').eq('is_active', true).order('name');
    if (error) throw error;
    return data || [];
  }

  async function loadDeviceTypes() {
    const { data, error } = await supabase().from('device_types')
      .select('id,name,device_category,default_power_watt').eq('is_active', true).order('name');
    if (error) throw error;
    return data || [];
  }

  async function loadDraftLogs(calculationId) {
    const [transport, electricity] = await Promise.all([
      supabase().from('transport_logs')
        .select('id,emission_factor_id,round_trip_distance_km,travel_days_per_month,passenger_count,notes,factor_basis_used,factor_value_used,factor_unit_used')
        .eq('calculation_id', calculationId),
      supabase().from('electricity_logs')
        .select('id,device_type_id,custom_device_name,emission_factor_id,power_watt,hours_per_day,days_per_month,notes,factor_value_used,factor_unit_used')
        .eq('calculation_id', calculationId)
    ]);
    if (transport.error) throw transport.error;
    if (electricity.error) throw electricity.error;
    return { transport: transport.data || [], electricity: electricity.data || [] };
  }

  async function saveTransport(calculationId, logs) {
    const { error } = await supabase().rpc('save_transport_activity_logs', {
      p_calculation_id: calculationId,
      p_logs: logs
    });
    if (error) throw error;
  }

  async function saveElectricity(calculationId, logs) {
    const { error } = await supabase().rpc('save_electricity_activity_logs', {
      p_calculation_id: calculationId,
      p_logs: logs
    });
    if (error) throw error;
  }

  async function finalizeIfBothCategories(calculationId, user, year, month) {
    const [transport, electricity] = await Promise.all([
      supabase().from('transport_logs').select('id', { count: 'exact', head: true }).eq('calculation_id', calculationId),
      supabase().from('electricity_logs').select('id', { count: 'exact', head: true }).eq('calculation_id', calculationId)
    ]);
    if (transport.error) throw transport.error;
    if (electricity.error) throw electricity.error;
    if ((transport.count || 0) < 1 || (electricity.count || 0) < 1) return false;

    const { error } = await supabase().rpc('finalize_carbon_calculation', { p_calculation_id: calculationId });
    if (error) throw error;
    localStorage.removeItem(draftKey(user.id, year, month));
    return true;
  }

  function setActiveDraft(user, year, month, id) {
    localStorage.setItem(draftKey(user.id, year, month), id);
  }

  function clearDraft(user, year, month) {
    localStorage.removeItem(draftKey(user.id, year, month));
  }

  function getPeriodFromUrlOrNow() {
    const params = new URLSearchParams(location.search);
    const now = new Date();
    return {
      year: Number(params.get('year')) || now.getFullYear(),
      month: Number(params.get('month')) || now.getMonth() + 1,
      calculationId: params.get('calculation_id') || null
    };
  }

  function redirectToOtherCalculator(page, calculationId, year, month) {
    const url = new URL(page, location.href);
    url.searchParams.set('calculation_id', calculationId);
    url.searchParams.set('year', year);
    url.searchParams.set('month', month);
    location.href = url.href;
  }

  window.CSCalc = {
    getUser, findDraft, getOrCreateDraft, loadFactors, loadTransportModes,
    loadDeviceTypes, loadDraftLogs, saveTransport, saveElectricity,
    finalizeIfBothCategories, setActiveDraft, clearDraft,
    getPeriodFromUrlOrNow, redirectToOtherCalculator
  };
})();
