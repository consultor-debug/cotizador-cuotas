/*!
 * Cotizador de Cuotas
 * Copyright (c) 2026 Luis D.. Todos los derechos reservados.
 * Software propietario. Prohibida su copia, distribución o uso sin
 * autorización escrita del titular. Ver archivo LICENSE.
 */

/* =========================================================
   CONDICIONES COMERCIALES
   ========================================================= */

function Condiciones({ cond, setCond, toast, goPlano }) {
  const [draft, setDraft] = useState(JSON.parse(JSON.stringify(cond)));
  const dirty = JSON.stringify(draft) !== JSON.stringify(cond);
  const set = (path, v) => setDraft(d => {
    const n = JSON.parse(JSON.stringify(d)); let o = n;
    const parts = path.split("."); parts.slice(0, -1).forEach(p => o = o[p]); o[parts.at(-1)] = v; return n;
  });

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "26px 36px 60px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button className="btn btn-ghost" onClick={goPlano} style={{ color: "var(--muted)" }}><Icon name="chevLeft" size={16} /> Admin</button>
            <h1 style={{ fontSize: 30 }}>Condiciones Comerciales</h1>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" disabled={!dirty} onClick={() => setDraft(JSON.parse(JSON.stringify(cond)))}><Icon name="reset" size={15} /> Restablecer</button>
            <button className="btn btn-primary" disabled={!dirty} onClick={() => { setCond(draft); toast("Condiciones guardadas · aplican a todo el equipo", "ok"); }}><Icon name="check" size={16} /> Guardar cambios</button>
          </div>
        </div>

        {/* Aviso */}
        <div style={{ display: "flex", gap: 12, background: "var(--primary-050)", border: "1px solid var(--primary-100)", borderRadius: 14, padding: "16px 20px", marginBottom: 22 }}>
          <Icon name="shield" size={20} style={{ color: "var(--primary)", flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 14, color: "var(--ink-2)" }}>
            <b style={{ color: "var(--ink)" }}>Política de descuentos del proyecto.</b> Estos límites se aplican automáticamente en el Cotizador del Plano. Cambios aquí afectan a todo el equipo comercial.
          </div>
        </div>

        {/* Financiamiento */}
        <Section icon="clock" title="Financiamiento">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
            <NumField label="Plazo máximo" value={draft.plazoMaximo} unit="meses" onChange={v => set("plazoMaximo", v)} hint="Los asesores no podrán ofrecer plazos mayores a este." />
            <NumField label="Tasa anual sugerida" value={draft.tasaAnualSugerida} unit="%" onChange={v => set("tasaAnualSugerida", v)} hint="Valor por defecto del slider de tasa en el cotizador." />
          </div>
          <hr className="divider" style={{ margin: "22px 0" }} />
          <NumField label="Juego de planos (monto fijo por lote)" value={draft.juegoPlanos} unit="S/" mono onChange={v => set("juegoPlanos", v)} hint="Se suma al precio lista cuando el asesor activa el checkbox en el cotizador." wide />
        </Section>

        {/* Topes de descuento */}
        <Section icon="dollar" title="Topes de descuento">
          <div className="card" style={{ overflow: "hidden", boxShadow: "none", border: "1px solid var(--line)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", padding: "12px 18px", background: "var(--surface-2)", fontSize: 11, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--faint)", borderBottom: "1px solid var(--line)" }}>
              <span>Nivel</span><span>Contado</span><span>Financiamiento</span><span>Aprobación</span>
            </div>
            <TopeRow color="var(--ok)" title="Descuento estándar" sub="Cualquier asesor puede aplicar"
              contado={<MiniMoney v={draft.topes.estandar.contado} onChange={v => set("topes.estandar.contado", v)} />}
              financ={<MiniMoney v={draft.topes.estandar.financiamiento} onChange={v => set("topes.estandar.financiamiento", v)} />}
              aprob={<span className="badge badge-ok"><span className="dot"></span>Automática</span>} />
            <TopeRow color="var(--warn)" title="Excepción" sub="Espera de aprobación automática"
              contado={<MiniMoney v={draft.topes.excepcion.contado} onChange={v => set("topes.excepcion.contado", v)} />}
              financ={<MiniMoney v={draft.topes.excepcion.financiamiento} onChange={v => set("topes.excepcion.financiamiento", v)} />}
              aprob={<MiniUnit v={draft.topes.excepcion.esperaSeg} unit="seg" onChange={v => set("topes.excepcion.esperaSeg", v)} />} />
            <TopeRow color="var(--bad)" title="Visto Bueno (VB)" sub="Cualquier monto, requiere firma de gerencia"
              contado={<span style={{ color: "var(--faint)", fontSize: 13 }}>Sin tope · requiere VB</span>}
              financ={<span style={{ color: "var(--faint)", fontSize: 13 }}>Sin tope · requiere VB</span>}
              aprob={<MiniUnit v={draft.topes.vb.esperaSeg} unit="seg" onChange={v => set("topes.vb.esperaSeg", v)} />} last />
          </div>
        </Section>

        {/* Aprobadores */}
        <Section icon="users" title="Aprobadores autorizados para VB Gerencial">
          <p style={{ color: "var(--muted)", fontSize: 14, marginTop: -8, marginBottom: 16 }}>Solo estos roles pueden firmar el visto bueno para descuentos sin tope. El sistema registra automáticamente quién aprobó cada operación.</p>
          {draft.aprobadores.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <div className="field" style={{ flex: 1, height: 46 }}>
                <Icon name="shield" size={16} style={{ color: "var(--primary)" }} />
                <input value={a} onChange={e => set("aprobadores." + i, e.target.value)} />
              </div>
              <button className="btn btn-ghost btn-danger" style={{ padding: 11 }} onClick={() => set("aprobadores", draft.aprobadores.filter((_, j) => j !== i))}><Icon name="trash" size={16} /></button>
            </div>
          ))}
          <button className="btn" onClick={() => set("aprobadores", [...draft.aprobadores, "Nuevo rol"])}><Icon name="plus" size={15} /> Agregar aprobador</button>
        </Section>

        {/* Vista previa */}
        <div className="card" style={{ padding: 22, background: "var(--surface-2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, color: "var(--ink-2)", fontWeight: 700 }}><Icon name="eye" size={17} /> Vista previa de las reglas</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
            <Preview title="Asesor puede dar hasta" lines={[<span><b className="mono">{LIB.money(draft.topes.estandar.contado)}</b> contado · <b className="mono">{LIB.money(draft.topes.estandar.financiamiento)}</b> financ.</span>]} />
            <Preview title={"Con excepción (en " + draft.topes.excepcion.esperaSeg + "s)"} lines={[<span><b className="mono">{LIB.money(draft.topes.excepcion.contado)}</b> contado · <b className="mono">{LIB.money(draft.topes.excepcion.financiamiento)}</b> financ.</span>]} />
            <Preview title={"VB gerencial (en " + Math.round(draft.topes.vb.esperaSeg / 60) + " min)"} lines={[<span>Sin tope · {draft.aprobadores.length} aprobadores</span>]} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div className="card" style={{ padding: "24px 26px", marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <Icon name={icon} size={18} style={{ color: "var(--primary)" }} />
        <h2 style={{ fontSize: 21 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}
function NumField({ label, value, unit, onChange, hint, mono, wide }) {
  return (
    <div style={{ maxWidth: wide ? 420 : "none" }}>
      <div className="kicker" style={{ marginBottom: 8 }}>{label}</div>
      <div className={"field " + (mono ? "field-mono" : "")} style={{ height: 50 }}>
        {mono && <span className="pre">{unit}</span>}
        <input type="text" value={mono ? Number(value).toLocaleString("en-US") : value} onChange={e => onChange(Number(e.target.value.replace(/[^0-9.]/g, "")) || 0)} />
        {!mono && <span style={{ background: "var(--bg-2)", padding: "13px 14px", margin: "-13px -12px -13px 0", borderRadius: "0 10px 10px 0", color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>{unit}</span>}
      </div>
      {hint && <div style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 7 }}>{hint}</div>}
    </div>
  );
}
function TopeRow({ color, title, sub, contado, financ, aprob, last }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", alignItems: "center", padding: "16px 18px", borderBottom: last ? "none" : "1px solid var(--line-2)", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span style={{ width: 9, height: 9, borderRadius: 99, background: color, marginTop: 5, flexShrink: 0 }}></span>
        <div><div style={{ fontWeight: 700 }}>{title}</div><div style={{ fontSize: 12.5, color: "var(--faint)" }}>{sub}</div></div>
      </div>
      <div>{contado}</div><div>{financ}</div><div>{aprob}</div>
    </div>
  );
}
function MiniMoney({ v, onChange }) {
  return (
    <div className="field field-mono" style={{ height: 40, width: 140 }}>
      <span className="pre">S/</span>
      <input value={Number(v).toLocaleString("en-US")} onChange={e => onChange(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} />
    </div>
  );
}
function MiniUnit({ v, unit, onChange }) {
  return (
    <div className="field field-mono" style={{ height: 40, width: 110 }}>
      <input value={v} onChange={e => onChange(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)} />
      <span style={{ background: "var(--bg-2)", padding: "10px 11px", margin: "-10px -12px -10px 0", borderRadius: "0 10px 10px 0", color: "var(--muted)", fontSize: 12, fontWeight: 600 }}>{unit}</span>
    </div>
  );
}
function Preview({ title, lines }) {
  return (
    <div className="card" style={{ padding: "14px 16px", boxShadow: "none" }}>
      <div className="kicker" style={{ marginBottom: 8 }}>{title}</div>
      {lines.map((l, i) => <div key={i} style={{ fontSize: 14.5, color: "var(--ink-2)" }}>{l}</div>)}
    </div>
  );
}

Object.assign(window, { Condiciones });
