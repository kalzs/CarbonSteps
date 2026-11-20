(async function () {
  const $ = CS.$;
  let original = null;
  function fill(profile, user) {
    const values = {
      profileFullName: profile?.full_name || user.user_metadata?.full_name || '',
      profileNim: profile?.nim || user.user_metadata?.nim || '',
      profileStudyProgram: profile?.study_program || '',
      profileFaculty: profile?.faculty || '',
      profileCampus: profile?.campus || '',
      profileTheme: profile?.theme_preference || 'dark'
    };
    Object.entries(values).forEach(([id,value]) => { const el = document.getElementById(id); if (el) el.value = value; });
    $('#profileEmailReadonly').value = user.email || '';
    CS.setText('profileDisplayName',values.profileFullName || 'Mahasiswa');
    CS.setText('profileDisplayNim',values.profileNim ? `NIM: ${values.profileNim}` : 'NIM belum diisi');
    CS.setText('profileEmail',user.email || '—');
    CS.setText('profileInitial',(values.profileFullName || 'M').trim().charAt(0).toUpperCase());
    CS.setText('profileThemeSummary',values.profileTheme === 'light' ? 'Light' : 'Dark');
    document.body.classList.toggle('light-theme',values.profileTheme === 'light');
    original = values;
  }
  function valuesFromForm() {
    return {
      profileFullName: $('#profileFullName').value.trim(),
      profileNim: $('#profileNim').value.trim(),
      profileStudyProgram: $('#profileStudyProgram').value.trim(),
      profileFaculty: $('#profileFaculty').value.trim(),
      profileCampus: $('#profileCampus').value.trim(),
      profileTheme: $('#profileTheme').value
    };
  }
  async function init() {
    const user = await CS.getAuthenticatedUser(); if (!user) return;
    await CS.loadProfileName(user); await CS.applySavedTheme(user);
    const [{ data: profile, error }, records] = await Promise.all([
      window.csSupabase.from('profiles').select('id,full_name,nim,study_program,faculty,campus,theme_preference').eq('id',user.id).maybeSingle(),
      window.csSupabase.from('carbon_calculations').select('id',{count:'exact',head:true}).eq('user_id',user.id)
    ]);
    if (error) throw error;
    if (records.error) throw records.error;
    fill(profile, user);
    CS.setText('profileCalculationCount',String(records.count || 0));
  }
  $('#profileForm').addEventListener('submit',async event => {
    event.preventDefault();
    const button = $('#saveProfileButton'); button.disabled = true; button.textContent = 'Menyimpan...';
    try {
      const user = await CS.getAuthenticatedUser(); if (!user) return;
      const values = valuesFromForm();
      if (!values.profileFullName) throw new Error('Nama lengkap wajib diisi.');
      if (!/^\d{10}$/.test(values.profileNim)) throw new Error('NIM harus terdiri dari 10 digit angka.');
      const payload = {
        id:user.id, full_name:values.profileFullName, nim:values.profileNim || null,
        study_program:values.profileStudyProgram || null, faculty:values.profileFaculty || null,
        campus:values.profileCampus || null, theme_preference:values.profileTheme, updated_at:new Date().toISOString()
      };
      const { error } = await window.csSupabase.from('profiles').upsert(payload,{onConflict:'id'});
      if (error) throw error;
      const { error: metadataError } = await window.csSupabase.auth.updateUser({data:{full_name:values.profileFullName,nim:values.profileNim}});
      if (metadataError) console.warn('Metadata autentikasi tidak ikut diperbarui; profil database sudah tersimpan:', metadataError.message);
      fill({...payload},user);
      await CS.loadProfileName(user);
      CS.showToast('Profil berhasil diperbarui.','success');
    } catch (error) {
      console.error(error);
      CS.showAlert('pageAlert',/profiles_nim_key|duplicate key|unique constraint/i.test(error.message) ? 'NIM sudah digunakan akun lain.' : (error.message || 'Gagal menyimpan profil.'),'error');
    } finally { button.disabled = false; button.textContent = 'Simpan Perubahan'; }
  });
  $('#resetProfileButton').addEventListener('click',()=>{
    if (!original) return;
    Object.entries(original).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.value=value;});
    CS.hideAlert('pageAlert');
  });
  $('#profileTheme').addEventListener('change',event=>document.body.classList.toggle('light-theme',event.target.value==='light'));
  try { await init(); } catch(error) { console.error(error); CS.showAlert('pageAlert',error.message || 'Gagal memuat profil.','error'); }
})();
