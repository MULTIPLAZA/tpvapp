import { LlamarSP, Sesion, mostrarPantalla, mostrarLoading, mostrarToast } from './App.js';

const LS_KEY = () => `tpv_terminal_${Sesion.get('IDEntidad')}`;

// ── Verificar si el dispositivo ya tiene terminal registrada ──
export async function verificarTerminal() {
  const guardado = JSON.parse(localStorage.getItem(LS_KEY()) || 'null');
  if (!guardado?.uuid) return false;

  try {
    const rows = await LlamarSP('VERIFICAR_TERMINAL', {
      IDEntidad: Sesion.get('IDEntidad'),
      UUID: guardado.uuid,
    });
    if (!rows?.length || rows[0].Mensaje) return false;

    // Terminal válida — guardar en sesión
    _guardarTerminalEnSesion({ ...rows[0], uuid: guardado.uuid });
    return true;
  } catch {
    return false;
  }
}

function _guardarTerminalEnSesion(t) {
  Sesion.set('IDTerminal', t.IDTerminal);
  Sesion.set('NombreTerminal', t.NombreTerminal);
  Sesion.set('NombreSucursal', t.NombreSucursal);
  Sesion.set('IDSucursal', t.IDSucursal);
  Sesion.set('IDDeposito', t.IDDeposito);
}

function _guardarTerminalEnLocal(t, uuid) {
  localStorage.setItem(LS_KEY(), JSON.stringify({
    uuid,
    IDTerminal: t.IDTerminal,
    NombreTerminal: t.NombreTerminal,
    NombreSucursal: t.NombreSucursal,
    IDSucursal: t.IDSucursal,
    IDDeposito: t.IDDeposito,
  }));
}

// ── Pantalla de registro ──
let _depositoSeleccionado = null;
let _uuid = null;

async function cargar() {
  _depositoSeleccionado = null;
  _uuid = crypto.randomUUID();
  document.getElementById('reg-paso2').style.display = 'none';
  document.getElementById('inp-nombre-terminal').value = '';
  document.getElementById('reg-uuid').textContent = _uuid;
  document.getElementById('reg-empresa').textContent = Sesion.get('NombreFantasia') || Sesion.get('RazonSocial');

  mostrarLoading(true);
  try {
    const rows = await LlamarSP('LISTAR_SUCURSALES', { IDEntidad: Sesion.get('IDEntidad') });
    renderDepositos(rows || []);
  } catch (err) {
    mostrarToast(err.message || 'Error al cargar depósitos', 'error');
  } finally {
    mostrarLoading(false);
  }
}

function renderDepositos(lista) {
  const contenedor = document.getElementById('lista-depositos');
  contenedor.innerHTML = '';

  const activos = lista.filter(d => d.Activo === true || d.Activo === 'True' || d.Activo === 1);

  if (!activos.length) {
    contenedor.innerHTML = '<p style="color:var(--text2);text-align:center;padding:20px">Sin depósitos disponibles</p>';
    return;
  }

  activos.forEach(d => {
    const div = document.createElement('div');
    div.className = 'item-card';
    div.dataset.id = d.IDDeposito;
    div.innerHTML = `<div><div class="nombre">${d.Descripcion}</div></div><span style="color:var(--text2);font-size:1.2rem">›</span>`;
    div.addEventListener('click', () => seleccionarDeposito(d, div));
    contenedor.appendChild(div);
  });
}

function seleccionarDeposito(deposito, el) {
  document.querySelectorAll('#lista-depositos .item-card').forEach(c => c.style.borderColor = '');
  el.style.borderColor = 'var(--accent)';
  _depositoSeleccionado = deposito;
  document.getElementById('reg-deposito-nombre').textContent = deposito.Descripcion;
  document.getElementById('reg-paso2').style.display = 'block';
  document.getElementById('inp-nombre-terminal').focus();
}

async function registrar() {
  const nombre = document.getElementById('inp-nombre-terminal').value.trim();
  if (!nombre) { mostrarToast('Ingrese un nombre para la terminal', 'error'); return; }
  if (!_depositoSeleccionado) { mostrarToast('Seleccione un depósito', 'error'); return; }

  mostrarLoading(true);
  try {
    const rows = await LlamarSP('REGISTRAR_TERMINAL', {
      IDEntidad: Sesion.get('IDEntidad'),
      IDDeposito: _depositoSeleccionado.IDDeposito,
      UUID: _uuid,
      DescripcionTerminal: nombre,
    });

    if (!rows?.length || rows[0].Mensaje) throw new Error(rows[0]?.Mensaje || 'Error al registrar');

    _guardarTerminalEnLocal(rows[0], _uuid);
    _guardarTerminalEnSesion({ ...rows[0], uuid: _uuid });

    mostrarToast(`Terminal "${rows[0].NombreTerminal}" registrada. Ingrese nuevamente.`, 'exito');
    setTimeout(() => window.location.reload(), 1500);
  } catch (err) {
    mostrarToast(err.message || 'Error al registrar terminal', 'error');
  } finally {
    mostrarLoading(false);
  }
}

function init() {
  document.getElementById('btn-reg-registrar').addEventListener('click', registrar);
  document.getElementById('btn-reg-volver').addEventListener('click', () => mostrarPantalla('screen-cuenta'));
}

export default { init, cargar, verificarTerminal };
