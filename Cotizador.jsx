/* =========================================================
   COTIZADOR — panel de precio / descuento / financiamiento
   ========================================================= */
const { useState, useEffect, useMemo, useRef } = React;

function Money({ pen, moneda, big, className }) {
  return <span className={"mono " + (className || "")}>{LIB.money(pen, moneda)}</span>;
}

/* Control de monto con entrada manual S/ y slider en % — sincronizados */
function MontoPctControl({ label, valuePEN, basePEN, onChange, moneda, accentMax, hint, disabled }) {
  const pctVal = basePEN > 0 ? (valuePEN / basePEN) * 100 : 0;
  return (
    <div style={{ opacity: disabled ? .5 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-2)" }}>{label}</span>
        <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>{LIB.pct(pctVal)}</span>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div className="field field-mono" style={{ width: 168, height: 42 }}>
          <span className="pre">{moneda === "USD" ? "$" : "S/"}</span>
          <input className="mono" type="text" inputMode="numeric"
            value={Math.round(moneda === "USD" ? valuePEN / LIB.TC() : valuePEN).toLocaleString("en-US")}
            onChange={(e) => {
              const raw = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
              onChange(moneda === "USD" ? raw * LIB.TC() : raw);
            }} />
        </div>
        <input type="range" min={0} max={accentMax || basePEN} step={Math.max(50, Math.round(basePEN / 200))}
          value={Math.min(valuePEN, accentMax || basePEN)} style={{ flex: 1 }}
          onChange={(e) => onChange(Number(e.target.value))} />
      </div>
      {hint && <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

function Cotizador({ lote, cond, asesor, moneda, onAction, onEnviar }) {
  const [tab, setTab] = useState("financiamiento");
  const [planosOn, setPlanosOn] = useState(true);
  const [desc, setDesc] = useState(0);
  const [inicial, setInicial] = useState(0);
  const [plazo, setPlazo] = useState(24);
  const [tasa, setTasa] = useState(cond.tasaAnualSugerida);
  const [verPlan, setVerPlan] = useState(false);
  const [aprob, setAprob] = useState({ state: "idle", by: null, left: 0 });
  const timer = useRef(null);

  // Reset al cambiar de lote
  useEffect(() => {
    setDesc(0); setInicial(Math.round(lote.precioLista * 0.2));
    setPlazo(24); setTab("financiamiento"); setPlanosOn(true);
    setAprob({ state: "idle", by: null, left: 0 });
  }, [lote.id]);

  const juego = planosOn ? cond.juegoPlanos : 0;
  const precioTotal = lote.precioLista + juego;
  const descuento = Math.min(desc, precioTotal);
  const precioVenta = precioTotal - descuento;
  const saldo = Math.max(0, precioVenta - Math.min(inicial, precioVenta));

  // Topes
  const capStd = tab === "contado" ? cond.topes.estandar.contado : cond.topes.estandar.financiamiento;
  const capExc = tab === "contado" ? cond.topes.excepcion.contado : cond.topes.excepcion.financiamiento;
  const nivel = descuento <= capStd ? "estandar" : descuento <= capExc ? "excepcion" : "vb";

  // Reset aprobación cuando cambia el nivel/descuento
  useEffect(() => {
    if (nivel === "estandar") { setAprob({ state: "idle", by: null, left: 0 }); }
    else { setAprob((a) => a.state === "approved" ? { state: "idle", by: null, left: 0 } : a); }
    // eslint-disable-next-line
  }, [nivel, Math.round(descuento / 50)]);

  useEffect(() => () => clearInterval(timer.current), []);

  function solicitar() {
    const segs = nivel === "excepcion" ? cond.topes.excepcion.esperaSeg : cond.topes.vb.esperaSeg;
    const by = nivel === "excepcion" ? "Aprobación automática" : "Daniela Ríos · SubGerente Comercial";
    setAprob({ state: "pending", by, left: segs });
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      setAprob((a) => {
        if (a.left <= 1) { clearInterval(timer.current); return { state: "approved", by, left: 0 }; }
        return { ...a, left: a.left - 1 };
      });
    }, 1000);
  }
  // demo: acelerar la espera
  function aprobarYa() { clearInterval(timer.current); setAprob((a) => ({ state: "approved", by: a.by, left: 0 })); }

  const requiereAprob = nivel !== "estandar";
  const bloqueado = requiereAprob && aprob.state !== "approved";

  const plan = useMemo(() => LIB.planPagos(saldo, tasa, plazo), [saldo, tasa, plazo]);

  function buildQuote() {
    return {
      lote, asesor, moneda, fecha: LIB.todayPlus(0), valida: LIB.todayPlus(cond.validezDias),
      modo: tab, planosOn, juego, precioLista: lote.precioLista, precioTotal, descuento, precioVenta,
      inicial: Math.min(inicial, precioVenta), saldo, plazo, tasa,
      cuota: plan.cuota, totalFin: plan.total, nivel,
      aprobadoPor: requiereAprob ? aprob.by : null,
      tipoCambio: cond.tipoCambio,
    };
  }

  const est = LIB.ESTADOS[lote.estado];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header del lote (fijo y compacto) */}
      <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid var(--line-2)", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="kicker" style={{ color: "var(--primary)" }}>Lote {lote.id}</div>
            <h2 style={{ fontSize: 25, marginTop: 4 }}>Manzana {lote.manzana} · N° {lote.numero}</h2>
          </div>
          <span className={"badge badge-" + est.cls}><span className="dot"></span>{est.label}</span>
        </div>
      </div>

      {/* Cuerpo scrolleable */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 24px 16px" }}>
        {/* Ficha técnica del lote */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px", marginBottom: 18 }}>
          {[["Superficie", lote.area + " m²"], ["Frente", lote.frente + " m"],
            ["Fondo", lote.fondo + " m"], ["Orientación", lote.orientacion],
            ["Tipología", lote.tipologia], ["Etapa", lote.etapa]].map(([k, v]) => (
            <div key={k}>
              <div className="kicker" style={{ fontSize: 10.5 }}>{k}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
        {/* Resumen de precio */}
        <div style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 16, padding: "18px 20px", marginTop: 4 }}>
          <PriceLine label="Precio lista" value={lote.precioLista} moneda={moneda} />
          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "10px 0", cursor: "pointer" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Check on={planosOn} onClick={() => setPlanosOn(v => !v)} />
              <span style={{ fontSize: 14.5, color: "var(--ink-2)", fontWeight: 600 }}>Juego de planos</span>
            </span>
            <Money pen={juego} moneda={moneda} className="" />
          </label>
          <hr className="divider" style={{ margin: "12px 0" }} />
          <PriceLine label="Precio total" value={precioTotal} moneda={moneda} strong />
          {descuento > 0 && <PriceLine label="Descuento" value={-descuento} moneda={moneda} accent="var(--bad-ink)" />}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--muted)" }}>Precio de venta</span>
            <Money pen={precioVenta} moneda={moneda} className="" />
          </div>
          <div style={{ textAlign: "right" }}>
            <span className="mono" style={{ fontSize: 12.5, color: "var(--faint)" }}>{LIB.money(Math.round(precioVenta / lote.area), moneda)} / m²</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="segtabs" style={{ marginTop: 18 }}>
          <button className={tab === "contado" ? "on" : ""} onClick={() => setTab("contado")}>Contado</button>
          <button className={tab === "financiamiento" ? "on" : ""} onClick={() => setTab("financiamiento")}>Financiamiento</button>
        </div>

        {/* Descuento */}
        <div style={{ marginTop: 20 }}>
          <MontoPctControl label="Descuento" valuePEN={descuento} basePEN={precioTotal} moneda={moneda}
            accentMax={Math.round(precioTotal * 0.25)} onChange={setDesc}
            hint={"Tope automático: " + LIB.money(capStd, moneda) + " · " + (tab === "contado" ? "contado" : "financiamiento")} />
          <TopeBanner nivel={nivel} aprob={aprob} capStd={capStd} capExc={capExc} moneda={moneda}
            onSolicitar={solicitar} onAprobarYa={aprobarYa} />
        </div>

        {/* Financiamiento */}
        {tab === "financiamiento" && (
          <div className="fade-in" style={{ marginTop: 20 }}>
            <MontoPctControl label="Cuota inicial" valuePEN={Math.min(inicial, precioVenta)} basePEN={precioVenta} moneda={moneda}
              onChange={setInicial} hint="Libre — el asesor define el monto de entrada." />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {[0, 10, 20, 30, 50].map(p => (
                <button key={p} className="btn" style={{ flex: 1, padding: "7px 0", justifyContent: "center", fontSize: 13 }}
                  onClick={() => setInicial(Math.round(precioVenta * p / 100))}>{p}%</button>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 22 }}>
              <SliderField label="Plazo" value={plazo} unit="meses" min={1} max={cond.plazoMaximo} onChange={setPlazo} />
              <SliderField label="Tasa anual" value={tasa} unit="%" min={0} max={18} step={0.5} onChange={setTasa} mono />
            </div>

            <div style={{ background: "var(--primary-050)", border: "1px solid var(--primary-100)", borderRadius: 16, padding: "18px 20px", marginTop: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div className="kicker" style={{ color: "var(--primary-700)" }}>Cuota mensual</div>
                  <div className="mono" style={{ fontSize: 32, fontWeight: 700, color: "var(--primary-700)", marginTop: 2 }}>{LIB.money(plan.cuota, moneda)}</div>
                </div>
                <div style={{ textAlign: "right", fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.7 }}>
                  <div>Saldo a financiar<br /><b className="mono">{LIB.money(saldo, moneda)}</b></div>
                </div>
              </div>
              <hr className="divider" style={{ margin: "14px 0", borderColor: "var(--primary-100)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--ink-2)" }}>
                <span>{plazo} cuotas · tasa {LIB.pct(tasa)} anual</span>
                <span>Total financiado <b className="mono">{LIB.money(plan.total + Math.min(inicial, precioVenta), moneda)}</b></span>
              </div>
              <button className="btn btn-ghost no-print" style={{ width: "100%", marginTop: 12, justifyContent: "center", color: "var(--primary-700)" }}
                onClick={() => setVerPlan(v => !v)}>
                <Icon name="doc" size={15} /> {verPlan ? "Ocultar" : "Ver"} plan de pagos
              </button>
              {verPlan && <PlanTable plan={plan} moneda={moneda} inicial={Math.min(inicial, precioVenta)} />}
            </div>
          </div>
        )}
      </div>

      {/* Footer acciones */}
      <div className="no-print" style={{ borderTop: "1px solid var(--line)", padding: "16px 24px", background: "var(--surface)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Avatar a={asesor} size={30} />
          <div style={{ fontSize: 12.5, lineHeight: 1.3 }}>
            <div style={{ fontWeight: 700 }}>{asesor.nombre}</div>
            <div style={{ color: "var(--faint)" }}>Cotiza esta operación</div>
          </div>
          <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--faint)" }} className="mono">Válida 3 días</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary btn-lg" style={{ flex: 1, justifyContent: "center" }}
            disabled={bloqueado || lote.estado === "vendido" || lote.estado === "no_disponible"} onClick={() => onEnviar(buildQuote())}>
            <Icon name="send" size={16} /> Enviar cotización
          </button>
          <ActionMenu lote={lote} bloqueado={bloqueado} onAction={onAction} />
        </div>
        {bloqueado && <div style={{ fontSize: 11.5, color: "var(--warn-ink)", marginTop: 8, textAlign: "center" }}>Requiere aprobación antes de enviar o vender.</div>}
      </div>
    </div>
  );
}

/* --- subcomponentes --- */
function PriceLine({ label, value, moneda, strong, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontSize: 14.5, color: accent || "var(--ink-2)", fontWeight: strong ? 700 : 500 }}>{label}</span>
      <span className="mono" style={{ fontSize: strong ? 17 : 15, fontWeight: strong ? 700 : 600, color: accent || "var(--ink)" }}>
        {value < 0 ? "− " : ""}{LIB.money(Math.abs(value), moneda)}
      </span>
    </div>
  );
}
function Check({ on, onClick }) {
  return (
    <span onClick={onClick} style={{ width: 20, height: 20, borderRadius: 6, border: "2px solid " + (on ? "var(--primary)" : "#c5cbd8"),
      background: on ? "var(--primary)" : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: ".12s", flexShrink: 0 }}>
      {on && <Icon name="check" size={13} stroke={3} style={{ color: "#fff" }} />}
    </span>
  );
}
function SliderField({ label, value, unit, min, max, step = 1, onChange, mono }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-2)" }}>{label}</span>
        <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{value}<span style={{ color: "var(--faint)", fontWeight: 500 }}> {unit}</span></span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} style={{ width: "100%" }} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
function TopeBanner({ nivel, aprob, capStd, capExc, moneda, onSolicitar, onAprobarYa }) {
  if (nivel === "estandar") return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 12.5, color: "var(--ok-ink)" }}>
      <Icon name="check" size={15} stroke={2.4} /> Dentro del tope estándar · aprobación automática.
    </div>
  );
  const isVB = nivel === "vb";
  return (
    <div className="pop" style={{ marginTop: 12, background: isVB ? "var(--bad-bg)" : "var(--warn-bg)", border: "1px solid " + (isVB ? "#f3c7cb" : "#f0d6a8"),
      borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: isVB ? "var(--bad-ink)" : "var(--warn-ink)" }}>
        <Icon name={isVB ? "shield" : "clock"} size={15} />
        {isVB ? "Visto Bueno Gerencial requerido" : "Excepción · requiere aprobación"}
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 4 }}>
        {isVB ? "Supera el tope de excepción (" + LIB.money(capExc, moneda) + "). Necesita firma de gerencia."
              : "Supera el tope estándar (" + LIB.money(capStd, moneda) + "). Espera de aprobación automática."}
      </div>
      <div style={{ marginTop: 10 }}>
        {aprob.state === "idle" && (
          <button className="btn" style={{ width: "100%", justifyContent: "center", fontSize: 13 }} onClick={onSolicitar}>
            <Icon name="shield" size={14} /> Solicitar aprobación
          </button>
        )}
        {aprob.state === "pending" && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>
              <span className="spin" style={{ width: 14, height: 14, border: "2px solid var(--line)", borderTopColor: isVB ? "var(--bad)" : "var(--warn)", borderRadius: "50%", display: "inline-block" }}></span>
              Esperando… <span className="mono">{aprob.left}s</span>
            </div>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onAprobarYa}>Aprobar ahora ▸</button>
          </div>
        )}
        {aprob.state === "approved" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700, color: "var(--ok-ink)" }}>
            <Icon name="check" size={15} stroke={2.6} /> Aprobado · {aprob.by}
          </div>
        )}
      </div>
    </div>
  );
}
function PlanTable({ plan, moneda, inicial }) {
  const show = plan.rows.length > 13 ? [...plan.rows.slice(0, 6), null, ...plan.rows.slice(-6)] : plan.rows;
  return (
    <div className="fade-in" style={{ marginTop: 12, maxHeight: 280, overflowY: "auto", background: "#fff", borderRadius: 10, border: "1px solid var(--primary-100)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead><tr style={{ position: "sticky", top: 0, background: "#fff" }}>
          {["#", "Cuota", "Capital", "Interés", "Saldo"].map((h, i) => (
            <th key={h} style={{ textAlign: i ? "right" : "left", padding: "9px 12px", color: "var(--faint)", fontWeight: 700, fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", borderBottom: "1px solid var(--line-2)" }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {inicial > 0 && <tr style={{ background: "var(--surface-2)" }}>
            <td style={{ padding: "8px 12px", fontWeight: 700 }}>0</td>
            <td className="mono" style={{ textAlign: "right", padding: "8px 12px", fontWeight: 700 }}>{LIB.money(inicial, moneda)}</td>
            <td colSpan={3} style={{ textAlign: "right", padding: "8px 12px", color: "var(--faint)" }}>Cuota inicial</td>
          </tr>}
          {show.map((r, i) => r === null
            ? <tr key={"e" + i}><td colSpan={5} style={{ textAlign: "center", color: "var(--faint)", padding: "4px" }}>···</td></tr>
            : <tr key={r.m} style={{ borderTop: "1px solid var(--line-2)" }}>
                <td style={{ padding: "8px 12px", color: "var(--muted)" }}>{r.m}</td>
                <td className="mono" style={{ textAlign: "right", padding: "8px 12px", fontWeight: 600 }}>{LIB.money(r.cuota, moneda)}</td>
                <td className="mono" style={{ textAlign: "right", padding: "8px 12px", color: "var(--muted)" }}>{LIB.money(r.capital, moneda)}</td>
                <td className="mono" style={{ textAlign: "right", padding: "8px 12px", color: "var(--muted)" }}>{LIB.money(r.interes, moneda)}</td>
                <td className="mono" style={{ textAlign: "right", padding: "8px 12px" }}>{LIB.money(r.saldo, moneda)}</td>
              </tr>)}
        </tbody>
      </table>
    </div>
  );
}
function ActionMenu({ lote, bloqueado, onAction }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h);
  }, []);
  const items = [
    { k: "separar", label: "Separar lote", icon: "clock", show: lote.estado !== "separado" && lote.estado !== "no_disponible" },
    { k: "vendido", label: "Marcar como vendido", icon: "tag", show: lote.estado !== "vendido" && lote.estado !== "no_disponible", danger: false, dis: bloqueado },
    { k: "liberar", label: "Liberar (disponible)", icon: "reset", show: lote.estado !== "disponible" },
    { k: "no_disponible", label: "No disponible para venta", icon: "lock", show: lote.estado !== "no_disponible" },
    { k: "transp", label: lote.transparente ? "Quitar transparencia" : "Hacer transparente", icon: "eye" },
  ].filter(i => i.show !== false);
  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button className="btn btn-lg" onClick={() => setOpen(o => !o)} style={{ height: "100%" }}><Icon name="sliders" size={16} /></button>
      {open && (
        <div className="card pop" style={{ position: "absolute", bottom: "calc(100% + 8px)", right: 0, width: 230, padding: 6, boxShadow: "var(--shadow-lg)", zIndex: 30 }}>
          {items.map(it => (
            <button key={it.k} disabled={it.dis} className="btn btn-ghost" style={{ width: "100%", justifyContent: "flex-start", opacity: it.dis ? .5 : 1 }}
              onClick={() => { if (!it.dis) { onAction(it.k); setOpen(false); } }}>
              <Icon name={it.icon} size={16} /> {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
function Avatar({ a, size = 32 }) {
  return <span style={{ width: size, height: size, borderRadius: "50%", background: a.color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.4, flexShrink: 0, fontFamily: "var(--font-sans)" }}>{a.iniciales}</span>;
}

Object.assign(window, { Cotizador, Avatar, Money });
