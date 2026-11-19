document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("regForm");
  const fullNameInput = document.getElementById("fullName");
  const nimInput = document.getElementById("nim");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirmPassword");
  const submitButton = document.getElementById("submitBtn");
  const feedback = document.getElementById("authFeedback");
  const configNotice = document.getElementById("configNotice");

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

  // Preserve the password visibility controls from the supplied Stitch layout.
  window.toggleVisibility = function toggleVisibility(inputId, button) {
    const input = document.getElementById(inputId);
    const icon = button?.querySelector(".material-symbols-outlined");
    if (!input) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    if (icon) icon.textContent = show ? "visibility_off" : "visibility";
  };

  if (!window.csSupabaseConfigured || !window.csSupabase) {
    if (configNotice) {
      configNotice.hidden = false;
      configNotice.textContent = "Supabase belum dikonfigurasi. Isi Project URL dan publishable/anon key pada assets/js/config.js.";
    }
    if (submitButton) submitButton.disabled = true;
    return;
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const originalHTML = submitButton?.innerHTML;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.innerHTML = '<span class="material-symbols-outlined animate-spin text-lg">sync</span><span>Membuat akun...</span>';
    }

    try {
      const fullName = fullNameInput.value.trim();
      const nim = nimInput.value.trim();
      const email = emailInput.value.trim().toLowerCase();
      const password = passwordInput.value;
      const confirmPassword = confirmInput.value;

      if (!fullName) throw new Error("Nama lengkap wajib diisi.");
      if (!/^\d{10}$/.test(nim)) {
        throw new Error("NIM harus terdiri dari 10 digit angka sesuai format pada formulir.");
      }
      if (password.length < 8) throw new Error("Kata sandi minimal 8 karakter.");
      if (password !== confirmPassword) throw new Error("Konfirmasi kata sandi tidak cocok.");

      // Default registration session is persistent when Supabase returns a session.
      window.CS_AUTH_REMEMBER = true;

      const redirectUrl = new URL("login.html", window.location.href).toString();
      const { data, error } = await window.csSupabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            nim: nim
          },
          emailRedirectTo: redirectUrl
        }
      });

      if (error) throw error;

      if (data.session) {
        showMessage("Registrasi berhasil. Mengarahkan ke halaman aplikasi...", "success");
        window.location.replace("pages/riwayat.html");
      } else {
        showMessage("Registrasi berhasil. Silakan periksa email untuk verifikasi, lalu masuk melalui halaman Login.", "success");
        form.reset();
      }
    } catch (error) {
      const message = error.message || "Registrasi gagal.";
      if (/profiles_nim_key|duplicate key|unique constraint/i.test(message)) {
        showMessage("NIM sudah terdaftar. Periksa kembali NIM yang dimasukkan.", "error");
      } else {
        showMessage(message, "error");
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        if (originalHTML) submitButton.innerHTML = originalHTML;
      }
    }
  });
});
