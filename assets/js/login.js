document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("auth-form");
  const emailInput = document.getElementById("student-id");
  const passwordInput = document.getElementById("student-password");
  const rememberInput = document.getElementById("remember-session");
  const submitButton = document.getElementById("submit-login");
  const feedback = document.getElementById("authFeedback");
  const configNotice = document.getElementById("configNotice");
  const toggleButton = document.getElementById("toggle-password");
  const eyeIcon = document.getElementById("eye-icon");
  const resetLink = document.getElementById("reset-password-link");

  function showMessage(message, type = "info") {
    if (!feedback) return;
    feedback.hidden = false;
    feedback.textContent = message;
    feedback.className = "rounded-lg px-3 py-2 text-sm " +
      (type === "error"
        ? "border border-error/40 bg-error-container/20 text-error"
        : type === "success"
          ? "border border-primary/40 bg-primary-container/20 text-primary"
          : "border border-outline-variant bg-surface-container-low text-on-surface-variant");
  }

  function getNextPage() {
    const fallback = new URL("pages/dashboard.html", window.location.href);
    const raw = new URLSearchParams(window.location.search).get("next");
    if (!raw) return fallback.href;
    try {
      const candidate = new URL(raw, window.location.origin);
      if (candidate.origin !== window.location.origin) return fallback.href;
      if (["/login.html", "/register.html"].includes(candidate.pathname)) return fallback.href;
      return candidate.href;
    } catch {
      return fallback.href;
    }
  }

  if (toggleButton && passwordInput && eyeIcon) {
    toggleButton.addEventListener("click", () => {
      const show = passwordInput.type === "password";
      passwordInput.type = show ? "text" : "password";
      eyeIcon.textContent = show ? "visibility_off" : "visibility";
    });
  }

  if (!window.csSupabaseConfigured || !window.csSupabase) {
    if (configNotice) {
      configNotice.hidden = false;
      configNotice.textContent = "Supabase belum dikonfigurasi. Isi Project URL dan publishable/anon key pada assets/js/config.js.";
    }
    if (submitButton) submitButton.disabled = true;
    return;
  }

  // If an authenticated session already exists, proceed to the application.
  window.csSupabase.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.warn("Tidak dapat memeriksa sesi:", error.message);
      return;
    }
    if (data.session) window.location.replace(getNextPage());
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const originalHTML = submitButton?.innerHTML;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = '<span class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span><span>Memvalidasi akun...</span>';
    }

    try {
      const email = emailInput.value.trim().toLowerCase();
      const password = passwordInput.value;
      // The original checkbox now controls whether Supabase stores the session
      // in localStorage (checked) or sessionStorage (unchecked).
      window.CS_AUTH_REMEMBER = Boolean(rememberInput?.checked);

      const { error } = await window.csSupabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      window.location.replace(getNextPage());
    } catch (error) {
      showMessage(error.message || "Login gagal. Periksa email dan kata sandi.", "error");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        if (originalHTML) submitButton.innerHTML = originalHTML;
      }
    }
  });

  // Password recovery is not included in this two-page change yet.
  resetLink?.addEventListener("click", (event) => {
    event.preventDefault();
    showMessage("Fitur lupa kata sandi belum diaktifkan. Untuk saat ini, hubungi pengelola aplikasi.", "info");
  });
});
