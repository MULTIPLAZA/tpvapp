import { LlamarSPMulti, LlamarSP, Sesion, mostrarLoading, mostrarToast, mostrarPantalla } from './App.js';

const fmtGs = n => {
  const v = typeof n === 'string' ? parseFloat(n.replace(',', '.')) : (n || 0);
  return 'Gs ' + Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const parsear = str => typeof str === 'string' ? parseFloat(str.replace(',', '.')) || 0 : (str || 0);

const TH = 'background:var(--bg3);color:var(--text2);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;padding:8px;border-bottom:1px solid var(--border)';
const TD = 'padding:9px 8px';

export async function cargar() {
  const IDEntidad        = Sesion.get('IDEntidad');
  const IDTransaccionCaja = Sesion.get('IDTransaccionCaja');

  mostrarLoading(true);
  try {
    const tablas = await LlamarSPMulti('RESUMEN_CAJA', { IDEntidad, IDTransaccionCaja });
    _renderMovimientos(tablas[0] ?? []);
    _renderFormaPago(tablas[1] ?? []);
    _renderMovEspeciales(tablas[2] ?? []);
    _renderProductos(tablas[3] ?? []);
  } catch (e) {
    mostrarToast('Error al cargar resumen de caja', 'error');
  } finally {
    mostrarLoading(false);
  }
}

function _renderMovimientos(rows) {
  let totalEntro = 0;
  let totalSalio = 0;
  let cantTickets = 0;

  const html = rows.map(r => {
    const credito = parsear(r.Credito);
    const debito  = parsear(r.Debito);
    totalEntro += credito;
    totalSalio += debito;
    if (r.Tipo === 'TIK' && credito > 0) cantTickets++;

    const esMov   = r.Tipo !== 'TIK';
    const italic  = esMov ? 'font-style:italic;color:var(--text2)' : '';
    const nro     = esMov ? 'MV' : (r.Comprobante ?? '—');
    const hora    = (r.Hora ?? '').slice(0, 5);
    const estado  = r.Estado ? `<small style="font-size:0.72rem;color:var(--text2);font-weight:400">${r.Estado}</small>` : '';
    const concepto = esMov
      ? `${r.Observacion || r.TipoComprobante || 'Movimiento'}<br><small style="font-size:0.72rem;font-weight:400">Mov. manual</small>`
      : `Ticket #${r.Comprobante}<br>${estado}`;

    const celdaEntro = credito > 0
      ? `<td style="${TD};text-align:right;color:${esMov ? '#5a9e2f' : '#8DC63F'};font-weight:600">${fmtGs(credito)}</td>`
      : `<td style="${TD};text-align:right;color:var(--bg3)">—</td>`;
    const celdaSalio = debito > 0
      ? `<td style="${TD};text-align:right;color:#e74c3c;font-weight:600">${fmtGs(debito)}</td>`
      : `<td style="${TD};text-align:right;color:var(--bg3)">—</td>`;

    return `<tr style="border-bottom:1px solid var(--border);${italic}">
      <td style="${TD};font-size:0.75rem;color:var(--text2)">${nro}</td>
      <td style="${TD};font-size:0.75rem;white-space:nowrap;color:var(--text2)">${hora}</td>
      <td style="${TD};font-weight:500">${concepto}</td>
      ${celdaEntro}${celdaSalio}
    </tr>`;
  }).join('');

  document.getElementById('cierre-body-mov').innerHTML = html ||
    `<tr><td colspan="5" style="padding:20px;text-align:center;color:var(--text2);font-size:0.85rem">Sin movimientos</td></tr>`;

  document.getElementById('cierre-total-entro').textContent = fmtGs(totalEntro);
  document.getElementById('cierre-total-salio').textContent = fmtGs(totalSalio);
  document.getElementById('cierre-saldo').textContent       = fmtGs(totalEntro - totalSalio);
  document.getElementById('cierre-cant-tickets').textContent = cantTickets;
}

function _renderFormaPago(rows) {
  let totalCant = 0;
  let totalMonto = 0;

  const html = rows.map(r => {
    const cant  = parseInt(r.Cantidad) || 0;
    const monto = parsear(r.Total);
    totalCant  += cant;
    totalMonto += monto;
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="${TD};font-weight:500">${r.FormaPago ?? '—'}</td>
      <td style="${TD};text-align:center;color:var(--text2)">${cant}</td>
      <td style="${TD};text-align:right;color:#8DC63F;font-weight:600">${fmtGs(monto)}</td>
    </tr>`;
  }).join('');

  const fila = rows.length ? `<tr style="background:var(--bg3)">
    <td style="${TD};font-weight:700;font-size:0.78rem;color:var(--text2);text-transform:uppercase;letter-spacing:0.4px">Totales</td>
    <td style="${TD};text-align:center;font-weight:700">${totalCant}</td>
    <td style="${TD};text-align:right;font-weight:700;color:#8DC63F">${fmtGs(totalMonto)}</td>
  </tr>` : '';

  document.getElementById('cierre-body-pago').innerHTML = html
    ? html + fila
    : `<tr><td colspan="3" style="padding:20px;text-align:center;color:var(--text2);font-size:0.85rem">Sin datos</td></tr>`;
}

function _renderMovEspeciales(rows) {
  // tabla[2] — movimientos manuales de caja (ingresos/egresos extraordinarios)
  // reservado para futura implementación
  void rows;
}

function _renderProductos(rows) {
  let totalCant  = 0;
  let totalMonto = 0;

  const html = rows.map(r => {
    const cant  = parsear(r.Cantidad);
    const monto = parsear(r.Total);
    totalCant  += cant;
    totalMonto += monto;
    const color = monto < 0 ? '#e74c3c' : '#8DC63F';
    return `<tr style="border-bottom:1px solid var(--border)">
      <td style="${TD};font-weight:500">${r.Producto ?? '—'}</td>
      <td style="${TD};text-align:center;color:var(--text2)">${Math.round(cant)}</td>
      <td style="${TD};text-align:right;color:${color};font-weight:600">${fmtGs(monto)}</td>
    </tr>`;
  }).join('');

  const fila = rows.length ? `<tr style="background:var(--bg3)">
    <td style="${TD};font-weight:700;font-size:0.78rem;color:var(--text2);text-transform:uppercase;letter-spacing:0.4px">Totales</td>
    <td style="${TD};text-align:center;font-weight:700">${Math.round(totalCant)}</td>
    <td style="${TD};text-align:right;font-weight:700;color:#8DC63F">${fmtGs(totalMonto)}</td>
  </tr>` : '';

  document.getElementById('cierre-body-prod').innerHTML = html
    ? html + fila
    : `<tr><td colspan="3" style="padding:20px;text-align:center;color:var(--text2);font-size:0.85rem">Sin productos</td></tr>`;

  // badge del botón colapsable
  document.getElementById('cierre-prod-badge').textContent = `${rows.length} items`;
}

export function initBotones() {
  document.getElementById('btn-cierre-confirmar').addEventListener('click', _confirmarCierre);
  document.getElementById('btn-cierre-imprimir').addEventListener('click', () => mostrarToast('Impresión próximamente'));
  document.getElementById('btn-cierre-movimiento').addEventListener('click', () => mostrarToast('Movimiento de caja próximamente'));
}

async function _confirmarCierre() {
  if (!confirm('¿Confirmar el cierre de caja? Esta acción no se puede deshacer.')) return;

  const IDEntidad         = Sesion.get('IDEntidad');
  const IDTransaccionCaja = Sesion.get('IDTransaccionCaja');
  const IDUsuario         = Sesion.get('IDUsuario');

  mostrarLoading(true);
  try {
    await LlamarSP('CERRAR_CAJA', { IDEntidad, IDTransaccionCaja, IDUsuario });
    mostrarToast('Caja cerrada correctamente', 'exito');
    mostrarPantalla('screen-main');
  } catch (e) {
    mostrarToast('Error al cerrar caja', 'error');
  } finally {
    mostrarLoading(false);
  }
}
