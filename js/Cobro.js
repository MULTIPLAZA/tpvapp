import { LlamarSP, Sesion, mostrarPantalla, mostrarLoading, mostrarToast, esProcesado } from './App.js';

const fmtGs  = n => 'Gs ' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const fmtInp = n => n > 0 ? Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';

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
    const labels = { deb:'T. Débito', cred:'T. Crédito', trans:'Transferencia', otros:'Otros' };
    document.getElementById('cobro-form-label').textContent = `Importe ${labels[tab] || ''} (Gs)`;
    // Mostrar checkbox QR solo para TD y TC
    const conQR = tab === 'deb' || tab === 'cred';
    document.getElementById('cobro-campo-qr').style.display = conQR ? '' : 'none';
    document.getElementById('cobro-check-qr').checked = false;
    // Auto-rellenar con el saldo pendiente
    const saldo = Math.max(0, _total - _efectivo);
    if (saldo > 0) { _otros = saldo; inp.value = fmtInp(saldo); }
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

  // Importe en form otros: formatea con separador de miles, actualiza _otros
  document.getElementById('cobro-form-importe').addEventListener('input', e => {
    const raw = e.target.value.replace(/\D/g, '');
    _otros = parseInt(raw) || 0;
    e.target.value = fmtInp(_otros);
    _actualizar();
  });

  document.getElementById('btn-cobro-volver').addEventListener('click', () => {
    mostrarPantalla('screen-main');
  });

  document.getElementById('btn-imprimir-cobro').addEventListener('click', () => {
    mostrarToast('Imprimir — próximamente', '');
  });

  document.getElementById('btn-cobrar-confirmar').addEventListener('click', async () => {
    const IDEntidad = Sesion.get('IDEntidad');
    const IDUsuario = Sesion.get('IDUsuario');

    const pagos = [];
    if (_efectivo > 0) pagos.push({
      TipoPago: 'EFECTIVO', Importe: _efectivo, Entregado: _efectivo,
      Comprobante: '', Obs: '', IDUsuario,
    });
    if (_otros > 0) pagos.push({
      TipoPago:    _tabActiva.toUpperCase(),
      Importe:     _otros,
      EsQR:        document.getElementById('cobro-check-qr').checked ? 1 : 0,
      Comprobante:  document.getElementById('cobro-form-comprobante').value,
      Observacion:  document.getElementById('cobro-form-obs').value,
      IDUsuario,
    });

    mostrarLoading(true);
    try {
      for (const pago of pagos) {
        const rows = await LlamarSP('COBRAR', { IDEntidad, IDTransaccion: _IDTransaccion, ...pago });
        if (!rows?.length || !esProcesado(rows[0].Procesado)) {
          mostrarToast(rows?.[0]?.Mensaje || 'Error al cobrar', 'error');
          return;
        }
      }
      // Todos los pagos OK — nuevo ticket y volver
      mostrarPantalla('screen-main');
      const { default: Main } = await import('./Main.js');
      await Main.nuevoTicket();
    } catch (err) {
      mostrarToast(err.message || 'Error al cobrar', 'error');
    } finally {
      mostrarLoading(false);
    }
  });
}

export default { init, cargar };
