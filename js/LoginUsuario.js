import { LlamarSP, Sesion, mostrarPantalla, mostrarLoading, mostrarToast } from './App.js';

async function _procesarLogin(IDEntidad, usuario, password) {
  const rows = await LlamarSP('LOGIN', { IDEntidad, Usuario: usuario, Password: password });
  if (!rows?.length) throw new Error('Usuario o contraseña incorrectos');
  if (rows[0].Mensaje) throw new Error(rows[0].Mensaje);
  const { IDUsuario, Nombre, Perfil, IDPerfil } = rows[0];
  Sesion.set('IDUsuario', IDUsuario);
  Sesion.set('NombreUsuario', Nombre);
  Sesion.set('Perfil', Perfil);
  Sesion.set('IDPerfil', IDPerfil);
}

async function _irACaja() {
  const { default: Caja } = await import('./Caja.js');
  await Caja.verificarYAbrir();
}

export async function mostrar(forceForm = false) {
  const empresa = Sesion.get('NombreFantasia') || Sesion.get('RazonSocial');
  document.getElementById('empresa-nombre').textContent = empresa;
  const terminal = Sesion.get('NombreTerminal') || '';
  const sucursal = Sesion.get('NombreSucursal') || '';
  document.getElementById('empresa-terminal').textContent = [sucursal, terminal].filter(Boolean).join(' — ');

  if (!forceForm) {
    mostrarLoading(true);
    try {
      const IDEntidad = Sesion.get('IDEntidad');
      const rows = await LlamarSP('LOGIN', { IDEntidad, Usuario: '', Password: '' });
      if (rows?.[0]?.AutoLogin) {
        await _procesarLogin(IDEntidad, 'admin', '12345');
        await _irACaja();
        return;
      }
    } catch { /* mostrar formulario */ }
    finally { mostrarLoading(false); }
  }

  mostrarPantalla('screen-usuario');
}

function init() {
  document.getElementById('form-usuario').addEventListener('submit', async e => {
    e.preventDefault();
    const usuario = document.getElementById('inp-usuario').value.trim();
    const password = document.getElementById('inp-password').value;
    if (!usuario || !password) return;
    mostrarLoading(true);
    try {
      await _procesarLogin(Sesion.get('IDEntidad'), usuario, password);
      await _irACaja();
    } catch (err) {
      mostrarToast(err.message || 'Error al iniciar sesión', 'error');
    } finally {
      mostrarLoading(false);
    }
  });

  document.getElementById('btn-volver-cuenta').addEventListener('click', () => {
    mostrarPantalla('screen-cuenta');
  });
}

export default { init };
