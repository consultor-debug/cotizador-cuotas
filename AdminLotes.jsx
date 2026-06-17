/* =========================================================
   ADMINISTRADOR DE LOTES
   ========================================================= */

function AdminLotes({ lotes, setLotes, moneda, toast, goPlano, brand, onLog }) {
  const [filtro, setFiltro] = useState("todos");
  const [q, setQ] = useState("");
  const [mz, setMz] = useState("");
  const [etapa, setEtapa] = useState("");
  const [limit, setLimit] = useState(40);
  const [edit, setEdit] = useState(null);     // lote en edición / nuevo
  const [importOpen, setImportOpen] = useState(false);

  const stats = {
    total: lotes.length,
    disponible: lotes.filter(l => l.estado === "disponible").length,
    separado: lotes.filter(l => l.estado === "separado").length,
    vendido: lotes.filter(l => l.estado === "vendido").length,
  };
  const manzanas = [...new Set(lotes.map(l => l.manzana))];
  const etapas = [...new Set(lotes.map(l => l.etapa))];
  const qn = q.trim().toLowerCase();

  const filtered = lotes.filter(l =>
    (filtro === "todos" || l.estado === filtro) &&
    (!mz || l.manzana === mz) && (!etapa || l.etapa === etapa) &&
    (!qn || l.id.toLowerCase().includes(qn) || l.manzana.toLowerCase().includes(qn) || l.tipologia.toLowerCase().includes(qn))
  );
  const shown = filtered.slice(0, limit);

  function save(l) {
    setLotes(ls => {
      const i = ls.findIndex(x => x.id === l.id);
      if (i === -1) { toast("Lote " + l.id + " creado", "ok"); onLog && onLog({ cat: "lote", accion: "crear", detalle: "Lote " + l.id + " creado · " + LIB.money(l.precioLista, "PEN"), ref: l.id }); return [l, ...ls]; }
      const prev = ls[i];
      const cambios = [];
      if (prev.precioLista !== l.precioLista) cambios.push("precio " + LIB.money(prev.precioLista, "PEN") + " → " + LIB.money(l.precioLista, "PEN"));
      if (prev.estado !== l.estado) cambios.push("estado " + prev.estado + " → " + l.estado);
      toast("Lote " + l.id + " actualizado", "ok");
      onLog && onLog({ cat: "lote", accion: "editar", detalle: "Lote " + l.id + " editado" + (cambios.length ? " · " + cambios.join(" · ") : ""), ref: l.id });
      return ls.map(x => x.id === l.id ? l : x);
    });
    setEdit(null);
  }
  function del(l) { setLotes(ls => ls.filter(x => x.id !== l.id)); onLog && onLog({ cat: "lote", accion: "eliminar", detalle: "Lote " + l.id + " eliminado", ref: l.id }); toast("Lote " + l.id + " eliminado", "bad"); }

  function exportCSV() {
    const head = ["codigo", "manzana", "etapa", "tipologia", "area_m2", "frente", "fondo", "lado_der", "lado_izq", "precio_lista", "estado"];
    const rows = filtered.map(l => [l.codigo, l.manzana, l.etapa, l.tipologia, l.area, l.frente, l.fondo, l.ladoDer, l.ladoIzq, l.precioLista, l.estado]);
    const csv = [head, ...rows].map(r => r.join(",")).join("\n");
    downloadFile("lotes.csv", csv, "text/csv");
    toast(filtered.length + " lotes exportados a CSV", "ok");
  }

  const statCards = [
    { k: "todos", n: stats.total, label: "Total", color: "var(--ink)" },
    { k: "disponible", n: stats.disponible, label: "Disponibles", color: "var(--ok-ink)" },
    { k: "separado", n: stats.separado, label: "Separados", color: "var(--warn-ink)" },
    { k: "vendido", n: stats.vendido, label: "Vendidos", color: "var(--bad-ink)" },
  ];

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "26px 36px 60px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button className="btn btn-ghost" onClick={goPlano} style={{ color: "var(--muted)" }}><Icon name="chevLeft" size={16} /> Admin</button>
            <h1 style={{ fontSize: 30 }}>Administrador de Lotes</h1>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" onClick={exportCSV}><Icon name="download" size={15} /> Exportar CSV</button>
            <button className="btn" onClick={() => setImportOpen(true)}><Icon name="upload" size={15} /> Importar Excel</button>
            <button className="btn btn-primary" onClick={() => setEdit(blankLote(lotes))}><Icon name="plus" size={16} /> Nuevo Lote</button>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr", gap: 16, marginBottom: 22 }}>
          <div className="card" style={{ padding: "20px 24px", display: "flex", alignItems: "center" }}>
            <div>
              <div className="kicker">Inventario de lotes</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, marginTop: 4 }}>{brand ? brand.nombre : "Tu Proyecto"}</div>
            </div>
          </div>
          {statCards.map(s => (
            <button key={s.k} onClick={() => setFiltro(s.k)} className="card" style={{ padding: "18px 24px", textAlign: "left",
              border: "1px solid " + (filtro === s.k ? "var(--primary)" : "var(--line)"), boxShadow: filtro === s.k ? "0 0 0 3px var(--primary-050)" : "var(--shadow-sm)", cursor: "pointer" }}>
              <div className="mono" style={{ fontSize: 34, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.n}</div>
              <div style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>{s.label}</div>
            </button>
          ))}
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <div className="field" style={{ width: 300 }}>
            <Icon name="search" size={16} style={{ color: "var(--faint)" }} />
            <input placeholder="Buscar lote o manzana…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <div className="segtabs" style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: 4 }}>
            {["todos", "disponible", "separado", "vendido"].map(k => (
              <button key={k} className={filtro === k ? "on" : ""} style={{ padding: "8px 18px", textTransform: "capitalize" }} onClick={() => setFiltro(k)}>{k === "todos" ? "Todos" : LIB.ESTADOS[k].label}</button>
            ))}
          </div>
          <Select value={mz} onChange={setMz} placeholder="Todas las manzanas" options={manzanas.map(m => ["Manzana " + m, m])} />
          <Select value={etapa} onChange={setEtapa} placeholder="Todas las etapas" options={etapas.map(e => [e, e])} />
          <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 13.5 }} className="mono">{filtered.length} de {lotes.length} lotes</span>
        </div>

        {/* Tabla */}
        <div className="card" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                {["Código", "Etapa", "Tipología", "Área m²", "Frente", "Fondo", "Precio lista", "Estado", ""].map((h, i) => (
                  <th key={i} style={{ textAlign: i >= 3 && i <= 6 ? "right" : "left", padding: "13px 18px", fontSize: 11, fontWeight: 800,
                    letterSpacing: ".07em", textTransform: "uppercase", color: "var(--faint)", borderBottom: "1px solid var(--line)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map(l => {
                const e = LIB.ESTADOS[l.estado];
                return (
                  <tr key={l.id} style={{ borderBottom: "1px solid var(--line-2)" }} className="row-hover">
                    <td style={{ padding: "13px 18px", fontWeight: 700 }}>{l.codigo}</td>
                    <td style={{ padding: "13px 18px", color: "var(--muted)", fontSize: 13.5 }}>{l.etapa}</td>
                    <td style={{ padding: "13px 18px" }}>{l.tipologia}</td>
                    <td className="mono" style={{ padding: "13px 18px", textAlign: "right" }}>{l.area} m²</td>
                    <td className="mono" style={{ padding: "13px 18px", textAlign: "right", color: "var(--muted)" }}>{l.frente}</td>
                    <td className="mono" style={{ padding: "13px 18px", textAlign: "right", color: "var(--muted)" }}>{l.fondo}</td>
                    <td className="mono" style={{ padding: "13px 18px", textAlign: "right", fontWeight: 700, color: "var(--ok-ink)" }}>{LIB.money(l.precioLista, moneda)}</td>
                    <td style={{ padding: "13px 18px" }}><span className={"badge badge-" + e.cls}>{e.label}</span></td>
                    <td style={{ padding: "13px 18px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="btn btn-ghost" style={{ padding: 8 }} onClick={() => setEdit(l)}><Icon name="edit" size={15} /></button>
                      <button className="btn btn-ghost btn-danger" style={{ padding: 8 }} onClick={() => del(l)}><Icon name="trash" size={15} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length > limit && (
            <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", padding: 16, borderRadius: 0 }} onClick={() => setLimit(l => l + 40)}>
              Cargar más · {filtered.length - limit} restantes
            </button>
          )}
          {filtered.length === 0 && <div style={{ padding: 50, textAlign: "center", color: "var(--faint)" }}>Sin resultados.</div>}
        </div>
      </div>

      {edit && <LoteModal lote={edit} onSave={save} onClose={() => setEdit(null)} moneda={moneda} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} toast={toast} lotes={lotes} setLotes={setLotes} onLog={onLog} />}
    </div>
  );
}

function Select({ value, onChange, placeholder, options }) {
  return (
    <div className="field" style={{ width: 230, position: "relative", paddingRight: 6 }}>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ border: 0, outline: 0, background: "transparent", flex: 1, fontSize: 14.5, color: value ? "var(--ink)" : "var(--muted)", appearance: "none", cursor: "pointer", height: "100%" }}>
        <option value="">{placeholder}</option>
        {options.map(([label, v]) => <option key={v} value={v}>{label}</option>)}
      </select>
      <Icon name="chevDown" size={16} style={{ color: "var(--faint)", pointerEvents: "none" }} />
    </div>
  );
}

function blankLote(lotes) {
  return { id: "NEW-" + Date.now(), codigo: "", manzana: "A", numero: 0, etapa: "1RA ETAPA", tipologia: "Lote Residencial",
    area: 150, frente: 8, fondo: 18.75, ladoDer: 17, ladoIzq: 17, orientacion: "Norte", precioLista: 35000, estado: "disponible", _new: true };
}

function LoteModal({ lote, onSave, onClose, moneda }) {
  const [f, setF] = useState(lote);
  const set = (k, v) => setF(s => ({ ...s, [k]: v }));
  const dimsLocked = !!f.dimsAuto;
  const fields = [
    ["codigo", "Código", "text"], ["manzana", "Manzana", "text"], ["etapa", "Etapa", "text"],
    ["tipologia", "Tipología", "text"], ["area", "Área m²", "num"],
    ["frente", "Frente m", "num", true], ["fondo", "Fondo m", "num", true],
    ["ladoIzq", "Lado Izq. m", "num", true], ["ladoDer", "Lado Der. m", "num", true],
    ["orientacion", "Orientación", "text"], ["precioLista", "Precio lista S/", "num"],
  ];
  return (
    <Modal onClose={onClose} title={lote._new ? "Nuevo lote" : "Editar lote " + lote.codigo} width={560}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, padding: "4px 0 8px" }}>
        {fields.map(([k, label, t, dim]) => {
          const locked = dim && dimsLocked;
          return (
            <label key={k} style={{ display: "block", opacity: locked ? 0.6 : 1 }}>
              <div className="kicker" style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>{label}{locked && <Icon name="lock" size={11} style={{ color: "var(--faint)" }} />}</div>
              <div className={"field " + (t === "num" ? "field-mono" : "")} style={{ height: 42, background: locked ? "var(--surface-2)" : undefined }}>
                <input type="text" value={f[k]} readOnly={locked} disabled={locked}
                  onChange={e => set(k, t === "num" ? (Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) : e.target.value)}
                  style={locked ? { color: "var(--muted)", cursor: "not-allowed" } : undefined} />
              </div>
            </label>
          );
        })}
        <label style={{ display: "block" }}>
          <div className="kicker" style={{ marginBottom: 6 }}>Estado</div>
          <div className="field" style={{ height: 42 }}>
            <select value={f.estado} onChange={e => set("estado", e.target.value)} style={{ border: 0, background: "transparent", flex: 1, outline: 0, fontSize: 14.5 }}>
              {["disponible", "separado", "vendido"].map(s => <option key={s} value={s}>{LIB.ESTADOS[s].label}</option>)}
            </select>
          </div>
        </label>
      </div>
      {dimsLocked && (
        <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 13px", marginTop: 4, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.5 }}>
          <Icon name="lock" size={14} style={{ color: "var(--faint)", flexShrink: 0, marginTop: 1 }} />
          <span>Lote generado de forma masiva. Frente, fondo y lados se estiman del polígono del plano y no son editables — en lotes irregulares o con curvas la medida regular no aplica. Edita el <b>Área m²</b> con el valor real del plano si lo necesitas.</span>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSave({ ...f, codigo: f.codigo || f.manzana + f.numero, _new: false })}><Icon name="check" size={16} /> Guardar</button>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose, toast, lotes, setLotes, onLog }) {
  const [rows, setRows] = useState(null);      // filas parseadas
  const [fileName, setFileName] = useState("");
  const [resumen, setResumen] = useState(null); // { actualizados, nuevos }
  const fileRef = useRef(null);

  function modelo() {
    const csv = "codigo,manzana,etapa,tipologia,area_m2,frente,fondo,lado_der,lado_izq,precio_lista,estado\nA1,A,2DA ETAPA,Esquina,232.43,14,16.6,17.14,17.14,50000,disponible\nA2,A,2DA ETAPA,Lote Residencial,237.72,14,16.98,17.14,17.14,47000,disponible";
    downloadFile("modelo_importacion_lotes.csv", csv, "text/csv");
    toast("Modelo de importación descargado", "ok");
  }

  function splitCsvLine(line) {
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if ((c === "," || c === ";") && !q) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur); return out;
  }
  function parseCSV(text) {
    const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim());
    if (!lines.length) return [];
    const head = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase());
    return lines.slice(1).map(line => {
      const cells = splitCsvLine(line); const o = {};
      head.forEach((h, i) => o[h] = (cells[i] == null ? "" : cells[i]).trim());
      return o;
    });
  }

  function onFile(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const name = f.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      toast("Para Excel usa “Guardar como… CSV” y sube ese archivo.", "warn");
      e.target.value = ""; return;
    }
    const rd = new FileReader();
    rd.onload = () => {
      try { const r = parseCSV(String(rd.result)); setRows(r); setFileName(f.name); setResumen(null); if (!r.length) toast("El archivo no tiene filas de datos", "warn"); }
      catch (err) { toast("No se pudo leer el archivo", "bad"); }
    };
    rd.readAsText(f);
    e.target.value = "";
  }

  const num = v => Number(String(v).replace(/[^0-9.\-]/g, "")) || 0;
  const conCodigo = rows ? rows.filter(r => (r.codigo || "").trim()).length : 0;

  function aplicar() {
    if (!rows || !rows.length) return;
    const byCodigo = {}; lotes.forEach(l => { byCodigo[String(l.codigo).toLowerCase().trim()] = l; });
    const updates = {}; const creados = [];
    let actualizados = 0, nuevos = 0;
    rows.forEach(r => {
      const cod = String(r.codigo || "").trim(); if (!cod) return;
      const patch = {};
      if (r.manzana) patch.manzana = r.manzana;
      if (r.etapa) patch.etapa = r.etapa;
      if (r.tipologia) patch.tipologia = r.tipologia;
      if (r.area_m2) patch.area = num(r.area_m2);
      if (r.frente) patch.frente = num(r.frente);
      if (r.fondo) patch.fondo = num(r.fondo);
      if (r.lado_der) patch.ladoDer = num(r.lado_der);
      if (r.lado_izq) patch.ladoIzq = num(r.lado_izq);
      if (r.precio_lista) patch.precioLista = num(r.precio_lista);
      if (r.estado) patch.estado = r.estado;
      // si la lista trae medidas reales, se desbloquea la edición individual
      if (patch.area || patch.frente || patch.fondo || patch.ladoDer || patch.ladoIzq) patch.dimsAuto = false;
      const ex = byCodigo[cod.toLowerCase()];
      if (ex) { updates[ex.id] = { ...(updates[ex.id] || {}), ...patch }; actualizados++; }
      else {
        creados.push({ id: cod, codigo: cod, manzana: patch.manzana || (cod.match(/^[A-Za-z]+/) || ["X"])[0].toUpperCase(),
          numero: num(cod.replace(/\D/g, "")), etapa: patch.etapa || "1RA ETAPA", tipologia: patch.tipologia || "Lote Residencial",
          area: patch.area || 0, frente: patch.frente || 0, fondo: patch.fondo || 0, ladoDer: patch.ladoDer || 0, ladoIzq: patch.ladoIzq || 0,
          orientacion: "Norte", precioLista: patch.precioLista || 0, estado: patch.estado || "disponible" });
        nuevos++;
      }
    });
    setLotes(ls => [...ls.map(l => updates[l.id] ? { ...l, ...updates[l.id] } : l), ...creados]);
    onLog && onLog({ cat: "lote", accion: "importar", detalle: "Importación por Código · " + actualizados + " actualizados · " + nuevos + " nuevos" });
    setResumen({ actualizados, nuevos });
    toast(actualizados + " lotes actualizados · " + nuevos + " nuevos", "ok");
  }

  return (
    <Modal onClose={onClose} title="Importar lista de precios" width={520}>
      <p style={{ color: "var(--muted)", fontSize: 14, marginTop: -4 }}>Sube tu lista (CSV). El sistema enlaza cada fila por <b style={{ color: "var(--ink-2)" }}>Código</b>: si el código ya existe, actualiza sus datos individuales (precio, área, medidas…); si no existe, crea el lote.</p>
      <button className="btn btn-ghost" onClick={modelo} style={{ color: "var(--primary)", padding: "6px 0", marginBottom: 14 }}><Icon name="download" size={15} /> Descargar modelo (.csv)</button>
      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} />
      <button onClick={() => fileRef.current && fileRef.current.click()}
        style={{ width: "100%", border: "2px dashed var(--line)", borderRadius: 14, padding: "30px 20px", textAlign: "center", background: "var(--surface-2)", cursor: "pointer" }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--primary-050)", color: "var(--primary)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Icon name="upload" size={24} /></div>
        <div style={{ fontWeight: 700 }}>{fileName ? fileName : "Haz clic para seleccionar tu CSV"}</div>
        <div style={{ fontSize: 13, color: "var(--faint)", marginTop: 4 }}>{rows ? rows.length + " filas leídas · " + conCodigo + " con código" : "Columna obligatoria: código · resto opcional"}</div>
      </button>

      {rows && !resumen && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 13px", marginTop: 14, fontSize: 13, color: "var(--muted)" }}>
          <Icon name="check" size={15} style={{ color: "var(--ok-ink)" }} /> Se enlazará por código y se actualizarán los lotes existentes.
        </div>
      )}
      {resumen && (
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <div className="card" style={{ flex: 1, padding: "12px 14px", textAlign: "center" }}>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: "var(--ok-ink)" }}>{resumen.actualizados}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>actualizados</div>
          </div>
          <div className="card" style={{ flex: 1, padding: "12px 14px", textAlign: "center" }}>
            <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: "var(--primary)" }}>{resumen.nuevos}</div>
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>nuevos</div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <button className="btn" onClick={onClose}>{resumen ? "Cerrar" : "Cancelar"}</button>
        {!resumen && <button className="btn btn-primary" disabled={!rows || !conCodigo} onClick={aplicar}><Icon name="upload" size={15} /> Importar {conCodigo ? conCodigo + " filas" : ""}</button>}
      </div>
    </Modal>
  );
}

function Modal({ children, title, onClose, width = 540 }) {
  useEffect(() => {
    const h = e => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h);
  }, []);
  return (
    <div onMouseDown={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.42)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div className="card pop" onMouseDown={e => e.stopPropagation()} style={{ width, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", padding: 26, boxShadow: "var(--shadow-lg)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 22 }}>{title}</h2>
          <button className="btn btn-ghost" style={{ padding: 8 }} onClick={onClose}><Icon name="x" size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

Object.assign(window, { AdminLotes, Modal, downloadFile });
