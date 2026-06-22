/*!
 * Cotizador de Cuotas
 * Copyright (c) 2026 Luis D.. Todos los derechos reservados.
 * Software propietario. Prohibida su copia, distribución o uso sin
 * autorización escrita del titular. Ver archivo LICENSE.
 */

/* =========================================================
   HOJA DE COTIZACIÓN (imprimible) + MODAL DE ENVÍO
   ========================================================= */

function CotizacionDoc({ quote, brand, onClose, onRegistrar, toast }) {
  const [sent, setSent] = useState(false);
  const [step, setStep] = useState("doc"); // doc | enviar
  const q = quote;
  const folio = "COT-" + q.lote.id.replace("-", "") + "-" + String(LIB.todayPlus(0).getDate()).padStart(2, "0") + "06";
  const M = (v) => LIB.money(v, q.moneda);

  return (
    <div onMouseDown={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 120, padding: "30px 20px", overflowY: "auto" }}>
      <div onMouseDown={e => e.stopPropagation()} style={{ width: 720, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Barra de acciones (no imprime) */}
        <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button className="btn" onClick={onClose} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", backdropFilter: "blur(4px)" }}><Icon name="arrowLeft" size={16} /> Volver</button>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" onClick={() => window.print()}><Icon name="printer" size={15} /> Imprimir / PDF</button>
            <button className="btn btn-primary" onClick={() => setStep("enviar")}><Icon name="send" size={15} /> Enviar al cliente</button>
          </div>
        </div>

        {/* Documento */}
        <div className="card" style={{ padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }} id="cotdoc">
          {/* Encabezado */}
          <div style={{ background: "var(--ink)", color: "#fff", padding: "26px 34px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {brand && brand.logo
                  ? <img src={brand.logo} alt="logo" style={{ width: 34, height: 34, borderRadius: 9, objectFit: "cover", display: "block" }} />
                  : <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--primary)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="building" size={18} /></span>}
                <span style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 600 }}>{brand ? brand.nombre : "Cotizador"}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,.6)", marginTop: 8 }}>{brand && brand.tagline ? brand.tagline : ""}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="kicker" style={{ color: "rgba(255,255,255,.5)" }}>Cotización</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{folio}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.6)", marginTop: 4 }}>{LIB.fmtFecha(q.fecha)}</div>
            </div>
          </div>

          {/* Validez */}
          <div style={{ background: "var(--warn-bg)", color: "var(--warn-ink)", padding: "10px 34px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="clock" size={15} /> Válida hasta el <b>{LIB.fmtFecha(q.valida)}</b> · {APP.condiciones.validezDias} días desde su emisión.
          </div>

          <div style={{ padding: "28px 34px" }}>
            {/* Lote */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
              <div>
                <div className="kicker">Lote</div>
                <h2 style={{ fontSize: 26, marginTop: 4 }}>Manzana {q.lote.manzana} · N° {q.lote.numero}</h2>
                <div style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 4 }}>{q.lote.tipologia} · {q.lote.etapa}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "6px 22px", fontSize: 13.5 }}>
                {[["Superficie", q.lote.area + " m²"], ["Frente", q.lote.frente + " m"], ["Fondo", q.lote.fondo + " m"], ["Orientación", q.lote.orientacion]].map(([k, v]) => (
                  <React.Fragment key={k}><span style={{ color: "var(--faint)" }}>{k}</span><span className="mono" style={{ textAlign: "right", fontWeight: 600 }}>{v}</span></React.Fragment>
                ))}
              </div>
            </div>

            {/* Desglose precio */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", marginBottom: 18 }}>
              <DocLine k="Precio lista" v={M(q.precioLista)} />
              {q.planosOn && <DocLine k="Juego de planos" v={M(q.juego)} />}
              <DocLine k="Precio total" v={M(q.precioTotal)} strong />
              {q.descuento > 0 && <DocLine k={"Descuento" + (q.aprobadoPor ? " · aprob. " + q.aprobadoPor.split(" · ")[0] : "")} v={"− " + M(q.descuento)} accent="var(--bad-ink)" />}
              <DocLine k="Precio de venta" v={M(q.precioVenta)} big />
            </div>

            {/* Plan de pago */}
            {q.modo === "financiamiento" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <PlanCard label="Cuota inicial" value={M(q.inicial)} sub={LIB.pct(q.precioVenta ? q.inicial / q.precioVenta * 100 : 0) + " del precio"} />
                <PlanCard label="Saldo financiado" value={M(q.saldo)} sub={q.plazo + " meses · " + LIB.pct(q.tasa) + " anual"} />
                <div style={{ gridColumn: "1 / -1", background: "var(--primary-050)", border: "1px solid var(--primary-100)", borderRadius: 14, padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div className="kicker" style={{ color: "var(--primary-700)" }}>Cuota mensual</div>
                    <div className="mono" style={{ fontSize: 30, fontWeight: 700, color: "var(--primary-700)" }}>{M(q.cuota)}</div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 12.5, color: "var(--ink-2)" }}>
                    <div>{q.plazo} cuotas iguales</div>
                    <div>Total: <b className="mono">{M(q.totalFin + q.inicial)}</b></div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ background: "var(--ok-bg)", border: "1px solid #bfe6cd", borderRadius: 14, padding: "18px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="kicker" style={{ color: "var(--ok-ink)" }}>Pago al contado</div>
                <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: "var(--ok-ink)" }}>{M(q.precioVenta)}</div>
              </div>
            )}

            {/* Asesor */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--line)" }}>
              <Avatar a={q.asesor} size={42} />
              <div style={{ fontSize: 13 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{q.asesor.nombre}</div>
                <div style={{ color: "var(--muted)" }}>{q.asesor.rol}{brand && brand.nombre ? " · " + brand.nombre : ""}</div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right", fontSize: 11.5, color: "var(--faint)", maxWidth: 240 }}>
                {q.moneda === "USD" && <div className="mono">T.C. referencial S/ {q.tipoCambio.toFixed(2)}</div>}
                Precios sujetos a disponibilidad. No incluye gastos notariales ni registrales.
              </div>
            </div>
          </div>
        </div>
      </div>

      {step === "enviar" && <EnviarModal quote={q} folio={folio} brand={brand} onClose={() => setStep("doc")} onSent={(rec) => { if (onRegistrar && rec) onRegistrar(rec); toast("Cotización " + folio + " enviada al cliente", "ok"); onClose(); }} />}
    </div>
  );
}

function DocLine({ k, v, strong, big, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: big ? "16px 20px" : "12px 20px",
      background: big ? "var(--surface-2)" : "transparent", borderTop: (strong || big) ? "1px solid var(--line)" : "none" }}>
      <span style={{ fontSize: big ? 13 : 14, fontWeight: big ? 800 : strong ? 700 : 500, color: accent || (big ? "var(--muted)" : "var(--ink-2)"), letterSpacing: big ? ".04em" : 0, textTransform: big ? "uppercase" : "none" }}>{k}</span>
      <span className="mono" style={{ fontSize: big ? 24 : strong ? 16 : 15, fontWeight: (big || strong) ? 700 : 600, color: accent || "var(--ink)" }}>{v}</span>
    </div>
  );
}
function PlanCard({ label, value, sub }) {
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 14, padding: "16px 18px" }}>
      <div className="kicker">{label}</div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function EnviarModal({ quote, folio, brand, onClose, onSent }) {
  const [canal, setCanal] = useState("whatsapp");
  const [dest, setDest] = useState("");
  const [nombre, setNombre] = useState("");
  const canales = [
    { k: "whatsapp", label: "WhatsApp", icon: "whatsapp", ph: "+51 999 888 777" },
    { k: "email", label: "Correo", icon: "mail", ph: "cliente@correo.com" },
  ];
  const c = canales.find(x => x.k === canal);
  const M = (v) => LIB.money(v, quote.moneda);
  const linea = quote.modo === "financiamiento"
    ? "Cuota mensual " + M(quote.cuota) + " x " + quote.plazo + " meses"
    : "Precio al contado " + M(quote.precioVenta);
  const msg =
    "Hola" + (nombre ? " " + nombre : "") + ", te comparto la cotización " + folio + ((brand && brand.nombre) ? " de " + brand.nombre : "") + ".\n" +
    "Lote " + quote.lote.id + " · Manzana " + quote.lote.manzana + " N° " + quote.lote.numero + "\n" +
    linea + "\nVálida hasta el " + LIB.fmtFecha(quote.valida) + ".";

  function enviar() {
    const phone = dest.replace(/[^0-9]/g, "");
    if (canal === "whatsapp") {
      window.open("https://wa.me/" + phone + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
    } else {
      window.open("mailto:" + encodeURIComponent(dest) + "?subject=" + encodeURIComponent("Cotización " + folio + ((brand && brand.nombre) ? " · " + brand.nombre : "")) + "&body=" + encodeURIComponent(msg), "_blank");
    }
    const rec = {
      id: folio, ts: Date.now(),
      loteId: quote.lote.id, manzana: quote.lote.manzana, numero: quote.lote.numero, tipologia: quote.lote.tipologia,
      asesorId: quote.asesor.id, asesorNombre: quote.asesor.nombre,
      clienteId: null, clienteNombre: nombre.trim() || "Sin nombre", clienteContacto: dest,
      canal, modo: quote.modo, moneda: quote.moneda,
      precioVenta: quote.precioVenta, descuento: quote.descuento, inicial: quote.inicial || 0,
      cuota: quote.cuota || 0, plazo: quote.plazo || 0,
      estado: "enviada",
    };
    onSent(rec);
  }
  return (
    <Modal onClose={onClose} title="Enviar cotización" width={460}>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: -6 }}>Se enviará la cotización <b className="mono" style={{ color: "var(--ink-2)" }}>{folio}</b> con validez de {APP.condiciones.validezDias} días.</p>
      <div className="segtabs" style={{ background: "var(--bg-2)", margin: "14px 0 16px" }}>
        {canales.map(x => <button key={x.k} className={canal === x.k ? "on" : ""} style={{ display: "flex", gap: 7, alignItems: "center", justifyContent: "center" }} onClick={() => setCanal(x.k)}><Icon name={x.icon} size={15} /> {x.label}</button>)}
      </div>
      <label className="kicker" style={{ display: "block", marginBottom: 6 }}>Nombre del cliente</label>
      <div className="field" style={{ marginBottom: 12 }}><input placeholder="Ej. Carlos Ramírez" value={nombre} onChange={e => setNombre(e.target.value)} /></div>
      <label className="kicker" style={{ display: "block", marginBottom: 6 }}>{c.label}</label>
      <div className="field"><Icon name={c.icon} size={16} style={{ color: "var(--faint)" }} /><input placeholder={c.ph} value={dest} onChange={e => setDest(e.target.value)} /></div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!dest} onClick={enviar}><Icon name={c.icon} size={15} /> Enviar por {c.label}</button>
      </div>
    </Modal>
  );
}

Object.assign(window, { CotizacionDoc });
