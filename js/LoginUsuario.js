import { LlamarSP, Sesion, mostrarPantalla, mostrarLoading, mostrarToast } from './App.js';

const _CRED_KEY = 'tpv_cred';

function _guardarCred(IDEntidad, usuario, password) {
  localStorage.setItem(_CRED_KEY, JSON.stringify({ IDEntidad, usuario, password }));
}

function _leerCred(IDEntidad) {
  try {
    const c = JSON.parse(localStorage.getItem(_CRED_KEY));
    if (c && c.IDEntidad === IDEntidad) return c;
  } catch {}
  return null;
}

function _borrarCred() {
  localStorage.removeItem(_CRED_KEY);
}

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
    const IDEntidad = Sesion.get('IDEntidad');
    const cred = _leerCred(IDEntidad);
    if (cred) {
      mostrarLoading(true);
      try {
        await _procesarLogin(IDEntidad, cred.usuario, cred.password);
        await _irACaja();
        return;
      } catch {
        _borrarCred(); // credenciales guardadas ya no son válidas
      } finally {
        mostrarLoading(false);
      }
    }
  }

  // Mostrar formulario — pre-limpiar campos
  document.getElementById('inp-usuario').value  = '';
  document.getElementById('inp-password').value = '';
  document.getElementById('chk-recordar').checked = false;
  mostrarPantalla('screen-usuario');
}

function init() {
  document.getElementById('form-usuario').addEventListener('submit', async e => {
    e.preventDefault();
    const usuario   = document.getElementById('inp-usuario').value.trim();
    const password  = document.getElementById('inp-password').value;
    const recordar  = document.getElementById('chk-recordar').checked;
    if (!usuario || !password) return;
    mostrarLoading(true);
    try {
      const IDEntidad = Sesion.get('IDEntidad');
      await _procesarLogin(IDEntidad, usuario, password);
      if (recordar) _guardarCred(IDEntidad, usuario, password);
      else _borrarCred();
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
