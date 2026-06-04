/* ============================================================
   BOOTSTRAP — pantalla de primer uso.
   Solo aparece cuando no existe ningún perfil en la base de
   datos (count_profiles() = 0). Crea la cuenta administradora.
   ============================================================ */
function Bootstrap({ brand, onDone }) {
  const [nombre,   setNombre]   = React.useState("Luis David Arce");
  const [usuario,  setUsuario]  = React.useState("larce");
  const [pass,     setPass]     = React.useState("larce2026");
  const [verPass,  setVerPass]  = React.useState(false);
  const [loading,  setLoading]  = React.useState(false);
  const [error,    setError]    = React.useState("");

  const iniciales = (nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("") || "LA").toUpperCase();
  const ok = nombre.trim().length >= 2 && /^[a-z0-9._-]{3,}$/.test(usuario) && pass.length >= 4;

  async function setup(e) {
    e.preventDefault();
    setLoading(true); setError("");
    // 1. Crear cuenta de autenticación
    const r = await DB.signUpUser(usuario, pass);
    if (!r.ok) { setError(r.motivo); setLoading(false); return; }
    // 2. Iniciar sesión con la nueva cuenta (necesario para insertar perfil propio)
    const email = usuario.trim().toLowerCase() + "@cotizador.app";
    const { data: sd, error: sie } = await DB.db.auth.signInWithPassword({ email, password: pass });
    if (sie || !sd.session) { setError("Cuenta creada pero no se pudo iniciar sesión. Intenta de nuevo."); setLoading(false); return; }
    // 3. Insertar perfil como superusuario
    const prof = { id: r.userId, usuario: usuario.trim().toLowerCase(), nombre: nombre.trim(),
      rol: "Gerente General", iniciales, color: "#7c3aed", accesos: {}, activo: true, super: true };
    const { ok: profOk, error: profErr } = await DB.upsertProfile(prof);
    if (!profOk) { setError("Error al guardar el perfil: " + (profErr && profErr.message)); setLoading(false); return; }
    setLoading(false);
    onDone({ session: sd.session, profile: prof });
  }

  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: 24 }}>
      <div className="card" style={{ width: "100%", maxWidth: 440, padding: "36px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 20 }}>
          <BrandLogo brand={brand} size={46} />
          <div>
            <div className="kicker" style={{ color: "var(--primary)" }}>Primera configuración</div>
            <h2 style={{ fontSize: 21, marginTop: 3 }}>Crear cuenta de administrador</h2>
          </div>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 13.5, marginBottom: 22, lineHeight: 1.55 }}>
          Esta pantalla solo aparece una vez. Crea la cuenta principal con la que administrarás el sistema y darás acceso a tu equipo.
        </p>
        <form onSubmit={setup}>
          <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Nombre completo</label>
          <div className="field" style={{ height: 46, marginBottom: 14 }}>
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre completo" />
          </div>
          <div className="form-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Usuario</label>
              <div className="field" style={{ height: 46 }}>
                <Icon name="users" size={15} style={{ color: "var(--faint)" }} />
                <input value={usuario} autoCapitalize="none" autoCorrect="off" spellCheck="false"
                  onChange={e => setUsuario(e.target.value.replace(/\s/g, "").toLowerCase())} />
              </div>
            </div>
            <div>
              <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Contraseña</label>
              <div className="field" style={{ height: 46 }}>
                <Icon name="lock" size={15} style={{ color: "var(--faint)" }} />
                <input type={verPass ? "text" : "password"} value={pass} onChange={e => setPass(e.target.value)} />
                <button type="button" className="btn btn-ghost" style={{ padding: 5, marginRight: -3 }}
                  onClick={() => setVerPass(v => !v)}>
                  <Icon name={verPass ? "eyeOff" : "eye"} size={14} style={{ color: "var(--faint)" }} />
                </button>
              </div>
            </div>
          </div>
          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--bad-ink)", background: "var(--bad-bg)", border: "1px solid #f3c7cb", borderRadius: 10, padding: "9px 12px", marginBottom: 12 }}>
              <Icon name="alert" size={15} /> {error}
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-lg" disabled={!ok || loading}
            style={{ width: "100%", justifyContent: "center" }}>
            {loading ? "Creando..." : "Crear cuenta y entrar"} {!loading && <Icon name="chevRight" size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
window.Bootstrap = Bootstrap;
