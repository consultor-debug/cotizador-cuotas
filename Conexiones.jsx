/* =========================================================
   CONEXIONES — ranking de actividad por cuenta
   Mide los inicios de sesión registrados. Visible solo para
   superusuario / cuentas con acceso a "usuarios".
   ========================================================= */

function Conexiones({ conexiones, asesores, currentId, toast }) {
  // índice de cuentas vigentes para marcar activas/eliminadas
  const cuentas = {};
  (asesores || []).forEach(a => { cuentas[a.id] = a; });

  const ranking = [...(conexiones || [])].sort((a, b) =>
    (b.count - a.count) || (b.lastSeen - a.lastSeen));

  const totalLogins = ranking.reduce((s, r) => s + (r.count || 0), 0);
  const maxCount = ranking.reduce((m, r) => Math.max(m, r.count || 0), 0) || 1;
  const activos7d = ranking.filter(r => r.lastSeen > Date.now() - 7 * STORE.DAY).length;
  const top = ranking[0];

  const medalla = ["#d9a441", "#9aa6b8", "#c08457"]; // oro / plata / bronce

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div className="view" style={{ maxWidth: 1000, margin: "0 auto", padding: "26px 36px 60px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div className="kicker" style={{ color: "var(--primary)" }}>Actividad</div>
            <h1 style={{ fontSize: 34, marginTop: 4 }}>Ranking de conexiones</h1>
            <div style={{ color: "var(--muted)", marginTop: 6, fontSize: 14.5, maxWidth: 560 }}>
              Asesores ordenados por número de ingresos al sistema. Se registra cada inicio de sesión.
            </div>
          </div>
        </div>

        {/* Resumen */}
        <div className="autogrid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, margin: "22px 0 26px" }}>
          {[["Ingresos totales", totalLogins, "var(--ink)"],
            ["Activos (7 días)", activos7d, "var(--ok-ink)"],
            ["Más activo", top ? top.nombre.split(" ")[0] : "—", "var(--primary)"]].map(([l, n, c]) => (
            <div key={l} className="card" style={{ padding: "16px 18px" }}>
              <div className="mono" style={{ fontSize: 30, fontWeight: 700, color: c, lineHeight: 1.05, wordBreak: "break-word" }}>{n}</div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Lista ranking */}
        {ranking.length === 0 ? (
          <div className="card" style={{ padding: "44px 24px", textAlign: "center", color: "var(--muted)" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--bg-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "var(--faint)", marginBottom: 12 }}>
              <Icon name="chart" size={24} />
            </div>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--ink)" }}>Aún no hay conexiones registradas</div>
            <div style={{ fontSize: 13.5, marginTop: 4 }}>El ranking se irá llenando a medida que los asesores inicien sesión.</div>
          </div>
        ) : (
          <div className="card" style={{ overflow: "hidden" }}>
            {ranking.map((r, i) => {
              const cuenta = cuentas[r.id];
              const eliminada = !cuenta;
              const inactiva = cuenta && cuenta.activo === false;
              const esYo = r.id === currentId;
              const pct = Math.round((r.count / maxCount) * 100);
              return (
                <div key={r.id} className="conx-row" style={{ display: "flex", alignItems: "center", gap: 16, padding: "15px 20px", borderTop: i ? "1px solid var(--line-2)" : "none" }}>
                  {/* Puesto */}
                  <div className="mono" style={{ width: 30, flexShrink: 0, textAlign: "center", fontSize: 18, fontWeight: 700, color: i < 3 ? medalla[i] : "var(--faint)" }}>
                    {i + 1}
                  </div>
                  <Avatar a={r} size={42} />
                  {/* Nombre + barra */}
                  <div className="conx-main" style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{r.nombre}</span>
                      {esYo && <span className="badge" style={{ fontSize: 10, padding: "2px 7px", background: "var(--bg-2)", color: "var(--muted)" }}>Tú</span>}
                      {eliminada && <span className="badge badge-muted" style={{ fontSize: 10, padding: "2px 7px" }}>Cuenta eliminada</span>}
                      {inactiva && <span className="badge badge-bad" style={{ fontSize: 10, padding: "2px 7px" }}>Sin acceso</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--faint)", marginTop: 2 }}>{r.rol}</div>
                    <div style={{ height: 6, borderRadius: 99, background: "var(--bg-2)", marginTop: 9, overflow: "hidden", maxWidth: 360 }}>
                      <div style={{ width: pct + "%", height: "100%", borderRadius: 99, background: i < 3 ? "var(--primary)" : "#c3cad8", transition: ".3s" }}></div>
                    </div>
                  </div>
                  {/* Métricas */}
                  <div className="conx-meta" style={{ textAlign: "right", flexShrink: 0 }}>
                    <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", lineHeight: 1 }}>{r.count}</div>
                    <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 3 }}>ingresos</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, whiteSpace: "nowrap" }}>{STORE.fmtDesde(r.lastSeen)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 14 }}>
          Para una pila piloto, esta actividad se guarda en este dispositivo. Un despliegue multiusuario real requiere un servidor que centralice las conexiones.
        </p>
      </div>
    </div>
  );
}

window.Conexiones = Conexiones;
