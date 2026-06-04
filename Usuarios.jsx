/* =========================================================
   USUARIOS — gestión de cuentas y accesos
   Solo visible para gerencia/jefatura (perms.usuarios).
   ========================================================= */

const ROLES_DISPONIBLES = [
  "Asesor comercial", "Asesora comercial", "Coordinador de ventas",
  "SubGerente Comercial", "Gerente General",
];
const PALETA_USUARIOS = ["#2f5bd7", "#0f9b6c", "#b3324a", "#7c3aed", "#d98213", "#0e7490", "#be185d", "#4338ca"];

function Usuarios({ asesores, setAsesores, currentId, toast }) {
  const [edit, setEdit] = useState(null);   // usuario en edición
  const [crear, setCrear] = useState(false);
  const [del, setDel] = useState(null);

  const nivelOrden = { Gerencia: 0, Jefatura: 1, Asesor: 2 };
  const orden = [...asesores].sort((a, b) => nivelOrden[PERMS.nivelDe(a.rol)] - nivelOrden[PERMS.nivelDe(b.rol)]);

  function guardar(u) {
    setAsesores(list => {
      const i = list.findIndex(x => x.id === u.id);
      if (i === -1) return [...list, u];
      return list.map(x => x.id === u.id ? u : x);
    });
    toast("Accesos de " + u.nombre + " guardados", "ok");
    setEdit(null); setCrear(false);
  }
  function crearUsuario(u) {
    const id = "u" + Date.now().toString(36);
    guardar({ id, ...u });
    toast("Usuario " + u.nombre + " creado", "ok");
  }
  function eliminar(u) {
    setAsesores(list => list.filter(x => x.id !== u.id));
    toast("Usuario " + u.nombre + " eliminado", "warn");
    setDel(null);
  }
  function toggleActivo(a) {
    const bloquear = a.activo !== false;
    setAsesores(list => list.map(x => x.id === a.id ? { ...x, activo: !bloquear } : x));
    toast(bloquear ? "Acceso bloqueado para " + a.nombre : "Acceso habilitado para " + a.nombre, bloquear ? "warn" : "ok");
  }

  const conteo = {
    total: asesores.length,
    gerencia: asesores.filter(a => PERMS.nivelDe(a.rol) === "Gerencia").length,
    jefatura: asesores.filter(a => PERMS.nivelDe(a.rol) === "Jefatura").length,
    asesor: asesores.filter(a => PERMS.nivelDe(a.rol) === "Asesor").length,
  };

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div className="view" style={{ maxWidth: 1080, margin: "0 auto", padding: "26px 36px 60px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="kicker" style={{ color: "var(--primary)" }}>Administración</div>
            <h1 style={{ fontSize: 34, marginTop: 4 }}>Usuarios y accesos</h1>
            <div style={{ color: "var(--muted)", marginTop: 6, fontSize: 14.5 }}>
              Controla quién entra y qué puede hacer. Solo gerencia y jefatura administran estas cuentas.
            </div>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => setCrear(true)}><Icon name="plus" size={16} /> Crear usuario</button>
        </div>

        {/* Resumen */}
        <div className="autogrid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, margin: "22px 0 26px" }}>
          {[["Total", conteo.total, "var(--ink)"], ["Gerencia", conteo.gerencia, "var(--primary)"],
            ["Jefatura", conteo.jefatura, "var(--warn-ink)"], ["Asesores", conteo.asesor, "var(--ok-ink)"]].map(([l, n, c]) => (
            <div key={l} className="card" style={{ padding: "16px 18px" }}>
              <div className="mono" style={{ fontSize: 30, fontWeight: 700, color: c, lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Lista */}
        <div className="card" style={{ overflow: "hidden" }}>
          {orden.map((a, i) => {
            const p = PERMS.permsFor(a);
            const accesos = PERMS.ACCESS_KEYS.filter(k => p.acc[k.k]);
            const esYo = a.id === currentId;
            const esSuper = !!a.super;
            const inactiva = a.activo === false;
            return (
              <div key={a.id} className="user-row" style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderTop: i ? "1px solid var(--line-2)" : "none", opacity: inactiva ? .72 : 1 }}>
                <Avatar a={a} size={44} />
                <div className="user-id" style={{ minWidth: 170 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {a.nombre}
                    {esYo && <span className="badge" style={{ fontSize: 10, padding: "2px 7px", background: "var(--bg-2)", color: "var(--muted)" }}>Tú</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 2, display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                    <span className="mono">@{a.usuario || "—"}</span>
                    <span style={{ opacity: .5 }}>·</span>
                    <span>{a.rol}</span>
                  </div>
                </div>
                <span className={"badge " + PERMS.nivelBadgeClass(p.nivel)} style={{ fontSize: 11 }}>{p.nivel}</span>
                <span className={"badge " + (inactiva ? "badge-bad" : "badge-ok")} style={{ fontSize: 11 }}>
                  <span className="dot"></span>{inactiva ? "Sin acceso" : "Con acceso"}
                </span>

                {/* Chips de accesos */}
                <div className="user-chips" style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1, justifyContent: "flex-start" }}>
                  {esSuper
                    ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--primary-700)", background: "var(--primary-050)", border: "1px solid var(--primary-100)", padding: "4px 9px", borderRadius: 8 }}><Icon name="shield" size={12} /> Control total</span>
                    : accesos.length === 0
                    ? <span style={{ fontSize: 12.5, color: "var(--faint)" }}>Solo ver plano y cotizar</span>
                    : accesos.map(k => (
                        <span key={k.k} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--ink-2)", background: "var(--surface-2)", border: "1px solid var(--line)", padding: "4px 9px", borderRadius: 8 }}>
                          <Icon name={k.icon} size={12} style={{ color: "var(--primary)" }} /> {k.label}
                        </span>
                      ))}
                </div>

                <div className="user-actions" style={{ display: "flex", gap: 8 }}>
                  <button className={"btn " + (inactiva ? "btn-primary" : "")} title={esSuper ? "El superusuario no se puede bloquear" : (inactiva ? "Habilitar acceso" : "Bloquear acceso")}
                    disabled={esSuper} onClick={() => toggleActivo(a)} style={{ padding: "9px 12px" }}>
                    <Icon name={inactiva ? "check" : "lock"} size={15} /> {inactiva ? "Dar acceso" : "Bloquear"}
                  </button>
                  <button className="btn" onClick={() => setEdit(a)}><Icon name="sliders" size={15} /> Editar</button>
                  <button className="btn btn-ghost" title={esYo || esSuper ? "No puedes eliminar esta cuenta" : "Eliminar"} disabled={esYo || esSuper} onClick={() => setDel(a)} style={{ padding: 9, color: (esYo || esSuper) ? "var(--faint)" : "var(--bad-ink)" }}>
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {(edit || crear) && (
        <UserEditorModal
          user={edit}
          usuariosTomados={asesores.map(a => (a.usuario || "").toLowerCase())}
          onClose={() => { setEdit(null); setCrear(false); }}
          onSave={(u) => edit ? guardar(u) : crearUsuario(u)} />
      )}
      {del && (
        <Modal onClose={() => setDel(null)} title="Eliminar usuario" width={400}>
          <p style={{ color: "var(--muted)", fontSize: 14, marginTop: -6 }}>
            ¿Eliminar la cuenta de <b style={{ color: "var(--ink)" }}>{del.nombre}</b>? Perderá el acceso al cotizador. Esta acción no se puede deshacer.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
            <button className="btn" onClick={() => setDel(null)}>Cancelar</button>
            <button className="btn btn-danger" onClick={() => eliminar(del)}><Icon name="trash" size={15} /> Eliminar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function UserEditorModal({ user, usuariosTomados, onClose, onSave }) {
  const isNew = !user;
  const esSuper = !!(user && user.super);
  const [nombre, setNombre] = useState(user ? user.nombre : "");
  const [usuario, setUsuario] = useState(user ? (user.usuario || "") : "");
  const [password, setPassword] = useState(user ? (user.password || "") : "");
  const [verPass, setVerPass] = useState(false);
  const [activo, setActivo] = useState(user ? user.activo !== false : true);
  const [rol, setRol] = useState(user ? user.rol : ROLES_DISPONIBLES[0]);
  const [acc, setAcc] = useState(() => user ? PERMS.permsFor(user).acc : PERMS.defaultAccesos(ROLES_DISPONIBLES[0]));
  const [tocado, setTocado] = useState(!!user);  // si el usuario tocó los toggles manualmente

  // al cambiar el rol en una cuenta nueva (sin tocar toggles), sincroniza accesos sugeridos
  function cambiarRol(r) {
    setRol(r);
    if (!tocado) setAcc(PERMS.defaultAccesos(r));
  }
  function toggle(k) { setTocado(true); setAcc(a => ({ ...a, [k]: !a[k] })); }

  const iniciales = (nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("") || "?").toUpperCase();
  const color = user ? user.color : PALETA_USUARIOS[Math.floor(Math.random() * PALETA_USUARIOS.length)];
  const nivel = PERMS.nivelDe(rol, user);
  const userClean = usuario.trim().toLowerCase();
  const yaTengo = user && (user.usuario || "").toLowerCase() === userClean;
  const tomado = (usuariosTomados || []).includes(userClean) && !yaTengo;
  const userOk = /^[a-z0-9._-]{3,}$/.test(userClean);
  const ok = nombre.trim().length >= 2 && userOk && !tomado && password.length >= 4;
  const draftAvatar = { nombre: nombre || "?", iniciales, color };

  return (
    <Modal onClose={onClose} title={isNew ? "Crear usuario" : "Editar accesos"} width={500}>
      {/* Identidad */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "10px 0 18px" }}>
        <Avatar a={draftAvatar} size={52} />
        <div style={{ flex: 1 }}>
          <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Nombre completo</label>
          <div className="field" style={{ height: 44 }}><input placeholder="Ej. Carla Mendoza" value={nombre} onChange={e => setNombre(e.target.value)} autoFocus={isNew} /></div>
        </div>
      </div>

      {/* Credenciales de acceso */}
      <div className="form-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Usuario</label>
          <div className="field" style={{ height: 44 }}>
            <Icon name="users" size={15} style={{ color: "var(--faint)" }} />
            <input placeholder="ej. cmendoza" value={usuario} autoCapitalize="none" autoCorrect="off" spellCheck="false"
              onChange={e => setUsuario(e.target.value.replace(/\s/g, "").toLowerCase())} />
          </div>
          {usuario && !userOk && <div style={{ fontSize: 11.5, color: "var(--bad-ink)", marginTop: 5 }}>Mínimo 3 caracteres: letras, números, . _ -</div>}
          {tomado && <div style={{ fontSize: 11.5, color: "var(--bad-ink)", marginTop: 5 }}>Ese usuario ya existe.</div>}
        </div>
        <div>
          <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Contraseña</label>
          <div className="field" style={{ height: 44 }}>
            <Icon name="lock" size={15} style={{ color: "var(--faint)" }} />
            <input type={verPass ? "text" : "password"} placeholder="••••••••" value={password}
              onChange={e => setPassword(e.target.value)} />
            <button type="button" onClick={() => setVerPass(v => !v)} className="btn btn-ghost" style={{ padding: 5, marginRight: -3 }} title={verPass ? "Ocultar" : "Mostrar"}>
              <Icon name={verPass ? "eyeOff" : "eye"} size={15} style={{ color: "var(--faint)" }} />
            </button>
          </div>
          {password && password.length < 4 && <div style={{ fontSize: 11.5, color: "var(--bad-ink)", marginTop: 5 }}>Mínimo 4 caracteres.</div>}
        </div>
      </div>

      {/* Acceso habilitado */}
      {!esSuper && (
        <label onClick={() => setActivo(v => !v)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", border: "1px solid " + (activo ? "var(--ok)" : "var(--line)"), background: activo ? "var(--ok-bg)" : "var(--surface)", borderRadius: 12, cursor: "pointer", marginBottom: 18, transition: ".12s" }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: activo ? "var(--ok)" : "var(--bg-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: activo ? "#fff" : "var(--faint)" }}><Icon name={activo ? "check" : "lock"} size={16} /></span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>Acceso habilitado</span>
            <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{activo ? "Esta cuenta puede iniciar sesión." : "Bloqueada: no podrá ingresar hasta que la habilites."}</span>
          </span>
          <span style={{ width: 42, height: 24, borderRadius: 99, background: activo ? "var(--ok)" : "#cbd2df", position: "relative", transition: ".15s", flexShrink: 0 }}>
            <span style={{ position: "absolute", top: 3, left: activo ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: ".15s", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }}></span>
          </span>
        </label>
      )}

      <div className="form-2col" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Rol / cargo</label>
          <div className="field" style={{ height: 44, padding: 0 }}>
            <select value={rol} onChange={e => cambiarRol(e.target.value)} style={{ border: 0, outline: 0, background: "transparent", width: "100%", height: "100%", padding: "0 12px", fontSize: 15 }}>
              {ROLES_DISPONIBLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Nivel</label>
          <span className={"badge " + PERMS.nivelBadgeClass(nivel)} style={{ fontSize: 12, padding: "8px 12px" }}>{nivel}</span>
        </div>
      </div>

      {/* Accesos */}
      <label className="kicker" style={{ display: "block", marginBottom: 8 }}>Accesos</label>
      {esSuper ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", border: "1px solid var(--primary)", background: "var(--primary-050)", borderRadius: 12 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--primary)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><Icon name="shield" size={16} /></span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>Control total (superusuario)</span>
            <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>Acceso a todo el sistema. No se puede limitar ni deshabilitar.</span>
          </span>
        </div>
      ) : (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* base siempre activa */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface-2)", opacity: .9 }}>
          <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--bg-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}><Icon name="tag" size={16} /></span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>Ver plano y cotizar</span>
            <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>Acceso base de toda cuenta</span>
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--faint)" }}>Siempre</span>
        </div>

        {PERMS.ACCESS_KEYS.map(k => {
          const on = !!acc[k.k];
          return (
            <label key={k.k} onClick={() => toggle(k.k)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", border: "1px solid " + (on ? "var(--primary)" : "var(--line)"), background: on ? "var(--primary-050)" : "var(--surface)", borderRadius: 12, cursor: "pointer", transition: ".12s" }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: on ? "var(--primary)" : "var(--bg-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: on ? "#fff" : "var(--faint)", transition: ".12s" }}><Icon name={k.icon} size={16} /></span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--ink)" }}>{k.label}</span>
                <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>{k.desc}</span>
              </span>
              <span style={{ width: 42, height: 24, borderRadius: 99, background: on ? "var(--primary)" : "#cbd2df", position: "relative", transition: ".15s", flexShrink: 0 }}>
                <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: ".15s", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }}></span>
              </span>
            </label>
          );
        })}
      </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!ok} onClick={() => onSave({
          ...(user || {}),
          nombre: nombre.trim(), usuario: userClean, password, rol, iniciales, color,
          activo: esSuper ? true : activo,
          accesos: acc, puedeAprobar: !!acc.aprobar,
        })}><Icon name="check" size={15} /> {isNew ? "Crear usuario" : "Guardar cambios"}</button>
      </div>
    </Modal>
  );
}

window.Usuarios = Usuarios;
