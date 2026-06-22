/*!
 * Cotizador de Cuotas
 * Copyright (c) 2026 Luis D.. Todos los derechos reservados.
 * Software propietario. Prohibida su copia, distribución o uso sin
 * autorización escrita del titular. Ver archivo LICENSE.
 */

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

function LoadingScreen() {
  return <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", color: "var(--muted)", fontSize: 15, gap: 10 }}>
    <Icon name="reset" size={22} style={{ animation: "spin 1s linear infinite" }} /> Conectando con la base de datos...
  </div>;
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = useState("plano");

  // --- Estado Supabase ---
  const [appLoading, setAppLoading] = useState(true);
  const [appError, setAppError] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  // Datos compartidos (Supabase)
  const [asesores, setAsesores] = useState([]);
  const [lotes, setLotes] = useState(() => APP.lotes.map(l => ({ ...l })));
  const [polys, setPolys] = useState(() => PLAN.seedPolys(APP.lotes));
  const [brand, setBrand] = useState({ nombre: "Mi Proyecto", tagline: "Cotizador de cuotas", logo: null });
  const [cond, setCond] = useState(() => JSON.parse(JSON.stringify(APP.condiciones)));
  const [clientes, setClientes] = useState([]);
  const [cotizaciones, setCotizaciones] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [conexiones, setConexiones] = useState([]);
  const [logs, setLogs] = useState([]);
  const [planoImg, setPlanoImg] = useState({});   // mapa { [etapa]: dataURL }

  // Preferencias locales (localStorage)
  const [planoMode, setPlanoMode] = useState(() => STORE.load("planoMode", "esquema"));
  const [planoOpacity, setPlanoOpacity] = useState(() => STORE.load("planoOpacity", 1));
  const [moneda, setMoneda] = useState(() => STORE.load("moneda", "PEN"));

  const [brandOpen, setBrandOpen] = useState(false);
  const [quote, setQuote] = useState(null);
  const [toast, toastNode] = useToasts();
  const initialLoadDone = useRef(false);
  const syncChannel = useRef(null);
  const isApplyingRemote = useRef(false);

  const asesor = profile;
  const asesorId = asesor ? asesor.id : null;
  const perms = asesor ? permsFor(asesor) : permsFor({});

  // ---- Carga inicial desde Supabase ----
  useEffect(() => {
    (async () => {
      try {
        const sess = await DB.getSession();
        if (sess) { setSession(sess); await loadAll(sess.user.id); }
        else { const n = await DB.countProfiles(); setNeedsBootstrap(n === 0); }
      } catch (e) { setAppError("No se pudo conectar con la base de datos. Verifica que el SQL de configuración se haya ejecutado."); console.error(e); }
      setAppLoading(false);
    })();
    const { data: { subscription } } = DB.db.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") { setSession(null); setProfile(null); initialLoadDone.current = false; }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadAll(uid) {
    const [mainData, assetData, profs, conxs] = await Promise.all([
      DB.loadMain(), DB.loadAssets(), DB.loadProfiles(), DB.loadConexiones()
    ]);
    if (profs) setAsesores(profs);
    if (conxs) setConexiones(conxs);
    setProfile((profs || []).find(p => p.id === uid) || null);
    if (assetData && assetData.planoImg) {
      const pv = assetData.planoImg;
      if (typeof pv === "string") {   // migración: plano único → plano de la 1ra etapa
        const ls = (mainData && mainData.lotes) || [];
        const etN = e => { const m = String(e).match(/\d+/); return m ? +m[0] : 999; };
        const first = [...new Set(ls.map(l => l.etapa).filter(Boolean))].sort((a, b) => etN(a) - etN(b))[0] || "1RA ETAPA";
        setPlanoImg({ [first]: pv });
      } else setPlanoImg(pv || {});
    }
    if (mainData && Object.keys(mainData).length > 0) {
      if (mainData.lotes) setLotes(mainData.lotes);
      if (mainData.polys) setPolys(mainData.polys);
      if (mainData.brand) setBrand(mainData.brand);
      if (mainData.cond) setCond(mainData.cond);
      if (mainData.clientes) setClientes(mainData.clientes);
      if (mainData.cotizaciones) setCotizaciones(mainData.cotizaciones);
      if (mainData.reservas) setReservas(mainData.reservas);
      if (mainData.logs) setLogs(mainData.logs);
    } else {
      const demo = STORE.seed(APP);
      const il = APP.lotes.map(l => ({ ...l })); const ip = PLAN.seedPolys(APP.lotes);
      const ib = { nombre: "Mi Proyecto", tagline: "Cotizador de cuotas", logo: null };
      const ic = JSON.parse(JSON.stringify(APP.condiciones));
      setLotes(il); setPolys(ip); setBrand(ib); setCond(ic);
      setClientes(demo.clientes); setCotizaciones(demo.cotizaciones); setReservas(demo.reservas); setLogs(demo.logs || []);
      DB.saveMain({ lotes: il, polys: ip, brand: ib, cond: ic, clientes: demo.clientes, cotizaciones: demo.cotizaciones, reservas: demo.reservas, logs: demo.logs || [] });
    }
    initialLoadDone.current = true;
  }

  // Auto-guardar en Supabase con debounce de 2s + broadcast en tiempo real
  useEffect(() => {
    if (!initialLoadDone.current || !session) return;
    if (isApplyingRemote.current) { isApplyingRemote.current = false; return; } // skip: datos recibidos de otro usuario
    const state = { lotes, polys, brand, cond, clientes, cotizaciones, reservas, logs };
    const timer = setTimeout(() => {
      DB.saveMain(state);
      if (syncChannel.current) syncChannel.current.send(state);
    }, 2000);
    return () => clearTimeout(timer);
  }, [lotes, polys, brand, cond, clientes, cotizaciones, reservas, logs]);

  useEffect(() => {
    if (!initialLoadDone.current || !session) return;
    DB.saveAssets({ planoImg: planoImg || null });
  }, [planoImg]);

  useEffect(() => { STORE.save("planoMode", planoMode); }, [planoMode]);
  useEffect(() => { STORE.save("planoOpacity", planoOpacity); }, [planoOpacity]);
  useEffect(() => { STORE.save("moneda", moneda); }, [moneda]);

  // Canal de sincronización en tiempo real (broadcast Supabase)
  useEffect(() => {
    if (!session) { if (syncChannel.current) { syncChannel.current.unsub(); syncChannel.current = null; } return; }
    const { send, unsub } = DB.createSyncChannel(session.user.id, (data) => {
      // Aplicar estado remoto sin disparar auto-save ni re-broadcast
      isApplyingRemote.current = true;
      if (data.lotes) setLotes(data.lotes);
      if (data.polys) setPolys(data.polys);
      if (data.brand) setBrand(data.brand);
      if (data.cond) setCond(data.cond);
      if (data.clientes) setClientes(data.clientes);
      if (data.cotizaciones) setCotizaciones(data.cotizaciones);
      if (data.reservas) setReservas(data.reservas);
      if (data.logs) setLogs(data.logs);
    });
    syncChannel.current = { send, unsub };
    return () => { if (syncChannel.current) { syncChannel.current.unsub(); syncChannel.current = null; } };
  }, [session]);

  const reservasRef = useRef(reservas);
  useEffect(() => { reservasRef.current = reservas; }, [reservas]);
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const expired = reservasRef.current.filter(r => r.estado === "activa" && r.expiresAt <= now);
      if (!expired.length) return;
      const ids = new Set(expired.map(e => e.loteId));
      setReservas(rs => rs.map(r => (r.estado === "activa" && r.expiresAt <= now) ? { ...r, estado: "vencida", historial: [...(r.historial || []), { ts: now, accion: "vencida", por: "Sistema", detalle: "Plazo cumplido · lote liberado" }] } : r));
      setLotes(ls => ls.map(l => ids.has(l.id) && l.estado === "separado" ? { ...l, estado: "disponible" } : l));
      setLogs(ls => [{ id: "log-" + now.toString(36) + Math.random().toString(36).slice(2, 6), ts: now, actorId: null, actorNombre: "Sistema", cat: "reserva", accion: "vencida", detalle: [...ids].join(", ") + (expired.length === 1 ? " vencido y liberado automáticamente" : " vencidos y liberados automáticamente"), ref: expired[0].loteId }, ...ls].slice(0, 800));
      toast(expired.length + (expired.length === 1 ? " reserva vencida · lote liberado" : " reservas vencidas · lotes liberados"), "warn");
    };
    const iv = setInterval(tick, 5000); tick();
    return () => clearInterval(iv);
  }, []);

  // --- Handlers de cliente / cotización / reserva ---
  function registrarLog(e) {
    if (!e) return;
    const entry = {
      id: "log-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts: Date.now(),
      actorId: asesor ? asesor.id : null,
      actorNombre: asesor ? asesor.nombre : "Sistema",
      cat: e.cat || "otro", accion: e.accion || "", detalle: e.detalle || "", ref: e.ref || null,
    };
    setLogs(ls => [entry, ...ls].slice(0, 800));
  }
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
    registrarLog({ cat: "cotizacion", accion: "enviar", detalle: "Cotización " + rec.id + " enviada · lote " + rec.loteId + " · " + rec.clienteNombre, ref: rec.id });
  }
  function crearReserva(lote, cliente, dias, pago) {
    const now = Date.now();
    const d = dias || cond.validezDias || 3;
    const p = pago || {};
    const resumenPago = p.modo === "contado"
      ? "contado"
      : (p.cuotas ? p.cuotas + " cuotas" : "fraccionamiento");
    const r = {
      id: "RSV-" + lote.id + "-" + now.toString(36),
      loteId: lote.id, manzana: lote.manzana, numero: lote.numero, precioLista: lote.precioLista,
      asesorId: asesor.id, asesorNombre: asesor.nombre,
      clienteId: null, clienteNombre: cliente.nombre, clienteContacto: cliente.telefono || "",
      modo: p.modo || null, montoSeparacion: p.montoSeparacion ?? null, inicialPactada: p.inicialPactada ?? null,
      siguientePago: p.siguientePago ?? null, saldoFinanciar: p.saldoFinanciar ?? null,
      cuotas: p.cuotas ?? 0, cuotaMensual: p.cuotaMensual ?? 0, tasa: p.tasa ?? null, captacion: p.captacion || null,
      precioVenta: p.precioVenta ?? lote.precioLista, planInicial: p.planInicial || null, primeraCuotaDias: p.primeraCuotaDias ?? null,
      createdAt: now, expiresAt: now + d * STORE.DAY, dias: d, estado: "activa",
      historial: [{ ts: now, accion: "creada", por: asesor.nombre, detalle: d + " días de plazo · cliente " + cliente.nombre + " · " + resumenPago + (p.montoSeparacion ? " · separación " + LIB.money(p.montoSeparacion, "PEN") : "") + (p.captacion ? " · captación: " + p.captacion : "") }],
    };
    setReservas(rs => [r, ...rs.filter(x => !(x.loteId === lote.id && x.estado === "activa"))]);
    upsertCliente(cliente);
    registrarLog({ cat: "reserva", accion: "crear", detalle: "Lote " + lote.id + " separado para " + cliente.nombre + " · " + d + " días · " + resumenPago, ref: lote.id });
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
    registrarLog({ cat: "reserva", accion: "plazo", detalle: "Lote " + r.loteId + " (" + r.clienteNombre + ") · plazo a " + dias + " días", ref: r.loteId });
  }
  function editarClienteReserva(r, datos) {
    const ts = Date.now();
    const nombre = (datos.nombre || "").trim() || "Pendiente";
    const contacto = (datos.contacto || "").trim();
    setReservas(rs => rs.map(x => {
      if (x.id !== r.id) return x;
      const cambios = [];
      if (x.clienteNombre !== nombre) cambios.push((x.clienteNombre || "—") + " → " + nombre);
      if ((x.clienteContacto || "") !== contacto) cambios.push("contacto actualizado");
      const ev = { ts, accion: "cliente", por: asesor.nombre, detalle: cambios.join(" · ") || "Datos del cliente actualizados" };
      return { ...x, clienteNombre: nombre, clienteContacto: contacto, historial: [...(x.historial || []), ev] };
    }));
    toast("Lote " + r.loteId + " · cliente actualizado a " + nombre, "ok");
    registrarLog({ cat: "reserva", accion: "editar", detalle: "Lote " + r.loteId + " · cliente actualizado a " + nombre, ref: r.loteId });
  }
  function editarPagoReserva(r, pago) {
    const ts = Date.now();
    const money = (n) => LIB.money(n || 0, "PEN");
    setReservas(rs => rs.map(x => {
      if (x.id !== r.id) return x;
      const cambios = [];
      if ((x.modo || "") !== pago.modo) cambios.push("forma " + (x.modo || "—") + " → " + pago.modo);
      if ((x.precioVenta || 0) !== pago.precioVenta) cambios.push("precio " + money(x.precioVenta) + " → " + money(pago.precioVenta));
      if ((x.inicialPactada || 0) !== pago.inicialPactada) cambios.push("inicial " + money(x.inicialPactada) + " → " + money(pago.inicialPactada));
      if ((x.montoSeparacion || 0) !== pago.montoSeparacion) cambios.push("separación " + money(x.montoSeparacion) + " → " + money(pago.montoSeparacion));
      if ((x.cuotas || 0) !== pago.cuotas) cambios.push("cuotas " + (x.cuotas || 0) + " → " + pago.cuotas);
      const npa = (pago.planInicial || []).length, npb = (x.planInicial || []).length;
      if (npa !== npb) cambios.push("plan inicial " + npb + " → " + npa + " pagos");
      const ev = { ts, accion: "negociacion", por: asesor.nombre, detalle: cambios.join(" · ") || "Cotización pactada actualizada" };
      return {
        ...x,
        modo: pago.modo, precioVenta: pago.precioVenta, montoSeparacion: pago.montoSeparacion,
        inicialPactada: pago.inicialPactada, siguientePago: pago.siguientePago, saldoFinanciar: pago.saldoFinanciar,
        cuotas: pago.cuotas, cuotaMensual: pago.cuotaMensual, tasa: pago.tasa, captacion: pago.captacion || x.captacion,
        planInicial: pago.planInicial, primeraCuotaDias: pago.primeraCuotaDias,
        historial: [...(x.historial || []), ev],
      };
    }));
    toast("Lote " + r.loteId + " · negociación actualizada", "ok");
    registrarLog({ cat: "reserva", accion: "negociacion", detalle: "Lote " + r.loteId + " (" + r.clienteNombre + ") · cotización pactada actualizada", ref: r.loteId });
  }
  function cerrarReservaDeLote(loteId, estado) {
    setReservas(rs => rs.map(r => r.loteId === loteId && r.estado === "activa" ? { ...r, estado } : r));
  }
  function liberarReserva(r) {
    const ts = Date.now();
    setReservas(rs => rs.map(x => x.id === r.id ? { ...x, estado: "liberada", historial: [...(x.historial || []), { ts, accion: "liberada", por: asesor.nombre, detalle: "Liberada manualmente" }] } : x));
    setLotes(ls => ls.map(l => l.id === r.loteId && l.estado === "separado" ? { ...l, estado: "disponible" } : l));
    toast("Reserva de lote " + r.loteId + " liberada", "ok");
    registrarLog({ cat: "reserva", accion: "liberar", detalle: "Reserva del lote " + r.loteId + " (" + r.clienteNombre + ") liberada", ref: r.loteId });
  }
  function convertirReserva(r) {
    const ts = Date.now();
    setReservas(rs => rs.map(x => x.id === r.id ? { ...x, estado: "convertida", historial: [...(x.historial || []), { ts, accion: "convertida", por: asesor.nombre, detalle: "Convertida en venta" }] } : x));
    setLotes(ls => ls.map(l => l.id === r.loteId ? { ...l, estado: "vendido" } : l));
    toast("Lote " + r.loteId + " vendido a " + r.clienteNombre, "ok");
    registrarLog({ cat: "venta", accion: "convertir", detalle: "Lote " + r.loteId + " vendido a " + r.clienteNombre + " (desde reserva)", ref: r.loteId });
  }
  async function resetDemo() {
    if (!session) return;
    const demo = STORE.seed(APP);
    const il = APP.lotes.map(l => ({ ...l })); const ip = PLAN.seedPolys(APP.lotes);
    const ib = { nombre: "Mi Proyecto", tagline: "Cotizador de cuotas", logo: null };
    await DB.saveMain({ lotes: il, polys: ip, brand: ib, cond: JSON.parse(JSON.stringify(APP.condiciones)), clientes: demo.clientes, cotizaciones: demo.cotizaciones, reservas: demo.reservas, logs: demo.logs || [] });
    await DB.saveAssets({ planoImg: null });
    location.reload();
  }
  async function vaciarTodo() {
    if (!session) return;
    await DB.saveMain({ lotes, polys, brand, cond, clientes: [], cotizaciones: [], reservas: [], logs: [] });
    await DB.clearConexiones();
    location.reload();
  }
  async function iniciarSesion({ session: sess, profile: prof }) {
    setSession(sess); setProfile(prof);
    await loadAll(sess.user.id);
    await DB.upsertConexion(sess.user.id, { nombre: prof.nombre, rol: prof.rol, color: prof.color, iniciales: prof.iniciales });
    const conxs = await DB.loadConexiones(); setConexiones(conxs);
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
    { type: "link", k: "plano", label: "Plano", icon: "layers" },
    { type: "group", label: "Comercial", icon: "wallet", items: [
      { k: "reservas", label: "Reservas", icon: "clock" },
      { k: "cotizaciones", label: "Cotizaciones", icon: "history" },
      { k: "tablero", label: "Tablero", icon: "chart" },
    ] },
    { type: "group", label: "Registro", icon: "doc", items: [
      { k: "bitacora", label: "Bitácora", icon: "doc" },
      perms.usuarios && { k: "conexiones", label: "Conexiones", icon: "chart" },
    ].filter(Boolean) },
    { type: "group", label: "Configuración", icon: "shield", items: [
      perms.admin && { k: "admin", label: "Lotes", icon: "building" },
      perms.cond && { k: "cond", label: "Condiciones", icon: "shield" },
      perms.usuarios && { k: "usuarios", label: "Usuarios", icon: "users" },
    ].filter(Boolean) },
  ].filter(g => g.type === "link" || g.items.length > 0);
  const allowedRoutes = nav.flatMap(g => g.type === "link" ? [g.k] : g.items.map(i => i.k));

  // Guardia de ruta
  useEffect(() => {
    if (asesor && !allowedRoutes.includes(route)) setRoute("plano");
  }, [route, perms.admin, perms.cond, perms.usuarios, !!asesor]);

  if (appLoading) return <LoadingScreen />;
  if (appError) return <div style={{ height:"100%",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14,background:"var(--bg)",color:"var(--muted)",padding:32,textAlign:"center" }}><Icon name="alert" size={32} /><div style={{fontSize:16,fontWeight:600,color:"var(--ink)"}}>Error de conexión</div><div style={{fontSize:14,maxWidth:400}}>{appError}</div></div>;
  if (needsBootstrap) return <Bootstrap brand={brand} onDone={async ({session:s,profile:p}) => { setNeedsBootstrap(false); await iniciarSesion({session:s,profile:p}); }} />;
  if (!asesor) return <Login onLogin={async (u, p) => { const r = await DB.login(u, p); if (r.ok) { await iniciarSesion(r); return {ok:true}; } return r; }} brand={brand} />;

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
          {nav.map(g => g.type === "link"
            ? <button key={g.k} className={"navbtn" + (route === g.k ? " on" : "")} onClick={() => setRoute(g.k)}>
                <Icon name={g.icon} size={16} /> {g.label}
              </button>
            : <NavGroup key={g.label} group={g} route={route} setRoute={setRoute} />
          )}
        </nav>

        <div className="topbar-right" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
          {/* Moneda */}
          <div className="segtabs" style={{ background: "var(--bg-2)", padding: 3 }}>
            {[["PEN", "S/"], ["USD", "$"]].map(([k, s]) => (
              <button key={k} className={moneda === k ? "on" : ""} style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => setMoneda(k)}>{s}</button>
            ))}
          </div>
          <AsesorSwitcher asesor={asesor} perms={perms} onLogout={async () => { await DB.logout(); setSession(null); setProfile(null); initialLoadDone.current = false; }} goUsuarios={perms.usuarios ? () => setRoute("usuarios") : null} onReset={perms.usuarios ? resetDemo : null} onClear={perms.usuarios ? vaciarTodo : null} />
        </div>
      </header>

      {/* Contenido */}
      <main style={{ flex: 1, minHeight: 0 }}>
        {route === "plano" && <Plano lotes={lotes} setLotes={setLotes} polys={polys} setPolys={setPolys} planos={planoImg} setPlanos={setPlanoImg} planoOpacity={planoOpacity} setPlanoOpacity={setPlanoOpacity} cond={cond} asesor={asesor} moneda={moneda} perms={perms} brand={brand} clientes={clientes} onEnviar={setQuote} onReservar={crearReserva} onCerrarReserva={cerrarReservaDeLote} onLog={registrarLog} toast={toast} />}
        {route === "tablero" && <Tablero lotes={lotes} cotizaciones={cotizaciones} reservas={reservas} asesores={[...asesores, ...APP.demoAutores]} moneda={moneda} goReservas={() => setRoute("reservas")} asesor={asesor} perms={perms} />}
        {route === "cotizaciones" && <Cotizaciones cotizaciones={cotizaciones} setCotizaciones={setCotizaciones} asesor={asesor} perms={perms} moneda={moneda} toast={toast} onLog={registrarLog} />}
        {route === "reservas" && <Reservas reservas={reservas} asesor={asesor} perms={perms} moneda={moneda} cond={cond} onLiberar={liberarReserva} onConvertir={convertirReserva} onEditarVencimiento={editarVencimientoReserva} onEditarCliente={editarClienteReserva} onEditarPago={editarPagoReserva} />}
        {route === "bitacora" && <Bitacora logs={logs} asesor={asesor} perms={perms} asesores={[...asesores, ...APP.demoAutores]} />}
        {route === "admin" && <AdminLotes lotes={lotes} setLotes={setLotes} moneda={moneda} toast={toast} goPlano={() => setRoute("plano")} brand={brand} onLog={registrarLog} />}
        {route === "cond" && <Condiciones cond={cond} setCond={setCond} toast={toast} goPlano={() => setRoute("plano")} />}
        {route === "usuarios" && <Usuarios asesores={asesores} setAsesores={setAsesores} currentId={asesorId} toast={toast} onLog={registrarLog} />}
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

function NavGroup({ group, route, setRoute }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const ref = useRef(null);
  const btnRef = useRef(null);
  const tmr = useRef(null);
  const activo = group.items.some(i => i.k === route);

  const medir = () => {
    const r = btnRef.current && btnRef.current.getBoundingClientRect();
    if (r) setPos({ left: r.left, top: r.bottom + 7 });
  };
  const abrir = () => { clearTimeout(tmr.current); medir(); setOpen(true); };
  const cerrarPronto = () => { tmr.current = setTimeout(() => setOpen(false), 130); };

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onScrollResize = () => setOpen(false);
    window.addEventListener("resize", onScrollResize);
    window.addEventListener("scroll", onScrollResize, true);
    return () => { window.removeEventListener("resize", onScrollResize); window.removeEventListener("scroll", onScrollResize, true); };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }} onMouseEnter={abrir} onMouseLeave={cerrarPronto}>
      <button ref={btnRef} className={"navbtn" + (activo || open ? " on" : "")} onClick={() => { if (open) { setOpen(false); } else { abrir(); } }}>
        <Icon name={group.icon} size={16} /> {group.label}
        <Icon name="chevDown" size={14} style={{ marginLeft: -1, opacity: .7, transition: ".15s", transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open && (
        <div className="navmenu pop" style={{ position: "fixed", top: pos.top, left: pos.left }}
          onMouseEnter={abrir} onMouseLeave={cerrarPronto}>
          {group.items.map(it => (
            <button key={it.k} className={"navmenu-item" + (route === it.k ? " on" : "")}
              onClick={() => { setRoute(it.k); setOpen(false); }}>
              <Icon name={it.icon} size={16} style={{ color: route === it.k ? "var(--primary)" : "var(--faint)" }} /> {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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

function Login({ brand, onLogin }) {
  const [usuario, setUsuario] = useState("");
  const [pass, setPass] = useState("");
  const [ver, setVer] = useState(false);
  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    const r = await onLogin(usuario, pass);
    setLoading(false);
    if (r && !r.ok) setError(r.motivo || "Error al iniciar sesión.");
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

            <button type="submit" disabled={loading} className="btn btn-primary btn-lg" style={{ width: "100%", justifyContent: "center", marginTop: 12, minHeight: 48 }}>
              {loading ? "Iniciando..." : "Ingresar"} {!loading && <Icon name="chevRight" size={16} />}
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
