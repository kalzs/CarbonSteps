(function () {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function formatNumber(value, digits = 1) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return number.toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: 2 });
  }

  function formatCO2(value) {
    return `${formatNumber(value, 1)} kg CO₂e`;
  }

  function formatDate(value, includeTime = true) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleString("id-ID", includeTime
      ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
      : { day: "2-digit", month: "short", year: "numeric" });
  }

  function formatPeriod(month, year) {
    const monthNumber = Number(month);
    const yearNumber = Number(year);
    if (!monthNumber || !yearNumber) return "Periode tidak tersedia";
    return new Date(yearNumber, monthNumber - 1, 1).toLocaleDateString("id-ID", {
      month: "long", year: "numeric"
    });
  }

  function showAlert(elementOrId, message, type = "info") {
    const element = typeof elementOrId === "string" ? document.getElementById(elementOrId) : elementOrId;
    if (!element) return;
    element.className = `alert show ${type}`;
    element.textContent = message;
    element.hidden = false;
  }

  function hideAlert(elementOrId) {
    const element = typeof elementOrId === "string" ? document.getElementById(elementOrId) : elementOrId;
    if (!element) return;
    element.className = "alert";
    element.textContent = "";
    element.hidden = true;
  }

  function showToast(message, type = "info") {
    let toast = document.getElementById("appToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "appToast";
      toast.className = "toast-message";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.dataset.type = type;
    toast.classList.add("visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("visible"), 3600);
  }

  function relationObject(relation) {
    return Array.isArray(relation) ? (relation[0] || null) : (relation || null);
  }

  function getNestedName(relation, fallback = "") {
    if (Array.isArray(relation)) return relation[0]?.name || fallback;
    return relation?.name || fallback;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value ?? "—";
  }

  function downloadCSV(filename, rows) {
    if (!rows.length) {
      showToast("Tidak ada data untuk diekspor.", "info");
      return;
    }
    const headers = Object.keys(rows[0]);
    const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const content = [headers.map(csvCell).join(","), ...rows.map(row => headers.map(key => csvCell(row[key])).join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function getAuthenticatedUser() {
    if (!window.csSupabaseConfigured || !window.csSupabase) {
      throw new Error("Supabase belum dikonfigurasi. Isi assets/js/config.js terlebih dahulu.");
    }
    const { data, error } = await window.csSupabase.auth.getUser();
    if (error) throw error;
    if (!data.user) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `${window.location.pathname.includes("/pages/") ? "../" : ""}login.html?next=${next}`;
      return null;
    }
    return data.user;
  }

  async function loadProfileName(user) {
    if (!user || !window.csSupabase) return;
    const nameElement = document.getElementById("currentUserName");
    const avatarElement = document.getElementById("currentUserAvatar");
    let name = user.user_metadata?.full_name || user.email || "Mahasiswa";
    try {
      const { data } = await window.csSupabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.full_name?.trim()) name = data.full_name.trim();
    } catch (error) {
      console.warn("Profil belum dapat dimuat:", error.message);
    }
    if (nameElement) nameElement.textContent = name;
    if (avatarElement) avatarElement.textContent = name.trim().charAt(0).toUpperCase() || "M";
  }

  async function logout() {
    if (!window.csSupabase) return;
    const { error } = await window.csSupabase.auth.signOut();
    if (error) {
      showToast(`Gagal keluar: ${error.message}`, "error");
      return;
    }
    window.location.href = window.location.pathname.includes("/pages/") ? "../login.html" : "login.html";
  }

  function attachSharedControls() {
    $$("[data-logout]").forEach(button => button.addEventListener("click", logout));
    $$("[data-placeholder-link]").forEach(link => link.addEventListener("click", event => {
      event.preventDefault();
      showToast("Halaman ini akan disambungkan setelah bagian anggota kelompok lainnya digabungkan.");
    }));
  }

  function setPageLoading(id, isLoading, message = "Memuat data...") {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = !isLoading;
    if (isLoading) el.textContent = message;
  }

  window.CS = {
    $, $$, escapeHTML, formatNumber, formatCO2, formatDate, formatPeriod, relationObject,
    showAlert, hideAlert, showToast, getNestedName, setText, downloadCSV,
    getAuthenticatedUser, loadProfileName, logout, attachSharedControls, setPageLoading
  };

  document.addEventListener("DOMContentLoaded", () => {
    attachSharedControls();
    const configNotice = document.getElementById("configNotice");
    if (configNotice && !window.csSupabaseConfigured) {
      configNotice.hidden = false;
      configNotice.textContent = "Supabase belum dikonfigurasi. Isi Project URL dan publishable/anon key di assets/js/config.js.";
    }
  });
})();
