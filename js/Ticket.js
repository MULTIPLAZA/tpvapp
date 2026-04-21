import { LlamarSP, LlamarSPMulti, Sesion, mostrarPantalla, mostrarLoading, mostrarToast, esProcesado } from './App.js';

const fmtGs  = n => 'Gs ' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
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
    totalEl.textContent = 'Gs 0';
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

  document.getElementById('btn-cobrar').addEventListener('click', () => {
    mostrarToast('Cobro disponible próximamente', '');
  });
}

export default { init, cargar };
