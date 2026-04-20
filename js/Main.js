import { LlamarSP, Sesion, mostrarPantalla, mostrarLoading, mostrarToast, esProcesado } from './App.js';

const fmtGs = n => 'Gs ' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

let _IDTransaccion = null;

export async function cargar() {
  const empresa  = Sesion.get('NombreFantasia') || Sesion.get('RazonSocial') || '';
  const terminal = Sesion.get('NombreTerminal') || '';
  const usuario  = Sesion.get('NombreUsuario')  || '';
  const version  = document.querySelector('#screen-cuenta .logo-sub small')?.textContent || '';

  document.getElementById('main-empresa').textContent  = empresa;
  document.getElementById('main-sub').textContent      = [terminal, usuario].filter(Boolean).join(' · ');
  document.getElementById('main-version').textContent  = version;

  const existente = Sesion.get('IDTransaccion');
  if (existente) {
    _IDTransaccion = existente;
    await _actualizarFooter();
  } else {
    await _nuevoTicket();
  }
  await _cargarCategorias();
}

export async function nuevoTicket() {
  Sesion.set('IDTransaccion', '');
  await _nuevoTicket();
  _setFooter([], Sesion.get('TicketNumero'));
  await _cargarCategorias();
}

export async function refrescarBarra() {
  await _actualizarFooter();
}

async function _actualizarFooter() {
  const IDEntidad = Sesion.get('IDEntidad');
  try {
    const items = await LlamarSP('TICKET_DETALLE', { IDEntidad, IDTransaccion: _IDTransaccion });
    _setFooter(items || [], Sesion.get('TicketNumero'));
  } catch { /* silencioso */ }
}

function _setFooter(items, num) {
  const total    = items.reduce((s, r) => s + (r.Total || 0), 0);
  const count    = items.length;

  document.getElementById('main-ticket-num').textContent   = num ? `#${num}` : '#—';
  document.getElementById('main-ticket-total').textContent = fmtGs(total);
  document.getElementById('btn-cobrar-main').disabled      = count === 0;

  const span = document.getElementById('main-items-count');
  if (span) span.textContent = count;
  document.getElementById('btn-ticket-badge')?.classList.toggle('tiene-items', count > 0);

  _renderPanelInline(items);
}

function _renderPanelInline(items) {
  const cont = document.getElementById('main-ticket-panel-items');
  const totalEl = document.getElementById('main-ticket-panel-total');
  if (!cont) return;
  if (!items.length) {
    cont.innerHTML = '<p style="color:var(--text2);text-align:center;padding:20px;font-size:0.8rem">Vacío</p>';
    if (totalEl) totalEl.textContent = 'Gs 0';
    return;
  }
  const total = items.reduce((s, r) => s + (r.Total || 0), 0);
  if (totalEl) totalEl.textContent = fmtGs(total);
  cont.innerHTML = items.map(i => `
    <div class="panel-item">
      <div>
        <div class="panel-item-nombre">${i.Descripcion}</div>
        <div class="panel-item-det">${parseFloat(i.Cantidad)} × ${fmtGs(i.PrecioUni)}</div>
      </div>
      <div style="font-size:0.82rem;font-weight:700">${fmtGs(i.Total)}</div>
    </div>
  `).join('');
}

async function _nuevoTicket() {
  const IDEntidad         = Sesion.get('IDEntidad');
  const IDTransaccionCaja = Sesion.get('IDTransaccionCaja');
  const IDUsuario         = Sesion.get('IDUsuario');
  mostrarLoading(true);
  try {
    const rows = await LlamarSP('NUEVO_TICKET', { IDEntidad, IDTransaccionCaja, IDUsuario });
    if (!rows?.length) throw new Error('No se pudo crear ticket');
    if (rows[0].Mensaje) throw new Error(rows[0].Mensaje);
    _IDTransaccion = rows[0].IDTransaccion;
    Sesion.set('IDTransaccion', _IDTransaccion);
    Sesion.set('TicketNumero', rows[0].Numero);
    _setFooter([], rows[0].Numero);
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
  const IDEntidad  = Sesion.get('IDEntidad');
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
    if (!esProcesado(rows[0].Procesado)) throw new Error(rows[0].Mensaje || 'Error al agregar');
    await _actualizarFooter();
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

  document.getElementById('btn-ticket-badge').addEventListener('click', async () => {
    const { default: Ticket } = await import('./Ticket.js');
    mostrarPantalla('screen-ticket');
    await Ticket.cargar(_IDTransaccion);
  });

  document.getElementById('btn-ticket-lista').addEventListener('click', async () => {
    const { default: TicketsLista } = await import('./TicketsLista.js');
    mostrarPantalla('screen-tickets-lista');
    await TicketsLista.cargar(_IDTransaccion);
  });

  document.getElementById('btn-cobrar-main').addEventListener('click', () => {
    mostrarToast('Cobro disponible próximamente', '');
  });
}

export default { init, cargar, nuevoTicket, refrescarBarra };
