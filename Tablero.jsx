/* =========================================================
   TABLERO — panel de control (gerencia / jefatura)
   ========================================================= */

function moneyShort(pen, moneda) {
  const tc = LIB.TC();
  const v = moneda === "USD" ? pen / tc : pen;
  const sign = moneda === "USD" ? "$" : "S/";
  const abs = Math.abs(v);
  if (abs >= 1e6) return sign + " " + (v / 1e6).toFixed(2) + " M";
  if (abs >= 1e3) return sign + " " + Math.round(v / 1e3) + " k";
  return sign + " " + Math.round(v);
}

function Tablero({ lotes, cotizaciones, reservas, asesores, moneda, goReservas }) {
  const now = Date.now();
  const total = lotes.length || 1;
  const disp = lotes.filter(l => l.estado === "disponible");
  const sep = lotes.filter(l => l.estado === "separado");
  const vend = lotes.filter(l => l.estado === "vendido");
  const sum = (arr) => arr.reduce((s, l) => s + (l.precioLista || 0), 0);
  const valorTotal = sum(lotes), valorVendido = sum(vend), valorDisp = sum(disp);
  const avance = vend.length / total * 100;

  // por etapa
  const etapas = [...new Set(lotes.map(l => l.etapa))].map(et => {
    const arr = lotes.filter(l => l.etapa === et);
    const v = arr.filter(l => l.estado === "vendido").length;
    return { et, total: arr.length, vend: v, pct: v / arr.length * 100 };
  }).sort((a, b) => b.total - a.total);

  // reservas
  const activas = reservas.filter(r => r.estado === "activa");
  const porVencer = activas.filter(r => r.expiresAt - now < 24 * 3600000 && r.expiresAt > now).length;

  // cotizaciones últimos 30 días
  const d30 = now - 30 * 86400000;
  const recientes = cotizaciones.filter(c => c.ts >= d30);
  const cEstado = (e) => recientes.filter(c => c.estado === e).length;
  const conversion = recientes.length ? (cEstado("aceptada") / recientes.length * 100) : 0;

  // ranking asesores
  const aMap = {}; asesores.forEach(a => aMap[a.id] = a);
  const rank = Object.values(cotizaciones.reduce((acc, c) => {
    const a = acc[c.asesorId] || (acc[c.asesorId] = { id: c.asesorId, nombre: c.asesorNombre, cot: 0, acc: 0, monto: 0 });
    a.cot++; if (c.estado === "aceptada") { a.acc++; a.monto += c.precioVenta || 0; }
    return acc;
  }, {})).sort((x, y) => y.monto - x.monto).slice(0, 5);
  const maxMonto = Math.max(1, ...rank.map(r => r.monto));

  const kpis = [
    { label: "Valor de inventario", value: moneyShort(valorTotal, moneda), sub: total + " lotes", icon: "wallet", color: "var(--ink)" },
    { label: "Vendido", value: moneyShort(valorVendido, moneda), sub: vend.length + " lotes · " + avance.toFixed(0) + "%", icon: "trophy", color: "var(--ok-ink)" },
    { label: "Disponible", value: moneyShort(valorDisp, moneda), sub: disp.length + " lotes", icon: "tag", color: "var(--primary)" },
    { label: "Reservas activas", value: activas.length, sub: porVencer + " por vencer (24 h)", icon: "clock", color: "var(--warn-ink)", onClick: goReservas },
  ];

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "26px 36px 60px" }}>
        <div className="kicker" style={{ color: "var(--primary)" }}>Gerencia</div>
        <h1 style={{ fontSize: 34, marginTop: 4 }}>Tablero de control</h1>
        <div style={{ color: "var(--muted)", marginTop: 6, fontSize: 14.5 }}>Estado del proyecto, avance comercial y desempeño del equipo.</div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, margin: "24px 0" }}>
          {kpis.map(k => (
            <div key={k.label} className="card" style={{ padding: "18px 20px", cursor: k.onClick ? "pointer" : "default" }} onClick={k.onClick}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div className="kicker">{k.label}</div>
                <Icon name={k.icon} size={17} style={{ color: k.color }} />
              </div>
              <div className="mono" style={{ fontSize: 27, fontWeight: 700, color: k.color, marginTop: 10, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 6 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, alignItems: "start" }}>
          {/* Inventario + etapas */}
          <div className="card" style={{ padding: "20px 22px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h3 style={{ fontSize: 18 }}>Avance comercial</h3>
              <span className="mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--ok-ink)" }}>{avance.toFixed(1)}%</span>
            </div>
            {/* barra global */}
            <div style={{ display: "flex", height: 16, borderRadius: 8, overflow: "hidden", margin: "14px 0 8px", background: "var(--bg-2)" }}>
              <div style={{ width: (vend.length / total * 100) + "%", background: LIB.ESTADOS.vendido.stroke }}></div>
              <div style={{ width: (sep.length / total * 100) + "%", background: LIB.ESTADOS.separado.stroke }}></div>
              <div style={{ width: (disp.length / total * 100) + "%", background: LIB.ESTADOS.disponible.stroke }}></div>
            </div>
            <div style={{ display: "flex", gap: 18, fontSize: 12.5, marginBottom: 20 }}>
              {[["Vendidos", vend.length, LIB.ESTADOS.vendido.stroke], ["Separados", sep.length, LIB.ESTADOS.separado.stroke], ["Disponibles", disp.length, LIB.ESTADOS.disponible.stroke]].map(([l, n, c]) => (
                <span key={l} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-2)", fontWeight: 600 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: c }}></span>{l} <span className="mono" style={{ color: "var(--faint)" }}>{n}</span>
                </span>
              ))}
            </div>

            <div className="kicker" style={{ marginBottom: 12 }}>Por etapa</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              {etapas.map(e => (
                <div key={e.et}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
                    <span style={{ fontWeight: 600, color: "var(--ink-2)" }}>{e.et}</span>
                    <span className="mono" style={{ color: "var(--faint)" }}>{e.vend}/{e.total} · {e.pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 5, background: "var(--bg-2)", overflow: "hidden" }}>
                    <div style={{ width: e.pct + "%", height: "100%", background: "var(--primary)", borderRadius: 5 }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cotizaciones 30d + ranking */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h3 style={{ fontSize: 18 }}>Cotizaciones · 30 días</h3>
                <span className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{recientes.length}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "14px 0 4px" }}>
                {[["Enviadas", cEstado("enviada"), "var(--warn-ink)"], ["Aceptadas", cEstado("aceptada"), "var(--ok-ink)"],
                  ["Rechazadas", cEstado("rechazada"), "var(--bad-ink)"], ["Vencidas", cEstado("vencida"), "var(--faint)"]].map(([l, n, c]) => (
                  <div key={l} style={{ background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px" }}>
                    <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: c }}>{n}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>Tasa de conversión</span>
                <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: "var(--primary)" }}>{conversion.toFixed(0)}%</span>
              </div>
            </div>

            <div className="card" style={{ padding: "20px 22px" }}>
              <h3 style={{ fontSize: 18, marginBottom: 14 }}>Ranking de asesores</h3>
              {rank.length === 0 && <div style={{ color: "var(--faint)", fontSize: 13 }}>Sin ventas registradas aún.</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {rank.map((r, i) => {
                  const a = aMap[r.id] || { iniciales: "?", color: "#94a3b8", nombre: r.nombre };
                  return (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--faint)", width: 16 }}>{i + 1}</span>
                      <Avatar a={a} size={32} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.nombre}</div>
                        <div style={{ height: 5, borderRadius: 3, background: "var(--bg-2)", marginTop: 4, overflow: "hidden" }}>
                          <div style={{ width: (r.monto / maxMonto * 100) + "%", height: "100%", background: a.color, borderRadius: 3 }}></div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="mono" style={{ fontSize: 13, fontWeight: 700 }}>{moneyShort(r.monto, moneda)}</div>
                        <div style={{ fontSize: 11, color: "var(--faint)" }}>{r.acc} venta{r.acc === 1 ? "" : "s"}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Tablero = Tablero;
