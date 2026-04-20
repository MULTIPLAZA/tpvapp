import { LlamarSP, Sesion, mostrarPantalla, mostrarLoading, mostrarToast } from './App.js';

function init() {
  document.getElementById('form-usuario').addEventListener('submit', async e => {
    e.preventDefault();
    const usuario = document.getElementById('inp-usuario').value.trim();
    const password = document.getElementById('inp-password').value;
    if (!usuario || !password) return;

    mostrarLoading(true);
    try {
      const rows = await LlamarSP('LOGIN', {
        IDEntidad: Sesion.get('IDEntidad'),
        Usuario: usuario,
        Password: password,
      });

      if (!rows?.length) throw new Error('Usuario o contraseña incorrectos');
      if (rows[0].Mensaje) throw new Error(rows[0].Mensaje);

      const { IDUsuario, Nombre, Perfil, IDPerfil } = rows[0];
      Sesion.set('IDUsuario', IDUsuario);
      Sesion.set('NombreUsuario', Nombre);
      Sesion.set('Perfil', Perfil);
      Sesion.set('IDPerfil', IDPerfil);

      const { default: Main } = await import('./Main.js');
      mostrarPantalla('screen-main');
      Main.cargar();
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
