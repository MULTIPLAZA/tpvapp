import { LlamarSP, Sesion, mostrarPantalla, mostrarLoading, mostrarToast } from './App.js';

export async function verificarYAbrir() {
  const IDEntidad = Sesion.get('IDEntidad');
  const IDTerminal = Sesion.get('IDTerminal');
  mostrarLoading(true);
  try {
    const rows = await LlamarSP('ESTADO_CAJA', { IDEntidad, IDTerminal });
    if (rows.length > 0 && rows[0].abierta) {
      Sesion.set('IDTransaccionCaja', rows[0].IDTransaccionCaja);
      await _irAMain();
    } else {
      mostrarPantalla('screen-apertura-caja');
      _cargarPantalla();
    }
  } catch (err) {
    mostrarToast(err.message || 'Error al verificar caja', 'error');
  } finally {
    mostrarLoading(false);
  }
}

function _cargarPantalla() {
  const terminal = Sesion.get('NombreTerminal') || '';
  const sucursal = Sesion.get('NombreSucursal') || '';
  document.getElementById('caja-terminal').textContent = [sucursal, terminal].filter(Boolean).join(' — ');
  document.getElementById('inp-importe-apertura').value = '';
  document.getElementById('inp-obs-apertura').value = '';
}

async function _irAMain() {
  const { default: Main } = await import('./Main.js');
  mostrarPantalla('screen-main');
  await Main.cargar();
}

function init() {
  document.getElementById('btn-abrir-caja').addEventListener('click', async () => {
    const IDEntidad  = Sesion.get('IDEntidad');
    const IDTerminal = Sesion.get('IDTerminal');
    const IDUsuario  = Sesion.get('IDUsuario');
    const IDSucursal = Sesion.get('IDSucursal');
    const IDDeposito = Sesion.get('IDDeposito');
    const importe    = parseFloat(document.getElementById('inp-importe-apertura').value) || 0;
    const obs        = document.getElementById('inp-obs-apertura').value.trim();

    mostrarLoading(true);
    try {
      const rows = await LlamarSP('ABRIR_CAJA', {
        IDEntidad, IDTerminal, IDUsuario, IDSucursal, IDDeposito,
        ImporteApertura: importe, Observacion: obs,
      });
      if (!rows?.length) throw new Error('Sin respuesta del servidor');
      if (String(rows[0].Procesado) !== 'True') throw new Error(rows[0].Mensaje || 'Error al abrir caja');
      Sesion.set('IDTransaccionCaja', rows[0].IDTransaccionCaja);
      await _irAMain();
    } catch (err) {
      mostrarToast(err.message || 'Error al abrir caja', 'error');
    } finally {
      mostrarLoading(false);
    }
  });
}

export default { init, verificarYAbrir };
