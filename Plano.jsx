/*!
 * Cotizador de Cuotas
 * Copyright (c) 2026 Luis D.. Todos los derechos reservados.
 * Software propietario. Prohibida su copia, distribución o uso sin
 * autorización escrita del titular. Ver archivo LICENSE.
 */

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
  const [iman, setIman] = useState(() => STORE.load("planoIman", true));
  useEffect(() => { STORE.save("planoIman", iman); }, [iman]);
  const [alignApi, setAlignApi] = useState(null);   // estado de selección reportado por el lienzo
  const [alignOpen, setAlignOpen] = useState(false); // panel "Alinear" desplegado
  const alignBtnRef = useRef(null);                  // ancla para posicionar el panel (fixed, evita recorte por overflow)
  const [vaciar, setVaciar] = useState(false);
  const [compact, setCompact] = useState(() => STORE.load("planoCompact", false));
  const [expand, setExpand] = useState(false);
  const [reservar, setReservar] = useState(null);   // lote pendiente de reserva
  const [reservaQuote, setReservaQuote] = useState(null); // cotización viva al separar
  const [barPos, setBarPos] = useState({ x: 16, y: 16 });
  const barDrag = useRef(null);
  const drag = useRef(null);
  const moved = useRef(false);
  const wrap = useRef(null);
  const fileRef = useRef(null);

  // ---- Historial de edición (deshacer / rehacer) ----
  const hist = useRef({ past: [], future: [], last: null, applying: false });
  const [histTick, setHistTick] = useState(0);          // fuerza re-render de los botones
  const snapStr = () => JSON.stringify({ polys, lotes });
  // Al entrar/salir de edición se reinicia el historial con el estado actual como base.
  useEffect(() => {
    hist.current = { past: [], future: [], last: editMode ? snapStr() : null, applying: false };
    setHistTick(t => t + 1);
  }, [editMode]);
  // Registra un punto de historial cuando un gesto se asienta (debounce → 1 entrada por acción).
  useEffect(() => {
    if (!editMode) return;
    const h = hist.current;
    if (h.applying) { h.applying = false; h.last = snapStr(); return; }
    const id = setTimeout(() => {
      const s = snapStr();
      if (s === h.last) return;
      if (h.last != null) { h.past.push(h.last); if (h.past.length > 60) h.past.shift(); h.future = []; }
      h.last = s;
      setHistTick(t => t + 1);
    }, 350);
    return () => clearTimeout(id);
  }, [polys, lotes, editMode]);
  function applySnap(str) {
    const o = JSON.parse(str);
    hist.current.applying = true;
    hist.current.last = str;
    setPolys(o.polys); setLotes(o.lotes);
    setHistTick(t => t + 1);
  }
  function undo() {
    const h = hist.current;
    if (!h.past.length) return;
    const prev = h.past.pop();
    h.future.push(h.last);
    applySnap(prev);
    toast("Cambio deshecho", "ok");
  }
  function redo() {
    const h = hist.current;
    if (!h.future.length) return;
    const next = h.future.pop();
    h.past.push(h.last);
    applySnap(next);
    toast("Cambio rehecho", "ok");
  }
  const canUndo = hist.current.past.length > 0;
  const canRedo = hist.current.future.length > 0;
  // Atajos Ctrl/Cmd+Z (deshacer) y Ctrl/Cmd+Shift+Z o Ctrl+Y (rehacer)
  useEffect(() => {
    if (!editMode) return;
    const onKey = (e) => {
      const meta = e.ctrlKey || e.metaKey;
      if (!meta) return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editMode]);

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
  function onAction(k, quote) {
    if (!sel) return;
    if (k === "separar") { setReservaQuote(quote || null); setReservar(sel); return; }
    if (k === "vendido") { setEstado(sel.id, "vendido"); onCerrarReserva && onCerrarReserva(sel.id, "convertida"); onLog && onLog({ cat: "venta", accion: "vendido", detalle: "Lote " + sel.id + " marcado como vendido", ref: sel.id }); toast("Lote " + sel.id + " marcado como vendido por " + asesor.nombre, "ok"); }
    if (k === "liberar") { setEstado(sel.id, "disponible"); onCerrarReserva && onCerrarReserva(sel.id, "liberada"); onLog && onLog({ cat: "lote", accion: "liberar", detalle: "Lote " + sel.id + " liberado (disponible)", ref: sel.id }); toast("Lote " + sel.id + " liberado", "ok"); }
    if (k === "no_disponible") { setEstado(sel.id, "no_disponible"); onCerrarReserva && onCerrarReserva(sel.id, "liberada"); onLog && onLog({ cat: "lote", accion: "no_disponible", detalle: "Lote " + sel.id + " marcado como no disponible", ref: sel.id }); toast("Lote " + sel.id + " marcado como no disponible para venta", "warn"); }
    if (k === "transp") {
      const nuevo = !sel.transparente;
      setLotes(ls => ls.map(l => l.id === sel.id ? { ...l, transparente: nuevo } : l));
      toast(nuevo ? "Lote " + sel.id + " transparente · se ve el plano de fondo" : "Lote " + sel.id + " con relleno de color", "ok");
    }
  }
  function confirmarReserva(lote, cliente, dias, pago) {
    setEstado(lote.id, "separado");
    onReservar && onReservar(lote, cliente, dias, pago);
    setReservar(null);
    toast("Lote " + lote.id + " separado para " + cliente.nombre + " · vence en " + dias + " días", "warn");
  }

  // zoom & pan — en edición se permite mover el plano arrastrando con la herramienta "Ajustar"
  // (los lotes, vértices y mangos detienen la propagación, así que arrastrarlos sigue moviéndolos).
  function onWheel(e) { e.preventDefault(); setZoom(z => Math.min(2.2, Math.max(0.5, z - e.deltaY * 0.0012))); }
  const panAllowed = true;  // se puede mover el plano arrastrando en cualquier herramienta; el click coloca vértices, el arrastre hace pan
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
          ? { position: "fixed", inset: 0, zIndex: 120, borderRadius: 0, overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column" }
          : { flex: 1, position: "relative", overflow: "hidden", background: "#fff", display: "flex", flexDirection: "column" }}>
          {/* Área del plano (la barra de edición queda fuera, abajo) */}
          <div style={{ position: "relative", flex: 1, minHeight: 0, overflow: "hidden" }}>
            <div ref={wrap} onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onClickCapture={onClickCapture}
              style={{ position: "absolute", inset: 0, cursor: panAllowed ? "grab" : "default", touchAction: "none" }}>
              <div style={{ position: "absolute", left: "50%", top: "50%",
                transform: `translate(-50%,-50%) translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: "center", transition: drag.current ? "none" : "transform .1s" }}>
                <PlanoBoard lotes={lotes} setLotes={setLotes} polys={polys} setPolys={setPolys} planoImg={planoView} planoOpacity={planoOpacity ?? 1}
                  selId={selId} setSel={setSel} matches={matches} active={qn || filtro !== "todos"}
                  editMode={editMode} tool={tool} setTool={setTool} snapOn={iman} onAlignApi={setAlignApi} toast={toast} />
              </div>
            </div>

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

          {/* Barra de edición FIJA (dock inferior, fuera del área del plano) */}
          {editMode && (
            <div style={{ flex: "0 0 auto", borderTop: "1px solid var(--line)", background: "var(--surface, #fff)", display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", overflowX: "auto" }}>
                <button onClick={undo} disabled={!canUndo} className="btn btn-ghost" style={{ fontSize: 13, flexShrink: 0, opacity: canUndo ? 1 : .4 }} title="Deshacer (Ctrl/Cmd + Z)"><Icon name="undo" size={15} /></button>
                <button onClick={redo} disabled={!canRedo} className="btn btn-ghost" style={{ fontSize: 13, flexShrink: 0, opacity: canRedo ? 1 : .4 }} title="Rehacer (Ctrl/Cmd + Shift + Z)"><Icon name="redo" size={15} /></button>
                <span style={{ width: 1, height: 22, background: "var(--line)", margin: "0 2px", flexShrink: 0 }}></span>
                <button onClick={() => setTool("select")} className={"btn " + (tool === "select" ? "btn-primary" : "btn-ghost")} style={{ fontSize: 13, flexShrink: 0 }}><Icon name="sliders" size={15} /> Ajustar</button>
                <button onClick={() => setTool("draw")} className={"btn " + (tool === "draw" ? "btn-primary" : "btn-ghost")} style={{ fontSize: 13, flexShrink: 0 }}><Icon name="plus" size={15} /> Dibujar lote</button>
                <button onClick={() => setTool("general")} className={"btn " + (tool === "general" ? "btn-primary" : "btn-ghost")} style={{ fontSize: 13, flexShrink: 0 }}><Icon name="layers" size={15} /> Polígono general</button>
                <span style={{ width: 1, height: 22, background: "var(--line)", margin: "0 2px", flexShrink: 0 }}></span>
                <button onClick={() => setIman(v => !v)} className={"btn " + (iman ? "btn-primary" : "btn-ghost")} style={{ fontSize: 13, flexShrink: 0 }} title={iman ? "Imán activo: los puntos se pegan a las esquinas vecinas. Mantén Alt para colocar libre." : "Imán desactivado: colocas los puntos donde quieras."}><Icon name="magnet" size={15} /> Imán {iman ? "on" : "off"}</button>
                <div ref={alignBtnRef} style={{ position: "relative", flexShrink: 0 }}>
                  <button onClick={() => setAlignOpen(o => !o)} disabled={tool !== "select"}
                    className={"btn " + (alignOpen ? "btn-primary" : "btn-ghost")} style={{ fontSize: 13, opacity: tool !== "select" ? .45 : 1 }}
                    title="Alinear vértices o lotes, distribuir y fijar ángulos">
                    <Icon name="align" size={15} /> Alinear
                    {alignApi && (alignApi.lotsCount >= 2 || alignApi.vselCount >= 1) &&
                      <span className="mono" style={{ marginLeft: 4, fontSize: 11, opacity: .85 }}>{alignApi.lotsCount >= 2 ? alignApi.lotsCount + " lotes" : alignApi.vselCount}</span>}
                  </button>
                  {alignOpen && tool === "select" && <AlignPanel api={alignApi} anchorRef={alignBtnRef} onClose={() => setAlignOpen(false)} />}
                </div>
                <span style={{ width: 1, height: 22, background: "var(--line)", margin: "0 2px", flexShrink: 0 }}></span>
                <button onClick={() => setVaciar(true)} className="btn btn-ghost" style={{ fontSize: 13, color: "var(--bad-ink)", flexShrink: 0 }}><Icon name="trash" size={15} /> Mapear desde cero</button>
                <span style={{ flex: 1 }}></span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)", padding: "0 12px 9px", lineHeight: 1.45 }}>
                {tool === "draw"
                  ? (iman ? "Click para añadir vértices (se imantan a las esquinas vecinas · Alt = libre). Cierra en el 1° punto, doble-clic o Enter."
                          : "Click para añadir vértices libremente. Cierra en el 1° punto, doble-clic o Enter.")
                  : tool === "general"
                  ? "Dibuja un contorno (ej. una manzana). Al cerrarlo podrás Subdividirlo en lotes."
                  : "Arrastra el lote o sus vértices. Shift+clic en varios vértices o en varios lotes → botón Alinear (filas/columnas, distribuir, ángulos). " + (iman ? "Se imantan a las esquinas vecinas (Alt = libre). " : "") + "Arrastra los rombos para curvar (doble-clic endereza). Doble-clic en un vértice lo elimina."}
              </div>
            </div>
          )}
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
      {reservar && <ReservaModal lote={reservar} quote={reservaQuote} clientes={clientes} cond={cond} moneda={moneda} onClose={() => { setReservar(null); setReservaQuote(null); }} onConfirm={confirmarReserva} />}
    </div>
  );
}

function ReservaModal({ lote, quote, clientes, cond, moneda, onClose, onConfirm }) {
  const precioBase = quote ? quote.precioVenta : lote.precioLista;
  const [nombre, setNombre] = useState("");
  const [tel, setTel] = useState("");
  const [sug, setSug] = useState(false);
  const [dias, setDias] = useState(cond.validezDias || 3);
  const [modo, setModo] = useState(quote ? quote.modo : "financiamiento");
  const [sep, setSep] = useState(() => Math.round(precioBase * 0.02 / 100) * 100);
  const [inicial, setInicial] = useState(() => quote ? quote.inicial : Math.round(precioBase * 0.2 / 100) * 100);
  const [cuotas, setCuotas] = useState(quote && quote.plazo ? quote.plazo : 24);
  const [captacion, setCaptacion] = useState("");
  const [iniPlan, setIniPlan] = useState([]);     // pagos adicionales de la inicial: [{dias, monto}]
  const matches = (clientes || []).filter(c => nombre.trim().length >= 2 && c.nombre.toLowerCase().includes(nombre.trim().toLowerCase())).slice(0, 4);

  const precio = precioBase;
  const tasa = quote && quote.tasa != null ? quote.tasa : (cond.tasaAnualSugerida || 8);
  const D = computePago({ modo, precio, sep, inicial, cuotas, tasa, iniPlan });
  const { inicialPactada, siguientePago, saldoFinanciar, cuotaMensual } = D;

  const ok = nombre.trim().length >= 2 && dias >= 1 && sep >= 0 && !!captacion && (modo === "contado" || cuotas >= 1);
  const opciones = [...new Set([cond.validezDias || 3, 7, 12, 15, 30])].sort((a, b) => a - b);
  const vence = new Date(Date.now() + dias * 86400000);
  function confirmar() {
    onConfirm(lote, { nombre: nombre.trim(), telefono: tel.trim() }, dias, {
      modo, precioVenta: precio, montoSeparacion: sep, inicialPactada, siguientePago, saldoFinanciar,
      cuotas: modo === "financiamiento" ? cuotas : 0, cuotaMensual, tasa, captacion,
      planInicial: D.planInicial, primeraCuotaDias: D.primeraCuotaDias,
    });
  }
  return (
    <Modal onClose={onClose} title="Separar lote" width={520}>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: -6 }}>
        Reserva el lote <b style={{ color: "var(--ink)" }}>{lote.id}</b> (Mz {lote.manzana} · N° {lote.numero}). Vencido el plazo se libera automáticamente.
      </p>
      <div style={{ background: quote ? "var(--primary-050)" : "var(--warn-bg)", border: "1px solid " + (quote ? "var(--primary-100)" : "#f0d6a8"), borderRadius: 12, padding: "10px 14px", margin: "14px 0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: quote ? "var(--primary-700)" : "var(--warn-ink)", fontWeight: 600 }}>{quote ? "Precio de venta (cotización)" : "Precio lista"}</span>
          <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: quote ? "var(--primary-700)" : "var(--warn-ink)" }}>{LIB.money(precioBase, moneda)}</span>
        </div>
        {quote && quote.descuento > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 5, fontSize: 12, color: "var(--muted)" }}>
            <span>Lista {LIB.money(quote.precioTotal, moneda)} · descuento aplicado</span>
            <span className="mono">− {LIB.money(quote.descuento, moneda)}</span>
          </div>
        )}
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

      {/* Pago / negociación */}
      <PagoFields modo={modo} setModo={setModo} sep={sep} setSep={setSep}
        inicial={inicial} setInicial={setInicial} cuotas={cuotas} setCuotas={setCuotas}
        iniPlan={iniPlan} setIniPlan={setIniPlan} precio={precio} tasa={tasa} moneda={moneda} />

      {/* Captación */}
      <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Medio de captación</label>
      <div className="field" style={{ height: 44, marginBottom: 16, position: "relative", paddingRight: 6 }}>
        <select value={captacion} onChange={e => setCaptacion(e.target.value)}
          style={{ border: 0, outline: 0, background: "transparent", flex: 1, fontSize: 14.5, color: captacion ? "var(--ink)" : "var(--muted)", appearance: "none", cursor: "pointer", height: "100%" }}>
          <option value="">¿Cómo llegó el cliente?</option>
          {CAPTACION_OPC.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <Icon name="chevDown" size={16} style={{ color: "var(--faint)", pointerEvents: "none" }} />
      </div>

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
        <button className="btn btn-primary" disabled={!ok} onClick={confirmar}><Icon name="clock" size={15} /> Separar {dias} días</button>
      </div>
    </Modal>
  );
}

const CAPTACION_OPC = ["Feria inmobiliaria", "Redes sociales", "Referido", "Página web", "WhatsApp", "Llamada / Call center", "Volante / Valla", "Visita a oficina", "Campaña / Anuncio", "Otro"];

function MoneyField({ value, onChange, disabled }) {
  return (
    <div className="field field-mono" style={{ height: 44, opacity: disabled ? 0.55 : 1, background: disabled ? "var(--surface-2)" : undefined }}>
      <span style={{ color: "var(--faint)", fontSize: 13 }}>S/</span>
      <input className="mono" inputMode="numeric" disabled={disabled}
        value={value ? value.toLocaleString("es-PE") : ""} placeholder="0"
        onChange={e => onChange(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
        style={disabled ? { cursor: "not-allowed" } : undefined} />
    </div>
  );
}

function PayRow({ k, v, strong }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <span style={{ color: strong ? "var(--ink-2)" : "var(--muted)", fontSize: 12.5, fontWeight: strong ? 600 : 400 }}>{k}</span>
      <span className="mono" style={{ fontWeight: strong ? 800 : 600, fontSize: strong ? 15 : 13, color: strong ? "var(--primary)" : "var(--ink-2)", whiteSpace: "nowrap" }}>{v}</span>
    </div>
  );
}

// Cálculo central de la negociación de pago (se usa al separar y al renegociar).
function computePago({ modo, precio, sep, inicial, cuotas, tasa, iniPlan }) {
  const inicialPactada = modo === "financiamiento" ? inicial : precio;
  const siguientePago = Math.max(0, inicialPactada - sep);
  const saldoFinanciar = modo === "financiamiento" ? Math.max(0, precio - inicial) : 0;
  const cuotaMensual = modo === "financiamiento" && cuotas > 0 ? Math.round(LIB.cuotaMensual(saldoFinanciar, tasa || 0, cuotas)) : 0;
  const plan = iniPlan || [];
  const planTotal = sep + plan.reduce((a, p) => a + (Number(p.monto) || 0), 0);
  const faltanteIni = inicialPactada - planTotal;
  const lastIniDias = plan.length ? Math.max(...plan.map(p => Number(p.dias) || 0)) : 0;
  const primeraCuotaDias = lastIniDias + 30;
  const planInicial = [
    { n: 1, dias: 0, monto: sep, tipo: "separación" },
    ...plan.map((p, i) => ({ n: i + 2, dias: Number(p.dias) || 0, monto: Number(p.monto) || 0, tipo: "inicial" })),
  ];
  return { inicialPactada, siguientePago, saldoFinanciar, cuotaMensual, planTotal, faltanteIni, lastIniDias, primeraCuotaDias, planInicial };
}

// Editor del cronograma de la cuota inicial (separación hoy + pagos parciales).
function PlanIniEditor({ sep, inicialPactada, iniPlan, setIniPlan, moneda }) {
  const [nPartes, setNPartes] = useState(2);
  const [cadaDias, setCadaDias] = useState(15);
  const planTotal = sep + iniPlan.reduce((a, p) => a + (Number(p.monto) || 0), 0);
  const faltante = inicialPactada - planTotal;
  function generar() {
    const resto = Math.max(0, inicialPactada - sep);
    const k = Math.max(1, Math.min(24, nPartes));
    const base = Math.max(0, Math.round(resto / k / 10) * 10);
    const rows = []; let acum = 0;
    for (let i = 0; i < k; i++) {
      const monto = i === k - 1 ? Math.max(0, resto - acum) : base;
      acum += monto;
      rows.push({ dias: cadaDias * (i + 1), monto });
    }
    setIniPlan(rows);
  }
  const setRow = (i, patch) => setIniPlan(rs => rs.map((r, j) => j === i ? { ...r, ...patch } : r));
  const addRow = () => setIniPlan(rs => [...rs, { dias: (rs.length ? Math.max(...rs.map(r => Number(r.dias) || 0)) : 0) + cadaDias, monto: 0 }]);
  const delRow = (i) => setIniPlan(rs => rs.filter((_, j) => j !== i));
  const Cell = ({ children, w }) => <div style={{ width: w, flexShrink: 0 }}>{children}</div>;
  return (
    <div style={{ border: "1px dashed var(--line)", borderRadius: 12, padding: "12px 14px", marginBottom: 14, background: "var(--surface)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span className="kicker" style={{ margin: 0 }}>Plan de la cuota inicial</span>
        <span style={{ fontSize: 11.5, color: "var(--faint)" }}>negociable</span>
      </div>
      <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, margin: "0 0 10px" }}>
        La separación de hoy es el primer pago. Agrega pagos parciales hasta completar la inicial; al terminarla empieza la cuota mensual.
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>Fraccionar el resto en</span>
        <div className="field field-mono" style={{ width: 64, height: 36, padding: "0 8px" }}>
          <input className="mono" type="number" min={1} max={24} value={nPartes} onChange={e => setNPartes(Math.max(1, Math.min(24, Number(e.target.value) || 1)))} />
        </div>
        <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>pagos cada</span>
        <div className="field field-mono" style={{ width: 70, height: 36, padding: "0 8px" }}>
          <input className="mono" type="number" min={1} max={120} value={cadaDias} onChange={e => setCadaDias(Math.max(1, Math.min(120, Number(e.target.value) || 1)))} />
          <span style={{ color: "var(--faint)", fontSize: 11.5 }}>d</span>
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 12.5, color: "var(--primary-700)", padding: "6px 10px" }} onClick={generar}><Icon name="sliders" size={14} /> Generar</button>
      </div>
      {/* Cronograma */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 9, background: "var(--surface-2)" }}>
          <Cell w={70}><span style={{ fontSize: 12, fontWeight: 700 }}>Hoy</span></Cell>
          <Cell w={90}><span style={{ fontSize: 11.5, color: "var(--faint)" }}>separación</span></Cell>
          <div style={{ marginLeft: "auto" }} className="mono">{LIB.money(sep, moneda)}</div>
        </div>
        {iniPlan.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Cell w={70}><span style={{ fontSize: 12.5, fontWeight: 600 }}>Pago {i + 2}</span></Cell>
            <div className="field field-mono" style={{ width: 96, height: 36, padding: "0 8px" }}>
              <input className="mono" type="number" min={1} max={400} value={p.dias} onChange={e => setRow(i, { dias: Math.max(0, Number(e.target.value) || 0) })} />
              <span style={{ color: "var(--faint)", fontSize: 11.5 }}>días</span>
            </div>
            <div style={{ flex: 1 }}><MoneyField value={Number(p.monto) || 0} onChange={v => setRow(i, { monto: v })} /></div>
            <button className="btn btn-ghost btn-danger" style={{ padding: 7 }} onClick={() => delRow(i)}><Icon name="trash" size={14} /></button>
          </div>
        ))}
      </div>
      <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", marginTop: 8, fontSize: 12.5, color: "var(--primary-700)" }} onClick={addRow}><Icon name="plus" size={14} /> Agregar pago parcial</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-2)", fontSize: 12.5 }}>
        <span style={{ color: "var(--muted)" }}>Programado <b className="mono" style={{ color: "var(--ink)" }}>{LIB.money(planTotal, moneda)}</b> / inicial {LIB.money(inicialPactada, moneda)}</span>
        <span className="mono" style={{ fontWeight: 700, color: Math.abs(faltante) < 1 ? "var(--ok-ink)" : "var(--bad-ink)" }}>
          {Math.abs(faltante) < 1 ? "✓ completa" : (faltante > 0 ? "faltan " + LIB.money(faltante, moneda) : "excede " + LIB.money(-faltante, moneda))}
        </span>
      </div>
    </div>
  );
}

// Bloque de campos de pago/negociación, reutilizado al separar y al renegociar.
function PagoFields({ modo, setModo, sep, setSep, inicial, setInicial, cuotas, setCuotas, iniPlan, setIniPlan, precio, setPrecio, precioEditable, tasa, moneda }) {
  const D = computePago({ modo, precio, sep, inicial, cuotas, tasa, iniPlan });
  const hoy = Date.now();
  return (
    <>
      <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Forma de pago</label>
      <div className="segtabs" style={{ marginBottom: 14 }}>
        <button className={modo === "contado" ? "on" : ""} onClick={() => setModo("contado")}>Contado</button>
        <button className={modo === "financiamiento" ? "on" : ""} onClick={() => setModo("financiamiento")}>Fraccionamiento</button>
      </div>
      {precioEditable && (
        <div style={{ marginBottom: 14 }}>
          <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Precio de venta pactado</label>
          <MoneyField value={precio} onChange={setPrecio} />
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Monto de separación</label>
          <MoneyField value={sep} onChange={setSep} />
        </div>
        <div>
          <label className="kicker" style={{ display: "block", marginBottom: 6 }}>{modo === "financiamiento" ? "Cuota inicial pactada" : "Precio al contado"}</label>
          <MoneyField value={D.inicialPactada} onChange={setInicial} disabled={modo !== "financiamiento"} />
        </div>
      </div>
      {modo === "financiamiento" && (
        <div style={{ marginBottom: 14 }}>
          <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Número de cuotas</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[12, 24, 36, 48, 60].map(n => (
              <button key={n} onClick={() => setCuotas(n)}
                style={{ border: "1px solid " + (cuotas === n ? "var(--primary)" : "var(--line)"), background: cuotas === n ? "var(--primary)" : "#fff", color: cuotas === n ? "#fff" : "var(--ink-2)",
                  padding: "8px 14px", borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>{n}</button>
            ))}
            <div className="field field-mono" style={{ width: 120, height: 40 }}>
              <input className="mono" type="number" min={1} max={120} value={cuotas} onChange={e => setCuotas(Math.max(1, Math.min(120, Number(e.target.value) || 1)))} />
              <span style={{ color: "var(--faint)", fontSize: 12.5, paddingRight: 4 }}>cuotas</span>
            </div>
          </div>
        </div>
      )}
      {modo === "financiamiento" && (
        <PlanIniEditor sep={sep} inicialPactada={D.inicialPactada} iniPlan={iniPlan} setIniPlan={setIniPlan} moneda={moneda} />
      )}
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 12, padding: "12px 14px", marginBottom: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <PayRow k="Siguiente pago (inicial restante)" v={LIB.money(D.siguientePago, moneda)} strong />
        {modo === "financiamiento" && <PayRow k="Saldo a financiar" v={LIB.money(D.saldoFinanciar, moneda)} />}
        {modo === "financiamiento" && <PayRow k={"Cuota mensual estimada · " + cuotas + " cuotas"} v={LIB.money(D.cuotaMensual, moneda) + "/mes"} />}
        {modo === "contado" && <PayRow k="Tras la separación, paga el saldo completo" v={LIB.money(D.siguientePago, moneda)} />}
        {modo === "financiamiento" && iniPlan.length > 0 && (
          <PayRow k="1ª cuota mensual estimada" v={LIB.fmtFecha(new Date(hoy + D.primeraCuotaDias * 86400000))} />
        )}
      </div>
    </>
  );
}

// Renegociar una reserva activa: edita toda la cotización pactada y la registra en el historial.
function EditarNegociacionModal({ reserva, moneda, cond, onClose, onSave }) {
  const r = reserva;
  const base = r.precioVenta || r.precioLista || 0;
  const [modo, setModo] = useState(r.modo || "financiamiento");
  const [precio, setPrecio] = useState(base);
  const [sep, setSep] = useState(r.montoSeparacion || 0);
  const [inicial, setInicial] = useState(r.inicialPactada != null ? r.inicialPactada : Math.round(base * 0.2));
  const [cuotas, setCuotas] = useState(r.cuotas || 24);
  const [captacion, setCaptacion] = useState(r.captacion || "");
  const [iniPlan, setIniPlan] = useState(() => (r.planInicial || []).filter(p => p.tipo === "inicial").map(p => ({ dias: p.dias, monto: p.monto })));
  const tasa = r.tasa != null ? r.tasa : (cond.tasaAnualSugerida || 8);
  const D = computePago({ modo, precio, sep, inicial, cuotas, tasa, iniPlan });
  function guardar() {
    onSave({
      modo, precioVenta: precio, montoSeparacion: sep,
      inicialPactada: D.inicialPactada, siguientePago: D.siguientePago, saldoFinanciar: D.saldoFinanciar,
      cuotas: modo === "financiamiento" ? cuotas : 0, cuotaMensual: D.cuotaMensual, tasa, captacion,
      planInicial: D.planInicial, primeraCuotaDias: D.primeraCuotaDias,
    });
  }
  return (
    <Modal onClose={onClose} title={"Negociación · Lote " + r.loteId} width={560}>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: -6, marginBottom: 16 }}>
        Todo es negociable en la reserva. Lo que pactes aquí queda como la <b style={{ color: "var(--ink)" }}>cotización del cliente</b> y se registra en su historial.
      </p>
      <PagoFields modo={modo} setModo={setModo} sep={sep} setSep={setSep}
        inicial={inicial} setInicial={setInicial} cuotas={cuotas} setCuotas={setCuotas}
        iniPlan={iniPlan} setIniPlan={setIniPlan} precio={precio} setPrecio={setPrecio} precioEditable tasa={tasa} moneda={moneda} />
      <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Medio de captación</label>
      <div className="field" style={{ height: 44, marginBottom: 16, position: "relative", paddingRight: 6 }}>
        <select value={captacion} onChange={e => setCaptacion(e.target.value)}
          style={{ border: 0, outline: 0, background: "transparent", flex: 1, fontSize: 14.5, color: captacion ? "var(--ink)" : "var(--muted)", appearance: "none", cursor: "pointer", height: "100%" }}>
          <option value="">¿Cómo llegó el cliente?</option>
          {CAPTACION_OPC.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <Icon name="chevDown" size={16} style={{ color: "var(--faint)", pointerEvents: "none" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={guardar}><Icon name="check" size={15} /> Guardar negociación</button>
      </div>
    </Modal>
  );
}
window.EditarNegociacionModal = EditarNegociacionModal;

const seg = { padding: "8px 16px", display: "flex", gap: 6, alignItems: "center" };

// Panel de alineación arrastrable junto a la barra de edición.
// Modo LOTES (2+ lotes con Shift+clic) → alinea filas/columnas completas.
// Modo VÉRTICES (1 lote) → fija ángulo de un vértice y alinea/distribuye vértices.
function AlignPanel({ api, anchorRef, onClose }) {
  const Glyph = window.AlignGlyph;
  const lots = !!api && api.lotsCount >= 2;
  const vcount = api ? api.vselCount : 0;
  const count = lots ? api.lotsCount : vcount;
  const enough = count >= 2;
  const canDist = count >= 3;
  const apply = (t) => { if (!api) return; (lots ? api.alignLots : api.align)(t); };

  const [ang, setAng] = useState(api && api.angle != null ? api.angle : 90);
  useEffect(() => { if (api && api.angle != null) setAng(api.angle); }, [api && api.angle]);
  const showAngle = !lots && vcount === 1 && api && api.angle != null;

  const Item = ({ type, label, disabled }) => (
    <button className="btn btn-ghost" disabled={disabled}
      style={{ width: "100%", justifyContent: "flex-start", gap: 10, padding: "7px 10px", fontSize: 13, opacity: disabled ? .4 : 1 }}
      onClick={() => apply(type)}>
      <Glyph type={type} /> {label}
    </button>
  );
  const Head = ({ children }) => (
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--faint)", padding: "9px 10px 3px" }}>{children}</div>
  );
  const presets = [45, 90, 120, 135];

  // Posición fija anclada al botón: el dock inferior tiene overflow-x:auto, que
  // recorta cualquier popup que suba por encima de la barra. Con `fixed` evitamos el recorte.
  const [pos, setPos] = useState(null);
  React.useLayoutEffect(() => {
    function place() {
      const el = anchorRef && anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ left: r.left, bottom: window.innerHeight - r.top + 8 });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [anchorRef]);

  // Cierra al hacer clic fuera del panel y del botón ancla.
  const panelRef = useRef(null);
  useEffect(() => {
    const h = e => {
      if (panelRef.current && panelRef.current.contains(e.target)) return;
      if (anchorRef && anchorRef.current && anchorRef.current.contains(e.target)) return;
      onClose && onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [anchorRef, onClose]);

  return (
    <div ref={panelRef} className="card pop poly-cell" style={{ position: "fixed", left: pos ? pos.left : -9999, bottom: pos ? pos.bottom : 0, width: 250, padding: 6, boxShadow: "var(--shadow-lg)", zIndex: 200, whiteSpace: "normal", maxHeight: "70vh", overflowY: "auto", visibility: pos ? "visible" : "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 6px 6px" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{lots ? "Alinear lotes" : "Alinear vértices"}</span>
        <span style={{ fontSize: 11, color: "var(--faint)" }}>{count} sel.</span>
      </div>

      {!enough && !showAngle && (
        <div style={{ fontSize: 12, color: "var(--muted)", padding: "4px 8px 8px", lineHeight: 1.5 }}>
          <b style={{ color: "var(--ink-2)" }}>Shift + clic</b> en los <b>círculos</b> de un lote para alinear sus vértices, o en <b>varios lotes</b> para alinear una fila/columna completa.
        </div>
      )}

      {showAngle && (
        <div style={{ padding: "2px 6px 8px", borderBottom: enough || count >= 1 ? "1px solid var(--line)" : "none", marginBottom: 4 }}>
          <Head>Ángulo del vértice</Head>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "2px 4px" }}>
            <div className="field field-mono" style={{ height: 36, flex: 1 }}>
              <input className="mono" type="number" min={1} max={359} value={ang}
                onChange={e => setAng(Math.max(1, Math.min(359, Number(e.target.value) || 0)))}
                onKeyDown={e => { if (e.key === "Enter") api.setAngle(ang); }}
                style={{ fontWeight: 700, fontSize: 14 }} />
              <span style={{ color: "var(--faint)", fontSize: 12.5, paddingRight: 4 }}>°</span>
            </div>
            <button className="btn btn-primary" style={{ padding: "8px 12px", fontSize: 12.5 }} onClick={() => api.setAngle(ang)}>Aplicar</button>
          </div>
          <div style={{ display: "flex", gap: 5, padding: "6px 4px 0", flexWrap: "wrap" }}>
            {presets.map(d => (
              <button key={d} className="btn btn-ghost" style={{ padding: "4px 9px", fontSize: 12 }}
                onClick={() => { setAng(d); api.setAngle(d); }}>{d}°</button>
            ))}
          </div>
        </div>
      )}

      <Head>Horizontal</Head>
      <Item type="left"  label="Alinear a la izquierda" disabled={!enough} />
      <Item type="cx"    label="Alinear en el centro"   disabled={!enough} />
      <Item type="right" label="Alinear a la derecha"   disabled={!enough} />
      <div style={{ height: 1, background: "var(--line)", margin: "5px 4px" }}></div>
      <Head>Vertical</Head>
      <Item type="top"    label="Alinear arriba" disabled={!enough} />
      <Item type="cy"     label="Alinear al medio" disabled={!enough} />
      <Item type="bottom" label="Alinear abajo" disabled={!enough} />
      <div style={{ height: 1, background: "var(--line)", margin: "5px 4px" }}></div>
      <Head>Distribuir</Head>
      <Item type="distX" label="Distribuir horizontalmente" disabled={!canDist} />
      <Item type="distY" label="Distribuir verticalmente" disabled={!canDist} />
    </div>
  );
}

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
