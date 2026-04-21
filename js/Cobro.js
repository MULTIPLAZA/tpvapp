import { Sesion, mostrarPantalla, mostrarToast } from './App.js';

const fmtGs = n => 'Gs ' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

let _total         = 0;
let _efectivo      = 0;
let _IDTransaccion = null;

export async function cargar(total, IDTransaccion) {
  _total         = total;
  _efectivo      = 0;
  _IDTransaccion = IDTransaccion;

  const num = Sesion.get('TicketNumero') || '';
  document.getElementById('cobro-num').textContent = `Cobro — Ticket #${num}`;
  document.getElementById('cobro-sub').textContent =
    [Sesion.get('NombreSucursal'), Sesion.get('NombreTerminal')].filter(Boolean).join(' — ');

  _actualizar();
}

function _actualizar() {
  const vuelto = Math.max(0, _efectivo - _total);
  document.getElementById('cobro-total').textContent     = fmtGs(_total);
  document.getElementById('cobro-efectivo').textContent  = fmtGs(_efectivo);
  document.getElementById('cobro-vuelto').textContent    = fmtGs(vuelto);
  document.getElementById('cobro-total-btn').textContent = fmtGs(_total);

  const btn   = document.getElementById('btn-cobrar-confirmar');
  const listo = _efectivo >= _total && _total > 0;
  btn.disabled      = !listo;
  btn.style.opacity = listo ? '1' : '0.4';

  const color = vuelto > 0 ? 'var(--accent)' : 'var(--text2)';
  document.getElementById('cobro-vuelto').style.color = color;
  document.querySelector('.cobro-etiqueta--vuelto').style.color = color;
}

function init() {
  document.querySelectorAll('.cobro-btn[data-monto]').forEach(btn => {
    btn.addEventListener('click', () => {
      _efectivo += parseInt(btn.dataset.monto);
      _actualizar();
    });
  });

  document.getElementById('cobro-btn-exacto').addEventListener('click', () => {
    _efectivo = _total;
    _actualizar();
  });

  document.getElementById('cobro-btn-limpiar').addEventListener('click', () => {
    _efectivo = 0;
    _actualizar();
  });

  document.getElementById('btn-cobro-volver').addEventListener('click', () => {
    mostrarPantalla('screen-main');
  });

  document.getElementById('btn-cobrar-confirmar').addEventListener('click', () => {
    mostrarToast('Cobranza — proxImamente', '');
  });
}

export default { init, cargar };
