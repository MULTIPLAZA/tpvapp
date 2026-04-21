import { Sesion, mostrarPantalla, mostrarToast } from './App.js';

const fmtGs = n => 'Gs ' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

let _total         = 0;
let _efectivo      = 0;
let _otros         = 0;   // suma de otros métodos
let _IDTransaccion = null;
let _tabActiva     = 'efectivo';

export async function cargar(total, IDTransaccion) {
  _total         = total;
  _efectivo      = 0;
  _otros         = 0;
  _IDTransaccion = IDTransaccion;

  // Resetear form otros
  document.getElementById('cobro-form-importe').value     = '';
  document.getElementById('cobro-form-comprobante').value = '';
  document.getElementById('cobro-form-obs').value         = '';

  // Activar tab efectivo
  _cambiarTab('efectivo');

  const num = Sesion.get('TicketNumero') || '';
  document.getElementById('cobro-num').textContent = `Cobro — Ticket #${num}`;
  document.getElementById('cobro-sub').textContent =
    [Sesion.get('NombreSucursal'), Sesion.get('NombreTerminal')].filter(Boolean).join(' — ');

  _actualizar();
}

function _cambiarTab(tab) {
  _tabActiva = tab;
  document.querySelectorAll('.cobro-tab').forEach(b =>
    b.classList.toggle('activo', b.dataset.tab === tab));
  document.getElementById('cobro-panel-efectivo').classList.toggle('activo', tab === 'efectivo');
  document.getElementById('cobro-panel-otro').classList.toggle('activo',     tab !== 'efectivo');

  // Siempre resetear _otros al cambiar tab para evitar acumulación entre métodos
  _otros = 0;
  const inp = document.getElementById('cobro-form-importe');
  inp.value = '';

  if (tab !== 'efectivo') {
    const labels = { qr:'QR', deb:'Débito', cred:'Crédito', trans:'Transferencia', otros:'Otros' };
    document.getElementById('cobro-form-label').textContent = `Importe ${labels[tab] || ''} (Gs)`;
    // Auto-rellenar con el saldo pendiente
    const saldo = Math.max(0, _total - _efectivo);
    if (saldo > 0) { _otros = saldo; inp.value = saldo; }
  }
  _actualizar();
}

function _actualizar() {
  const recibido = _efectivo + _otros;
  const vuelto   = Math.max(0, recibido - _total);

  document.getElementById('cobro-total').textContent     = fmtGs(_total);
  document.getElementById('cobro-efectivo').textContent  = fmtGs(_efectivo);
  document.getElementById('cobro-otros').textContent     = fmtGs(_otros);
  document.getElementById('cobro-vuelto').textContent    = fmtGs(vuelto);
  document.getElementById('cobro-total-btn').textContent = fmtGs(_total);

  const listo = recibido >= _total && _total > 0;
  const btn   = document.getElementById('btn-cobrar-confirmar');
  btn.disabled      = !listo;
  btn.style.opacity = listo ? '1' : '0.4';

  const vueltoColor = vuelto > 0 ? 'var(--accent)' : 'var(--text2)';
  document.getElementById('cobro-vuelto').style.color = vueltoColor;
  document.querySelector('.cobro-etiqueta--vuelto').style.color = vueltoColor;
}

function init() {
  // Tabs
  document.querySelectorAll('.cobro-tab').forEach(btn => {
    btn.addEventListener('click', () => _cambiarTab(btn.dataset.tab));
  });

  // Botones de monto efectivo
  document.querySelectorAll('.cobro-btn[data-monto]').forEach(btn => {
    btn.addEventListener('click', () => {
      _efectivo += parseInt(btn.dataset.monto);
      _actualizar();
    });
  });
  document.getElementById('cobro-btn-exacto').addEventListener('click', () => {
    _efectivo = _total - _otros;
    _actualizar();
  });
  document.getElementById('cobro-btn-limpiar').addEventListener('click', () => {
    _efectivo = 0;
    _actualizar();
  });

  // Importe en form otros: actualiza _otros en tiempo real
  document.getElementById('cobro-form-importe').addEventListener('input', e => {
    _otros = parseFloat(e.target.value) || 0;
    _actualizar();
  });

  document.getElementById('btn-cobro-volver').addEventListener('click', () => {
    mostrarPantalla('screen-main');
  });

  document.getElementById('btn-cobrar-confirmar').addEventListener('click', () => {
    mostrarToast('Cobranza — próximamente', '');
  });
}

export default { init, cargar };
