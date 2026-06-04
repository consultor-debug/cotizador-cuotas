/* =========================================================
   BITÁCORA — registro de auditoría de acciones del sistema.
   Asesor ve lo suyo; gerencia/jefatura (verTodo) ve todo.
   ========================================================= */

const LOG_CAT = {
  reserva:    { label: "Reserva",     icon: "clock",    color: "var(--warn-ink)", bg: "var(--warn-bg)",    bd: "#f0d6a8" },
  venta:      { label: "Venta",       icon: "tag",      color: "var(--ok-ink)",   bg: "var(--ok-bg)",      bd: "#bfe6cd" },
  cotizacion: { label: "Cotización",  icon: "history",  color: "var(--primary-700)", bg: "var(--primary-050)", bd: "var(--primary-100)" },
  lote:       { label: "Lote",        icon: "building", color: "var(--ink-2)",    bg: "var(--surface-2)",  bd: "var(--line)" },
  plano:      { label: "Plano",       icon: "layers",   color: "var(--ink-2)",    bg: "var(--surface-2)",  bd: "var(--line)" },
  usuario:    { label: "Usuario",     icon: "users",    color: "var(--bad-ink)",  bg: "var(--bad-bg)",     bd: "#f3c7cb" },
  otro:       { label: "Otro",        icon: "doc",      color: "var(--muted)",    bg: "var(--surface-2)",  bd: "var(--line)" },
};

function diaLabel(ts) {
  const d = new Date(ts); const hoy = new Date();
  const ayer = new Date(Date.now() - 86400000);
  const same = (a, b) => a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (same(d, hoy)) return "Hoy";
  if (same(d, ayer)) return "Ayer";
  return STORE.fmtFechaHora(ts);
}
function horaLog(ts) {
  return new Date(ts).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

function Bitacora({ logs, asesor, perms, asesores }) {
  const [cat, setCat] = useState("todas");
  const [q, setQ] = useState("");
  const [quien, setQuien] = useState("");

  const puedeVerTodo = perms.verTodo;
  const mapAse = useMemo(() => { const m = {}; (asesores || []).forEach(a => m[a.id] = a); return m; }, [asesores]);

  const base = puedeVerTodo ? (logs || []) : (logs || []).filter(l => l.actorId === asesor.id);
  const qn = q.trim().toLowerCase();
  const lista = base
    .filter(l => cat === "todas" || l.cat === cat)
    .filter(l => !quien || l.actorId === quien)
    .filter(l => !qn || (l.detalle || "").toLowerCase().includes(qn) || (l.actorNombre || "").toLowerCase().includes(qn) || (l.ref || "").toLowerCase().includes(qn))
    .sort((a, b) => b.ts - a.ts);

  const cuenta = (k) => base.filter(l => k === "todas" || l.cat === k).length;
  const autoresConLog = [...new Set(base.map(l => l.actorId).filter(Boolean))];

  const chips = [{ k: "todas", label: "Todas" },
    ...Object.keys(LOG_CAT).filter(k => k !== "otro").map(k => ({ k, label: LOG_CAT[k].label }))];

  // agrupar por día
  const grupos = [];
  let actual = null;
  lista.forEach(l => {
    const dl = diaLabel(l.ts);
    if (!actual || actual.dia !== dl) { actual = { dia: dl, items: [] }; grupos.push(actual); }
    actual.items.push(l);
  });

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "26px 36px 60px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="kicker" style={{ color: "var(--primary)" }}>Auditoría</div>
            <h1 style={{ fontSize: 34, marginTop: 4 }}>Bitácora</h1>
            <div style={{ color: "var(--muted)", marginTop: 6, fontSize: 14.5 }}>
              {puedeVerTodo ? "Registro de todas las acciones del equipo." : "Registro de tus propias acciones."} {base.length} eventos.
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", flexWrap: "wrap", margin: "22px 0 18px" }}>
          <div className="field" style={{ width: 240, height: 40 }}>
            <Icon name="search" size={16} style={{ color: "var(--faint)" }} />
            <input placeholder="Buscar acción, lote o persona…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {chips.map(c => (
              <button key={c.k} onClick={() => setCat(c.k)}
                style={{ display: "flex", alignItems: "center", gap: 7, border: "1px solid " + (cat === c.k ? "var(--primary)" : "var(--line)"),
                  background: cat === c.k ? "var(--primary)" : "#fff", color: cat === c.k ? "#fff" : "var(--ink-2)",
                  padding: "7px 13px", borderRadius: 10, fontWeight: 600, fontSize: 13.5 }}>
                {c.label}<span className="mono" style={{ opacity: .75 }}>{cuenta(c.k)}</span>
              </button>
            ))}
          </div>
          {puedeVerTodo && autoresConLog.length > 1 && (
            <div className="field" style={{ width: 200, position: "relative", paddingRight: 6, height: 40, marginLeft: "auto" }}>
              <Icon name="users" size={15} style={{ color: "var(--faint)" }} />
              <select value={quien} onChange={e => setQuien(e.target.value)}
                style={{ border: 0, outline: 0, background: "transparent", flex: 1, fontSize: 14, color: quien ? "var(--ink)" : "var(--muted)", appearance: "none", cursor: "pointer", height: "100%" }}>
                <option value="">Todos los usuarios</option>
                {autoresConLog.map(id => <option key={id} value={id}>{(mapAse[id] && mapAse[id].nombre) || id}</option>)}
              </select>
              <Icon name="chevDown" size={15} style={{ color: "var(--faint)", pointerEvents: "none" }} />
            </div>
          )}
        </div>

        {lista.length === 0 && <div className="card" style={{ padding: "48px 20px", textAlign: "center", color: "var(--faint)" }}>Sin eventos para este filtro.</div>}

        {grupos.map(g => (
          <div key={g.dia} style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--faint)", margin: "0 2px 10px" }}>{g.dia}</div>
            <div className="card" style={{ overflow: "hidden", padding: 0 }}>
              {g.items.map((l, i) => {
                const m = LOG_CAT[l.cat] || LOG_CAT.otro;
                const ase = mapAse[l.actorId];
                return (
                  <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 18px", borderTop: i ? "1px solid var(--line-2)" : "none" }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, background: m.bg, border: "1px solid " + m.bd, display: "inline-flex", alignItems: "center", justifyContent: "center", color: m.color, flexShrink: 0 }}>
                      <Icon name={m.icon} size={16} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{l.detalle}</div>
                      <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 2, display: "flex", alignItems: "center", gap: 7 }}>
                        <span className="badge" style={{ fontSize: 10, padding: "2px 7px", background: m.bg, color: m.color, border: "1px solid " + m.bd }}>{m.label}</span>
                        <span>por <b style={{ color: "var(--ink-2)" }}>{l.actorNombre || "Sistema"}</b></span>
                      </div>
                    </div>
                    {ase && <Avatar a={ase} size={28} />}
                    <span className="mono" style={{ fontSize: 12, color: "var(--faint)", whiteSpace: "nowrap", width: 50, textAlign: "right" }}>{horaLog(l.ts)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.Bitacora = Bitacora;
