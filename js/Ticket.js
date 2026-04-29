import { LlamarSP, LlamarSPMulti, Sesion, mostrarPantalla, mostrarLoading, mostrarToast, esProcesado } from './App.js';

function _pedirCantidad() {
  return new Promise(resolve => {
    const modal = document.getElementById('modal-cant-item');
    const inp   = document.getElementById('inp-cant-item');
    inp.value   = '';
    modal.style.display = 'flex';
    setTimeout(() => inp.focus(), 50);
    const onGuardar  = () => {
      const v = parseFloat(inp.value.replace(',', '.'));
      modal.style.display = 'none'; cleanup();
      resolve(isNaN(v) || v <= 0 ? null : v);
    };
    const onCancelar = () => { modal.style.display = 'none'; cleanup(); resolve(null); };
    const onKey      = e  => { if (e.key === 'Enter') onGuardar(); else if (e.key === 'Escape') onCancelar(); };
    function cleanup() {
      document.getElementById('modal-cant-guardar').removeEventListener('click', onGuardar);
      document.getElementById('modal-cant-cancelar').removeEventListener('click', onCancelar);
      inp.removeEventListener('keydown', onKey);
    }
    document.getElementById('modal-cant-guardar').addEventListener('click', onGuardar);
    document.getElementById('modal-cant-cancelar').addEventListener('click', onCancelar);
    inp.addEventListener('keydown', onKey);
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

const fmtGs  = n => Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const fmtQty = n => parseFloat(n || 0).toString();

let _IDTransaccion = null;

export async function cargar(IDTransaccion) {
  _IDTransaccion = IDTransaccion;
  document.getElementById('ticket-terminal').textContent = Sesion.get('NombreTerminal') || '';
  await _refrescar();
}

async function _refrescar() {
  const IDEntidad = Sesion.get('IDEntidad');
  mostrarLoading(true);
  try {
    const tablas = await LlamarSPMulti('TICKET_ACTIVO', { IDEntidad, IDTransaccion: _IDTransaccion });
    _renderItems(tablas[1] ?? [], tablas[0]?.[0]);
  } catch (err) {
    mostrarToast(err.message || 'Error al cargar ticket', 'error');
  } finally {
    mostrarLoading(false);
  }
}

function _renderItems(items, cabecera) {
  const cont    = document.getElementById('ticket-items');
  const totalEl = document.getElementById('ticket-total');
  const numEl   = document.getElementById('ticket-numero');
  const num     = cabecera?.Numero || Sesion.get('TicketNumero') || '';
  if (cabecera?.Numero) Sesion.set('TicketNumero', cabecera.Numero);
  numEl.textContent = `Ticket #${num}`;

  if (!items.length) {
    cont.innerHTML = '<p style="color:var(--text2);text-align:center;padding:40px">Ticket vacío</p>';
    totalEl.textContent = '0';
    return;
  }
  totalEl.textContent = fmtGs(items.reduce((s, r) => s + (r.Total || 0), 0));

  cont.innerHTML = '';
  items.forEach(item => {
    const qty = parseFloat(item.Cantidad || 0);
    const el  = document.createElement('div');
    el.className = 'ticket-item';
    el.innerHTML = `
      <div class="ticket-item-info">
        <div class="ticket-item-nombre">${item.Descripcion}</div>
        ${item.Observacion ? `<div class="ticket-item-obs">${item.Observacion}</div>` : ''}
        <div class="ticket-item-precio">${fmtGs(item.PrecioUni)} c/u</div>
      </div>
      <div class="ticket-item-acciones">
        <button class="btn-qty" data-accion="menos" data-id="${item.IDDetalleTicket}">−</button>
        <span class="qty-valor">${fmtQty(qty)}</span>
        <button class="btn-qty" data-accion="mas" data-id="${item.IDDetalleTicket}">+</button>
        <button class="btn-cant" data-id="${item.IDDetalleTicket}" title="Agregar cantidad">+N</button>
        <button class="btn-obs${item.Observacion ? ' tiene-obs' : ''}" data-id="${item.IDDetalleTicket}" data-obs="${(item.Observacion||'').replace(/"/g,'&quot;')}" title="Observación"><svg viewBox="0 0 24 24" fill="currentColor" style="width:13px;height:13px;pointer-events:none"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15h8v2H8zm0-4h8v2H8z"/></svg></button>
        <button class="btn-quitar" data-id="${item.IDDetalleTicket}">🗑</button>
      </div>
      <div class="ticket-item-total">${fmtGs(item.Total)}</div>
    `;
    cont.appendChild(el);
  });

  cont.querySelectorAll('.btn-qty').forEach(btn => {
    btn.addEventListener('click', () => {
      const accion = btn.dataset.accion === 'mas' ? 'MAS_ITEM' : 'MENOS_ITEM';
      _llamarItem(accion, parseInt(btn.dataset.id));
    });
  });

  cont.querySelectorAll('.btn-cant').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cant = await _pedirCantidad();
      if (cant === null) return;
      const IDEntidad       = Sesion.get('IDEntidad');
      const IDDetalleTicket = parseInt(btn.dataset.id);
      mostrarLoading(true);
      try {
        const rows = await LlamarSP('AUMENTAR_CANTIDAD', { IDEntidad, IDTransaccion: _IDTransaccion, IDDetalleTicket, Cantidad: cant });
        if (!rows?.length) throw new Error('Sin respuesta');
        if (!esProcesado(rows[0].Procesado)) throw new Error(rows[0].Mensaje || 'Error');
        await _refrescar();
      } catch (err) {
        mostrarToast(err.message || 'Error al actualizar cantidad', 'error');
      } finally {
        mostrarLoading(false);
      }
    });
  });

  cont.querySelectorAll('.btn-obs').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nueva = await _pedirObservacion(btn.dataset.obs);
      if (nueva === null) return;
      const IDEntidad       = Sesion.get('IDEntidad');
      const IDDetalleTicket = parseInt(btn.dataset.id);
      mostrarLoading(true);
      try {
        const rows = await LlamarSP('ITEM_OBSERVACION', { IDEntidad, IDTransaccion: _IDTransaccion, IDDetalleTicket, Observacion: nueva });
        if (!rows?.length) throw new Error('Sin respuesta');
        if (!esProcesado(rows[0].Procesado)) throw new Error(rows[0].Mensaje || 'Error');
        await _refrescar();
      } catch (err) {
        mostrarToast(err.message || 'Error al guardar observación', 'error');
      } finally {
        mostrarLoading(false);
      }
    });
  });

  cont.querySelectorAll('.btn-quitar').forEach(btn => {
    btn.addEventListener('click', () => _quitarItem(parseInt(btn.dataset.id)));
  });
}

async function _llamarItem(accion, IDDetalleTicket) {
  const IDEntidad = Sesion.get('IDEntidad');
  mostrarLoading(true);
  try {
    const rows = await LlamarSP(accion, { IDEntidad, IDTransaccion: _IDTransaccion, IDDetalleTicket });
    if (!rows?.length) throw new Error('Sin respuesta');
    if (!esProcesado(rows[0].Procesado)) throw new Error(rows[0].Mensaje || 'Error');
    await _refrescar();
  } catch (err) {
    mostrarToast(err.message || 'Error', 'error');
  } finally {
    mostrarLoading(false);
  }
}

async function _quitarItem(IDDetalleTicket) {
  const IDEntidad = Sesion.get('IDEntidad');
  mostrarLoading(true);
  try {
    const rows = await LlamarSP('QUITAR_ITEM', { IDEntidad, IDTransaccion: _IDTransaccion, IDDetalleTicket });
    if (!rows?.length) throw new Error('Sin respuesta');
    if (!esProcesado(rows[0].Procesado)) throw new Error(rows[0].Mensaje || 'Error');
    await _refrescar();
  } catch (err) {
    mostrarToast(err.message || 'Error al quitar ítem', 'error');
  } finally {
    mostrarLoading(false);
  }
}

function init() {
  document.getElementById('btn-ticket-volver').addEventListener('click', async () => {
    const { default: Main } = await import('./Main.js');
    mostrarPantalla('screen-main');
    await Main.refrescarBarra();
  });

  document.getElementById('btn-ticket-nuevo').addEventListener('click', async () => {
    if (!confirm('¿Crear nuevo ticket? El actual quedará abierto.')) return;
    Sesion.set('IDTransaccion', '');
    const { default: Main } = await import('./Main.js');
    mostrarPantalla('screen-main');
    await Main.nuevoTicket();
  });

  document.getElementById('btn-cobrar').addEventListener('click', async () => {
    const total = parseFloat(document.getElementById('ticket-total').textContent.replace(/[^\d]/g, '')) || 0;
    const { default: Cobro } = await import('./Cobro.js');
    mostrarPantalla('screen-cobro');
    await Cobro.cargar(total, _IDTransaccion);
  });
}

export default { init, cargar };
