/*!
 * Cotizador de Cuotas
 * Copyright (c) 2026 Luis D.. Todos los derechos reservados.
 * Software propietario. Prohibida su copia, distribución o uso sin
 * autorización escrita del titular. Ver archivo LICENSE.
 */

/* =========================================================
   COTIZACIONES — historial de cotizaciones emitidas
   Asesor ve las suyas; gerencia/jefatura ve todas.
   ========================================================= */

const COT_ESTADOS = {
  enviada:   { label: "Enviada",   cls: "warn", dot: "#e0a64e" },
  aceptada:  { label: "Aceptada",  cls: "ok",   dot: "#3aa564" },
  rechazada: { label: "Rechazada", cls: "bad",  dot: "#d4555f" },
  vencida:   { label: "Vencida",   cls: "",     dot: "#9aa3b2" },
};

function Cotizaciones({ cotizaciones, setCotizaciones, asesor, perms, moneda, toast, onLog }) {
  const [filtro, setFiltro] = useState("todas");
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(null);

  const puedeVerTodo = perms.verTodo;
  const mias = puedeVerTodo ? cotizaciones : cotizaciones.filter(c => c.asesorId === asesor.id);
  const puedeEditar = (c) => perms.editarTodo || c.asesorId === asesor.id;
  const qn = q.trim().toLowerCase();
  const lista = mias.filter(c =>
    (filtro === "todas" || c.estado === filtro) &&
    (!qn || c.clienteNombre.toLowerCase().includes(qn) || c.loteId.toLowerCase().includes(qn) || c.id.toLowerCase().includes(qn))
  );
  const cuenta = (e) => mias.filter(c => e === "todas" || c.estado === e).length;

  function setEstado(id, estado) {
    const c = cotizaciones.find(x => x.id === id);
    setCotizaciones(cs => cs.map(c => c.id === id ? { ...c, estado } : c));
    setMenu(null);
    toast("Cotización marcada como " + COT_ESTADOS[estado].label.toLowerCase(), estado === "aceptada" ? "ok" : estado === "rechazada" ? "bad" : "warn");
    if (onLog && c) onLog({ cat: "cotizacion", accion: "estado", detalle: "Cotización " + c.id + " (lote " + c.loteId + ") → " + COT_ESTADOS[estado].label, ref: c.id });
  }

  const chips = [
    { k: "todas", label: "Todas" },
    { k: "enviada", label: "Enviadas" },
    { k: "aceptada", label: "Aceptadas" },
    { k: "rechazada", label: "Rechazadas" },
    { k: "vencida", label: "Vencidas" },
  ];

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "26px 36px 60px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="kicker" style={{ color: "var(--primary)" }}>Comercial</div>
            <h1 style={{ fontSize: 34, marginTop: 4 }}>Cotizaciones</h1>
            <div style={{ color: "var(--muted)", marginTop: 6, fontSize: 14.5 }}>
              {perms.admin ? "Historial de todo el equipo comercial." : (puedeVerTodo ? "Historial de todo el equipo comercial." : "Tu historial de cotizaciones enviadas.")} {mias.length} en total.
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", flexWrap: "wrap", margin: "22px 0 18px" }}>
          <div className="field" style={{ width: 260, height: 40 }}>
            <Icon name="search" size={16} style={{ color: "var(--faint)" }} />
            <input placeholder="Cliente, lote o folio…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {chips.map(c => (
              <button key={c.k} onClick={() => setFiltro(c.k)}
                style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid " + (filtro === c.k ? "var(--primary)" : "var(--line)"),
                  background: filtro === c.k ? "var(--primary)" : "#fff", color: filtro === c.k ? "#fff" : "var(--ink-2)",
                  padding: "7px 13px", borderRadius: 10, fontWeight: 600, fontSize: 13.5 }}>
                {c.label}<span className="mono" style={{ opacity: .75 }}>{cuenta(c.k)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tabla */}
        <div className="card" style={{ overflow: "visible", padding: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: perms.admin ? "96px 1fr 1.1fr 1fr 120px 120px 52px" : "96px 1fr 1.2fr 130px 130px 52px", gap: 0, padding: "12px 18px", borderBottom: "1px solid var(--line)", fontSize: 10.5, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--faint)" }}>
            <span>Fecha</span><span>Lote</span><span>Cliente</span>{perms.admin && <span>Asesor</span>}<span style={{ textAlign: "right" }}>Monto</span><span style={{ textAlign: "center" }}>Estado</span><span></span>
          </div>
          {lista.length === 0 && <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--faint)" }}>Sin cotizaciones para este filtro.</div>}
          {lista.map(c => {
            const e = COT_ESTADOS[c.estado] || COT_ESTADOS.enviada;
            return (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: perms.admin ? "96px 1fr 1.1fr 1fr 120px 120px 52px" : "96px 1fr 1.2fr 130px 130px 52px", gap: 0, padding: "13px 18px", borderTop: "1px solid var(--line-2)", alignItems: "center", fontSize: 13.5 }}>
                <span className="mono" style={{ color: "var(--muted)", fontSize: 12.5 }}>{STORE.fmtFechaHora(c.ts)}</span>
                <span><b>{c.loteId}</b><span style={{ color: "var(--faint)", fontSize: 11.5, display: "block" }} className="mono">{c.id}</span></span>
                <span style={{ minWidth: 0 }}><span style={{ fontWeight: 600, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.clienteNombre}</span><span className="mono" style={{ color: "var(--faint)", fontSize: 11.5 }}>{c.clienteContacto}</span></span>
                {perms.admin && <span style={{ fontSize: 12.5, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{c.asesorNombre}</span>}
                <span style={{ textAlign: "right" }}>
                  <span className="mono" style={{ fontWeight: 700 }}>{LIB.money(c.precioVenta, moneda)}</span>
                  <span style={{ display: "block", fontSize: 11, color: "var(--faint)" }}>{c.modo === "financiamiento" ? LIB.money(c.cuota, moneda) + "/mes" : "contado"}</span>
                </span>
                <span style={{ textAlign: "center" }}><span className={"badge badge-" + e.cls}><span className="dot" style={{ background: e.dot }}></span>{e.label}</span></span>
                <span style={{ textAlign: "center", position: "relative" }}>
                  {puedeEditar(c) ? (
                  <button className="btn btn-ghost" style={{ padding: 7 }} onClick={() => setMenu(menu === c.id ? null : c.id)}><Icon name="sliders" size={15} /></button>
                  ) : (
                  <span title={"Cotización de " + c.asesorNombre + " · solo lectura"} style={{ display: "inline-flex", padding: 7, color: "var(--faint)" }}><Icon name="lock" size={14} /></span>
                  )}
                  {menu === c.id && puedeEditar(c) && (
                    <div className="card pop" style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", width: 190, padding: 6, zIndex: 20, boxShadow: "var(--shadow-lg)", textAlign: "left" }}>
                      {[["aceptada", "Marcar aceptada", "check"], ["rechazada", "Marcar rechazada", "x"], ["enviada", "Marcar enviada", "send"], ["vencida", "Marcar vencida", "clock"]]
                        .filter(([k]) => k !== c.estado).map(([k, label, icon]) => (
                        <button key={k} className="btn btn-ghost" style={{ width: "100%", justifyContent: "flex-start", gap: 9, padding: "8px 10px", fontSize: 13 }} onClick={() => setEstado(c.id, k)}>
                          <Icon name={icon} size={15} style={{ color: "var(--" + (COT_ESTADOS[k].cls || "muted") + (COT_ESTADOS[k].cls ? "-ink" : "") + ")" }} /> {label}
                        </button>
                      ))}
                    </div>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

window.Cotizaciones = Cotizaciones;
