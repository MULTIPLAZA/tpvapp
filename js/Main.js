import { LlamarSP, LlamarSPMulti, Sesion, mostrarPantalla, mostrarLoading, mostrarToast, esProcesado } from './App.js';

const fmtGs = n => 'Gs ' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const _PALETA = [
  '#1a6b8a','#1a7a4a','#5a3a8a','#8a4a1a',
  '#8a1a2a','#1a6a6a','#7a6a1a','#7a1a5a',
];

const _argbToCss = argb => {
  if (!argb || argb === -1) return null;
  const u = argb >>> 0;
  return `rgb(${(u >> 16) & 0xFF},${(u >> 8) & 0xFF},${u & 0xFF})`;
};

const _audio = new (window.AudioContext || window.webkitAudioContext)();

function _beep(tipo) {
  const osc  = _audio.createOscillator();
  const gain = _audio.createGain();
  osc.connect(gain);
  gain.connect(_audio.destination);
  if (tipo === 'ok') {
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, _audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, _audio.currentTime + 0.12);
    osc.start();
    osc.stop(_audio.currentTime + 0.12);
  } else {
    osc.type = 'sawtooth';
    osc.frequency.value = 220;
    gain.gain.setValueAtTime(0.2, _audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, _audio.currentTime + 0.3);
    osc.start();
    osc.stop(_audio.currentTime + 0.3);
  }
}

function _efectoExito(card) {
  card.classList.add('prod-card--ok');
  setTimeout(() => card.classList.remove('prod-card--ok'), 400);
  const badge = document.getElementById('btn-ticket-badge');
  if (badge) {
    badge.classList.add('badge--bump');
    setTimeout(() => badge.classList.remove('badge--bump'), 400);
  }
}

function _efectoError(card) {
  card.classList.add('prod-card--err');
  setTimeout(() => card.classList.remove('prod-card--err'), 500);
}

let _IDTransaccion  = null;
let _todosProductos = [];
let _colorCat       = {};   // IDTipoProducto → color css

export async function cargar() {
  const empresa  = Sesion.get('NombreFantasia') || Sesion.get('RazonSocial') || '';
  const terminal = Sesion.get('NombreTerminal') || '';
  const usuario  = Sesion.get('NombreUsuario')  || '';
  const version  = document.querySelector('#screen-cuenta .logo-sub small')?.textContent || '';

  document.getElementById('main-empresa').textContent  = empresa;
  document.getElementById('main-sub').textContent      = [terminal, usuario].filter(Boolean).join(' · ');
  document.getElementById('main-version').textContent  = version;

  mostrarLoading(true);
  try {
    await _nuevoTicket();
    await _ticketActivo();
  } catch (err) {
    mostrarToast(err.message || 'Error al preparar ticket', 'error');
  } finally {
    mostrarLoading(false);
  }
  await _cargarCatalogo();
}

export async function nuevoTicket() {
  mostrarLoading(true);
  try {
    await _nuevoTicket();
    await _ticketActivo();
  } catch (err) {
    mostrarToast(err.message || 'Error al crear ticket', 'error');
  } finally {
    mostrarLoading(false);
  }
  await _cargarCatalogo();
}

export async function seleccionarTicket(IDTransaccion) {
  _IDTransaccion = IDTransaccion;
  Sesion.set('IDTransaccion', IDTransaccion);
  mostrarLoading(true);
  try {
    await _ticketActivo();
  } catch (err) {
    mostrarToast(err.message || 'Error al cargar ticket', 'error');
  } finally {
    mostrarLoading(false);
  }
}

export async function refrescarBarra() {
  _IDTransaccion = Sesion.get('IDTransaccion') || _IDTransaccion;
  try {
    await _ticketActivo();
  } catch { /* silencioso */ }
}

async function _nuevoTicket() {
  const IDEntidad         = Sesion.get('IDEntidad');
  const IDTransaccionCaja = Sesion.get('IDTransaccionCaja');
  const IDUsuario         = Sesion.get('IDUsuario');
  const rows = await LlamarSP('NUEVO_TICKET', { IDEntidad, IDTransaccionCaja, IDUsuario });
  if (!rows?.length) throw new Error('No se pudo crear ticket');
  if (!esProcesado(rows[0].Procesado)) throw new Error(rows[0].Mensaje || 'Error al crear ticket');
  _IDTransaccion = rows[0].IDTransaccion;
  Sesion.set('IDTransaccion', _IDTransaccion);
}

async function _ticketActivo() {
  const IDEntidad = Sesion.get('IDEntidad');
  const tablas = await LlamarSPMulti('TICKET_ACTIVO', { IDEntidad, IDTransaccion: _IDTransaccion });
  const ticket = tablas[0] ?? [];
  const items  = tablas[1] ?? [];
  if (!ticket.length) throw new Error('Ticket no encontrado');
  Sesion.set('TicketNumero', ticket[0].Numero);
  _setFooter(items, ticket[0].Numero);
}

function _setFooter(items, num) {
  const total = items.reduce((s, r) => s + (r.Total || 0), 0);
  const count = items.length;

  document.getElementById('main-ticket-num').textContent   = num ? `#${num}` : '#—';
  document.getElementById('main-ticket-total').textContent = fmtGs(total);
  document.getElementById('btn-cobrar-main').disabled      = count === 0;

  const span = document.getElementById('main-items-count');
  if (span) span.textContent = count;
  document.getElementById('btn-ticket-badge')?.classList.toggle('tiene-items', count > 0);

  _renderPanelInline(items);
}

function _renderPanelInline(items) {
  const cont    = document.getElementById('main-ticket-panel-items');
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

async function _cargarCatalogo() {
  const IDEntidad  = Sesion.get('IDEntidad');
  const IDDeposito = Sesion.get('IDDeposito');
  mostrarLoading(true);
  try {
    const [cats, prods] = await Promise.all([
      LlamarSP('CATEGORIAS', { IDEntidad }),
      LlamarSP('PRODUCTOS',  { IDEntidad, IDDeposito }),
    ]);

    // Mapa color por categoría con paleta por defecto
    _colorCat = {};
    (cats || []).forEach((c, i) => {
      const id = c.IDTipoProducto ?? c.IDTipo;
      _colorCat[id] = _argbToCss(c.Color) ?? _PALETA[i % _PALETA.length];
    });

    _todosProductos = prods || [];

    // Renderizar categorías
    const cont = document.getElementById('main-categorias');
    cont.innerHTML = '';
    cont.appendChild(_crearCatBtn('Todos', 0, true, null));
    (cats || []).forEach((c, i) => {
      const id    = c.IDTipoProducto ?? c.IDTipo;
      const color = _colorCat[id];
      cont.appendChild(_crearCatBtn(c.Descripcion, id, false, color));
    });

    _filtrarProductos(0);
  } catch (err) {
    mostrarToast(err.message || 'Error al cargar catálogo', 'error');
  } finally {
    mostrarLoading(false);
  }
}

function _crearCatBtn(texto, id, activa, color) {
  const btn = document.createElement('button');
  btn.className = 'cat-btn' + (activa ? ' activa' : '');
  btn.textContent = texto;
  if (color) btn.style.setProperty('--cat-color', color);
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('activa'));
    btn.classList.add('activa');
    _filtrarProductos(id);
  });
  return btn;
}

function _filtrarProductos(IDTipoProducto) {
  const lista = IDTipoProducto == 0
    ? _todosProductos
    : _todosProductos.filter(p => p.IDTipoProducto == IDTipoProducto);

  const cont = document.getElementById('main-productos');
  cont.innerHTML = '';
  if (!lista.length) {
    cont.innerHTML = '<p style="color:var(--text2);text-align:center;padding:32px;grid-column:1/-1">Sin productos</p>';
    return;
  }
  lista.forEach(p => {
    const colorCat  = _colorCat[p.IDTipoProducto];
    const colorCard = _argbToCss(p.Color) ?? colorCat ?? _PALETA[0];
    const card = document.createElement('div');
    card.className = 'prod-card';
    card.style.background = colorCard;
    card.innerHTML = `<div class="prod-nombre">${p.Descripcion}</div><div class="prod-precio">${fmtGs(p.Precio)}</div>`;
    card.addEventListener('click', () => _agregarItem(p, card));
    cont.appendChild(card);
  });
}

async function _agregarItem(producto, card) {
  if (!_IDTransaccion) {
    mostrarToast('Sin ticket activo', 'error');
    return;
  }

  // Efecto inmediato — antes de esperar al SP
  _beep('ok');
  _efectoExito(card);

  const IDEntidad = Sesion.get('IDEntidad');
  try {
    const rows = await LlamarSP('AGREGAR_ITEM', {
      IDEntidad, IDTransaccion: _IDTransaccion,
      IDProducto: producto.IDProducto, Cantidad: 1,
    });
    if (!rows?.length) throw new Error('Sin respuesta');
    if (!esProcesado(rows[0].Procesado)) throw new Error(rows[0].Mensaje || 'Error al agregar');
    await _ticketActivo();
  } catch (err) {
    _beep('err');
    _efectoError(card);
    mostrarToast(err.message || 'Error al agregar', 'error');
    await _ticketActivo().catch(() => {});
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

export default { init, cargar, nuevoTicket, seleccionarTicket, refrescarBarra };
