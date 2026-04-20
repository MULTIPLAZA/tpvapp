// ── Configuración ──────────────────────────────────────────────
export const CONFIG = {
  APISQL_URL: 'https://apisql-production-665e.up.railway.app/sql',
  TOKEN_LICENCIA: 'f14614203049662d1a64097f13b8c4eafb7956fcabb1ed66db969a4e90379a56',
};

// ── Debug Log ──────────────────────────────────────────────────
const _logEntradas = [];

function _logAdd(sql, data, error, token, ms) {
  const t = new Date().toTimeString().slice(0, 8);
  const jwt = _decodeJWT(token);
  const conexion = jwt
    ? `${jwt.server || jwt.host || jwt.Server || '?'} / ${jwt.database || jwt.db || jwt.Database || '?'} / ${jwt.user || jwt.username || jwt.User || '?'}`
    : (token ? token.slice(0, 16) + '…' : '—');
  _logEntradas.unshift({ t, sql, data, error, conexion, ms });
  if (_logEntradas.length > 50) _logEntradas.pop();
  const badge = document.getElementById('debug-badge');
  if (badge) {
    const errores = _logEntradas.filter(e => e.error).length;
    badge.textContent = errores > 0 ? `⚠ ${errores}` : _logEntradas.length;
    badge.style.background = errores > 0 ? '#e74c3c' : '#0f3460';
  }
}

function _logMostrar() {
  const panel = document.getElementById('debug-panel');
  if (!panel) return;
  const visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : 'flex';
  if (!visible) _logRenderizar();
}

function _logRenderizar() {
  const lista = document.getElementById('debug-lista');
  if (!lista) return;
  if (!_logEntradas.length) { lista.innerHTML = '<p style="color:#888;padding:12px;text-align:center">Sin registros</p>'; return; }
  lista.innerHTML = _logEntradas.map(e => `
    <div style="border-bottom:1px solid #2a2a4a;padding:10px 12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:0.7rem;color:#888">${e.t}</span>
        <span style="font-size:0.7rem;color:#888">${e.ms != null ? e.ms + ' ms' : ''}</span>
        <span style="font-size:0.7rem;font-weight:700;color:${e.error ? '#e74c3c' : '#27ae60'}">${e.error ? 'ERROR' : 'OK'}</span>
      </div>
      <div style="font-size:0.68rem;color:#f5a623;margin-bottom:3px">${e.conexion}</div>
      <div style="font-size:0.72rem;color:#a0a0b0;word-break:break-all;font-family:monospace">${e.sql}</div>
      ${e.error ? `<div style="font-size:0.75rem;color:#e74c3c;margin-top:4px">${e.error}</div>` : ''}
      ${e.data && !e.error ? `<div style="font-size:0.7rem;color:#27ae60;margin-top:4px">${JSON.stringify(e.data).slice(0, 120)}…</div>` : ''}
    </div>
  `).join('');
}

function _decodeJWT(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

function _logInyectar() {
  document.body.insertAdjacentHTML('beforeend', `
    <button id="debug-btn"
      style="position:fixed;bottom:70px;right:12px;z-index:9500;background:#0f3460;border:1px solid #2a2a4a;
      border-radius:20px;color:#eaeaea;font-size:0.75rem;font-weight:700;padding:6px 12px;cursor:pointer;min-width:44px">
      <span id="debug-badge" style="background:#0f3460;border-radius:10px">0</span>
    </button>
    <div id="debug-panel" style="display:none;position:fixed;inset:0;z-index:9600;flex-direction:column;background:#1a1a2e">
      <div style="background:#16213e;border-bottom:1px solid #2a2a4a;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <span style="font-weight:700;font-size:0.9rem">Log APISQL</span>
        <div style="display:flex;gap:8px">
          <button id="debug-btn-limpiar"
            style="background:#2a2a4a;border:none;color:#a0a0b0;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.8rem">Limpiar</button>
          <button id="debug-btn-cerrar"
            style="background:#2a2a4a;border:none;color:#eaeaea;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.8rem">✕ Cerrar</button>
        </div>
      </div>
      <div id="debug-lista" style="flex:1;overflow-y:auto;font-size:0.78rem"></div>
    </div>
  `);
  document.getElementById('debug-btn').addEventListener('click', _logMostrar);
  document.getElementById('debug-btn-limpiar').addEventListener('click', () => {
    _logEntradas.length = 0;
    _logRenderizar();
    const badge = document.getElementById('debug-badge');
    if (badge) { badge.textContent = '0'; badge.style.background = '#0f3460'; }
  });
  document.getElementById('debug-btn-cerrar').addEventListener('click', () => {
    document.getElementById('debug-panel').style.display = 'none';
  });
}

// ── APISQL ─────────────────────────────────────────────────────
export async function LlamarSPMulti(accion, params = {}, tokenOverride = null) {
  return _llamar('multi', accion, params, tokenOverride);
}

export async function LlamarSP(accion, params = {}, tokenOverride = null) {
  return _llamar('', accion, params, tokenOverride);
}

async function _llamar(modo, accion, params = {}, tokenOverride = null) {
  const token = tokenOverride ?? Sesion.get('token_apisql');

  const paramStr = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `@${k}='${v}'`)
    .join(', ');

  const sql = `Exec SpTPVApp @Accion='${accion}'${paramStr ? ', ' + paramStr : ''}`;
  const url  = CONFIG.APISQL_URL + (modo ? `/${modo}` : '');

  let data;
  const t0 = performance.now();
  try {
    if (!token) throw new Error('Sin token de conexión');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ sp: sql }),
    });
    if (!res.ok) {
      let msg = `Error HTTP ${res.status}`;
      try { const b = await res.json(); msg = b.error || b.message || b.detail || msg; } catch {}
      throw new Error(msg);
    }
    data = await res.json();
    if (data.error) throw new Error(data.error);
    _logAdd(sql, data, null, token, Math.round(performance.now() - t0));
    return data;
  } catch (err) {
    _logAdd(sql, null, err.message, token, Math.round(performance.now() - t0));
    throw err;
  }
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

// ── Helper: interpreta Procesado independiente del tipo ────────
export const esProcesado = v => v === true || v === 1 || String(v).toLowerCase() === 'true';

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

  _logInyectar();

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
  const { default: Ticket }       = await import('./Ticket.js');
  const { default: TicketsLista } = await import('./TicketsLista.js');

  LoginCuenta.init();
  LoginUsuario.init();
  Terminal.init();
  Caja.init();
  Main.init();
  Ticket.init();
  TicketsLista.init();

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
