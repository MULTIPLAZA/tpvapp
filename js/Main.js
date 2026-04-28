import { LlamarSP, LlamarSPMulti, Sesion, Dispositivo, mostrarPantalla, mostrarLoading, mostrarToast, esProcesado } from './App.js';

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
    // Ascendente: 440 → 880 Hz
    osc.frequency.setValueAtTime(440, _audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, _audio.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, _audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, _audio.currentTime + 0.13);
    osc.start();
    osc.stop(_audio.currentTime + 0.13);
  } else if (tipo === 'ticket') {
    // Descendente: 880 → 440 Hz
    osc.frequency.setValueAtTime(880, _audio.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, _audio.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, _audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, _audio.currentTime + 0.13);
    osc.start();
    osc.stop(_audio.currentTime + 0.13);
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
let _colorCat       = {};
let _catActivaId    = 0;
let _textoBusca     = '';
let _totalTicket    = 0;
let _modoCarrito    = false;
let _ultimosItems   = [];

export async function cargar() {
  const empresa  = Sesion.get('NombreFantasia') || Sesion.get('RazonSocial') || '';
  const terminal = Sesion.get('NombreTerminal') || '';
  const usuario  = Sesion.get('NombreUsuario')  || '';
  const version  = document.querySelector('#screen-cuenta .logo-sub small')?.textContent || '';

  const perfil = Sesion.get('Perfil') || '';
  document.getElementById('main-empresa').textContent  = empresa;
  document.getElementById('main-version').textContent  = version;
  document.getElementById('main-sub').textContent = [terminal, usuario, perfil].filter(Boolean).join(' · ');

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
    _setModoCarrito(false);
  } catch (err) {
    mostrarToast(err.message || 'Error al crear ticket', 'error');
  } finally {
    mostrarLoading(false);
  }
}

export async function seleccionarTicket(IDTransaccion) {
  _IDTransaccion = IDTransaccion;
  Sesion.set('IDTransaccion', IDTransaccion);
  mostrarLoading(true);
  try {
    await _ticketActivo();
    _setModoCarrito(true);
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
  const cab = ticket[0];
  Sesion.set('TicketNumero', cab.Numero);
  const horaEl   = document.getElementById('main-ticket-hora');
  const rucEl    = document.getElementById('main-ticket-ruc');
  const razonEl  = document.getElementById('main-ticket-razon');
  const estadoEl = document.getElementById('main-ticket-estado');
  if (horaEl)   horaEl.textContent   = cab.Hora        || '';
  if (rucEl)    rucEl.textContent    = cab.RUC         || '—';
  if (razonEl)  razonEl.textContent  = cab.RazonSocial || cab.Cliente || '';
  if (estadoEl) { estadoEl.textContent = cab.Estado || ''; estadoEl.dataset.estado = cab.Estado || ''; }
  _setFooter(items, cab.Numero);
}

function _setFooter(items, num) {
  _ultimosItems = items;
  _totalTicket = items.reduce((s, r) => s + (r.Total || 0), 0);
  const total  = _totalTicket;
  const count  = items.length;

  document.getElementById('main-ticket-num').textContent   = num ? `#${num}` : '#—';
  document.getElementById('main-ticket-total').textContent = fmtGs(total);
  document.getElementById('btn-cobrar-main').disabled      = count === 0;
  document.getElementById('btn-cobrar-main').style.opacity = count === 0 ? '0.4' : '1';

  const span = document.getElementById('main-items-count');
  if (span) span.textContent = count;
  document.getElementById('btn-ticket-badge')?.classList.toggle('tiene-items', count > 0);

  _renderPanelInline(items);
  if (_modoCarrito) _renderTicketInline();
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

    // Mapa color por categoría — paleta solo para las que no tienen color de BD
    _colorCat = {};
    let _iPaleta = 0;
    (cats || []).forEach(c => {
      const id    = c.IDTipoProducto ?? c.IDTipo;
      const color = _argbToCss(c.Color);
      _colorCat[id] = color ?? _PALETA[_iPaleta++ % _PALETA.length];
    });

    _todosProductos = prods || [];

    // Renderizar categorías
    const cont = document.getElementById('main-categorias');
    cont.innerHTML = '';
    cont.appendChild(_crearCatBtn('Todos', 0, true, null));
    (cats || []).forEach(c => {
      const id = c.IDTipoProducto ?? c.IDTipo;
      cont.appendChild(_crearCatBtn(c.Descripcion, id, false, _colorCat[id]));
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
  _catActivaId = IDTipoProducto;
  let lista = IDTipoProducto == 0
    ? _todosProductos
    : _todosProductos.filter(p => p.IDTipoProducto == IDTipoProducto);
  if (_textoBusca) {
    const q = _textoBusca.toLowerCase();
    lista = lista.filter(p => p.Descripcion.toLowerCase().includes(q));
  }

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
    _beep('ticket');
  } catch (err) {
    _beep('err');
    _efectoError(card);
    mostrarToast(err.message || 'Error al agregar', 'error');
    await _ticketActivo().catch(() => {});
  }
}

function _setModoCarrito(activo) {
  if (_modoCarrito === activo) {
    if (activo) _renderTicketInline();
    return;
  }
  _modoCarrito = activo;
  const prod   = document.getElementById('main-productos');
  const cats   = document.querySelector('.categorias-wrap');
  const inline = document.getElementById('main-ticket-inline');
  const badge  = document.getElementById('btn-ticket-badge');

  if (activo) {
    prod.style.display   = 'none';
    cats.style.display   = 'none';
    inline.style.display = 'flex';
    badge.classList.add('modo-ticket');
    badge.querySelector('.badge-modo-prod').style.display   = 'none';
    badge.querySelector('.badge-modo-ticket').style.display = '';
    _renderTicketInline();
  } else {
    prod.style.display   = '';
    cats.style.display   = '';
    inline.style.display = 'none';
    badge.classList.remove('modo-ticket');
    badge.querySelector('.badge-modo-prod').style.display   = '';
    badge.querySelector('.badge-modo-ticket').style.display = 'none';
  }
}

function _toggleCarrito() { _setModoCarrito(!_modoCarrito); }

function _renderTicketInline() {
  const cont = document.getElementById('main-ticket-inline');
  if (!cont) return;
  if (!_ultimosItems.length) {
    cont.innerHTML = '<p style="color:var(--text2);text-align:center;padding:32px">Ticket vacío</p>';
    return;
  }
  const IDEntidad = Sesion.get('IDEntidad');
  cont.innerHTML = _ultimosItems.map(i => `
    <div class="ti2">
      <div class="ti2-top">
        <div class="ti2-nombre">${i.Descripcion}</div>
        <div class="ti2-total">${fmtGs(i.Total)}</div>
      </div>
      ${i.Observacion ? `<div class="ticket-item-obs" style="padding:0">${i.Observacion}</div>` : ''}
      <div class="ti2-bottom">
        <div class="ticket-item-acciones">
          <button class="btn-qty" data-accion="menos" data-id="${i.IDDetalleTicket}">−</button>
          <span class="qty-valor">${parseFloat(i.Cantidad)}</span>
          <button class="btn-qty" data-accion="mas" data-id="${i.IDDetalleTicket}">+</button>
          <button class="btn-obs${i.Observacion ? ' tiene-obs' : ''}" data-accion="obs" data-id="${i.IDDetalleTicket}" data-obs="${(i.Observacion||'').replace(/"/g,'&quot;')}" title="Observación">✎</button>
          <button class="btn-quitar" data-accion="quitar" data-id="${i.IDDetalleTicket}">✕</button>
        </div>
        <div class="ti2-precio">${fmtGs(i.PrecioUni)} c/u</div>
      </div>
    </div>
  `).join('');

  const spMap = { mas: 'MAS_ITEM', menos: 'MENOS_ITEM', quitar: 'QUITAR_ITEM' };
  cont.querySelectorAll('[data-accion]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const accion    = btn.dataset.accion;
      const IDDetalle = btn.dataset.id;
      const IDDetalleTicket = btn.dataset.id;
      if (accion === 'obs') {
        const nueva = await _pedirObservacion(btn.dataset.obs);
        if (nueva === null) return;
        try {
          await LlamarSP('ITEM_OBSERVACION', { IDEntidad, IDTransaccion: _IDTransaccion, IDDetalleTicket, Observacion: nueva });
          await _ticketActivo();
        } catch (err) {
          mostrarToast(err.message || 'Error al guardar observación', 'error');
        }
        return;
      }
      try {
        await LlamarSP(spMap[accion], { IDEntidad, IDTransaccion: _IDTransaccion, IDDetalleTicket });
        await _ticketActivo();
      } catch (err) {
        mostrarToast(err.message || 'Error', 'error');
      }
    });
  });
}

function _pedirObservacion(obsActual) {
  return new Promise(resolve => {
    const modal = document.getElementById('modal-obs-item');
    const inp   = document.getElementById('inp-obs-item');
    inp.value   = obsActual || '';
    modal.style.display = 'flex';
    setTimeout(() => inp.focus(), 50);

    const onGuardar  = () => { modal.style.display = 'none'; cleanup(); resolve(inp.value.trim()); };
    const onCancelar = () => { modal.style.display = 'none'; cleanup(); resolve(null); };
    const onKey      = e  => { if (e.key === 'Enter') onGuardar(); else if (e.key === 'Escape') onCancelar(); };

    function cleanup() {
      document.getElementById('modal-obs-guardar').removeEventListener('click', onGuardar);
      document.getElementById('modal-obs-cancelar').removeEventListener('click', onCancelar);
      inp.removeEventListener('keydown', onKey);
    }
    document.getElementById('modal-obs-guardar').addEventListener('click', onGuardar);
    document.getElementById('modal-obs-cancelar').addEventListener('click', onCancelar);
    inp.addEventListener('keydown', onKey);
  });
}

async function _navegar(accion) {
  const IDEntidad = Sesion.get('IDEntidad');
  mostrarLoading(true);
  try {
    const rows = await LlamarSP(accion, { IDEntidad, IDTransaccion: _IDTransaccion });
    if (!rows?.length) { mostrarToast('Sin respuesta', 'error'); return; }
    const id = rows[0].IDTransaccion;
    if (!id) { mostrarToast(rows[0].Mensaje || 'No hay más tickets', ''); return; }
    _IDTransaccion = id;
    Sesion.set('IDTransaccion', _IDTransaccion);
    await _ticketActivo();
    _setModoCarrito(true);
  } catch (err) {
    mostrarToast(err.message || 'Error de navegación', 'error');
  } finally {
    mostrarLoading(false);
  }
}

function _abrirMenu() {
  document.getElementById('main-menu-empresa').textContent =
    Sesion.get('NombreFantasia') || Sesion.get('RazonSocial') || '';
  document.getElementById('main-menu-overlay').classList.add('visible');
}
function _cerrarMenu() {
  document.getElementById('main-menu-overlay').classList.remove('visible');
}

function init() {
  document.getElementById('btn-main-menu').addEventListener('click', _abrirMenu);
  document.getElementById('main-menu-backdrop').addEventListener('click', _cerrarMenu);

  document.getElementById('menu-caja').addEventListener('click', () => {
    _cerrarMenu();
    mostrarPantalla('screen-caja-panel');
  });

  document.getElementById('menu-actualizar').addEventListener('click', () => {
    _cerrarMenu();
    _cargarCatalogo();
  });

  document.getElementById('menu-reportes').addEventListener('click', () => { _cerrarMenu(); mostrarPantalla('screen-reportes'); });
  document.getElementById('menu-impresora').addEventListener('click', () => { _cerrarMenu(); mostrarPantalla('screen-impresora'); });
  document.getElementById('menu-opciones').addEventListener('click',  () => { _cerrarMenu(); mostrarPantalla('screen-opciones'); });
  document.getElementById('menu-datos').addEventListener('click',     () => { _cerrarMenu(); mostrarPantalla('screen-datos'); });

  document.getElementById('menu-cierre-caja').addEventListener('click', () => {
    _cerrarMenu();
    document.getElementById('cierre-sub').textContent =
      [Sesion.get('NombreSucursal'), Sesion.get('NombreTerminal')].filter(Boolean).join(' — ');
    mostrarPantalla('screen-cierre-caja');
  });

  document.getElementById('menu-cerrar-sesion').addEventListener('click', () => {
    _cerrarMenu();
    import('./LoginUsuario.js').then(m => m.mostrar(true));
  });

  document.getElementById('menu-salir').addEventListener('click', () => {
    _cerrarMenu();
    Sesion.clear();
    mostrarPantalla('screen-cuenta');
  });

  ['caja-panel','reportes','impresora','opciones','datos','cliente','cierre-caja'].forEach(id => {
    document.getElementById(`btn-${id}-volver`)
      ?.addEventListener('click', () => mostrarPantalla('screen-main'));
  });

  document.getElementById('btn-ticket-ruc').addEventListener('click', () => {
    mostrarPantalla('screen-cliente');
    document.getElementById('inp-buscar-cliente').value = '';
    document.getElementById('cliente-resultados').innerHTML =
      '<p style="color:var(--text2);text-align:center;padding:40px 16px;font-size:0.85rem">Ingrese RUC o nombre para buscar</p>';
    setTimeout(() => document.getElementById('inp-buscar-cliente').focus(), 100);
  });

  document.getElementById('btn-ticket-badge').addEventListener('click', _toggleCarrito);

  const _abrirTicketsLista = async () => {
    const { default: TicketsLista } = await import('./TicketsLista.js');
    mostrarPantalla('screen-tickets-lista');
    await TicketsLista.cargar(_IDTransaccion);
  };
  document.getElementById('btn-ticket-lista').addEventListener('click', _abrirTicketsLista);
  document.getElementById('tk-cel-time').addEventListener('click', _abrirTicketsLista);

  // ── Búsqueda por texto — overlay pantalla completa ──
  const _btnBuscar = document.getElementById('btn-buscar-cat');
  const _overlay   = document.getElementById('buscar-overlay');
  const _inpBuscar = document.getElementById('inp-buscar-producto');
  const _resCont   = document.getElementById('buscar-resultados');

  _btnBuscar.addEventListener('click', () => {
    _overlay.style.display = 'flex';
    _btnBuscar.classList.add('activa');
    _inpBuscar.value = '';
    _textoBusca = '';
    _resCont.innerHTML = '';
    setTimeout(() => _inpBuscar.focus(), 50);
  });

  document.getElementById('btn-buscar-cerrar').addEventListener('click', _cerrarBusqueda);

  _inpBuscar.addEventListener('input', () => {
    _textoBusca = _inpBuscar.value.trim();
    if (!_textoBusca) { _resCont.innerHTML = ''; return; }
    const q = _textoBusca.toLowerCase();
    const lista = _todosProductos.filter(p => p.Descripcion.toLowerCase().includes(q));
    _renderBusqueda(lista);
  });

  function _renderBusqueda(lista) {
    _resCont.innerHTML = '';
    if (!lista.length) {
      _resCont.innerHTML = '<p style="color:var(--text2);text-align:center;padding:32px;grid-column:1/-1">Sin resultados</p>';
      return;
    }
    lista.forEach(p => {
      const colorCard = _argbToCss(p.Color) ?? _colorCat[p.IDTipoProducto] ?? _PALETA[0];
      const card = document.createElement('div');
      card.className = 'prod-card';
      card.style.background = colorCard;
      card.innerHTML = `<div class="prod-nombre">${p.Descripcion}</div><div class="prod-precio">${fmtGs(p.Precio)}</div>`;
      card.addEventListener('click', () => { _cerrarBusqueda(); _agregarItem(p, card); });
      _resCont.appendChild(card);
    });
  }

  function _cerrarBusqueda() {
    _textoBusca = '';
    _overlay.style.display = 'none';
    _btnBuscar.classList.remove('activa');
  }

  document.getElementById('btn-cobrar-main').addEventListener('click', async () => {
    const { default: Cobro } = await import('./Cobro.js');
    mostrarPantalla('screen-cobro');
    await Cobro.cargar(_totalTicket, _IDTransaccion);
  });

  document.getElementById('btn-nuevo-top').addEventListener('click', nuevoTicket);

  document.getElementById('btn-tick-prev').addEventListener('click',  () => _navegar('TICKET_ANTERIOR'));
  document.getElementById('btn-tick-next').addEventListener('click',  () => _navegar('TICKET_SIGUIENTE'));
  document.getElementById('btn-tick-last').addEventListener('click',  () => _navegar('TICKET_ULTIMO'));
}

export default { init, cargar, nuevoTicket, seleccionarTicket, refrescarBarra };
