import { CONFIG, LlamarSP, Sesion, mostrarPantalla, mostrarLoading, mostrarToast } from './App.js';
import { verificarTerminal } from './Terminal.js';

async function irAUsuario() {
  mostrarPantalla('screen-usuario');
  const empresa = Sesion.get('NombreFantasia') || Sesion.get('RazonSocial');
  document.getElementById('empresa-nombre').textContent = empresa;
  const terminal = Sesion.get('NombreTerminal') || '';
  const sucursal = Sesion.get('NombreSucursal') || '';
  document.getElementById('empresa-terminal').textContent = [sucursal, terminal].filter(Boolean).join(' — ');
}

function init() {
  document.getElementById('form-cuenta').addEventListener('submit', async e => {
    e.preventDefault();
    const ruc = document.getElementById('inp-ruc').value.trim();
    const codigo = document.getElementById('inp-codigo').value.trim();
    if (!ruc || !codigo) return;

    mostrarLoading(true);
    try {
      const rows = await LlamarSP('LICENCIA', { RUC: ruc, Codigo: codigo }, CONFIG.TOKEN_LICENCIA);
      if (!rows?.length) throw new Error('Licencia no válida');
      if (rows[0].Mensaje) throw new Error(rows[0].Mensaje);

      const { token_apisql, IDEntidad, RazonSocial, NombreFantasia, RUC } = rows[0];
      Sesion.set('token_apisql', token_apisql);
      Sesion.set('IDEntidad', IDEntidad);
      Sesion.set('RazonSocial', RazonSocial);
      Sesion.set('NombreFantasia', NombreFantasia);
      Sesion.set('RUC', RUC);

      // Verificar si este dispositivo tiene terminal registrada
      const terminalOk = await verificarTerminal();
      if (terminalOk) {
        await irAUsuario();
      } else {
        const { default: Terminal } = await import('./Terminal.js');
        mostrarPantalla('screen-registro-terminal');
        Terminal.cargar();
      }
    } catch (err) {
      mostrarToast(err.message || 'Error al validar licencia', 'error');
    } finally {
      mostrarLoading(false);
    }
  });
}

export { irAUsuario };
export default { init };
