/* =========================================================
   ADMINISTRADOR DE LOTES
   ========================================================= */

function AdminLotes({ lotes, setLotes, moneda, toast, goPlano, brand }) {
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
      if (i === -1) { toast("Lote " + l.id + " creado", "ok"); return [l, ...ls]; }
      toast("Lote " + l.id + " actualizado", "ok");
      return ls.map(x => x.id === l.id ? l : x);
    });
    setEdit(null);
  }
  function del(l) { setLotes(ls => ls.filter(x => x.id !== l.id)); toast("Lote " + l.id + " eliminado", "bad"); }

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
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} toast={toast} />}
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
  const fields = [
    ["codigo", "Código", "text"], ["manzana", "Manzana", "text"], ["etapa", "Etapa", "text"],
    ["tipologia", "Tipología", "text"], ["area", "Área m²", "num"], ["frente", "Frente m", "num"],
    ["fondo", "Fondo m", "num"], ["orientacion", "Orientación", "text"], ["precioLista", "Precio lista S/", "num"],
  ];
  return (
    <Modal onClose={onClose} title={lote._new ? "Nuevo lote" : "Editar lote " + lote.codigo} width={560}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, padding: "4px 0 8px" }}>
        {fields.map(([k, label, t]) => (
          <label key={k} style={{ display: "block" }}>
            <div className="kicker" style={{ marginBottom: 6 }}>{label}</div>
            <div className={"field " + (t === "num" ? "field-mono" : "")} style={{ height: 42 }}>
              <input type="text" value={f[k]} onChange={e => set(k, t === "num" ? (Number(e.target.value.replace(/[^0-9.]/g, "")) || 0) : e.target.value)} />
            </div>
          </label>
        ))}
        <label style={{ display: "block" }}>
          <div className="kicker" style={{ marginBottom: 6 }}>Estado</div>
          <div className="field" style={{ height: 42 }}>
            <select value={f.estado} onChange={e => set("estado", e.target.value)} style={{ border: 0, background: "transparent", flex: 1, outline: 0, fontSize: 14.5 }}>
              {["disponible", "separado", "vendido"].map(s => <option key={s} value={s}>{LIB.ESTADOS[s].label}</option>)}
            </select>
          </div>
        </label>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSave({ ...f, codigo: f.codigo || f.manzana + f.numero, _new: false })}><Icon name="check" size={16} /> Guardar</button>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose, toast }) {
  function modelo() {
    const csv = "codigo,manzana,etapa,tipologia,area_m2,frente,fondo,lado_der,lado_izq,precio_lista,estado\nA1,A,2DA ETAPA,Esquina,232.43,14,16.6,17.14,17.14,50000,disponible\nA2,A,2DA ETAPA,Lote Residencial,237.72,14,16.98,17.14,17.14,47000,disponible";
    downloadFile("modelo_importacion_lotes.csv", csv, "text/csv");
    toast("Modelo de importación descargado", "ok");
  }
  return (
    <Modal onClose={onClose} title="Importar lotes desde Excel" width={520}>
      <p style={{ color: "var(--muted)", fontSize: 14, marginTop: -4 }}>Sube un archivo .xlsx o .csv con las columnas del modelo. El sistema validará códigos duplicados y precios antes de cargar.</p>
      <button className="btn btn-ghost" onClick={modelo} style={{ color: "var(--primary)", padding: "6px 0", marginBottom: 14 }}><Icon name="download" size={15} /> Descargar modelo de importación</button>
      <div style={{ border: "2px dashed var(--line)", borderRadius: 14, padding: "38px 20px", textAlign: "center", background: "var(--surface-2)" }}>
        <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--primary-050)", color: "var(--primary)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}><Icon name="upload" size={24} /></div>
        <div style={{ fontWeight: 700 }}>Arrastra tu archivo aquí</div>
        <div style={{ fontSize: 13, color: "var(--faint)", marginTop: 4 }}>o haz clic para seleccionar · .xlsx, .csv</div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => { toast("Importación simulada · 0 lotes nuevos", "ok"); onClose(); }}><Icon name="upload" size={15} /> Importar</button>
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
