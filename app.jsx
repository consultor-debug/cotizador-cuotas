/* =========================================================
   APP — shell, navegación, estado global, tweaks
   ========================================================= */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "indigo",
  "type": "editorial",
  "radius": 16,
  "density": "regular"
}/*EDITMODE-END*/;

function useToasts() {
  const [items, setItems] = useState([]);
  const toast = (msg, kind = "ok") => {
    const id = Math.random();
    setItems(t => [...t, { id, msg, kind }]);
    setTimeout(() => setItems(t => t.filter(x => x.id !== id)), 3200);
  };
  const node = (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 200, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }} className="no-print">
      {items.map(t => (
        <div key={t.id} className="pop" style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--ink)", color: "#fff", padding: "12px 18px", borderRadius: 12, boxShadow: "var(--shadow-lg)", fontSize: 14, fontWeight: 600 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: t.kind === "ok" ? "#4ade80" : t.kind === "warn" ? "#fbbf24" : "#f87171" }}></span>
          {t.msg}
        </div>
      ))}
    </div>
  );
  return [toast, node];
}

function usePersisted(key, makeInitial) {
  const [v, setV] = useState(() => STORE.load(key, makeInitial));
  useEffect(() => { STORE.save(key, v); }, [key, v]);
  return [v, setV];
}

// Persistencia en IndexedDB para blobs grandes (el plano) que no caben en localStorage.
function usePersistedImage(key) {
  const [v, setV] = useState(null);
  const ready = useRef(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      let val = null;
      try { val = await STORE.idbGet(key); } catch (e) {}
      // Migración: plano viejo guardado en localStorage → IndexedDB (una sola vez)
      if (STORE.has(key)) {
        const legacy = STORE.load(key, null);
        if (val == null && legacy != null) { val = legacy; try { await STORE.idbSet(key, legacy); } catch (e) {} }
        STORE.remove(key); // liberar el espacio de localStorage de todos modos
      }
      if (alive && val != null) setV(val);
    })().catch(() => {}).finally(() => { ready.current = true; });
    return () => { alive = false; };
  }, [key]);
  useEffect(() => {
    if (!ready.current) return; // no escribir hasta hidratar (evita borrar lo guardado)
    if (v == null) STORE.idbDel(key).catch(() => {});
    else STORE.idbSet(key, v).catch(() => {});
  }, [key, v]);
  return [v, setV];
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useState("plano");
  const demoRef = useRef(null);
  const demo = () => (demoRef.current || (demoRef.current = STORE.seed(APP)));

  const [lotes, setLotes] = usePersisted("lotes", () => APP.lotes.map(l => ({ ...l })));
  const [polys, setPolys] = usePersisted("polys", () => PLAN.seedPolys(APP.lotes));
  const [planoImg, setPlanoImg] = usePersistedImage("planoImg");
  const [planoMode, setPlanoMode] = usePersisted("planoMode", "esquema");
  const [planoOpacity, setPlanoOpacity] = usePersisted("planoOpacity", 1);
  const [brand, setBrand] = usePersisted("brand", () => ({ nombre: "Mi Proyecto", tagline: "Cotizador de cuotas", logo: null }));
  const [brandOpen, setBrandOpen] = useState(false);
  const [asesores, setAsesores] = usePersisted("asesores", () => APP.asesores.map(a => ({ ...a })));
  const [cond, setCond] = usePersisted("cond", () => JSON.parse(JSON.stringify(APP.condiciones)));
  const [clientes, setClientes] = usePersisted("clientes", () => demo().clientes);
  const [cotizaciones, setCotizaciones] = usePersisted("cotizaciones", () => demo().cotizaciones);
  const [reservas, setReservas] = usePersisted("reservas", () => demo().reservas);
  const [conexiones, setConexiones] = usePersisted("conexiones", () => STORE.seedConexiones(APP));

  const [sessionUid, setSessionUid] = usePersisted("sessionUid", null);
  const [moneda, setMoneda] = useState("PEN");
  const [quote, setQuote] = useState(null);
  const [toast, toastNode] = useToasts();
  // Sesión activa solo si la cuenta existe y tiene acceso habilitado.
  const asesor = asesores.find(a => a.id === sessionUid && PERMS.activo(a)) || null;
  const asesorId = asesor ? asesor.id : null;
  const perms = asesor ? permsFor(asesor) : permsFor({});

  // Migración de cuentas: deja solo cuentas con acceso real (usuario) y garantiza
  // que exista el superusuario larce. Limpia las cuentas demo heredadas (sin usuario).
  useEffect(() => {
    setAsesores(list => {
      const tieneLarce = list.some(a => a.super || (a.usuario || "").toLowerCase() === "larce");
      const limpio = list.filter(a => a.usuario || a.super);
      const next = tieneLarce ? limpio : [APP.asesores[0], ...limpio];
      return next.length !== list.length ? next : list;
    });
  }, []);
  const reservasRef = useRef(reservas);
  useEffect(() => { reservasRef.current = reservas; }, [reservas]);
  // Migración: reservas guardadas antes del historial reciben su evento de creación
  useEffect(() => {
    if (reservas.some(r => !r.historial)) {
      setReservas(rs => rs.map(r => {
        if (r.historial) return r;
        const d = r.dias || Math.max(1, Math.round((r.expiresAt - r.createdAt) / STORE.DAY));
        return { ...r, dias: d, historial: [{ ts: r.createdAt, accion: "creada", por: r.asesorNombre, detalle: d + " días de plazo" }] };
      }));
    }
  }, []);
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const expired = reservasRef.current.filter(r => r.estado === "activa" && r.expiresAt <= now);
      if (!expired.length) return;
      const ids = new Set(expired.map(e => e.loteId));
      setReservas(rs => rs.map(r => (r.estado === "activa" && r.expiresAt <= now) ? { ...r, estado: "vencida", historial: [...(r.historial || []), { ts: now, accion: "vencida", por: "Sistema", detalle: "Plazo cumplido · lote liberado" }] } : r));
      setLotes(ls => ls.map(l => ids.has(l.id) && l.estado === "separado" ? { ...l, estado: "disponible" } : l));
      toast(expired.length + (expired.length === 1 ? " reserva vencida · lote liberado" : " reservas vencidas · lotes liberados"), "warn");
    };
    const iv = setInterval(tick, 5000); tick();
    return () => clearInterval(iv);
  }, []);

  // --- Handlers de cliente / cotización / reserva ---
  function upsertCliente(c) {
    if (!c || !c.nombre) return;
    const key = c.nombre.trim().toLowerCase();
    setClientes(list => {
      const i = list.findIndex(x => x.nombre.trim().toLowerCase() === key);
      if (i === -1) return [{ id: "c" + Date.now().toString(36), nombre: c.nombre.trim(), telefono: c.telefono || "", dni: c.dni || "", email: c.email || "", createdAt: Date.now() }, ...list];
      return list.map((x, j) => j === i ? { ...x, telefono: c.telefono || x.telefono } : x);
    });
  }
  function registrarCotizacion(rec) {
    setCotizaciones(cs => [rec, ...cs]);
    upsertCliente({ nombre: rec.clienteNombre, telefono: rec.clienteContacto });
  }
  function crearReserva(lote, cliente, dias) {
    const now = Date.now();
    const d = dias || cond.validezDias || 3;
    const r = {
      id: "RSV-" + lote.id + "-" + now.toString(36),
      loteId: lote.id, manzana: lote.manzana, numero: lote.numero, precioLista: lote.precioLista,
      asesorId: asesor.id, asesorNombre: asesor.nombre,
      clienteId: null, clienteNombre: cliente.nombre, clienteContacto: cliente.telefono || "",
      createdAt: now, expiresAt: now + d * STORE.DAY, dias: d, estado: "activa",
      historial: [{ ts: now, accion: "creada", por: asesor.nombre, detalle: d + " días de plazo · cliente " + cliente.nombre }],
    };
    setReservas(rs => [r, ...rs.filter(x => !(x.loteId === lote.id && x.estado === "activa"))]);
    upsertCliente(cliente);
  }
  function editarVencimientoReserva(r, dias) {
    const ts = Date.now();
    setReservas(rs => rs.map(x => {
      if (x.id !== r.id) return x;
      const antes = x.dias || Math.max(1, Math.round((x.expiresAt - x.createdAt) / STORE.DAY));
      const ev = { ts, accion: "plazo", por: asesor.nombre, detalle: antes + " → " + dias + " días" };
      return { ...x, dias, expiresAt: x.createdAt + dias * STORE.DAY, historial: [...(x.historial || []), ev] };
    }));
    toast("Lote " + r.loteId + " · vencimiento actualizado a " + dias + " días", "ok");
  }
  function cerrarReservaDeLote(loteId, estado) {
    setReservas(rs => rs.map(r => r.loteId === loteId && r.estado === "activa" ? { ...r, estado } : r));
  }
  function liberarReserva(r) {
    const ts = Date.now();
    setReservas(rs => rs.map(x => x.id === r.id ? { ...x, estado: "liberada", historial: [...(x.historial || []), { ts, accion: "liberada", por: asesor.nombre, detalle: "Liberada manualmente" }] } : x));
    setLotes(ls => ls.map(l => l.id === r.loteId && l.estado === "separado" ? { ...l, estado: "disponible" } : l));
    toast("Reserva de lote " + r.loteId + " liberada", "ok");
  }
  function convertirReserva(r) {
    const ts = Date.now();
    setReservas(rs => rs.map(x => x.id === r.id ? { ...x, estado: "convertida", historial: [...(x.historial || []), { ts, accion: "convertida", por: asesor.nombre, detalle: "Convertida en venta" }] } : x));
    setLotes(ls => ls.map(l => l.id === r.loteId ? { ...l, estado: "vendido" } : l));
    toast("Lote " + r.loteId + " vendido a " + r.clienteNombre, "ok");
  }
  function resetDemo() {
    STORE.clearAll();
    location.reload();
  }
  function vaciarTodo() {
    STORE.vaciarTrabajo();
    location.reload();
  }
  // Registra/incrementa la conexión de una cuenta al iniciar sesión.
  function registrarConexion(u) {
    const now = Date.now();
    setConexiones(cs => {
      const base = { id: u.id, nombre: u.nombre, rol: u.rol, color: u.color, iniciales: u.iniciales };
      const i = cs.findIndex(x => x.id === u.id);
      if (i === -1) return [...cs, { ...base, count: 1, firstSeen: now, lastSeen: now }];
      return cs.map(x => x.id === u.id ? { ...x, ...base, count: (x.count || 0) + 1, lastSeen: now } : x);
    });
  }
  function iniciarSesion(u) {
    registrarConexion(u);
    setSessionUid(u.id);
    setRoute("plano");
  }

  // aplicar tweaks de estilo
  useEffect(() => {
    const r = document.documentElement;
    r.setAttribute("data-theme", t.theme);
    r.setAttribute("data-type", t.type);
    r.style.setProperty("--radius", t.radius + "px");
    r.style.setProperty("--radius-sm", (t.radius * 0.7) + "px");
    r.style.setProperty("--density", t.density === "compact" ? 0.85 : t.density === "comfy" ? 1.12 : 1);
  }, [t]);

  const nav = [
    { k: "plano", label: "Plano", icon: "layers" },
    perms.admin && { k: "tablero", label: "Tablero", icon: "chart" },
    { k: "cotizaciones", label: "Cotizaciones", icon: "history" },
    { k: "reservas", label: "Reservas", icon: "clock" },
    perms.admin && { k: "admin", label: "Lotes", icon: "building" },
    perms.cond && { k: "cond", label: "Condiciones", icon: "shield" },
    perms.usuarios && { k: "usuarios", label: "Usuarios", icon: "users" },
    perms.usuarios && { k: "conexiones", label: "Conexiones", icon: "chart" },
  ].filter(Boolean);

  // Guardia de ruta: si el rol no puede ver la sección, vuelve al plano
  useEffect(() => {
    if (!nav.some(n => n.k === route)) setRoute("plano");
  }, [route, perms.admin, perms.cond, perms.usuarios]);

  if (!asesor) return <Login asesores={asesores} brand={brand} onLogin={iniciarSesion} />;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <header className="no-print app-header" style={{ display: "flex", alignItems: "center", gap: 18, padding: "0 24px", height: 60, background: "var(--surface)", borderBottom: "1px solid var(--line)", flexShrink: 0, zIndex: 40 }}>
        <div className="app-brand" style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <BrandLogo brand={brand} size={32} />
          <div className="app-brand-text" style={{ lineHeight: 1.15 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16 }}>{brand.nombre}</div>
            <div style={{ fontSize: 11, color: "var(--faint)" }}>{brand.tagline}</div>
          </div>
          {perms.editarPlano && (
            <button onClick={() => setBrandOpen(true)} title="Editar identidad" className="btn btn-ghost" style={{ padding: 6, marginLeft: 2 }}>
              <Icon name="edit" size={14} style={{ color: "var(--faint)" }} />
            </button>
          )}
        </div>

        <nav className="app-nav" style={{ display: "flex", gap: 4, marginLeft: 18, minWidth: 0, overflowX: "auto" }}>
          {nav.map(n => (
            <button key={n.k} onClick={() => setRoute(n.k)}
              style={{ display: "flex", alignItems: "center", gap: 8, border: 0, background: route === n.k ? "var(--primary-050)" : "transparent", whiteSpace: "nowrap",
                color: route === n.k ? "var(--primary-700)" : "var(--muted)", padding: "9px 15px", borderRadius: 10, fontWeight: 600, fontSize: 14, transition: ".12s" }}>
              <Icon name={n.icon} size={16} /> {n.label}
            </button>
          ))}
        </nav>

        <div className="topbar-right" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
          {/* Moneda */}
          <div className="segtabs" style={{ background: "var(--bg-2)", padding: 3 }}>
            {[["PEN", "S/"], ["USD", "$"]].map(([k, s]) => (
              <button key={k} className={moneda === k ? "on" : ""} style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => setMoneda(k)}>{s}</button>
            ))}
          </div>
          <AsesorSwitcher asesor={asesor} perms={perms} onLogout={() => { setSessionUid(null); }} goUsuarios={perms.usuarios ? () => setRoute("usuarios") : null} onReset={perms.usuarios ? resetDemo : null} onClear={perms.usuarios ? vaciarTodo : null} />
        </div>
      </header>

      {/* Contenido */}
      <main style={{ flex: 1, minHeight: 0 }}>
        {route === "plano" && <Plano lotes={lotes} setLotes={setLotes} polys={polys} setPolys={setPolys} planoImg={planoImg} setPlanoImg={setPlanoImg} planoMode={planoMode} setPlanoMode={setPlanoMode} planoOpacity={planoOpacity} setPlanoOpacity={setPlanoOpacity} cond={cond} asesor={asesor} moneda={moneda} perms={perms} brand={brand} clientes={clientes} onEnviar={setQuote} onReservar={crearReserva} onCerrarReserva={cerrarReservaDeLote} toast={toast} />}
        {route === "tablero" && <Tablero lotes={lotes} cotizaciones={cotizaciones} reservas={reservas} asesores={[...asesores, ...APP.demoAutores]} moneda={moneda} goReservas={() => setRoute("reservas")} />}
        {route === "cotizaciones" && <Cotizaciones cotizaciones={cotizaciones} setCotizaciones={setCotizaciones} asesor={asesor} perms={perms} moneda={moneda} toast={toast} />}
        {route === "reservas" && <Reservas reservas={reservas} asesor={asesor} perms={perms} moneda={moneda} cond={cond} onLiberar={liberarReserva} onConvertir={convertirReserva} onEditarVencimiento={editarVencimientoReserva} />}
        {route === "admin" && <AdminLotes lotes={lotes} setLotes={setLotes} moneda={moneda} toast={toast} goPlano={() => setRoute("plano")} brand={brand} />}
        {route === "cond" && <Condiciones cond={cond} setCond={setCond} toast={toast} goPlano={() => setRoute("plano")} />}
        {route === "usuarios" && <Usuarios asesores={asesores} setAsesores={setAsesores} currentId={asesorId} toast={toast} />}
        {route === "conexiones" && <Conexiones conexiones={conexiones} asesores={asesores} currentId={asesorId} toast={toast} />}
      </main>

      {quote && <CotizacionDoc quote={quote} brand={brand} onClose={() => setQuote(null)} onRegistrar={registrarCotizacion} toast={toast} />}
      {brandOpen && <BrandModal brand={brand} onClose={() => setBrandOpen(false)} onSave={(b) => { setBrand(b); setBrandOpen(false); toast("Identidad del cotizador actualizada", "ok"); }} />}
      {toastNode}

      {/* Tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Estilo visual" />
        <TweakColor label="Color de marca" value={brandColor(t.theme)}
          options={["#2f5bd7", "#0f9b6c", "#b3324a", "#2b3242"]}
          onChange={(v) => setTweak("theme", { "#2f5bd7": "indigo", "#0f9b6c": "esmeralda", "#b3324a": "granate", "#2b3242": "grafito" }[v])} />
        <TweakRadio label="Tipografía" value={t.type} options={["editorial", "geométrico", "clásico"]}
          onChange={(v) => setTweak("type", { "editorial": "editorial", "geométrico": "geometrico", "clásico": "clasico" }[v] || v)} />
        <TweakSection label="Forma" />
        <TweakSlider label="Redondeo" value={t.radius} min={4} max={24} unit="px" onChange={(v) => setTweak("radius", v)} />
        <TweakRadio label="Densidad" value={t.density} options={["compact", "regular", "comfy"]} onChange={(v) => setTweak("density", v)} />
      </TweaksPanel>
    </div>
  );
}

function brandColor(theme) {
  return { indigo: "#2f5bd7", esmeralda: "#0f9b6c", granate: "#b3324a", grafito: "#2b3242" }[theme] || "#2f5bd7";
}

// permsFor vive en perms.js (global). Alias local por comodidad.
const permsFor = window.permsFor;

function AsesorSwitcher({ asesor, perms, onLogout, goUsuarios, onReset, onClear }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);

  const email = asesor.usuario ? "@" + asesor.usuario : emailDe(asesor.nombre);
  const accesos = PERMS.ACCESS_KEYS.filter(k => perms.acc[k.k]);

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button className="user-chip" onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 9, border: "1px solid var(--line)", background: "var(--surface)", padding: "5px 10px 5px 6px", borderRadius: 99, cursor: "pointer" }}>
        <Avatar a={asesor} size={28} />
        <div className="user-chip-text" style={{ textAlign: "left", lineHeight: 1.15, whiteSpace: "nowrap" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{asesor.nombre}</div>
          <div style={{ fontSize: 10.5, color: "var(--faint)" }}>{asesor.rol}</div>
        </div>
        <span className={"badge user-chip-badge " + PERMS.nivelBadgeClass(perms.nivel)} style={{ fontSize: 10.5, padding: "3px 8px" }}>{perms.nivel}</span>
        <Icon name="chevDown" size={15} style={{ color: "var(--faint)" }} />
      </button>
      {open && (
        <div className="card pop" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 290, padding: 0, boxShadow: "var(--shadow-lg)", zIndex: 50, overflow: "hidden" }}>
          {/* Tu cuenta */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 14px", background: "var(--surface-2)", borderBottom: "1px solid var(--line)" }}>
            <Avatar a={asesor} size={42} />
            <div style={{ lineHeight: 1.3, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>{asesor.nombre}</div>
              <div style={{ fontSize: 11.5, color: "var(--faint)", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
            </div>
          </div>
          {/* Mis accesos */}
          <div style={{ padding: "12px 14px" }}>
            <div className="kicker" style={{ marginBottom: 8 }}>Mis accesos</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-2)", background: "var(--surface-2)", border: "1px solid var(--line)", padding: "4px 9px", borderRadius: 8 }}>Ver plano y cotizar</span>
              {accesos.map(k => (
                <span key={k.k} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, color: "var(--ink-2)", background: "var(--surface-2)", border: "1px solid var(--line)", padding: "4px 9px", borderRadius: 8 }}>
                  <Icon name={k.icon} size={12} style={{ color: "var(--primary)" }} /> {k.label}
                </span>
              ))}
            </div>
          </div>
          <hr className="divider" style={{ margin: "2px 0" }} />
          <div style={{ padding: 6 }}>
            {goUsuarios && (
              <button onClick={() => { goUsuarios(); setOpen(false); }} className="btn btn-ghost" style={{ width: "100%", justifyContent: "flex-start", gap: 10, padding: "9px 10px", fontWeight: 600 }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--primary-050)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}><Icon name="users" size={15} /></span>
                Gestionar usuarios
              </button>
            )}
            {onClear && (
              <button onClick={() => { if (confirm("¿Dejar todo limpio? Se borrarán cotizaciones, reservas, clientes y el ranking de conexiones. Se conservan los lotes, el plano y las cuentas.")) onClear(); }} className="btn btn-ghost" style={{ width: "100%", justifyContent: "flex-start", gap: 10, padding: "9px 10px", color: "var(--ink-2)", fontWeight: 600 }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--bg-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}><Icon name="trash" size={15} /></span>
                Dejar todo limpio
              </button>
            )}
            {onReset && (
              <button onClick={() => { if (confirm("¿Restaurar TODO a los datos de demostración? Se perderán tus cambios y las cuentas que hayas creado (la contraseña de larce vuelve a la inicial).")) onReset(); }} className="btn btn-ghost" style={{ width: "100%", justifyContent: "flex-start", gap: 10, padding: "9px 10px", color: "var(--ink-2)", fontWeight: 600 }}>
                <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--bg-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}><Icon name="reset" size={15} /></span>
                Restaurar datos demo
              </button>
            )}
            <button onClick={() => { setOpen(false); onLogout(); }} className="btn btn-ghost" style={{ width: "100%", justifyContent: "flex-start", gap: 10, padding: "9px 10px", color: "var(--ink-2)", fontWeight: 600 }}>
              <span style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--bg-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}><Icon name="arrowLeft" size={15} /></span>
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function emailDe(nombre) {
  return nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, ".").replace(/[^a-z.]/g, "") + "@correo.com";
}

function BrandLogo({ brand, size = 32, radius }) {
  const r = radius != null ? radius : Math.round(size * 0.28);
  if (brand && brand.logo) {
    return <img src={brand.logo} alt="logo" style={{ width: size, height: size, borderRadius: r, objectFit: "cover", display: "block" }} />;
  }
  return (
    <span style={{ width: size, height: size, borderRadius: r, background: "var(--ink)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Icon name="building" size={Math.round(size * 0.53)} />
    </span>
  );
}

function BrandModal({ brand, onClose, onSave }) {
  const [nombre, setNombre] = useState(brand.nombre);
  const [tagline, setTagline] = useState(brand.tagline);
  const [logo, setLogo] = useState(brand.logo);
  const fileRef = useRef(null);
  function onFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = async () => {
      let durl = rd.result;
      try { durl = await PLAN.downscaleDataURL(rd.result, 512, 0.92, "image/png"); } catch (e) { /* usar original */ }
      setLogo(durl);
    };
    rd.readAsDataURL(f);
    e.target.value = "";
  }
  const draft = { nombre: nombre.trim() || "Cotizador", tagline: tagline, logo };
  return (
    <Modal onClose={onClose} title="Identidad del cotizador" width={470}>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: -6 }}>
        El nombre, subtítulo y logo se aplican en la barra superior, el login, las cotizaciones y los planos exportados.
      </p>

      {/* Vista previa */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", border: "1px solid var(--line)", borderRadius: 14, background: "var(--surface-2)", margin: "16px 0 20px" }}>
        <BrandLogo brand={draft} size={44} />
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18 }}>{draft.nombre}</div>
          <div style={{ fontSize: 12.5, color: "var(--faint)" }}>{draft.tagline}</div>
        </div>
        <span className="badge badge-primary" style={{ marginLeft: "auto", fontSize: 10.5 }}>Vista previa</span>
      </div>

      <label className="kicker" style={{ display: "block", marginBottom: 8 }}>Logo</label>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 18 }}>
        <BrandLogo brand={draft} size={52} />
        <input ref={fileRef} type="file" accept="image/*,.svg" onChange={onFile} style={{ display: "none" }} />
        <button className="btn" onClick={() => fileRef.current.click()}><Icon name="upload" size={15} /> {logo ? "Cambiar logo" : "Subir logo"}</button>
        {logo && <button className="btn btn-danger" onClick={() => setLogo(null)}><Icon name="trash" size={14} /> Quitar</button>}
      </div>

      <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Nombre del cotizador</label>
      <div className="field" style={{ height: 44, marginBottom: 14 }}><input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Mi Proyecto" autoFocus /></div>

      <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Subtítulo</label>
      <div className="field" style={{ height: 44 }}><input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="Ej. Cotizador de cuotas" /></div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSave(draft)}><Icon name="check" size={15} /> Guardar cambios</button>
      </div>
    </Modal>
  );
}

function Login({ asesores, brand, onLogin }) {
  const [usuario, setUsuario] = useState("");
  const [pass, setPass] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    const r = PERMS.auth(asesores, usuario, pass);
    if (!r.ok) { setError(r.motivo); return; }
    setError("");
    onLogin(r.user);
  }

  return (
    <div className="login-shell" style={{ height: "100%", display: "flex", background: "var(--bg)" }}>
      {/* Panel marca (se oculta en móvil) */}
      <div className="login-brand" style={{ flex: "1 1 0", minWidth: 0, background: "var(--ink)", color: "#fff", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "44px 52px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: .5, background:
          "radial-gradient(900px 500px at 12% 0%, color-mix(in srgb, var(--primary) 55%, transparent), transparent 60%), radial-gradient(700px 500px at 100% 100%, color-mix(in srgb, var(--primary) 28%, transparent), transparent 55%)" }}></div>
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
          <BrandLogo brand={brand} size={40} radius={11} />
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 19 }}>{brand ? brand.nombre : "Cotizador"}</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)" }}>{brand ? brand.tagline : "Cotizador de cuotas"}</div>
          </div>
        </div>
        <div style={{ position: "relative", maxWidth: 460 }}>
          <h1 style={{ fontSize: 40, lineHeight: 1.08, color: "#fff", letterSpacing: "-.02em" }}>Cotiza, separa y cierra ventas desde el plano.</h1>
          <p style={{ fontSize: 15.5, color: "rgba(255,255,255,.7)", marginTop: 16, lineHeight: 1.6 }}>
            Plataforma comercial para tu proyecto inmobiliario. El acceso es por usuario y contraseña; lo habilita el administrador.
          </p>
        </div>
        <div style={{ position: "relative", display: "flex", gap: 22, fontSize: 12.5, color: "rgba(255,255,255,.55)", flexWrap: "wrap" }}>
          <span>{APP.stats.total} lotes</span>
          <span>{APP.stats.disponibles} disponibles</span>
          <span>Cotizador de cuotas</span>
        </div>
      </div>

      {/* Panel acceso */}
      <div className="login-form" style={{ flex: "0 0 480px", maxWidth: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 28px", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: 360 }}>
          {/* Marca compacta (solo visible en móvil) */}
          <div className="login-brand-mini" style={{ display: "none", alignItems: "center", gap: 11, marginBottom: 22 }}>
            <BrandLogo brand={brand} size={38} />
            <div style={{ lineHeight: 1.15, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17, whiteSpace: "nowrap" }}>{brand ? brand.nombre : "Cotizador"}</div>
              <div style={{ fontSize: 11.5, color: "var(--faint)", whiteSpace: "nowrap" }}>{brand ? brand.tagline : "Cotizador de cuotas"}</div>
            </div>
          </div>

          <div className="kicker">Bienvenido</div>
          <h2 style={{ fontSize: 28, marginTop: 6 }}>Iniciar sesión</h2>
          <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 6 }}>Ingresa con tu usuario y contraseña.</p>

          <form onSubmit={submit} style={{ marginTop: 22 }}>
            <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Usuario</label>
            <div className="field" style={{ marginBottom: 14, height: 48 }}>
              <Icon name="users" size={16} style={{ color: "var(--faint)" }} />
              <input value={usuario} autoFocus autoCapitalize="none" autoCorrect="off" spellCheck="false"
                placeholder="usuario" onChange={e => { setUsuario(e.target.value); setError(""); }} />
            </div>
            <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Contraseña</label>
            <div className="field" style={{ marginBottom: 8, height: 48 }}>
              <Icon name="lock" size={16} style={{ color: "var(--faint)" }} />
              <input type={ver ? "text" : "password"} placeholder="••••••••" value={pass}
                onChange={e => { setPass(e.target.value); setError(""); }} />
              <button type="button" onClick={() => setVer(v => !v)} className="btn btn-ghost" style={{ padding: 6, marginRight: -4 }} title={ver ? "Ocultar" : "Mostrar"}>
                <Icon name={ver ? "eyeOff" : "eye"} size={16} style={{ color: "var(--faint)" }} />
              </button>
            </div>

            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--bad-ink)", background: "var(--bad-bg)", border: "1px solid #f3c7cb", borderRadius: 10, padding: "9px 12px", margin: "4px 0 6px" }}>
                <Icon name="alert" size={15} /> {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%", justifyContent: "center", marginTop: 12, minHeight: 48 }}>
              Ingresar <Icon name="chevRight" size={16} />
            </button>
          </form>

          <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 18, textAlign: "center", lineHeight: 1.55 }}>
            ¿No tienes acceso? Solicítalo al administrador.<br />Tu sesión queda guardada en este dispositivo.
          </p>
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(e, info) { console.error("Error de render:", e, info); }
  render() {
    if (this.state.err) {
      return (
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
          <div className="card" style={{ maxWidth: 420, padding: 28, textAlign: "center" }}>
            <h3 style={{ fontSize: 20, marginBottom: 8 }}>Algo salió mal</h3>
            <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 18 }}>Ocurrió un error inesperado en esta vista. Puedes reintentar sin perder la sesión.</p>
            <button className="btn btn-primary" onClick={() => this.setState({ err: null })}><Icon name="reset" size={15} /> Reintentar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(<ErrorBoundary><App /></ErrorBoundary>);
