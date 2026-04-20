import { LlamarSP, Sesion, mostrarPantalla, mostrarLoading, mostrarToast } from './App.js';

const fmtGs = n => 'Gs ' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

let _IDTransaccion = null;

export async function cargar() {
  document.getElementById('main-terminal').textContent = Sesion.get('NombreTerminal') || '';
  document.getElementById('main-empresa').textContent = Sesion.get('NombreFantasia') || Sesion.get('RazonSocial') || '';
  document.getElementById('main-usuario').textContent = Sesion.get('NombreUsuario') || '';

  const existente = Sesion.get('IDTransaccion');
  if (existente) {
    _IDTransaccion = existente;
    await refrescarBarra();
  } else {
    await _nuevoTicket();
  }
  await _cargarCategorias();
}

export async function nuevoTicket() {
  await _nuevoTicket();
  _actualizarBarra([]);
  await _cargarCategorias();
}

export async function refrescarBarra() {
  const IDEntidad = Sesion.get('IDEntidad');
  try {
    const items = await LlamarSP('TICKET_DETALLE', { IDEntidad, IDTransaccion: _IDTransaccion });
    _actualizarBarra(items || []);
  } catch { /* silencioso */ }
}

function _actualizarBarra(items) {
  const num = Sesion.get('TicketNumero') || '';
  const el = document.getElementById('main-ticket-info');
  if (!items.length) {
    el.textContent = `#${num} — Vacío`;
    return;
  }
  const total = items.reduce((s, r) => s + (r.Total || 0), 0);
  el.textContent = `#${num} — ${items.length} ítem${items.length !== 1 ? 's' : ''} — ${fmtGs(total)}`;
}

async function _nuevoTicket() {
  const IDEntidad        = Sesion.get('IDEntidad');
  const IDTransaccionCaja = Sesion.get('IDTransaccionCaja');
  const IDUsuario        = Sesion.get('IDUsuario');
  mostrarLoading(true);
  try {
    const rows = await LlamarSP('NUEVO_TICKET', { IDEntidad, IDTransaccion: IDTransaccionCaja, IDUsuario });
    if (!rows?.length) throw new Error('No se pudo crear ticket');
    if (rows[0].Mensaje) throw new Error(rows[0].Mensaje);
    _IDTransaccion = rows[0].IDTransaccion;
    Sesion.set('IDTransaccion', _IDTransaccion);
    Sesion.set('TicketNumero', rows[0].Numero);
  } finally {
    mostrarLoading(false);
  }
}

async function _cargarCategorias() {
  const IDEntidad = Sesion.get('IDEntidad');
  mostrarLoading(true);
  try {
    const rows = await LlamarSP('CATEGORIAS', { IDEntidad });
    const cont = document.getElementById('main-categorias');
    cont.innerHTML = '';
    cont.appendChild(_crearCatBtn('Todos', 0, true));
    (rows || []).forEach(r => cont.appendChild(_crearCatBtn(r.Descripcion, r.IDTipoProducto, false)));
    await _cargarProductos(0);
  } catch (err) {
    mostrarToast(err.message || 'Error al cargar categorías', 'error');
  } finally {
    mostrarLoading(false);
  }
}

function _crearCatBtn(texto, id, activa) {
  const btn = document.createElement('button');
  btn.className = 'cat-btn' + (activa ? ' activa' : '');
  btn.textContent = texto;
  btn.addEventListener('click', async () => {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('activa'));
    btn.classList.add('activa');
    await _cargarProductos(id);
  });
  return btn;
}

async function _cargarProductos(IDTipoProducto) {
  const IDEntidad = Sesion.get('IDEntidad');
  const IDDeposito = Sesion.get('IDDeposito');
  mostrarLoading(true);
  try {
    const rows = await LlamarSP('PRODUCTOS', { IDEntidad, IDTipoProducto, IDDeposito });
    const cont = document.getElementById('main-productos');
    cont.innerHTML = '';
    if (!rows?.length) {
      cont.innerHTML = '<p style="color:var(--text2);text-align:center;padding:32px;grid-column:1/-1">Sin productos</p>';
      return;
    }
    rows.forEach(p => {
      const card = document.createElement('div');
      card.className = 'prod-card';
      card.innerHTML = `<div class="prod-nombre">${p.Descripcion}</div><div class="prod-precio">${fmtGs(p.Precio)}</div>`;
      card.addEventListener('click', () => _agregarItem(p));
      cont.appendChild(card);
    });
  } catch (err) {
    mostrarToast(err.message || 'Error al cargar productos', 'error');
  } finally {
    mostrarLoading(false);
  }
}

async function _agregarItem(producto) {
  if (!_IDTransaccion) return;
  const IDEntidad = Sesion.get('IDEntidad');
  mostrarLoading(true);
  try {
    const rows = await LlamarSP('AGREGAR_ITEM', {
      IDEntidad, IDTransaccion: _IDTransaccion,
      IDProducto: producto.IDProducto, Cantidad: 1,
    });
    if (!rows?.length) throw new Error('Sin respuesta');
    if (String(rows[0].Procesado) !== 'True') throw new Error(rows[0].Mensaje || 'Error al agregar');
    await refrescarBarra();
    mostrarToast(producto.Descripcion, 'exito');
  } catch (err) {
    mostrarToast(err.message || 'Error al agregar', 'error');
  } finally {
    mostrarLoading(false);
  }
}

function init() {
  document.getElementById('btn-main-salir').addEventListener('click', () => {
    import('./LoginUsuario.js').then(m => m.mostrar(true));
  });

  document.getElementById('btn-ver-ticket').addEventListener('click', async () => {
    const { default: Ticket } = await import('./Ticket.js');
    mostrarPantalla('screen-ticket');
    await Ticket.cargar(_IDTransaccion);
  });
}

export default { init, cargar, nuevoTicket, refrescarBarra };
