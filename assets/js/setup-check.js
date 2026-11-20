document.addEventListener("DOMContentLoaded", async () => {
  const target = document.getElementById("setupCheckOutput");
  if (!target) return;
  const lines = [];
  lines.push(`Supabase configured: ${Boolean(window.csSupabaseConfigured)}`);
  if (window.csSupabase) {
    const { data, error } = await window.csSupabase.auth.getUser();
    lines.push(`Authenticated: ${Boolean(data?.user)}`);
    if (error) lines.push(`Auth check: ${error.message}`);
  }
  target.textContent = lines.join("\n");
});
