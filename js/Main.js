import { mostrarPantalla, mostrarLoading, mostrarToast } from './App.js';
import { Sesion } from './App.js';

// placeholder — se implementa en Etapa 4-6
async function cargar() {
  const terminal = Sesion.get('NombreTerminal');
  const usuario = Sesion.get('NombreUsuario');
  const empresa = Sesion.get('NombreFantasia') || Sesion.get('RazonSocial');

  document.getElementById('main-terminal').textContent = terminal;
  document.getElementById('main-usuario').textContent = usuario;
  document.getElementById('main-empresa').textContent = empresa;
}

function init() {
  document.getElementById('btn-main-salir').addEventListener('click', () => {
    mostrarPantalla('screen-terminal');
    import('./Terminal.js').then(m => m.default.cargar());
  });
}

export default { init, cargar };
