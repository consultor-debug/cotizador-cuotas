/* =========================================================
   PLANO — contenedor: toolbar (subir / editar / exportar),
   lienzo poligónico (PlanoBoard) + panel Cotizador.
   ========================================================= */

function Plano({ lotes, setLotes, polys, setPolys, planoImg, setPlanoImg, planoMode, setPlanoMode, planoOpacity, setPlanoOpacity, cond, asesor, moneda, perms, brand, clientes, onEnviar, onReservar, onCerrarReserva, onLog, toast }) {
  const [selId, setSel] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [q, setQ] = useState("");
  const [zoom, setZoom] = useState(0.62);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [editMode, setEditMode] = useState(false);
  const [tool, setTool] = useState("select");
  const [vaciar, setVaciar] = useState(false);
  const [compact, setCompact] = useState(() => STORE.load("planoCompact", false));
  const [expand, setExpand] = useState(false);
  const [reservar, setReservar] = useState(null);   // lote pendiente de reserva
  const [barPos, setBarPos] = useState({ x: 16, y: 16 });
  const barDrag = useRef(null);
  const drag = useRef(null);
  const moved = useRef(false);
  const wrap = useRef(null);
  const fileRef = useRef(null);

  function fit() {
    if (!wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    const z = Math.min((r.width - 36) / 1240, (r.height - 36) / 684);
    setZoom(Math.max(0.5, Math.min(1.4, z))); setPan({ x: 0, y: 0 });
  }
  useEffect(() => {
    fit();
    const ro = new ResizeObserver(() => fit());
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { if (!perms.editarPlano && editMode) setEditMode(false); }, [perms.editarPlano, editMode]);
  useEffect(() => { STORE.save("planoCompact", compact); }, [compact]);
  // Pantalla completa del lienzo: re-encuadra al entrar/salir y cierra con Esc
  useEffect(() => {
    const t = setTimeout(fit, 60);
    if (!expand) return () => clearTimeout(t);
    const onKey = e => { if (e.key === "Escape") setExpand(false); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onKey); };
  }, [expand]);

  const counts = useMemo(() => ({
    todos: lotes.length,
    disponible: lotes.filter(l => l.estado === "disponible").length,
    separado: lotes.filter(l => l.estado === "separado").length,
    vendido: lotes.filter(l => l.estado === "vendido").length,
    no_disponible: lotes.filter(l => l.estado === "no_disponible").length,
  }), [lotes]);

  const sel = lotes.find(l => l.id === selId);

  const qn = q.trim().toLowerCase();
  function matches(l) {
    if (filtro !== "todos" && l.estado !== filtro) return false;
    if (qn && !(l.id.toLowerCase().includes(qn) || ("manzana " + l.manzana).toLowerCase().includes(qn))) return false;
    return true;
  }
  function setEstado(id, estado) { setLotes(ls => ls.map(l => l.id === id ? { ...l, estado } : l)); }
  function onAction(k) {
    if (!sel) return;
    if (k === "separar") { setReservar(sel); return; }
    if (k === "vendido") { setEstado(sel.id, "vendido"); onCerrarReserva && onCerrarReserva(sel.id, "convertida"); onLog && onLog({ cat: "venta", accion: "vendido", detalle: "Lote " + sel.id + " marcado como vendido", ref: sel.id }); toast("Lote " + sel.id + " marcado como vendido por " + asesor.nombre, "ok"); }
    if (k === "liberar") { setEstado(sel.id, "disponible"); onCerrarReserva && onCerrarReserva(sel.id, "liberada"); onLog && onLog({ cat: "lote", accion: "liberar", detalle: "Lote " + sel.id + " liberado (disponible)", ref: sel.id }); toast("Lote " + sel.id + " liberado", "ok"); }
    if (k === "no_disponible") { setEstado(sel.id, "no_disponible"); onCerrarReserva && onCerrarReserva(sel.id, "liberada"); onLog && onLog({ cat: "lote", accion: "no_disponible", detalle: "Lote " + sel.id + " marcado como no disponible", ref: sel.id }); toast("Lote " + sel.id + " marcado como no disponible para venta", "warn"); }
    if (k === "transp") {
      const nuevo = !sel.transparente;
      setLotes(ls => ls.map(l => l.id === sel.id ? { ...l, transparente: nuevo } : l));
      toast(nuevo ? "Lote " + sel.id + " transparente · se ve el plano de fondo" : "Lote " + sel.id + " con relleno de color", "ok");
    }
  }
  function confirmarReserva(lote, cliente, dias) {
    setEstado(lote.id, "separado");
    onReservar && onReservar(lote, cliente, dias);
    setReservar(null);
    toast("Lote " + lote.id + " separado para " + cliente.nombre + " · vence en " + dias + " días", "warn");
  }

  // zoom & pan — en edición se permite mover el plano arrastrando con la herramienta "Ajustar"
  // (los lotes, vértices y mangos detienen la propagación, así que arrastrarlos sigue moviéndolos).
  function onWheel(e) { e.preventDefault(); setZoom(z => Math.min(2.2, Math.max(0.5, z - e.deltaY * 0.0012))); }
  const panAllowed = !editMode || tool === "select";
  function onDown(e) {
    if (!panAllowed) return;                           // dibujando: el click coloca vértices
    if (e.target.closest(".poly-cell")) return;       // controles flotantes
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    moved.current = false;
    wrap.current.style.cursor = "grabbing";
  }
  function onMove(e) {
    if (!drag.current) return;
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved.current = true;
    setPan({ x: drag.current.px + dx, y: drag.current.py + dy });
  }
  function onUp() { drag.current = null; if (wrap.current) wrap.current.style.cursor = panAllowed ? "grab" : "default"; }
  function onClickCapture(e) { if (moved.current) { e.stopPropagation(); moved.current = false; } }

  // arrastrar la barra de edición flotante
  function barDown(e) {
    e.stopPropagation();
    barDrag.current = { x: e.clientX, y: e.clientY, ox: barPos.x, oy: barPos.y };
    window.addEventListener("pointermove", barMove);
    window.addEventListener("pointerup", barUp);
  }
  function barMove(e) {
    const d = barDrag.current; if (!d) return;
    const r = wrap.current ? wrap.current.getBoundingClientRect() : { width: 900, height: 600 };
    const nx = Math.max(8, Math.min(r.width - 90, d.ox + (e.clientX - d.x)));
    const ny = Math.max(8, Math.min(r.height - 50, d.oy + (e.clientY - d.y)));
    setBarPos({ x: nx, y: ny });
  }
  function barUp() {
    window.removeEventListener("pointermove", barMove);
    window.removeEventListener("pointerup", barUp);
    barDrag.current = null;
  }

  // subir plano
  function onFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = async () => {
      let durl = rd.result;
      try { durl = await PLAN.downscaleDataURL(rd.result); } catch (e) { /* usar original */ }
      setPlanoImg(durl);
      setPlanoMode("real");
      toast("Plano \"" + f.name + "\" cargado · dibuja los lotes encima", "ok");
      fit();
    };
    rd.readAsDataURL(f);
    e.target.value = "";
  }
  function mapearDesdeCero() {
    setPolys([]); setLotes([]); setSel(null); setVaciar(false);
    setTool("general");
    toast("Plano vaciado · empieza a mapear con Polígono general o Dibujar lote", "ok");
  }

  const hasPlano = !!planoImg;
  const showReal = planoMode === "real" && hasPlano;
  const planoView = showReal ? planoImg : null; // lo que se muestra/exporta (la imagen guardada se conserva siempre)

  const chips = [
    { k: "todos", label: "Todos", c: counts.todos },
    { k: "disponible", label: "Disponibles", c: counts.disponible, cls: "ok" },
    { k: "separado", label: "Separados", c: counts.separado, cls: "warn" },
    { k: "vendido", label: "Vendidos", c: counts.vendido, cls: "bad" },
    { k: "no_disponible", label: "No disponibles", c: counts.no_disponible, cls: "muted" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflowY: "auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: compact ? "center" : "flex-end", gap: 16, padding: compact ? "10px 30px 10px" : "22px 30px 16px", flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <button className="btn btn-ghost" onClick={() => setCompact(c => !c)} title={compact ? "Mostrar encabezado" : "Compactar encabezado"} style={{ padding: 8, flexShrink: 0 }}>
            <Icon name={compact ? "chevDown" : "chevUp"} size={18} />
          </button>
          {compact ? (
            <div style={{ fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Plano del proyecto <span style={{ color: "var(--muted)", fontSize: 13.5, fontWeight: 500 }}>· {counts.disponible} disponibles</span>
            </div>
          ) : (
            <div>
              <h1 style={{ fontSize: 34 }}>Plano del proyecto</h1>
              <div style={{ color: "var(--muted)", marginTop: 6, fontSize: 14.5 }}>
                {brand.nombre} · {counts.todos} lotes · {counts.disponible} disponibles
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div className="segtabs" style={{ padding: 3 }}>
            <button className={showReal ? "" : "on"} style={seg} onClick={() => setPlanoMode("esquema")}><Icon name="layers" size={15} /> Esquema</button>
            <button
              className={showReal ? "on" : ""}
              style={{ ...seg, opacity: !hasPlano && !perms.editarPlano ? 0.4 : 1 }}
              disabled={!hasPlano && !perms.editarPlano}
              title={!hasPlano ? "El administrador aún no ha subido el plano real" : ""}
              onClick={() => { if (hasPlano) setPlanoMode("real"); else if (perms.editarPlano) fileRef.current.click(); }}>
              <Icon name="pin" size={15} /> Plano real
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*,.svg" onChange={onFile} style={{ display: "none" }} />
          {perms.editarPlano && <button className="btn" onClick={() => fileRef.current.click()}><Icon name="upload" size={15} /> {hasPlano ? "Cambiar plano" : "Subir plano"}</button>}
          {perms.editarPlano && (
            <button className={"btn" + (editMode ? " btn-primary" : "")} onClick={() => { setEditMode(v => !v); setTool("select"); }}>
              <Icon name="edit" size={15} /> {editMode ? "Listo" : "Editar polígonos"}
            </button>
          )}
          <ExportMenu polys={polys} planoImg={planoView} planoOpacity={planoOpacity ?? 1} lotes={lotes} brand={brand} toast={toast} />
        </div>
      </div>

      {/* Toolbar filtros */}
      <div style={{ padding: compact ? "0 30px 10px" : "0 30px 16px", flexShrink: 0 }}>
        <div className="card" style={{ display: "flex", alignItems: "center", gap: 14, padding: compact ? "8px 14px" : "12px 16px", flexWrap: "wrap" }}>
          <div className="field" style={{ width: 280, height: 40 }}>
            <Icon name="search" size={16} style={{ color: "var(--faint)" }} />
            <input placeholder="Lote A-03, manzana C…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {chips.map(c => (
              <button key={c.k} onClick={() => setFiltro(c.k)}
                style={{ display: "flex", alignItems: "center", gap: 9, border: "1px solid " + (filtro === c.k ? "var(--primary)" : "var(--line)"),
                  background: filtro === c.k ? "var(--primary)" : "#fff", color: filtro === c.k ? "#fff" : "var(--ink-2)",
                  padding: "7px 14px", borderRadius: 10, fontWeight: 600, fontSize: 13.5, transition: ".12s" }}>
                {c.cls && <span style={{ width: 9, height: 9, borderRadius: 3, background: LIB.ESTADOS[c.k].stroke }}></span>}
                {c.label}
                <span className="mono" style={{ fontWeight: 700, opacity: filtro === c.k ? 1 : .7 }}>{c.c}</span>
              </button>
            ))}
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }} className="poly-cell">
            <Icon name="layers" size={15} style={{ color: "var(--faint)" }} />
            <span style={{ fontSize: 12.5, color: "var(--muted)", fontWeight: 600, whiteSpace: "nowrap" }}>Opacidad de lotes</span>
            <input type="range" min={15} max={100} step={5} value={Math.round((planoOpacity ?? 1) * 100)}
              onChange={e => setPlanoOpacity(+e.target.value / 100)}
              style={{ width: 120, accentColor: "var(--primary)", cursor: "pointer" }} />
            <span className="mono" style={{ fontSize: 12, color: "var(--faint)", width: 38, textAlign: "right" }}>{Math.round((planoOpacity ?? 1) * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Split: plano + cotizador */}
      <div className="plano-split" style={{ flex: 1, display: "flex", gap: 18, padding: "0 30px 24px", minHeight: 0, minBlockSize: 520 }}>
        {/* Lienzo */}
        <div className="card plano-lienzo" style={expand
          ? { position: "fixed", inset: 0, zIndex: 120, borderRadius: 0, overflow: "hidden", background: "#fff" }
          : { flex: 1, position: "relative", overflow: "hidden", background: "#fff" }}>
          <div ref={wrap} onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onClickCapture={onClickCapture}
            style={{ position: "absolute", inset: 0, cursor: panAllowed ? "grab" : "default", touchAction: "none" }}>
            <div style={{ position: "absolute", left: "50%", top: "50%",
              transform: `translate(-50%,-50%) translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: "center", transition: drag.current ? "none" : "transform .1s" }}>
              <PlanoBoard lotes={lotes} setLotes={setLotes} polys={polys} setPolys={setPolys} planoImg={planoView} planoOpacity={planoOpacity ?? 1}
                selId={selId} setSel={setSel} matches={matches} active={qn || filtro !== "todos"}
                editMode={editMode} tool={tool} setTool={setTool} toast={toast} />
            </div>
          </div>

          {/* Barra de edición flotante (arrastrable) */}
          {editMode && (
            <div className="card pop poly-cell" style={{ position: "absolute", left: barPos.x, top: barPos.y, display: "flex", alignItems: "center", gap: 6, padding: 6, boxShadow: "var(--shadow-lg)", zIndex: 8, maxWidth: "calc(100% - 32px)", flexWrap: "wrap" }}>
              <span onPointerDown={barDown} title="Arrastrar barra" style={{ display: "inline-flex", alignItems: "center", alignSelf: "stretch", padding: "0 4px", cursor: barDrag.current ? "grabbing" : "grab", color: "var(--faint)", borderRight: "1px solid var(--line)", marginRight: 2, touchAction: "none" }}><Icon name="grip" size={16} /></span>
              <button onClick={() => setTool("select")} className={"btn " + (tool === "select" ? "btn-primary" : "btn-ghost")} style={{ fontSize: 13 }}><Icon name="sliders" size={15} /> Ajustar</button>
              <button onClick={() => setTool("draw")} className={"btn " + (tool === "draw" ? "btn-primary" : "btn-ghost")} style={{ fontSize: 13 }}><Icon name="plus" size={15} /> Dibujar lote</button>
              <button onClick={() => setTool("general")} className={"btn " + (tool === "general" ? "btn-primary" : "btn-ghost")} style={{ fontSize: 13 }}><Icon name="layers" size={15} /> Polígono general</button>
              <span style={{ width: 1, height: 22, background: "var(--line)", margin: "0 2px" }}></span>
              <button onClick={() => setVaciar(true)} className="btn btn-ghost" style={{ fontSize: 13, color: "var(--bad-ink)" }}><Icon name="trash" size={15} /> Mapear desde cero</button>
              <span style={{ width: 1, height: 22, background: "var(--line)", margin: "0 2px" }}></span>
              <span style={{ fontSize: 12, color: "var(--muted)", paddingRight: 6, maxWidth: 280 }}>
                {tool === "draw"
                  ? "Click para añadir vértices · cierra en el 1° punto, doble-clic o Enter."
                  : tool === "general"
                  ? "Dibuja un contorno (ej. una manzana). Al cerrarlo podrás Subdividirlo en lotes."
                  : "Arrastra el lote o sus vértices (círculos). Arrastra los rombos para curvar una arista (doble-clic la endereza). Doble-clic en un vértice lo elimina."}
              </span>
            </div>
          )}

          {/* Zoom controls */}
          <div className="card poly-cell" style={{ position: "absolute", right: 16, bottom: 16, display: "flex", flexDirection: "column", padding: 4, gap: 2 }}>
            <button className="btn btn-ghost" style={{ padding: 8 }} title={expand ? "Salir de pantalla completa (Esc)" : "Pantalla completa"} onClick={() => setExpand(v => !v)}><Icon name={expand ? "minimize" : "expand"} size={16} /></button>
            <div style={{ height: 1, background: "var(--line)", margin: "2px 4px" }}></div>
            <button className="btn btn-ghost" style={{ padding: 8 }} onClick={() => setZoom(z => Math.min(2.2, z + 0.15))}><Icon name="plus" size={16} /></button>
            <div style={{ textAlign: "center", fontSize: 10.5, color: "var(--faint)", fontWeight: 700 }} className="mono">{Math.round(zoom * 100)}%</div>
            <button className="btn btn-ghost" style={{ padding: 8 }} onClick={() => setZoom(z => Math.max(0.5, z - 0.15))}><Icon name="minus" size={16} /></button>
            <button className="btn btn-ghost" style={{ padding: 8 }} onClick={fit}><Icon name="reset" size={15} /></button>
          </div>
          {/* Leyenda */}
          <div className="card poly-cell" style={{ position: "absolute", left: 16, bottom: 16, display: "flex", gap: 14, padding: "9px 14px", fontSize: 12, fontWeight: 600 }}>
            {["disponible", "separado", "vendido", "no_disponible"].map(s => (
              <span key={s} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-2)" }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: LIB.ESTADOS[s].fill, border: "1.5px solid " + LIB.ESTADOS[s].stroke }}></span>
                {LIB.ESTADOS[s].label}
              </span>
            ))}
          </div>
        </div>

        {/* Cotizador */}
        <div className="card plano-cotizador" style={{ width: 430, flexShrink: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {sel
            ? <Cotizador key={sel.id} lote={sel} cond={cond} asesor={asesor} moneda={moneda} onAction={onAction} onEnviar={onEnviar} />
            : <EmptyCotizador editMode={editMode} />}
        </div>
      </div>

      {vaciar && (
        <Modal onClose={() => setVaciar(false)} title="Mapear desde cero" width={440}>
          <p style={{ color: "var(--ink-2)", fontSize: 14, marginTop: -6, lineHeight: 1.6 }}>
            Se eliminarán <b className="mono">{counts.todos}</b> lotes y todos sus polígonos del plano para empezar el mapeo en limpio.
            {planoView ? " El plano subido se conserva como fondo." : ""}
          </p>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "var(--bad-bg)", border: "1px solid #f3c7cb", borderRadius: 12, padding: "12px 14px", margin: "14px 0 4px" }}>
            <Icon name="trash" size={16} style={{ color: "var(--bad-ink)", marginTop: 1 }} />
            <span style={{ fontSize: 13, color: "var(--bad-ink)" }}>Esta acción no se puede deshacer.</span>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
            <button className="btn" onClick={() => setVaciar(false)}>Cancelar</button>
            <button className="btn btn-danger" onClick={mapearDesdeCero}><Icon name="trash" size={15} /> Vaciar y mapear desde cero</button>
          </div>
        </Modal>
      )}
      {reservar && <ReservaModal lote={reservar} clientes={clientes} cond={cond} moneda={moneda} onClose={() => setReservar(null)} onConfirm={confirmarReserva} />}
    </div>
  );
}

function ReservaModal({ lote, clientes, cond, moneda, onClose, onConfirm }) {
  const [nombre, setNombre] = useState("");
  const [tel, setTel] = useState("");
  const [sug, setSug] = useState(false);
  const [dias, setDias] = useState(cond.validezDias || 3);
  const matches = (clientes || []).filter(c => nombre.trim().length >= 2 && c.nombre.toLowerCase().includes(nombre.trim().toLowerCase())).slice(0, 4);
  const ok = nombre.trim().length >= 2 && dias >= 1;
  const opciones = [...new Set([cond.validezDias || 3, 7, 12, 15, 30])].sort((a, b) => a - b);
  const vence = new Date(Date.now() + dias * 86400000);
  return (
    <Modal onClose={onClose} title="Separar lote" width={460}>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: -6 }}>
        Reserva el lote <b style={{ color: "var(--ink)" }}>{lote.id}</b> (Mz {lote.manzana} · N° {lote.numero}). Vencido el plazo se libera automáticamente.
      </p>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--warn-bg)", border: "1px solid #f0d6a8", borderRadius: 12, padding: "10px 14px", margin: "14px 0 16px" }}>
        <span style={{ fontSize: 13, color: "var(--warn-ink)", fontWeight: 600 }}>Precio lista</span>
        <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: "var(--warn-ink)" }}>{LIB.money(lote.precioLista, moneda)}</span>
      </div>
      <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Cliente</label>
      <div style={{ position: "relative", marginBottom: 14 }}>
        <div className="field" style={{ height: 44 }}><input placeholder="Nombre del cliente" value={nombre} autoFocus
          onChange={e => { setNombre(e.target.value); setSug(true); }} onFocus={() => setSug(true)} /></div>
        {sug && matches.length > 0 && (
          <div className="card pop" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, padding: 4, zIndex: 5, boxShadow: "var(--shadow-lg)" }}>
            {matches.map(c => (
              <button key={c.id} className="btn btn-ghost" style={{ width: "100%", justifyContent: "flex-start", gap: 8, padding: "8px 10px" }}
                onClick={() => { setNombre(c.nombre); setTel(c.telefono || ""); setSug(false); }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{c.nombre}</span>
                <span style={{ fontSize: 11.5, color: "var(--faint)", marginLeft: "auto" }} className="mono">{c.telefono}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Teléfono / contacto</label>
      <div className="field" style={{ height: 44, marginBottom: 16 }}><Icon name="whatsapp" size={15} style={{ color: "var(--faint)" }} /><input placeholder="Ej. 987 654 321" value={tel} onChange={e => setTel(e.target.value)} /></div>

      {/* Plazo de vencimiento */}
      <label className="kicker" style={{ display: "block", marginBottom: 8 }}>Plazo de vencimiento</label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {opciones.map(d => (
          <button key={d} onClick={() => setDias(d)}
            style={{ border: "1px solid " + (dias === d ? "var(--primary)" : "var(--line)"), background: dias === d ? "var(--primary)" : "#fff", color: dias === d ? "#fff" : "var(--ink-2)",
              padding: "8px 14px", borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
            {d} días{d === (cond.validezDias || 3) ? " · estándar" : ""}
          </button>
        ))}
        <div className="field field-mono" style={{ width: 130, height: 40 }}>
          <input className="mono" type="number" min={1} max={365} value={dias} onChange={e => setDias(Math.max(1, Math.min(365, Number(e.target.value) || 1)))} />
          <span style={{ color: "var(--faint)", fontSize: 12.5, paddingRight: 4 }}>días</span>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 4 }}>
        Vence el <b style={{ color: "var(--ink-2)" }}>{LIB.fmtFecha(vence)}</b>{dias > (cond.validezDias || 3) ? " · plazo extendido (negociación especial)" : ""}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!ok} onClick={() => onConfirm(lote, { nombre: nombre.trim(), telefono: tel.trim() }, dias)}><Icon name="clock" size={15} /> Separar {dias} días</button>
      </div>
    </Modal>
  );
}

const seg = { padding: "8px 16px", display: "flex", gap: 6, alignItems: "center" };

function ExportMenu({ polys, planoImg, planoOpacity = 1, lotes, brand, toast }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  async function run(kind) {
    setOpen(false); setBusy(true);
    try {
      const cv = await PLAN.renderCanvas({ polys, planoImg, planoOpacity, lotes, brand, scale: kind === "png" ? 2 : 2 });
      if (kind === "png") { PLAN.downloadCanvas(cv, ((brand && brand.nombre) || "Plano") + ".png"); toast("Plano exportado como PNG", "ok"); }
      else { PLAN.printCanvas(cv, (brand && brand.nombre) || "Plano"); toast("Abriendo diálogo de impresión / PDF…", "ok"); }
    } catch (e) { toast("No se pudo exportar el plano", "bad"); }
    setBusy(false);
  }
  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button className="btn" onClick={() => setOpen(o => !o)} disabled={busy}>
        <Icon name={busy ? "reset" : "download"} size={15} className={busy ? "spin" : ""} /> Exportar plano <Icon name="chevDown" size={14} style={{ marginLeft: -2 }} />
      </button>
      {open && (
        <div className="card pop" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", width: 210, padding: 6, boxShadow: "var(--shadow-lg)", zIndex: 50 }}>
          <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "flex-start", gap: 10 }} onClick={() => run("png")}><Icon name="download" size={16} /> Imagen PNG</button>
          <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "flex-start", gap: 10 }} onClick={() => run("pdf")}><Icon name="printer" size={16} /> PDF imprimible</button>
        </div>
      )}
    </div>
  );
}

function EmptyCotizador({ editMode }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 40, color: "var(--faint)" }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: "var(--primary-050)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)", marginBottom: 16 }}>
        <Icon name={editMode ? "edit" : "tag"} size={28} />
      </div>
      <h3 style={{ fontSize: 20, color: "var(--ink)" }}>{editMode ? "Editando el plano" : "Selecciona un lote"}</h3>
      <p style={{ fontSize: 14, maxWidth: 250, marginTop: 6 }}>
        {editMode
          ? "Dibuja nuevos lotes o ajusta los existentes. Sal de edición para volver a cotizar."
          : "Haz clic en cualquier lote del plano para armar la cotización."}
      </p>
    </div>
  );
}

window.Plano = Plano;
