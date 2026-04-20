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

// ── Dispositivo (localStorage — persiste entre sesiones) ────────
export const Dispositivo = {
  CLAVE: 'tpv_device',
  guardar(datos) { localStorage.setItem(this.CLAVE, JSON.stringify(datos)); },
  obtener() { try { return JSON.parse(localStorage.getItem(this.CLAVE)); } catch { return null; } },
  limpiar() { localStorage.removeItem(this.CLAVE); },
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

// ── Instalación PWA ────────────────────────────────────────────
let _promptInstalar = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _promptInstalar = e;
  const btn = document.getElementById('btn-instalar');
  if (btn) btn.style.display = 'flex';
});

window.addEventListener('appinstalled', () => {
  _promptInstalar = null;
  const btn = document.getElementById('btn-instalar');
  if (btn) btn.style.display = 'none';
  const ios = document.getElementById('banner-ios');
  if (ios) ios.style.display = 'none';
});

export function instalarPWA() {
  if (_promptInstalar) {
    _promptInstalar.prompt();
    _promptInstalar.userChoice.then(() => { _promptInstalar = null; });
  }
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

  // Banner iOS — mostrar si es Safari en iOS y no está instalada
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const esSafari = /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);
  const yaInstalada = window.navigator.standalone === true;
  if (esIOS && esSafari && !yaInstalada) {
    const banner = document.getElementById('banner-ios');
    if (banner) banner.style.display = 'block';
  }

  const { default: LoginCuenta } = await import('./LoginCuenta.js');
  const { default: LoginUsuario } = await import('./LoginUsuario.js');
  const { default: Terminal } = await import('./Terminal.js');
  const { default: Caja } = await import('./Caja.js');
  const { default: Main } = await import('./Main.js');
  const { default: Ticket } = await import('./Ticket.js');

  LoginCuenta.init();
  LoginUsuario.init();
  Terminal.init();
  Caja.init();
  Main.init();
  Ticket.init();

  // Auto-restore si el dispositivo ya tiene terminal registrada
  const dispositivo = Dispositivo.obtener();
  if (dispositivo?.uuid && dispositivo?.token_apisql) {
    mostrarLoading(true);
    try {
      // Restaurar sesión de entidad
      Sesion.set('token_apisql', dispositivo.token_apisql);
      Sesion.set('IDEntidad',    dispositivo.IDEntidad);
      Sesion.set('NombreFantasia', dispositivo.NombreFantasia);
      Sesion.set('RazonSocial',  dispositivo.RazonSocial);
      Sesion.set('RUC',          dispositivo.RUC);

      // Verificar que la terminal sigue válida
      const { verificarTerminal } = await import('./Terminal.js');
      const ok = await verificarTerminal();
      if (ok) {
        const { irAUsuario } = await import('./LoginCuenta.js');
        await irAUsuario();
      } else {
        Dispositivo.limpiar();
        mostrarPantalla('screen-cuenta');
      }
    } catch {
      Dispositivo.limpiar();
      mostrarPantalla('screen-cuenta');
    } finally {
      mostrarLoading(false);
    }
  } else {
    mostrarPantalla('screen-cuenta');
  }
}

document.addEventListener('DOMContentLoaded', init);
