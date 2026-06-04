# Cotizador de Cuotas

Sistema estándar de cotización, separación y reserva de lotes sobre un plano.
Reutilizable para cualquier proyecto inmobiliario. Aplicación web estática
(no requiere servidor ni build). Funciona en celular, tablet y PC.

## Acceso inicial
- **Usuario:** `larce`
- **Contraseña:** `larce2026`  ← cámbiala al entrar (Usuarios → Editar).

`larce` es **superusuario** con control total: crea cuentas, da o bloquea el acceso
de cada asesor y ve el **Ranking de conexiones**.

> Un asesor solo puede iniciar sesión cuando el administrador le da acceso.

## Personalizar por proyecto
En la barra superior, junto al nombre, el ícono de editar (✎) abre **Identidad**:
cambia el **nombre**, **subtítulo** y **logo**. Eso se refleja en el login, las
cotizaciones y los planos exportados. El inventario de lotes se administra en **Lotes**
y el plano real se sube en **Plano**.

## Publicar en Netlify
1. https://app.netlify.com/ → **Add new site → Deploy manually**.
2. Arrastra **toda esta carpeta** a la zona de carga.
3. Netlify te da una URL pública. Listo. (Para actualizar, vuelve a arrastrar la carpeta.)

## Restaurar / limpiar datos
Menú de tu cuenta (arriba a la derecha):
- **Dejar todo limpio** — borra cotizaciones, reservas, clientes y ranking; conserva
  lotes, plano y cuentas. Ideal para arrancar un proyecto en blanco.
- **Restaurar datos demo** — vuelve todo al estado de demostración.

## Nota sobre seguridad
El login se valida en el navegador y los datos se guardan en **cada dispositivo**
(no se comparten entre equipos). Adecuado para un **piloto de pruebas**; para un
despliegue multiusuario con datos centralizados se necesita un servidor con base de
datos y autenticación.
