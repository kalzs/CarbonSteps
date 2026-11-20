(function initCarbonStepsSupabase() {
  const cfg = window.CARBONSTEPS_CONFIG || {};
  const validUrl = typeof cfg.supabaseUrl === "string" &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(cfg.supabaseUrl);
  const validKey = typeof cfg.supabaseAnonKey === "string" &&
    cfg.supabaseAnonKey.length > 20 &&
    !cfg.supabaseAnonKey.includes("YOUR_");

  window.csSupabase = null;
  window.csSupabaseConfigured = Boolean(validUrl && validKey && window.supabase);
  // Login page changes this value from the existing "Ingat saya" checkbox.
  window.CS_AUTH_REMEMBER = true;

  if (!window.csSupabaseConfigured) return;

  const storageAdapter = {
    async getItem(key) {
      return sessionStorage.getItem(key) ?? localStorage.getItem(key);
    },
    async setItem(key, value) {
      // Keep the session in the storage where it already lives on later pages.
      // Only a brand-new sign-in uses the login checkbox preference.
      const alreadyInSession = sessionStorage.getItem(key) !== null;
      const alreadyInLocal = localStorage.getItem(key) !== null;
      const persistent = alreadyInSession
        ? false
        : alreadyInLocal
          ? true
          : window.CS_AUTH_REMEMBER !== false;
      const target = persistent ? localStorage : sessionStorage;
      const other = persistent ? sessionStorage : localStorage;
      other.removeItem(key);
      target.setItem(key, value);
    },
    async removeItem(key) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
  };

  window.csSupabase = window.supabase.createClient(
    cfg.supabaseUrl,
    cfg.supabaseAnonKey,
    {
      auth: {
        storage: storageAdapter,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );
})();
