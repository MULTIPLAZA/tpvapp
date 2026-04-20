// ── Configuración ──────────────────────────────────────────────
export const CONFIG = {
  APISQL_URL: 'https://apisql-production-665e.up.railway.app/sql',
  TOKEN_LICENCIA: 'f14614203049662d1a64097f13b8c4eafb7956fcabb1ed66db969a4e90379a56',
};

// ── APISQL ─────────────────────────────────────────────────────
export async function LlamarSP(accion, params = {}, tokenOverride = null) {
  const token = tokenOverride ?? Sesion.get('token_apisql');
  if (!token) throw new Error('Sin token de conexión');

  const paramStr = Object.entries(params)
    .map(([k, v]) => `@${k}='${v}'`)
    .join(', ');

  const sql = `Exec SpTPVApp @Accion='${accion}'${paramStr ? ', ' + paramStr : ''}`;

  const res = await fetch(CONFIG.APISQL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ sp: sql }),
  });

  if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ── Sesión (sessionStorage) ─────────────────────────────────────
export const Sesion = {
  set(k, v) { sessionStorage.setItem(`tpv_${k}`, typeof v === 'object' ? JSON.stringify(v) : v); },
  get(k) {
    const v = sessionStorage.getItem(`tpv_${k}`);
    try { return JSON.parse(v); } catch { return v; }
  },
  clear() { Object.keys(sessionStorage).filter(k => k.startsWith('tpv_')).forEach(k => sessionStorage.removeItem(k)); },
  existe() { return !!sessionStorage.getItem('tpv_token_apisql'); },
};

// ── Router ─────────────────────────────────────────────────────
export function mostrarPantalla(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('activa'));
  const pantalla = document.getElementById(id);
  if (pantalla) pantalla.classList.add('activa');
}

// ── UI helpers ─────────────────────────────────────────────────
export function mostrarLoading(visible) {
  document.getElementById('loading').classList.toggle('visible', visible);
}

let _toastTimer;
export function mostrarToast(msg, tipo = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = tipo;
  t.style.display = 'block';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.style.display = 'none'; }, 3000);
}

// ── Verificar conexión ──────────────────────────────────────────
async function verificarConexion() {
  if (!navigator.onLine) {
    alert('Sin conexión a internet. La aplicación se cerrará.');
    window.location.href = 'about:blank';
    return false;
  }
  return true;
}

window.addEventListener('offline', () => {
  alert('Se perdió la conexión. La aplicación se cerrará.');
  Sesion.clear();
  window.location.reload();
});

// ── Init ────────────────────────────────────────────────────────
async function init() {
  if (!await verificarConexion()) return;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  const { default: LoginCuenta } = await import('./LoginCuenta.js');
  const { default: LoginUsuario } = await import('./LoginUsuario.js');
  const { default: Terminal } = await import('./Terminal.js');
  const { default: Main } = await import('./Main.js');

  LoginCuenta.init();
  LoginUsuario.init();
  Terminal.init();
  Main.init();

  mostrarPantalla('screen-cuenta');
}

document.addEventListener('DOMContentLoaded', init);
