/* =========================================================
   PLANO BOARD — lienzo poligónico (con curvas y subdivisión)
   · Fondo: plano subido (img) o esquemático
   · Capa SVG: un <path> por lote (aristas rectas o curvas)
   · Edición: mover/curvar vértices, dibujar lote, dibujar
     "polígono general" y subdividirlo en una grilla de lotes
   ========================================================= */

function PlanoBoard({ lotes, setLotes, polys, setPolys, planoImg, planoOpacity = 1, selId, setSel,
                      matches, active, editMode, tool, setTool, toast }) {
  const svgRef = useRef(null);
  const [draft, setDraft] = useState([]);
  const [hover, setHover] = useState(null);
  const [nuevo, setNuevo] = useState(null);   // pts → modal nuevo lote
  const [subdiv, setSubdiv] = useState(null); // poly → modal subdividir
  const drag = useRef(null);
  const lmap = useMemo(() => { const m = {}; lotes.forEach(l => m[l.id] = l); return m; }, [lotes]);
  const genSeq = useRef(1);

  useEffect(() => { if (!editMode) { setDraft([]); setHover(null); } }, [editMode]);
  useEffect(() => { if (tool === "select") { /* mantener selección */ } else { setDraft([]); setHover(null); } }, [tool]);

  function toUser(e) {
    const svg = svgRef.current;
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const m = svg.getScreenCTM(); if (!m) return [0, 0];
    const u = p.matrixTransform(m.inverse());
    return [Math.round(u.x * 10) / 10, Math.round(u.y * 10) / 10];
  }

  const drawing = editMode && (tool === "draw" || tool === "general");

  // ---- DIBUJAR (lote o general) ----
  function bgPointerDown(e) {
    if (!drawing) return;
    e.stopPropagation();
    const u = toUser(e);
    if (draft.length >= 3 && PLAN.dist(u, draft[0]) < 12) { cerrarDraft(); return; }
    setDraft(d => [...d, u]);
  }
  function bgMove(e) { if (drawing && draft.length) setHover(toUser(e)); }
  function cerrarDraft() {
    if (draft.length < 3) { setDraft([]); return; }
    if (tool === "general") {
      const id = "GEN-" + (genSeq.current++);
      setPolys(ps => [...ps, { loteId: id, general: true, pts: draft }]);
      setSel(id); setTool("select"); setDraft([]); setHover(null);
      toast("Polígono general creado · usa Subdividir para generar lotes", "ok");
    } else {
      setNuevo(draft); setDraft([]); setHover(null);
    }
  }
  useEffect(() => {
    if (!editMode) return;
    const onKey = (e) => {
      if (e.key === "Enter" && draft.length >= 3) cerrarDraft();
      if (e.key === "Escape") { setDraft([]); setHover(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editMode, draft, tool]);

  // ---- DRAGS (vértice / mover / curvar) ----
  function startDrag(kind, loteId, idx) {
    drag.current = { kind, loteId, idx, last: null, moved: false };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragUp);
  }
  function vertexDown(e, poly, idx) { if (tool !== "select") return; e.stopPropagation(); setSel(poly.loteId); startDrag("vertex", poly.loteId, idx); }
  function curveDown(e, poly, idx) { if (tool !== "select") return; e.stopPropagation(); setSel(poly.loteId); startDrag("curve", poly.loteId, idx); }
  function polyDown(e, poly) {
    if (!editMode) return;            // vista: el lienzo hace pan; seleccionar va por onClick
    if (tool !== "select") return;
    e.stopPropagation();
    setSel(poly.loteId);
    const u = toUser(e);
    drag.current = { kind: "move", loteId: poly.loteId, last: u, moved: false };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragUp);
  }
  function onDragMove(e) {
    const d = drag.current; if (!d) return;
    const u = toUser(e);
    setPolys(ps => ps.map(p => {
      if (p.loteId !== d.loteId) return p;
      if (d.kind === "vertex") return { ...p, pts: p.pts.map((pt, i) => i === d.idx ? u : pt) };
      if (d.kind === "curve") {
        const a = p.pts[d.idx], b = p.pts[(d.idx + 1) % p.pts.length];
        return { ...p, curves: { ...(p.curves || {}), [d.idx]: PLAN.controlThrough(a, b, u) } };
      }
      // move
      if (!d.last) d.last = u;
      const dx = u[0] - d.last[0], dy = u[1] - d.last[1]; d.last = u; d.moved = true;
      const curves = p.curves ? Object.fromEntries(Object.entries(p.curves).map(([k, c]) => [k, [c[0] + dx, c[1] + dy]])) : p.curves;
      return { ...p, pts: p.pts.map(pt => [pt[0] + dx, pt[1] + dy]), curves };
    }));
  }
  function onDragUp() {
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragUp);
    drag.current = null;
  }

  // doble-clic en arista: si está curvada → endereza; si recta → inserta vértice
  function toggleEdge(e, poly, i) {
    e.stopPropagation();
    setPolys(ps => ps.map(p => {
      if (p.loteId !== poly.loteId) return p;
      const cur = p.curves || {};
      if (cur[i]) { const nc = { ...cur }; delete nc[i]; return { ...p, curves: nc }; }
      const a = p.pts[i], b = p.pts[(i + 1) % p.pts.length];
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const nc = {}; Object.entries(cur).forEach(([k, v]) => { const ki = +k; nc[ki > i ? ki + 1 : ki] = v; });
      return { ...p, pts: [...p.pts.slice(0, i + 1), mid, ...p.pts.slice(i + 1)], curves: nc };
    }));
  }
  function delVertex(e, poly, i) {
    e.stopPropagation();
    if (poly.pts.length <= 3) { toast("Un polígono necesita al menos 3 vértices", "warn"); return; }
    setPolys(ps => ps.map(p => {
      if (p.loteId !== poly.loteId) return p;
      const nc = {}; Object.entries(p.curves || {}).forEach(([k, v]) => { const ki = +k; if (ki === i) return; nc[ki > i ? ki - 1 : ki] = v; });
      return { ...p, pts: p.pts.filter((_, j) => j !== i), curves: nc };
    }));
  }

  function eliminar(poly) {
    setPolys(ps => ps.filter(p => p.loteId !== poly.loteId));
    if (!poly.general) setLotes(ls => ls.filter(l => l.id !== poly.loteId));
    if (selId === poly.loteId) setSel(null);
    toast((poly.general ? "Polígono general" : "Lote " + poly.loteId) + " eliminado", "warn");
  }

  function crearLote(fields) {
    const l = {
      id: fields.id, codigo: fields.manzana + fields.numero, manzana: fields.manzana,
      numero: fields.numero, etapa: fields.etapa, tipologia: fields.tipologia,
      area: fields.area, frente: fields.frente, fondo: fields.fondo,
      ladoDer: fields.frente, ladoIzq: fields.frente,
      orientacion: fields.orientacion, precioLista: fields.precioLista, estado: "disponible",
    };
    setLotes(ls => [...ls, l]);
    setPolys(ps => [...ps, { loteId: l.id, pts: nuevo }]);
    setNuevo(null); setSel(l.id); setTool("select");
    toast("Lote " + l.id + " creado · " + LIB.money(l.precioLista, "PEN"), "ok");
  }

  // subdividir un polígono (general o lote) en cols×rows lotes
  function aplicarSubdiv(poly, { manzana, cols, rows, etapa, precio }) {
    const cells = PLAN.subdivide(poly, cols, rows);
    const existentes = new Set(lotes.map(l => l.id));
    const nuevosLotes = [], nuevosPolys = [];
    let n = 0;
    cells.forEach((pts) => {
      n++; let numero = n, id = manzana + "-" + String(numero).padStart(2, "0");
      while (existentes.has(id)) { numero++; id = manzana + "-" + String(numero).padStart(2, "0"); }
      existentes.add(id);
      const area = PLAN.estimaArea(pts), frente = +(Math.sqrt(area * 0.62)).toFixed(2);
      nuevosLotes.push({ id, codigo: manzana + numero, manzana, numero, etapa, tipologia: "Lote Residencial",
        area, frente, fondo: +(area / frente).toFixed(2), ladoDer: frente, ladoIzq: frente,
        orientacion: "Norte", precioLista: precio, estado: "disponible" });
      nuevosPolys.push({ loteId: id, pts });
    });
    setLotes(ls => [...ls, ...nuevosLotes]);
    setPolys(ps => [...ps.filter(p => p.loteId !== poly.loteId), ...nuevosPolys]);
    setSubdiv(null); setSel(null);
    toast(nuevosLotes.length + " lotes generados en manzana " + manzana, "ok");
  }

  const sel = polys.find(p => p.loteId === selId);

  return (
    <div style={{ position: "relative", width: 1240, height: 684 }}>
      {planoImg
        ? <img src={planoImg} alt="Plano del proyecto" draggable={false}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", borderRadius: 10, background: "#fff", userSelect: "none" }} />
        : <SchematicBg />}

      <svg ref={svgRef} viewBox="0 0 1240 684" width={1240} height={684}
        style={{ position: "absolute", inset: 0, cursor: editMode ? (drawing ? "crosshair" : "default") : "grab", touchAction: "none" }}>
        <rect x={0} y={0} width={1240} height={684} fill="transparent"
          onPointerDown={bgPointerDown} onPointerMove={bgMove} onDoubleClick={() => draft.length >= 3 && cerrarDraft()} />

        {polys.map(p => {
          const isSel = p.loteId === selId;
          if (p.general) {
            return (
              <path key={p.loteId} d={PLAN.polyPath(p.pts, p.curves)}
                fill="color-mix(in srgb, var(--primary) 8%, transparent)"
                stroke="var(--primary)" strokeWidth={isSel ? 2.4 : 1.6} strokeDasharray="7 5"
                onPointerDown={(ev) => polyDown(ev, p)} onClick={() => { if (!drawing) setSel(p.loteId); }}
                style={{ cursor: "pointer" }} />
            );
          }
          const l = lmap[p.loteId]; if (!l) return null;
          const e = LIB.ESTADOS[l.estado] || LIB.ESTADOS.disponible;
          const transp = !!l.transparente;
          const on = !active || matches(l);
          const c = PLAN.centroid(p.pts), bb = PLAN.bbox(p.pts);
          return (
            <g key={p.loteId} opacity={on ? 1 : 0.2} style={{ cursor: "pointer" }}>
              <path d={PLAN.polyPath(p.pts, p.curves)} fill={transp ? "transparent" : e.fill}
                fillOpacity={transp ? undefined : planoOpacity}
                stroke={isSel ? "var(--primary)" : (transp ? "rgba(55,60,72,.55)" : e.stroke)} strokeWidth={isSel ? 2.4 : 1}
                strokeDasharray={transp && !isSel ? "5 4" : undefined}
                onPointerDown={(ev) => polyDown(ev, p)}
                onClick={() => { if (!drawing) setSel(p.loteId); }} />
              {bb.h > 16 && bb.w > 12 && <text x={c[0]} y={c[1] + 2.6} textAnchor="middle" fontSize={8} fontWeight={700}
                fill={transp ? "#2f3440" : e.text}
                stroke={transp ? "#fff" : undefined} strokeWidth={transp ? 2.4 : undefined} paintOrder={transp ? "stroke" : undefined}
                style={{ pointerEvents: "none", userSelect: "none" }}>{l.numero}</text>}
            </g>
          );
        })}

        {/* Mangos de edición del polígono seleccionado */}
        {editMode && tool === "select" && sel && (
          <g>
            {/* mangos de curva (rombos) en cada arista */}
            {sel.pts.map((_, i) => {
              const h = PLAN.edgeHandle(sel, i);
              const curved = sel.curves && sel.curves[i];
              return (
                <rect key={"e" + i} x={h[0] - 3.4} y={h[1] - 3.4} width={6.8} height={6.8}
                  transform={`rotate(45 ${h[0]} ${h[1]})`}
                  fill={curved ? "var(--primary)" : "#fff"} stroke="var(--primary)" strokeWidth={1.6}
                  onPointerDown={(e) => curveDown(e, sel, i)} onDoubleClick={(e) => toggleEdge(e, sel, i)}
                  style={{ cursor: "grab" }} />
              );
            })}
            {/* vértices (círculos) */}
            {sel.pts.map((pt, i) => (
              <circle key={"v" + i} cx={pt[0]} cy={pt[1]} r={5} fill="#fff" stroke="var(--primary)" strokeWidth={2}
                onPointerDown={(e) => vertexDown(e, sel, i)} onDoubleClick={(e) => delVertex(e, sel, i)} style={{ cursor: "grab" }} />
            ))}
          </g>
        )}

        {/* Borrador en construcción */}
        {draft.length > 0 && (
          <g style={{ pointerEvents: "none" }}>
            <polyline points={PLAN.toPath(hover ? [...draft, hover] : draft)}
              fill={tool === "general" ? "color-mix(in srgb, var(--primary) 8%, transparent)" : "rgba(47,91,215,.12)"}
              stroke="var(--primary)" strokeWidth={1.6} strokeDasharray="5 4" />
            {draft.map((pt, i) => <circle key={i} cx={pt[0]} cy={pt[1]} r={i === 0 ? 5.5 : 4} fill={i === 0 ? "var(--primary)" : "#fff"} stroke="var(--primary)" strokeWidth={2} />)}
          </g>
        )}
      </svg>

      {editMode && tool === "select" && sel && (
        <FloatTag poly={sel} lote={lmap[sel.loteId]} onDelete={() => eliminar(sel)} onSubdiv={() => setSubdiv(sel)} />
      )}

      {nuevo && <NuevoLoteModal pts={nuevo} lotes={lotes} onCancel={() => setNuevo(null)} onCreate={crearLote} />}
      {subdiv && <SubdividirModal poly={subdiv} lotes={lotes} onCancel={() => setSubdiv(null)} onApply={(opts) => aplicarSubdiv(subdiv, opts)} />}
    </div>
  );
}

function SchematicBg() {
  // Lienzo limpio: solo los lotes. Sin amenities, ingreso ni rótulos.
  return <div style={{ position: "absolute", inset: 0, borderRadius: 10, background: "#ffffff" }}></div>;
}
function Amenity({ a }) {
  const s = {
    park:   { label: "Parque",  icon: "🌳" },
    pool:   { label: "Piscina", icon: "🏊" },
    soccer: { label: "Cancha",  icon: "⚽" },
  }[a.kind];
  return (
    <div style={{ position: "absolute", left: a.x, top: a.y, width: a.w, height: a.h,
      background: "#f5f7f9", border: "1px solid #e4e8ee", borderRadius: 8,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: a.kind === "park" ? 22 : 16, opacity: .85 }}>{s.icon}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#8a93a1", letterSpacing: ".04em", marginTop: 3, textTransform: "uppercase" }}>{a.label}</div>
    </div>
  );
}

function FloatTag({ poly, lote, onDelete, onSubdiv }) {
  const bb = PLAN.bbox(poly.pts);
  const general = poly.general;
  return (
    <div className="poly-cell" style={{ position: "absolute", left: bb.x + bb.w / 2, top: bb.y - 12, transform: "translate(-50%,-100%)", zIndex: 6 }}>
      <div className="card pop" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 6px 6px 12px", boxShadow: "var(--shadow-lg)", whiteSpace: "nowrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{general ? "Polígono general" : "Lote " + poly.loteId}</span>
        <span style={{ fontSize: 11, color: "var(--faint)" }}>{poly.pts.length} vértices</span>
        <button className="btn btn-primary" style={{ padding: "5px 10px", fontSize: 12 }} onClick={onSubdiv}><Icon name="sliders" size={13} /> Subdividir</button>
        <button className="btn btn-danger" style={{ padding: "5px 9px", fontSize: 12 }} onClick={onDelete}><Icon name="trash" size={13} /></button>
      </div>
    </div>
  );
}

function NuevoLoteModal({ pts, lotes, onCancel, onCreate }) {
  const usados = lotes.filter(l => l.manzana === "P").map(l => l.numero);
  const sugNum = (usados.length ? Math.max(...usados) : 0) + 1;
  const areaEst = PLAN.estimaArea(pts);
  const frenteEst = +(Math.sqrt(areaEst * 0.62)).toFixed(2);
  const [manzana, setManzana] = useState("P");
  const [numero, setNumero] = useState(sugNum);
  const [tipologia, setTipologia] = useState("Lote Residencial");
  const [precio, setPrecio] = useState(Math.round(areaEst * 230 / 100) * 100);
  const id = manzana.toUpperCase().trim() + "-" + String(numero).padStart(2, "0");
  const dup = lotes.some(l => l.id === id);
  const fondoEst = +(areaEst / frenteEst).toFixed(2);
  return (
    <Modal onClose={onCancel} title="Nuevo lote" width={440}>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: -6 }}>
        Polígono de {pts.length} vértices · superficie estimada <b className="mono" style={{ color: "var(--ink-2)" }}>{areaEst} m²</b>.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
        <div>
          <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Manzana</label>
          <div className="field" style={{ height: 42 }}><input value={manzana} onChange={e => setManzana(e.target.value.slice(0, 2))} /></div>
        </div>
        <div>
          <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Número</label>
          <div className="field field-mono" style={{ height: 42 }}><input className="mono" type="number" min={1} value={numero} onChange={e => setNumero(Number(e.target.value) || 1)} /></div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Tipología</label>
        <div className="field" style={{ height: 42, padding: 0 }}>
          <select value={tipologia} onChange={e => setTipologia(e.target.value)} style={selStyle}>
            {["Lote Residencial", "Esquina", "Esquina + Av. Principal", "Frente a parque", "Lote Comercial"].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Precio lista (S/)</label>
        <div className="field field-mono" style={{ height: 42 }}><span className="pre">S/</span><input className="mono" type="number" step={500} value={precio} onChange={e => setPrecio(Number(e.target.value) || 0)} /></div>
      </div>
      {dup && <div style={{ color: "var(--bad-ink)", fontSize: 12.5, marginTop: 10, fontWeight: 600 }}>Ya existe el lote {id}. Cambia manzana o número.</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <button className="btn" onClick={onCancel}>Cancelar</button>
        <button className="btn btn-primary" disabled={dup || !manzana.trim()} onClick={() => onCreate({
          id, manzana: manzana.toUpperCase().trim(), numero, etapa: "1RA ETAPA", tipologia,
          area: areaEst, frente: frenteEst, fondo: fondoEst, orientacion: "Norte", precioLista: precio,
        })}><Icon name="plus" size={15} /> Crear lote</button>
      </div>
    </Modal>
  );
}

function SubdividirModal({ poly, lotes, onCancel, onApply }) {
  const letrasUsadas = [...new Set(lotes.map(l => l.manzana))];
  const sugManzana = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find(c => !letrasUsadas.includes(c)) || "Z";
  const [manzana, setManzana] = useState(sugManzana);
  const [cols, setCols] = useState(4);
  const [rows, setRows] = useState(3);
  const [precio, setPrecio] = useState(38000);
  const total = cols * rows;
  const cuad = poly.pts.length === 4;
  return (
    <Modal onClose={onCancel} title="Subdividir en lotes" width={460}>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: -6 }}>
        {cuad ? "Se rellenará el polígono con una grilla que sigue su forma."
              : "El polígono no es un cuadrilátero: se subdividirá sobre su bounding box."}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, margin: "18px 0 6px" }}>
        <SubSlider label="Columnas" value={cols} setValue={setCols} max={30} />
        <SubSlider label="Filas" value={rows} setValue={setRows} max={30} />
      </div>
      <GridPreview cols={cols} rows={rows} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
        <div>
          <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Manzana</label>
          <div className="field" style={{ height: 42 }}><input value={manzana} onChange={e => setManzana(e.target.value.slice(0, 2).toUpperCase())} /></div>
        </div>
        <div>
          <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Precio base (S/)</label>
          <div className="field field-mono" style={{ height: 42 }}><span className="pre">S/</span><input className="mono" type="number" step={500} value={precio} onChange={e => setPrecio(Number(e.target.value) || 0)} /></div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>Generará <b className="mono" style={{ color: "var(--ink)" }}>{total}</b> lotes</span>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-primary" disabled={!manzana.trim() || total < 1} onClick={() => onApply({ manzana: manzana.toUpperCase().trim(), cols, rows, etapa: "1RA ETAPA", precio })}><Icon name="check" size={15} /> Generar {total} lotes</button>
        </div>
      </div>
    </Modal>
  );
}
function SubSlider({ label, value, setValue, max = 12 }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-2)" }}>{label}</span>
        <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{value}</span>
      </div>
      <input type="range" min={1} max={max} value={value} style={{ width: "100%" }} onChange={e => setValue(Number(e.target.value))} />
    </div>
  );
}
function GridPreview({ cols, rows }) {
  const n = Math.max(0, cols) * Math.max(0, rows);
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(" + cols + ",1fr)", gridTemplateRows: "repeat(" + rows + ",1fr)", gap: 3, height: 104 }}>
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} style={{ background: "var(--ok-bg)", border: "1px solid var(--ok)", borderRadius: 3 }}></div>
        ))}
      </div>
    </div>
  );
}

const selStyle = { border: 0, outline: 0, background: "transparent", width: "100%", height: "100%", padding: "0 12px", fontSize: 15 };

window.PlanoBoard = PlanoBoard;
