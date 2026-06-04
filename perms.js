/* ============================================================
   PERMISOS — accesos por usuario
   Cada usuario tiene un objeto `accesos` (toggles). Si no lo
   trae, se derivan valores por defecto según su rol. Solo
   gerencia/jefatura puede gestionar usuarios y sus accesos.
   ============================================================ */
(function () {
  // Catálogo de accesos editables (orden = orden en el editor)
  const ACCESS_KEYS = [
    { k: "editarPlano", label: "Editar plano",            desc: "Subir plano, dibujar, mapear y exportar",   icon: "edit" },
    { k: "admin",       label: "Admin de lotes",          desc: "Crear, editar y eliminar lotes",            icon: "building" },
    { k: "cond",        label: "Condiciones comerciales", desc: "Topes, tasas, plazos y aprobadores",        icon: "shield" },
    { k: "aprobar",     label: "Aprobar descuentos",      desc: "Autoriza excepciones y Visto Bueno",        icon: "check" },
    { k: "usuarios",    label: "Gestionar usuarios",      desc: "Crear cuentas y definir sus accesos",       icon: "users" },
  ];

  const esGerencia = (rol) => /gerente|subgerente/i.test(rol || "");
  const esJefatura = (rol) => /coordinador|jefatura|jefe/i.test(rol || "");

  function nivelDe(rol, a) {
    if (a && a.super) return "Superusuario";
    return esGerencia(rol) ? "Gerencia" : esJefatura(rol) ? "Jefatura" : "Asesor";
  }

  // ¿la cuenta tiene acceso habilitado? (activo === false bloquea el ingreso)
  function activo(a) { return !a || a.activo !== false; }

  // Valida usuario + contraseña + acceso habilitado. Devuelve { ok, user, motivo }.
  function auth(asesores, usuario, password) {
    const u = (usuario || "").trim().toLowerCase();
    const cuenta = (asesores || []).find(a => ((a.usuario || "").trim().toLowerCase()) === u);
    if (!cuenta) return { ok: false, motivo: "Usuario no encontrado." };
    if ((cuenta.password || "") !== password) return { ok: false, motivo: "Contraseña incorrecta." };
    if (!activo(cuenta)) return { ok: false, motivo: "Tu acceso está deshabilitado. Contacta al administrador." };
    return { ok: true, user: cuenta };
  }

  // accesos por defecto según el rol
  function defaultAccesos(rol) {
    const g = esGerencia(rol), j = esJefatura(rol);
    return {
      editarPlano: g || j,
      admin:       g || j,
      cond:        g,
      aprobar:     g,
      usuarios:    g || j,   // solo gerencia o jefatura administra usuarios
    };
  }

  // permisos efectivos de un usuario (base por rol + overrides explícitos)
  function permsFor(a) {
    const rol = (a && a.rol) || "";
    // Superusuario: control total, sin importar accesos.
    if (a && a.super) {
      const all = { editarPlano: true, admin: true, cond: true, aprobar: true, usuarios: true };
      return { plano: true, editarPlano: true, admin: true, cond: true, aprobar: true, usuarios: true,
        super: true, nivel: "Superusuario", acc: all };
    }
    const base = defaultAccesos(rol);
    const acc = (a && a.accesos) ? Object.assign({}, base, a.accesos) : base;
    return {
      plano: true,                         // ver plano y cotizar: siempre
      editarPlano: !!acc.editarPlano,
      admin: !!acc.admin,
      cond: !!acc.cond,
      aprobar: !!acc.aprobar || !!(a && a.puedeAprobar),
      usuarios: !!acc.usuarios,
      super: false,
      nivel: nivelDe(rol, a),
      acc,
    };
  }

  // normaliza un usuario para que siempre tenga accesos explícitos
  function withAccesos(a) {
    return Object.assign({}, a, { accesos: permsFor(a).acc });
  }

  function nivelBadgeClass(nivel) {
    return nivel === "Superusuario" ? "badge-primary"
      : nivel === "Gerencia" ? "badge-primary"
      : nivel === "Jefatura" ? "badge-warn" : "badge-ok";
  }

  window.PERMS = { ACCESS_KEYS, nivelDe, defaultAccesos, permsFor, withAccesos, esGerencia, esJefatura, nivelBadgeClass, activo, auth };
  window.permsFor = permsFor; // conveniencia para los componentes
})();
