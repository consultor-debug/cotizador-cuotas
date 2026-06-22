/*!
 * Cotizador de Cuotas
 * Copyright (c) 2026 Luis D.. Todos los derechos reservados.
 * Software propietario. Prohibida su copia, distribución o uso sin
 * autorización escrita del titular. Ver archivo LICENSE.
 */

/* =========================================================
   RESERVAS — separaciones activas con cuenta regresiva
   Asesor ve las suyas; gerencia/jefatura ve todas.
   ========================================================= */

function useNow(intervalMs) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), intervalMs || 1000);
    return () => clearInterval(iv);
  }, [intervalMs]);
  return now;
}

const RSV_ESTADOS = {
  activa:     { label: "Activa",     cls: "ok" },
  vencida:    { label: "Vencida",    cls: "bad" },
  convertida: { label: "Convertida", cls: "" },
  liberada:   { label: "Liberada",   cls: "" },
};

function Reservas({ reservas, asesor, perms, moneda, cond, onLiberar, onConvertir, onEditarVencimiento, onEditarCliente, onEditarPago }) {
  const now = useNow(1000);
  const [filtro, setFiltro] = useState("activa");
  const [editar, setEditar] = useState(null);
  const [editCliente, setEditCliente] = useState(null);
  const [editNeg, setEditNeg] = useState(null);
  const [hist, setHist] = useState(null);

  const puedeVerTodo = perms.verTodo;
  const mias = puedeVerTodo ? reservas : reservas.filter(r => r.asesorId === asesor.id);
  const puedeEditar = (r) => perms.editarTodo || r.asesorId === asesor.id;
  const lista = mias.filter(r => filtro === "todas" || r.estado === filtro)
    .sort((a, b) => (a.estado === "activa" && b.estado === "activa") ? a.expiresAt - b.expiresAt : 0);
  const cuenta = (e) => mias.filter(r => e === "todas" || r.estado === e).length;
  const activas = mias.filter(r => r.estado === "activa");
  const porVencer = activas.filter(r => r.expiresAt - now < 24 * 3600000 && r.expiresAt > now).length;

  const chips = [
    { k: "activa", label: "Activas" },
    { k: "vencida", label: "Vencidas" },
    { k: "convertida", label: "Convertidas" },
    { k: "liberada", label: "Liberadas" },
    { k: "todas", label: "Todas" },
  ];

  function urgencia(ms) {
    if (ms <= 0) return { c: "var(--bad-ink)", bg: "var(--bad-bg)", bd: "#f3c7cb" };
    if (ms < 3600000) return { c: "var(--bad-ink)", bg: "var(--bad-bg)", bd: "#f3c7cb" };
    if (ms < 24 * 3600000) return { c: "var(--warn-ink)", bg: "var(--warn-bg)", bd: "#f0d6a8" };
    return { c: "var(--ok-ink)", bg: "var(--ok-bg)", bd: "#bfe6cd" };
  }

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "26px 36px 60px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="kicker" style={{ color: "var(--primary)" }}>Comercial</div>
            <h1 style={{ fontSize: 34, marginTop: 4 }}>Reservas</h1>
            <div style={{ color: "var(--muted)", marginTop: 6, fontSize: 14.5 }}>
              {activas.length} activas{porVencer > 0 ? " · " : ""}{porVencer > 0 && <b style={{ color: "var(--warn-ink)" }}>{porVencer} por vencer en 24 h</b>}. Se liberan solas al vencer el plazo.
            </div>
            <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)", background: "var(--surface-2)", border: "1px solid var(--line)", padding: "5px 11px", borderRadius: 999 }}>
              <Icon name={puedeVerTodo ? "users" : "eye"} size={13} style={{ color: "var(--primary)" }} />
              {puedeVerTodo
                ? (perms.editarTodo ? "Ves y gestionas las reservas de todo el equipo" : "Ves todas; solo gestionas las tuyas")
                : "Solo tus reservas"}
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "20px 0 18px" }}>
          {chips.map(c => (
            <button key={c.k} onClick={() => setFiltro(c.k)}
              style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid " + (filtro === c.k ? "var(--primary)" : "var(--line)"),
                background: filtro === c.k ? "var(--primary)" : "#fff", color: filtro === c.k ? "#fff" : "var(--ink-2)",
                padding: "8px 14px", borderRadius: 10, fontWeight: 600, fontSize: 13.5 }}>
              {c.label}<span className="mono" style={{ opacity: .75 }}>{cuenta(c.k)}</span>
            </button>
          ))}
        </div>

        {lista.length === 0 && <div className="card" style={{ padding: "48px 20px", textAlign: "center", color: "var(--faint)" }}>Sin reservas para este filtro.</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 16 }}>
          {lista.map(r => {
            const e = RSV_ESTADOS[r.estado] || RSV_ESTADOS.activa;
            const ms = r.expiresAt - now;
            const u = urgencia(ms);
            const activa = r.estado === "activa";
            return (
              <div key={r.id} className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "16px 18px 12px" }}>
                  <div>
                    <div className="kicker" style={{ color: "var(--primary)" }}>Lote {r.loteId}</div>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, marginTop: 3 }}>Mz {r.manzana} · N° {r.numero}</div>
                  </div>
                  <span className={"badge badge-" + e.cls}>{e.label}</span>
                </div>

                {/* Cuenta regresiva */}
                {activa ? (
                  <div style={{ margin: "0 18px 14px", padding: "12px 14px", borderRadius: 12, background: u.bg, border: "1px solid " + u.bd, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: u.c }}>
                      <Icon name="clock" size={15} /> {ms <= 0 ? "Vencida" : "Vence en"}
                    </span>
                    <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: u.c }}>{STORE.fmtLeft(ms)}</span>
                  </div>
                ) : (
                  <div style={{ margin: "0 18px 14px", padding: "10px 14px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--line)", fontSize: 12.5, color: "var(--muted)" }}>
                    {r.estado === "convertida" ? "Convertida en venta" : r.estado === "liberada" ? "Liberada manualmente" : "Vencida y liberada"}
                  </div>
                )}

                <div style={{ padding: "0 18px 14px", display: "flex", flexDirection: "column", gap: 9, fontSize: 13 }}>
                  <ClienteRow r={r} editable={activa && puedeEditar(r)} onEdit={() => setEditCliente(r)} />
                  <Row k="Asesor" v={r.asesorNombre} />
                  <Row k="Precio lista" v={LIB.money(r.precioLista, moneda)} mono />
                  {r.modo && (
                    <>
                      <div style={{ height: 1, background: "var(--line-2)", margin: "3px 0" }}></div>
                      <Row k="Forma de pago" v={r.modo === "contado" ? "Contado" : "Fraccionamiento · " + (r.cuotas || 0) + " cuotas"} />
                      {r.montoSeparacion != null && <Row k="Separación" v={LIB.money(r.montoSeparacion, moneda)} mono />}
                      {r.siguientePago != null && (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                          <span style={{ color: "var(--ink-2)", fontSize: 12.5, fontWeight: 600 }}>Siguiente pago <span style={{ color: "var(--faint)", fontWeight: 400 }}>(inicial restante)</span></span>
                          <span className="mono" style={{ fontWeight: 800, color: "var(--primary)" }}>{LIB.money(r.siguientePago, moneda)}</span>
                        </div>
                      )}
                      {r.modo === "financiamiento" && r.cuotaMensual ? <Row k={"Cuota mensual · " + (r.cuotas || 0) + "x"} v={LIB.money(r.cuotaMensual, moneda) + "/mes"} mono /> : null}
                      {Array.isArray(r.planInicial) && r.planInicial.length > 1 && (
                        <Row k="Plan de inicial" v={r.planInicial.length + " pagos"} />
                      )}
                      {r.captacion && <Row k="Captación" v={r.captacion} />}
                      {activa && puedeEditar(r) && (
                        <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", gap: 7, marginTop: 4, fontSize: 12.5, color: "var(--primary-700)", border: "1px solid var(--primary-100)" }} onClick={() => setEditNeg(r)}>
                          <Icon name="sliders" size={14} /> Editar negociación
                        </button>
                      )}
                    </>
                  )}
                  {!r.modo && activa && puedeEditar(r) && (
                    <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", gap: 7, marginTop: 2, fontSize: 12.5, color: "var(--primary-700)", border: "1px solid var(--primary-100)" }} onClick={() => setEditNeg(r)}>
                      <Icon name="sliders" size={14} /> Negociar pago / cotización
                    </button>
                  )}
                </div>

                <div style={{ padding: "0 18px 14px" }}>
                  <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", gap: 8, fontSize: 12.5, color: "var(--muted)" }} onClick={() => setHist(r)}>
                    <Icon name="history" size={14} /> Ver historial ({(r.historial || []).length})
                  </button>
                </div>

                {activa && (
                  puedeEditar(r) ? (
                  <div style={{ marginTop: "auto", display: "flex", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--line)", background: "var(--surface)" }}>
                    <button className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }} onClick={() => onConvertir(r)}><Icon name="tag" size={15} /> Convertir</button>
                    <button className="btn" title="Editar plazo de vencimiento" onClick={() => setEditar(r)}><Icon name="clock" size={15} /></button>
                    <button className="btn" title="Liberar lote" onClick={() => onLiberar(r)}><Icon name="reset" size={15} /></button>
                  </div>
                  ) : (
                  <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8, padding: "12px 18px", borderTop: "1px solid var(--line)", background: "var(--surface-2)", fontSize: 12.5, color: "var(--faint)" }}>
                    <Icon name="lock" size={14} /> Reserva de {r.asesorNombre.split(" ")[0]} · solo lectura
                  </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      </div>
      {editar && <EditVencimientoModal reserva={editar} cond={cond} now={now} onClose={() => setEditar(null)} onSave={(dias) => { onEditarVencimiento(editar, dias); setEditar(null); }} />}
      {editCliente && <EditClienteModal reserva={editCliente} onClose={() => setEditCliente(null)} onSave={(datos) => { onEditarCliente(editCliente, datos); setEditCliente(null); }} />}
      {editNeg && <EditarNegociacionModal reserva={editNeg} moneda={moneda} cond={cond} onClose={() => setEditNeg(null)} onSave={(pago) => { onEditarPago(editNeg, pago); setEditNeg(null); }} />}
      {hist && <HistorialModal reserva={hist} onClose={() => setHist(null)} />}
    </div>
  );
}

const HIST_EV = {
  creada:     { label: "Reserva creada",          icon: "clock",   color: "var(--primary)" },
  plazo:      { label: "Plazo modificado",        icon: "sliders", color: "var(--warn-ink)" },
  cliente:    { label: "Cliente actualizado",     icon: "edit",    color: "var(--primary)" },
  negociacion:{ label: "Negociación actualizada", icon: "sliders", color: "var(--primary)" },
  convertida: { label: "Convertida en venta",     icon: "tag",     color: "var(--ok-ink)" },
  liberada:   { label: "Liberada",                icon: "reset",   color: "var(--muted)" },
  vencida:    { label: "Vencida automáticamente", icon: "clock",   color: "var(--bad-ink)" },
};
function fmtHora(ts) {
  return new Date(ts).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}
function HistorialModal({ reserva, onClose }) {
  const eventos = [...(reserva.historial || [])].sort((a, b) => a.ts - b.ts);
  return (
    <Modal onClose={onClose} title="Historial de la reserva" width={460}>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: -6 }}>
        Lote <b style={{ color: "var(--ink)" }}>{reserva.loteId}</b> · {reserva.clienteNombre}
      </p>
      <div style={{ marginTop: 18, position: "relative" }}>
        {eventos.length === 0 && <div style={{ color: "var(--faint)", fontSize: 13 }}>Sin eventos registrados.</div>}
        {eventos.map((e, i) => {
          const m = HIST_EV[e.accion] || HIST_EV.creada;
          const last = i === eventos.length - 1;
          return (
            <div key={i} style={{ display: "flex", gap: 14, position: "relative" }}>
              {/* línea + punto */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--surface-2)", border: "1.5px solid " + m.color, display: "inline-flex", alignItems: "center", justifyContent: "center", color: m.color, flexShrink: 0 }}><Icon name={m.icon} size={14} /></span>
                {!last && <span style={{ width: 2, flex: 1, minHeight: 18, background: "var(--line)", margin: "2px 0" }}></span>}
              </div>
              <div style={{ paddingBottom: last ? 0 : 16, flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{m.label}</span>
                  <span className="mono" style={{ fontSize: 11.5, color: "var(--faint)", whiteSpace: "nowrap" }}>{STORE.fmtFechaHora(e.ts)} · {fmtHora(e.ts)}</span>
                </div>
                {e.detalle && <div style={{ fontSize: 12.5, color: "var(--ink-2)", marginTop: 2 }}>{e.detalle}</div>}
                <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 2 }}>por {e.por}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <button className="btn" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
}

function EditVencimientoModal({ reserva, cond, now, onClose, onSave }) {
  const actuales = Math.max(1, Math.round((reserva.expiresAt - reserva.createdAt) / 86400000));
  const [dias, setDias] = useState(reserva.dias || actuales);
  const opciones = [...new Set([cond.validezDias || 3, 7, 12, 15, 30])].sort((a, b) => a - b);
  const nuevoVence = reserva.createdAt + dias * 86400000;
  const restante = nuevoVence - now;
  return (
    <Modal onClose={onClose} title="Editar vencimiento" width={440}>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: -6 }}>
        Reserva del lote <b style={{ color: "var(--ink)" }}>{reserva.loteId}</b> para <b style={{ color: "var(--ink)" }}>{reserva.clienteNombre}</b>. Ajusta el plazo total desde que se creó.
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 14px", margin: "14px 0 16px", fontSize: 12.5 }}>
        <span style={{ color: "var(--muted)" }}>Creada el</span>
        <span className="mono" style={{ fontWeight: 600 }}>{STORE.fmtFechaHora(reserva.createdAt)}</span>
      </div>
      <label className="kicker" style={{ display: "block", marginBottom: 8 }}>Plazo total</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {opciones.map(d => (
          <button key={d} onClick={() => setDias(d)}
            style={{ border: "1px solid " + (dias === d ? "var(--primary)" : "var(--line)"), background: dias === d ? "var(--primary)" : "#fff", color: dias === d ? "#fff" : "var(--ink-2)",
              padding: "8px 14px", borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>{d} días</button>
        ))}
        <div className="field field-mono" style={{ width: 130, height: 40 }}>
          <input className="mono" type="number" min={1} max={365} value={dias} onChange={e => setDias(Math.max(1, Math.min(365, Number(e.target.value) || 1)))} />
          <span style={{ color: "var(--faint)", fontSize: 12.5, paddingRight: 4 }}>días</span>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 4 }}>
        Nuevo vencimiento: <b style={{ color: "var(--ink-2)" }}>{STORE.fmtFechaHora(nuevoVence)}</b> · {restante > 0 ? "quedan " + STORE.fmtLeft(restante) : <span style={{ color: "var(--bad-ink)" }}>ya vencida</span>}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={dias < 1} onClick={() => onSave(dias)}><Icon name="check" size={15} /> Guardar plazo</button>
      </div>
    </Modal>
  );
}

function ClienteRow({ r, editable, onEdit }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <span style={{ color: "var(--faint)", fontSize: 12.5 }}>Cliente</span>
      <span style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 7, justifyContent: "flex-end" }}>
        <span style={{ textAlign: "right" }}>
          <span style={{ fontWeight: 600, color: r.clienteNombre === "Pendiente" ? "var(--warn-ink)" : "var(--ink)" }}>{r.clienteNombre}</span>
          {r.clienteContacto && <span className="mono" style={{ display: "block", fontSize: 11.5, color: "var(--faint)" }}>{r.clienteContacto}</span>}
        </span>
        {editable && (
          <button className="btn btn-ghost" title="Editar datos del cliente" onClick={onEdit}
            style={{ padding: 5, color: "var(--primary)", flexShrink: 0 }}><Icon name="edit" size={14} /></button>
        )}
      </span>
    </div>
  );
}

function EditClienteModal({ reserva, onClose, onSave }) {
  const [nombre, setNombre] = useState(reserva.clienteNombre === "Pendiente" ? "" : (reserva.clienteNombre || ""));
  const [contacto, setContacto] = useState(reserva.clienteContacto || "");
  return (
    <Modal onClose={onClose} title="Editar cliente" width={440}>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: -6 }}>
        Reserva del lote <b style={{ color: "var(--ink)" }}>{reserva.loteId}</b>. Actualiza el nombre y el contacto del cliente.
      </p>
      <label className="kicker" style={{ display: "block", margin: "16px 0 6px" }}>Nombre del cliente</label>
      <div className="field" style={{ height: 44 }}>
        <input autoFocus value={nombre} placeholder="Ej. Matteo G." onChange={e => setNombre(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onSave({ nombre, contacto }); }} style={{ fontSize: 15 }} />
      </div>
      <label className="kicker" style={{ display: "block", margin: "14px 0 6px" }}>Contacto <span style={{ color: "var(--faint)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(opcional)</span></label>
      <div className="field" style={{ height: 44 }}>
        <input value={contacto} placeholder="Teléfono o correo" onChange={e => setContacto(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onSave({ nombre, contacto }); }} style={{ fontSize: 15 }} />
      </div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 10 }}>
        Si dejas el nombre vacío, la reserva queda como <b style={{ color: "var(--warn-ink)" }}>Pendiente</b>.
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSave({ nombre, contacto })}><Icon name="check" size={15} /> Guardar cliente</button>
      </div>
    </Modal>
  );
}

function Row({ k, v, sub, mono }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <span style={{ color: "var(--faint)", fontSize: 12.5 }}>{k}</span>
      <span style={{ textAlign: "right" }}>
        <span className={mono ? "mono" : ""} style={{ fontWeight: 600 }}>{v}</span>
        {sub && <span className="mono" style={{ display: "block", fontSize: 11.5, color: "var(--faint)" }}>{sub}</span>}
      </span>
    </div>
  );
}

window.Reservas = Reservas;
