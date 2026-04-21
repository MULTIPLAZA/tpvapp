import { LlamarSP, Sesion, mostrarPantalla, mostrarLoading, mostrarToast } from './App.js';

const fmtGs = n => 'Gs ' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

let _IDTransaccionActual = null;
let _todosTickets        = [];
let _filtroActivo        = '';

export async function cargar(IDTransaccionActual) {
  _IDTransaccionActual = IDTransaccionActual;
  const num = Sesion.get('TicketNumero') || '';
  document.getElementById('tklista-sub').textContent = num ? `Ticket activo: #${num}` : '';

  mostrarLoading(true);
  try {
    const IDEntidad         = Sesion.get('IDEntidad');
    const IDTransaccionCaja = Sesion.get('IDTransaccionCaja');
    _todosTickets = await LlamarSP('LISTAR_TICKETS_CAJA', { IDEntidad, IDTransaccionCaja }) || [];
    _render();
  } catch (err) {
    mostrarToast(err.message || 'Error al cargar tickets', 'error');
  } finally {
    mostrarLoading(false);
  }
}

function _render() {
  const tickets = _filtroActivo
    ? _todosTickets.filter(t => t.Estado === _filtroActivo)
    : _todosTickets;

  const cont = document.getElementById('tklista-items');
  if (!tickets.length) {
    cont.innerHTML = '<p style="color:var(--text2);text-align:center;padding:40px">Sin tickets</p>';
    return;
  }
  cont.innerHTML = '';
  tickets.forEach(t => {
    const esActual = String(t.IDTransaccion) === String(_IDTransaccionActual);
    const div = document.createElement('div');
    div.className = 'tk-card';
    if (esActual) div.style.background = 'var(--bg2)';
    div.innerHTML = `
      <div class="tk-card-num" style="color:${esActual ? 'var(--accent2)' : 'var(--text)'}">#${t.Numero}</div>
      <div class="tk-card-info">
        <div style="font-size:0.75rem;color:var(--text2)">${t.Hora || ''}</div>
      </div>
      <div class="tk-card-total">${fmtGs(t.Total)}</div>
      <span class="estado-badge estado-${t.Estado}">${t.Estado}</span>
      ${esActual ? '<span style="font-size:0.7rem;color:var(--accent2);font-weight:700">●</span>' : ''}
    `;
    if (t.Estado === 'Pendiente') {
      div.addEventListener('click', () => _seleccionarTicket(t));
    }
    cont.appendChild(div);
  });
}

async function _seleccionarTicket(ticket) {
  const { default: Main } = await import('./Main.js');
  mostrarPantalla('screen-main');
  await Main.seleccionarTicket(ticket.IDTransaccion);
}

function init() {
  document.getElementById('btn-tklista-volver').addEventListener('click', () => {
    mostrarPantalla('screen-main');
  });

  document.getElementById('btn-tklista-nuevo').addEventListener('click', async () => {
    const { default: Main } = await import('./Main.js');
    Sesion.set('IDTransaccion', '');
    mostrarPantalla('screen-main');
    await Main.nuevoTicket();
  });

  document.querySelectorAll('.tklista-filtro').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tklista-filtro').forEach(b => b.classList.remove('activo'));
      btn.classList.add('activo');
      _filtroActivo = btn.dataset.estado;
      _render();
    });
  });
}

export default { init, cargar };
