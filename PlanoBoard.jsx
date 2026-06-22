/*!
 * Cotizador de Cuotas
 * Copyright (c) 2026 Luis D.. Todos los derechos reservados.
 * Software propietario. Prohibida su copia, distribución o uso sin
 * autorización escrita del titular. Ver archivo LICENSE.
 */

/* =========================================================
   PLANO BOARD — lienzo poligónico (con curvas y subdivisión)
   · Fondo: plano subido (img) o esquemático
   · Capa SVG: un <path> por lote (aristas rectas o curvas)
   · Edición: mover/curvar vértices, dibujar lote, dibujar
     "polígono general" y subdividirlo en una grilla de lotes
   ========================================================= */

function PlanoBoard({ lotes, setLotes, polys, setPolys, planoImg, planoOpacity = 1, selId, setSel,
                      matches, active, editMode, tool, setTool, snapOn = true, onAlignApi, toast }) {
  const svgRef = useRef(null);
  const [draft, setDraft] = useState([]);
  const [hover, setHover] = useState(null);
  const [nuevo, setNuevo] = useState(null);   // pts → modal nuevo lote
  const [subdiv, setSubdiv] = useState(null); // poly → modal subdividir
  const [snapPt, setSnapPt] = useState(null); // esquina vecina a la que se imanta el cursor
  const [vsel, setVsel] = useState(() => new Set()); // índices de vértices seleccionados (para alinear)
  const vselRef = useRef(vsel);
  useEffect(() => { vselRef.current = vsel; }, [vsel]);
  const [lotsSel, setLotsSel] = useState(() => new Set()); // lotes seleccionados (alinear fila/columna)
  const lotsSelRef = useRef(lotsSel);
  useEffect(() => { lotsSelRef.current = lotsSel; }, [lotsSel]);
  const drag = useRef(null);
  const lmap = useMemo(() => { const m = {}; lotes.forEach(l => m[l.id] = l); return m; }, [lotes]);
  const genSeq = useRef(1);

  // El imán está activo solo si el toggle está encendido y NO se mantiene Alt
  // (Alt = colocar el punto con total libertad, sin imantar).
  function snapActive(e) { return snapOn && !(e && e.altKey); }

  function clearVsel() { vselRef.current = new Set(); setVsel(new Set()); }
  function clearLots() { lotsSelRef.current = new Set(); setLotsSel(new Set()); }

  useEffect(() => { if (!editMode) { setDraft([]); setHover(null); setSnapPt(null); clearVsel(); clearLots(); } }, [editMode]);
  useEffect(() => { if (tool === "select") { /* mantener selección */ } else { setDraft([]); setHover(null); setSnapPt(null); clearVsel(); clearLots(); } }, [tool]);
  useEffect(() => { clearVsel(); }, [selId]); // cambiar de lote limpia la selección de vértices

  // Reporta el estado de selección hacia arriba para que la barra de edición
  // muestre el panel "Alinear" (arrastrable, fuera del lienzo).
  useEffect(() => {
    if (!onAlignApi) return;
    if (!editMode || tool !== "select") { onAlignApi(null); return; }
    const cur = polys.find(p => p.loteId === selId);
    let angle = null;
    if (vsel.size === 1 && cur) { const vi = [...vsel][0]; if (vi < cur.pts.length) angle = vertexAngle(cur.pts, vi); }
    onAlignApi({ vselCount: vsel.size, lotsCount: lotsSel.size, angle, align: alignVerts, alignLots, setAngle: setVertexAngle });
  }, [vsel, lotsSel, selId, polys, editMode, tool, onAlignApi]);

  function toUser(e) {
    const svg = svgRef.current;
    const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
    const m = svg.getScreenCTM(); if (!m) return [0, 0];
    const u = p.matrixTransform(m.inverse());
    return [Math.round(u.x * 10) / 10, Math.round(u.y * 10) / 10];
  }

  // Imán: devuelve la esquina existente más cercana al cursor (para compartir
  // vértices y alinear lotes). Si no hay ninguna dentro del radio, devuelve u.
  // `avoid` evita pegarse a un punto concreto (p. ej. el vértice recién creado).
  function snapVertex(u, excludeId, avoid) {
    const R = 11;
    let best = null, bd = R;
    for (const p of polys) {
      if (excludeId && p.loteId === excludeId) continue;
      for (const pt of p.pts) {
        if (avoid && PLAN.dist(pt, avoid) < 7) continue; // no pegar al vértice anterior
        const dd = PLAN.dist(u, pt);
        if (dd < bd) { bd = dd; best = pt; }
      }
    }
    return best ? [best[0], best[1]] : u;
  }

  const drawing = editMode && (tool === "draw" || tool === "general");

  // ---- DIBUJAR (lote o general) ----
  // El vértice se coloca con un CLICK (sin arrastre); arrastrar el fondo hace pan del plano.
  function bgClick(e) {
    if (!drawing) return;
    let u = toUser(e);
    if (draft.length >= 3 && PLAN.dist(u, draft[0]) < 12) { cerrarDraft(); return; }
    const prevPt = draft.length ? draft[draft.length - 1] : null;
    if (snapActive(e)) { const s = snapVertex(u, null, prevPt); if (s !== u) u = s; }   // imantar a una esquina vecina (no al punto anterior)
    setDraft(d => [...d, u]);
    setSnapPt(null);
  }
  function bgMove(e) {
    if (!(drawing && draft.length)) return;
    const u = toUser(e);
    const prevPt = draft[draft.length - 1];
    const s = snapActive(e) ? snapVertex(u, null, prevPt) : u;
    setSnapPt(s !== u ? s : null);
    setHover(s !== u ? s : u);
  }
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
      if (e.key === "Escape") { setDraft([]); setHover(null); setSnapPt(null); clearVsel(); clearLots(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editMode, draft, tool]);

  // ---- DRAGS (vértice / mover / curvar) ----
  function startDrag(kind, loteId, idx, group) {
    drag.current = { kind, loteId, idx, group: group || null, last: null, moved: false };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragUp);
  }
  function vertexDown(e, poly, idx) {
    if (tool !== "select") return;
    e.stopPropagation();
    setSel(poly.loteId);
    // Selección múltiple: Shift/Cmd/Ctrl alterna; clic simple selecciona solo ese
    // (salvo que ya forme parte de un grupo, para poder arrastrar el grupo entero).
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    const prev = vselRef.current;
    let next;
    if (additive) { next = new Set(prev); next.has(idx) ? next.delete(idx) : next.add(idx); }
    else if (prev.has(idx) && prev.size > 1) { next = prev; }
    else { next = new Set([idx]); }
    vselRef.current = next; setVsel(next);
    const group = (next.size > 1 && next.has(idx)) ? [...next] : [idx];
    startDrag("vertex", poly.loteId, idx, group);
  }
  function curveDown(e, poly, idx) { if (tool !== "select") return; e.stopPropagation(); setSel(poly.loteId); clearLots(); startDrag("curve", poly.loteId, idx); }
  function polyDown(e, poly) {
    if (!editMode) return;            // vista: el lienzo hace pan; seleccionar va por onClick
    if (tool !== "select") return;
    e.stopPropagation();
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    const prev = lotsSelRef.current;
    if (additive) {                    // Shift+clic: alterna el lote en la selección múltiple (sin arrastrar)
      const next = new Set(prev);
      next.has(poly.loteId) ? next.delete(poly.loteId) : next.add(poly.loteId);
      lotsSelRef.current = next; setLotsSel(next);
      setSel(next.size ? [...next][next.size - 1] : poly.loteId);
      clearVsel();
      return;
    }
    setSel(poly.loteId);
    clearVsel();
    const keepGroup = prev.has(poly.loteId) && prev.size > 1;
    const group = keepGroup ? [...prev] : [poly.loteId];
    if (!keepGroup) { const ns = new Set([poly.loteId]); lotsSelRef.current = ns; setLotsSel(ns); }
    const u = toUser(e);
    drag.current = { kind: "move", loteIds: group, last: u, moved: false };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragUp);
  }
  function onDragMove(e) {
    const d = drag.current; if (!d) return;
    let u = toUser(e);
    if (d.kind === "vertex") {                 // imantar a la esquina de un lote vecino
      if (snapActive(e)) { const s = snapVertex(u, d.loteId); if (s !== u) { u = s; setSnapPt(s); } else setSnapPt(null); }
      else setSnapPt(null);
    }
    let mdx = 0, mdy = 0;
    if (d.kind === "move") {
      if (!d.last) d.last = u;
      mdx = u[0] - d.last[0]; mdy = u[1] - d.last[1]; d.last = u; d.moved = true;
    }
    const moveSet = d.kind === "move" ? new Set(d.loteIds || [d.loteId]) : null;
    setPolys(ps => ps.map(p => {
      if (d.kind === "move") {                 // mover uno o varios lotes a la vez
        if (!moveSet.has(p.loteId)) return p;
        const curves = p.curves ? Object.fromEntries(Object.entries(p.curves).map(([k, c]) => [k, [c[0] + mdx, c[1] + mdy]])) : p.curves;
        return { ...p, pts: p.pts.map(pt => [pt[0] + mdx, pt[1] + mdy]), curves };
      }
      if (p.loteId !== d.loteId) return p;
      if (d.kind === "vertex") {
        const grp = d.group && d.group.length > 1 ? new Set(d.group) : null;
        if (grp) {                              // arrastre en grupo: mueve todos los vértices seleccionados
          const anchor = p.pts[d.idx];
          const dx = u[0] - anchor[0], dy = u[1] - anchor[1];
          return { ...p, pts: p.pts.map((pt, i) => grp.has(i) ? [pt[0] + dx, pt[1] + dy] : pt) };
        }
        return { ...p, pts: p.pts.map((pt, i) => i === d.idx ? u : pt) };
      }
      if (d.kind === "curve") {
        const a = p.pts[d.idx], b = p.pts[(d.idx + 1) % p.pts.length];
        return { ...p, curves: { ...(p.curves || {}), [d.idx]: PLAN.controlThrough(a, b, u) } };
      }
      return p;
    }));
  }
  function onDragUp() {
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragUp);
    drag.current = null;
    setSnapPt(null);
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
    clearVsel(); // los índices seleccionados quedan obsoletos tras borrar
    setPolys(ps => ps.map(p => {
      if (p.loteId !== poly.loteId) return p;
      const nc = {}; Object.entries(p.curves || {}).forEach(([k, v]) => { const ki = +k; if (ki === i) return; nc[ki > i ? ki - 1 : ki] = v; });
      return { ...p, pts: p.pts.filter((_, j) => j !== i), curves: nc };
    }));
  }

  // Alinear / distribuir los vértices seleccionados del lote actual.
  function alignVerts(mode) {
    const idxs = [...vselRef.current];
    if (!selId || idxs.length < 2) return;
    setPolys(ps => ps.map(p => {
      if (p.loteId !== selId) return p;
      if (idxs.some(i => i >= p.pts.length)) return p; // índices obsoletos
      const pts = p.pts.map(pt => [pt[0], pt[1]]);
      const xs = idxs.map(i => pts[i][0]), ys = idxs.map(i => pts[i][1]);
      const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
      if (mode === "left")   { const v = Math.min(...xs); idxs.forEach(i => pts[i][0] = v); }
      if (mode === "cx")     { const v = avg(xs);          idxs.forEach(i => pts[i][0] = v); }
      if (mode === "right")  { const v = Math.max(...xs); idxs.forEach(i => pts[i][0] = v); }
      if (mode === "top")    { const v = Math.min(...ys); idxs.forEach(i => pts[i][1] = v); }
      if (mode === "cy")     { const v = avg(ys);          idxs.forEach(i => pts[i][1] = v); }
      if (mode === "bottom") { const v = Math.max(...ys); idxs.forEach(i => pts[i][1] = v); }
      if (mode === "distX" && idxs.length >= 3) {
        const o = [...idxs].sort((a, b) => pts[a][0] - pts[b][0]);
        const min = pts[o[0]][0], step = (pts[o[o.length - 1]][0] - min) / (o.length - 1);
        o.forEach((i, k) => pts[i][0] = +(min + step * k).toFixed(1));
      }
      if (mode === "distY" && idxs.length >= 3) {
        const o = [...idxs].sort((a, b) => pts[a][1] - pts[b][1]);
        const min = pts[o[0]][1], step = (pts[o[o.length - 1]][1] - min) / (o.length - 1);
        o.forEach((i, k) => pts[i][1] = +(min + step * k).toFixed(1));
      }
      return { ...p, pts: pts.map(pt => [+pt[0].toFixed(1), +pt[1].toFixed(1)]) };
    }));
  }

  // Alinear / distribuir LOTES completos (filas y columnas) por su bounding box.
  function alignLots(mode) {
    const ids = [...lotsSelRef.current];
    if (ids.length < 2) return;
    setPolys(ps => {
      const sel = ps.filter(p => ids.includes(p.loteId));
      const bb = {}; sel.forEach(p => bb[p.loteId] = PLAN.bbox(p.pts));
      const cx = p => bb[p.loteId].x + bb[p.loteId].w / 2;
      const cy = p => bb[p.loteId].y + bb[p.loteId].h / 2;
      const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
      const shift = {};
      if (mode === "left")   { const v = Math.min(...sel.map(p => bb[p.loteId].x));                 sel.forEach(p => shift[p.loteId] = [v - bb[p.loteId].x, 0]); }
      if (mode === "right")  { const v = Math.max(...sel.map(p => bb[p.loteId].x + bb[p.loteId].w)); sel.forEach(p => shift[p.loteId] = [v - (bb[p.loteId].x + bb[p.loteId].w), 0]); }
      if (mode === "cx")     { const v = avg(sel.map(cx));                                            sel.forEach(p => shift[p.loteId] = [v - cx(p), 0]); }
      if (mode === "top")    { const v = Math.min(...sel.map(p => bb[p.loteId].y));                 sel.forEach(p => shift[p.loteId] = [0, v - bb[p.loteId].y]); }
      if (mode === "bottom") { const v = Math.max(...sel.map(p => bb[p.loteId].y + bb[p.loteId].h)); sel.forEach(p => shift[p.loteId] = [0, v - (bb[p.loteId].y + bb[p.loteId].h)]); }
      if (mode === "cy")     { const v = avg(sel.map(cy));                                            sel.forEach(p => shift[p.loteId] = [0, v - cy(p)]); }
      if (mode === "distX" && sel.length >= 3) {
        const o = [...sel].sort((a, b) => cx(a) - cx(b));
        const min = cx(o[0]), step = (cx(o[o.length - 1]) - min) / (o.length - 1);
        o.forEach((p, k) => shift[p.loteId] = [min + step * k - cx(p), 0]);
      }
      if (mode === "distY" && sel.length >= 3) {
        const o = [...sel].sort((a, b) => cy(a) - cy(b));
        const min = cy(o[0]), step = (cy(o[o.length - 1]) - min) / (o.length - 1);
        o.forEach((p, k) => shift[p.loteId] = [0, min + step * k - cy(p)]);
      }
      return ps.map(p => {
        const s = shift[p.loteId]; if (!s) return p;
        const [dx, dy] = s;
        const curves = p.curves ? Object.fromEntries(Object.entries(p.curves).map(([k, c]) => [k, [c[0] + dx, c[1] + dy]])) : p.curves;
        return { ...p, pts: p.pts.map(pt => [+(pt[0] + dx).toFixed(1), +(pt[1] + dy).toFixed(1)]), curves };
      });
    });
  }

  // Fijar el ángulo interior de UN vértice: gira sus dos aristas vecinas alrededor
  // del vértice (conservando longitudes y bisectriz) hasta lograr el ángulo pedido.
  function setVertexAngle(deg) {
    const idxs = [...vselRef.current];
    if (idxs.length !== 1 || !selId) return;
    const i = idxs[0];
    setPolys(ps => ps.map(p => {
      if (p.loteId !== selId) return p;
      const n = p.pts.length; if (n < 3 || i >= n) return p;
      const v = p.pts[i], a = p.pts[(i - 1 + n) % n], b = p.pts[(i + 1) % n];
      const da = [a[0] - v[0], a[1] - v[1]], db = [b[0] - v[0], b[1] - v[1]];
      const la = Math.hypot(da[0], da[1]), lb = Math.hypot(db[0], db[1]);
      if (!la || !lb) return p;
      const ua = [da[0] / la, da[1] / la], ub = [db[0] / lb, db[1] / lb];
      let bis = [ua[0] + ub[0], ua[1] + ub[1]];
      let bl = Math.hypot(bis[0], bis[1]);
      if (bl < 1e-6) { bis = [-ua[1], ua[0]]; bl = 1; } // aristas casi opuestas → usa perpendicular
      bis = [bis[0] / bl, bis[1] / bl];
      const half = (deg * Math.PI / 180) / 2;
      const rot = (vec, ang) => [vec[0] * Math.cos(ang) - vec[1] * Math.sin(ang), vec[0] * Math.sin(ang) + vec[1] * Math.cos(ang)];
      const sgn = (bis[0] * ua[1] - bis[1] * ua[0]) >= 0 ? 1 : -1; // conserva orientación del vértice
      const dirA = rot(bis, sgn * half), dirB = rot(bis, -sgn * half);
      const na = [+(v[0] + dirA[0] * la).toFixed(1), +(v[1] + dirA[1] * la).toFixed(1)];
      const nb = [+(v[0] + dirB[0] * lb).toFixed(1), +(v[1] + dirB[1] * lb).toFixed(1)];
      const ia = (i - 1 + n) % n, ib = (i + 1) % n;
      return { ...p, pts: p.pts.map((pt, k) => k === ia ? na : k === ib ? nb : pt) };
    }));
  }

  // Renombrar el código del lote seleccionado (ej. GG30 → GG50). Reescribe
  // código, manzana, número e id del lote y reapunta el polígono al nuevo id.
  function renombrarLote(poly, raw) {
    const lote = lmap[poly.loteId]; if (!lote) return;
    const code = String(raw).toUpperCase().trim();
    if (!code) return;
    const mz = (code.match(/[A-Z]+/) || [""])[0];
    const num = parseInt((code.match(/\d+/) || [""])[0], 10);
    const manzana = mz || lote.manzana;
    const numero = Number.isFinite(num) && num > 0 ? num : lote.numero;
    const newId = manzana + "-" + String(numero).padStart(2, "0");
    if (newId !== poly.loteId && lotes.some(l => l.id === newId)) {
      toast("Ya existe un lote con código " + code + " (" + newId + ")", "warn");
      return;
    }
    setLotes(ls => ls.map(l => l.id === poly.loteId ? { ...l, id: newId, manzana, numero, codigo: code } : l));
    setPolys(ps => ps.map(p => p.loteId === poly.loteId ? { ...p, loteId: newId } : p));
    if (selId === poly.loteId) setSel(newId);
    toast("Lote renombrado a " + code, "ok");
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
  function aplicarSubdiv(poly, { manzana, cols, rows, etapa, precio, inicio, frente, fondo, ladoIzq, ladoDer }) {
    const cells = PLAN.subdivide(poly, cols, rows);
    const existentes = new Set(lotes.map(l => l.id));
    const nuevosLotes = [], nuevosPolys = [];
    let n = Math.max(1, inicio || 1) - 1;
    cells.forEach((pts) => {
      n++; let numero = n, id = manzana + "-" + String(numero).padStart(2, "0");
      while (existentes.has(id)) { numero++; id = manzana + "-" + String(numero).padStart(2, "0"); }
      existentes.add(id);
      const areaEst = PLAN.estimaArea(pts), frEst = +(Math.sqrt(areaEst * 0.62)).toFixed(2), foEst = +(areaEst / frEst).toFixed(2);
      // Medidas: usa las indicadas en el modal; si van vacías (0) se estiman del polígono
      const fr = frente > 0 ? frente : frEst;
      const fo = fondo > 0 ? fondo : foEst;
      const li = ladoIzq > 0 ? ladoIzq : fo;
      const ld = ladoDer > 0 ? ladoDer : fo;
      const area = (frente > 0 && fondo > 0) ? +(fr * fo).toFixed(2) : areaEst;
      // dimsAuto: medidas masivas/estimadas — bloqueadas en la edición individual
      nuevosLotes.push({ id, codigo: manzana + numero, manzana, numero, etapa, tipologia: "Lote Residencial",
        area, frente: fr, fondo: fo, ladoDer: ld, ladoIzq: li,
        orientacion: "Norte", precioLista: precio, estado: "disponible", dimsAuto: true });
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
        style={{ position: "absolute", inset: 0, cursor: drawing ? "crosshair" : "grab", touchAction: "none" }}>
        <rect x={0} y={0} width={1240} height={684} fill="transparent"
          onPointerMove={bgMove} onClick={bgClick} onDoubleClick={() => draft.length >= 3 && cerrarDraft()} />

        {polys.map(p => {
          const isSel = p.loteId === selId;
          const inMulti = lotsSel.has(p.loteId);
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
              <path d={PLAN.polyPath(p.pts, p.curves)} fill={transp ? "transparent" : (inMulti ? "color-mix(in srgb, var(--primary) 22%, " + e.fill + ")" : e.fill)}
                fillOpacity={transp ? undefined : planoOpacity}
                stroke={(isSel || inMulti) ? "var(--primary)" : (transp ? "rgba(55,60,72,.55)" : e.stroke)} strokeWidth={(isSel || inMulti) ? 2.4 : 1}
                strokeDasharray={transp && !isSel ? "5 4" : undefined}
                onPointerDown={(ev) => polyDown(ev, p)}
                onClick={() => { if (!drawing) setSel(p.loteId); }} />
              {bb.h > 16 && bb.w > 12 && (
                <text x={c[0]} y={c[1]} textAnchor="middle" dominantBaseline="middle"
                  fontSize={5} fontWeight={800}
                  fill={isSel ? "var(--primary)" : e.text}
                  stroke="#fff" strokeWidth={2} paintOrder="stroke" strokeLinejoin="round"
                  style={{ pointerEvents: "none", userSelect: "none" }}>{l.codigo || l.numero}</text>
              )}
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
            {/* vértices (círculos) — los seleccionados se rellenan para alinearlos */}
            {sel.pts.map((pt, i) => {
              const on = vsel.has(i);
              return (
                <circle key={"v" + i} cx={pt[0]} cy={pt[1]} r={on ? 5.6 : 5}
                  fill={on ? "var(--primary)" : "#fff"} stroke="var(--primary)" strokeWidth={2}
                  onPointerDown={(e) => vertexDown(e, sel, i)} onDoubleClick={(e) => delVertex(e, sel, i)} style={{ cursor: "grab" }} />
              );
            })}
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

        {/* Imán: esquina vecina resaltada */}
        {snapPt && (
          <g style={{ pointerEvents: "none" }}>
            <circle cx={snapPt[0]} cy={snapPt[1]} r={8.5} fill="none" stroke="var(--primary)" strokeWidth={1.8} />
            <circle cx={snapPt[0]} cy={snapPt[1]} r={2.4} fill="var(--primary)" />
          </g>
        )}
      </svg>

      {editMode && tool === "select" && sel && (
        <FloatTag poly={sel} lote={lmap[sel.loteId]}
          onDelete={() => eliminar(sel)} onSubdiv={() => setSubdiv(sel)} onRename={renombrarLote} />
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

function FloatTag({ poly, lote, onDelete, onSubdiv, onRename }) {
  const bb = PLAN.bbox(poly.pts);
  const general = poly.general;
  const actual = general ? "" : String((lote && (lote.codigo || lote.numero)) || poly.loteId);
  const [code, setCode] = useState(actual);
  useEffect(() => { setCode(actual); }, [poly.loteId]);
  function commit() {
    const c = code.toUpperCase().trim();
    if (general) return;
    if (c && c !== actual) onRename(poly, c); else setCode(actual);
  }
  return (
    <div className="poly-cell" style={{ position: "absolute", left: bb.x + bb.w / 2, top: bb.y - 12, transform: "translate(-50%,-100%)", zIndex: 6 }}>
      <div className="card pop" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 6px 6px 10px", boxShadow: "var(--shadow-lg)", whiteSpace: "nowrap", position: "relative" }}>
        {general ? (
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>Polígono general</span>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "var(--faint)", fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}>Código</span>
            <div className="field field-mono" style={{ height: 30, width: 96 }}>
              <input className="mono" value={code}
                onChange={e => setCode(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } if (e.key === "Escape") { setCode(actual); e.target.blur(); } }}
                onBlur={commit}
                style={{ fontWeight: 700, fontSize: 13 }} />
            </div>
          </div>
        )}
        <span style={{ fontSize: 11, color: "var(--faint)" }}>{poly.pts.length} vértices</span>
        <button className="btn btn-primary" style={{ padding: "5px 10px", fontSize: 12 }} onClick={onSubdiv}><Icon name="sliders" size={13} /> Subdividir</button>
        <button className="btn btn-danger" style={{ padding: "5px 9px", fontSize: 12 }} onClick={onDelete}><Icon name="trash" size={13} /></button>
      </div>
    </div>
  );
}

// Ángulo interior (grados) del vértice i de un polígono
function vertexAngle(pts, i) {
  const n = pts.length; if (n < 3 || i < 0 || i >= n) return null;
  const v = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
  if (!v || !a || !b) return null;
  const a1 = Math.atan2(a[1] - v[1], a[0] - v[0]);
  const a2 = Math.atan2(b[1] - v[1], b[0] - v[0]);
  let d = Math.abs(a1 - a2) * 180 / Math.PI;
  if (d > 180) d = 360 - d;
  return Math.round(d);
}

// Glifo SVG para cada operación de alineación
function AlignGlyph({ type }) {
  const sw = 1.7, p = { fill: "currentColor", opacity: .9 };
  const line = (x1, y1, x2, y2) => <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />;
  const bar = (x, y, w, h) => <rect x={x} y={y} width={w} height={h} rx={1.5} {...p} />;
  const G = {
    left:   <g>{line(3, 3, 3, 21)}{bar(6, 6, 13, 4)}{bar(6, 14, 8, 4)}</g>,
    cx:     <g>{line(12, 3, 12, 21)}{bar(4, 6, 16, 4)}{bar(7, 14, 10, 4)}</g>,
    right:  <g>{line(21, 3, 21, 21)}{bar(5, 6, 13, 4)}{bar(10, 14, 8, 4)}</g>,
    top:    <g>{line(3, 3, 21, 3)}{bar(6, 6, 4, 13)}{bar(14, 6, 4, 8)}</g>,
    cy:     <g>{line(3, 12, 21, 12)}{bar(6, 4, 4, 16)}{bar(14, 7, 4, 10)}</g>,
    bottom: <g>{line(3, 21, 21, 21)}{bar(6, 5, 4, 13)}{bar(14, 10, 4, 8)}</g>,
    distX:  <g>{bar(4, 5, 3.4, 14)}{bar(10.3, 5, 3.4, 14)}{bar(16.6, 5, 3.4, 14)}</g>,
    distY:  <g>{bar(5, 4, 14, 3.4)}{bar(5, 10.3, 14, 3.4)}{bar(5, 16.6, 14, 3.4)}</g>,
  };
  return <svg width={18} height={18} viewBox="0 0 24 24" fill="none">{G[type]}</svg>;
}
window.AlignGlyph = AlignGlyph;

function AlignMenu({ vselCount, onAlign, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const enough = vselCount >= 2;
  const canDist = vselCount >= 3;
  const Item = ({ type, label, disabled }) => (
    <button className="btn btn-ghost" disabled={disabled}
      style={{ width: "100%", justifyContent: "flex-start", gap: 10, padding: "7px 10px", fontSize: 13, opacity: disabled ? .4 : 1 }}
      onClick={() => { onAlign(type); }}>
      <AlignGlyph type={type} /> {label}
    </button>
  );
  const Head = ({ children }) => (
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--faint)", padding: "8px 10px 3px" }}>{children}</div>
  );
  return (
    <div ref={ref} className="card pop" style={{ position: "absolute", top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", width: 232, padding: 6, boxShadow: "var(--shadow-lg)", zIndex: 30, whiteSpace: "normal" }}>
      {!enough && (
        <div style={{ fontSize: 12, color: "var(--muted)", padding: "8px 10px", lineHeight: 1.5 }}>
          Selecciona <b style={{ color: "var(--ink-2)" }}>2 o más vértices</b> con <b>Shift + clic</b> sobre los círculos para alinearlos.
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
  const [inicio, setInicio] = useState(1);
  const [frente, setFrente] = useState(0);
  const [fondo, setFondo] = useState(0);
  const [ladoIzq, setLadoIzq] = useState(0);
  const [ladoDer, setLadoDer] = useState(0);
  const mzClean = manzana.toUpperCase().trim();
  // Sugerir el siguiente número libre de la manzana elegida
  useEffect(() => {
    const usados = lotes.filter(l => l.manzana === mzClean).map(l => l.numero);
    setInicio((usados.length ? Math.max(...usados) : 0) + 1);
  }, [mzClean]);
  const total = cols * rows;
  const cuad = poly.pts.length === 4;
  return (
    <Modal onClose={onCancel} title="Subdividir en lotes" width={460}>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: -6 }}>
        {cuad ? "Se rellenará el polígono con una grilla que sigue su forma."
              : "El polígono no es un cuadrilátero: se subdividirá sobre su bounding box."}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, margin: "18px 0 10px" }}>
        <SubStepper label="Columnas" value={cols} setValue={setCols} max={100} />
        <SubStepper label="Filas" value={rows} setValue={setRows} max={100} />
      </div>
      <GridPreview cols={cols} rows={rows} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 12, marginTop: 16 }}>
        <div>
          <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Manzana</label>
          <div className="field" style={{ height: 42 }}><input value={manzana} onChange={e => setManzana(e.target.value.slice(0, 2).toUpperCase())} /></div>
        </div>
        <div>
          <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Inicia en N°</label>
          <div className="field field-mono" style={{ height: 42 }}><input className="mono" type="number" min={1} value={inicio} onChange={e => setInicio(Math.max(1, Number(e.target.value) || 1))} /></div>
        </div>
        <div>
          <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Precio base (S/)</label>
          <div className="field field-mono" style={{ height: 42 }}><span className="pre">S/</span><input className="mono" type="number" step={500} value={precio} onChange={e => setPrecio(Number(e.target.value) || 0)} /></div>
        </div>
      </div>
      <div style={{ marginTop: 16 }}>
        <label className="kicker" style={{ display: "block", marginBottom: 7 }}>Medidas por lote (m) · opcional</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 9 }}>
          {[["Frente", frente, setFrente], ["Fondo", fondo, setFondo], ["Lado izq.", ladoIzq, setLadoIzq], ["Lado der.", ladoDer, setLadoDer]].map(([lab, val, setter]) => (
            <div key={lab}>
              <div style={{ fontSize: 11, color: "var(--faint)", fontWeight: 600, marginBottom: 5 }}>{lab}</div>
              <div className="field field-mono" style={{ height: 40 }}><input className="mono" type="number" min={0} step={0.5} placeholder="auto" value={val || ""} onChange={e => setter(Number(e.target.value) || 0)} /></div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>Frente = adelante · Fondo = atrás. Vacío = se estima del polígono. Se aplican a todos los lotes generados.</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>Generará <b className="mono" style={{ color: "var(--ink)" }}>{total}</b> lotes · <span className="mono">{mzClean}{inicio}–{mzClean}{inicio + total - 1}</span></span>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-primary" disabled={!manzana.trim() || total < 1} onClick={() => onApply({ manzana: mzClean, cols, rows, etapa: "1RA ETAPA", precio, inicio, frente, fondo, ladoIzq, ladoDer })}><Icon name="check" size={15} /> Generar {total} lotes</button>
        </div>
      </div>
    </Modal>
  );
}
function SubStepper({ label, value, setValue, min = 1, max = 100 }) {
  const clamp = v => Math.max(min, Math.min(max, v));
  const btn = { padding: 9, width: 42, justifyContent: "center" };
  return (
    <div>
      <label className="kicker" style={{ display: "block", marginBottom: 7 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button type="button" className="btn btn-ghost" style={btn} onClick={() => setValue(v => clamp(v - 1))}><Icon name="minus" size={16} /></button>
        <div className="field field-mono" style={{ height: 44, flex: 1 }}>
          <input className="mono" type="number" min={min} max={max} value={value}
            onChange={e => setValue(clamp(parseInt(e.target.value, 10) || min))}
            style={{ textAlign: "center", fontSize: 17, fontWeight: 700 }} />
        </div>
        <button type="button" className="btn btn-ghost" style={btn} onClick={() => setValue(v => clamp(v + 1))}><Icon name="plus" size={16} /></button>
      </div>
    </div>
  );
}
function GridPreview({ cols, rows }) {
  const vc = Math.max(1, Math.min(cols, 24)), vr = Math.max(1, Math.min(rows, 16));
  const n = vc * vr;
  const clamped = vc < cols || vr < rows;
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(" + vc + ",1fr)", gridTemplateRows: "repeat(" + vr + ",1fr)", gap: 3, height: 104 }}>
        {Array.from({ length: n }).map((_, i) => (
          <div key={i} style={{ background: "var(--ok-bg)", border: "1px solid var(--ok)", borderRadius: 3 }}></div>
        ))}
      </div>
      {clamped && <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 7, textAlign: "center" }}>Vista aproximada · se generarán {cols}×{rows} lotes</div>}
    </div>
  );
}

const selStyle = { border: 0, outline: 0, background: "transparent", width: "100%", height: "100%", padding: "0 12px", fontSize: 15 };

window.PlanoBoard = PlanoBoard;
