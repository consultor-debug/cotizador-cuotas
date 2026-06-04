/* Helpers de formato y cálculo financiero */
(function () {
  const TC = () => (window.APP?.condiciones?.tipoCambio || 3.75);

  // moneda: 'PEN' | 'USD'
  function money(amountPEN, moneda) {
    moneda = moneda || "PEN";
    const v = moneda === "USD" ? amountPEN / TC() : amountPEN;
    const sign = moneda === "USD" ? "$" : "S/";
    const s = Math.round(v).toLocaleString("en-US");
    return sign + " " + s;
  }
  function money2(amountPEN, moneda) {
    moneda = moneda || "PEN";
    const v = moneda === "USD" ? amountPEN / TC() : amountPEN;
    const sign = moneda === "USD" ? "$" : "S/";
    return sign + " " + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function num(v) { return (Number(v) || 0).toLocaleString("en-US"); }
  function pct(v) { return (Math.round(v * 10) / 10).toFixed(1) + "%"; }

  // Cuota mensual — sistema francés. tasaAnual en %, n meses
  function cuotaMensual(saldo, tasaAnual, n) {
    if (n <= 0) return 0;
    const i = (tasaAnual / 100) / 12;
    if (i === 0) return saldo / n;
    return saldo * (i / (1 - Math.pow(1 + i, -n)));
  }
  // Tabla de amortización
  function planPagos(saldo, tasaAnual, n) {
    const i = (tasaAnual / 100) / 12;
    const cuota = cuotaMensual(saldo, tasaAnual, n);
    let bal = saldo; const rows = [];
    for (let m = 1; m <= n; m++) {
      const interes = bal * i;
      const capital = cuota - interes;
      bal = Math.max(0, bal - capital);
      rows.push({ m, cuota, interes, capital, saldo: bal });
    }
    return { cuota, rows, total: cuota * n };
  }

  const ESTADOS = {
    disponible:    { label: "Disponible", cls: "ok", fill: "#dfeee4", stroke: "#7bbf96", text: "#157f3c" },
    separado:      { label: "Separado",   cls: "warn", fill: "#fbe9cf", stroke: "#e0a64e", text: "#a9650f" },
    vendido:       { label: "Vendido",    cls: "bad", fill: "#f6dadd", stroke: "#d98a92", text: "#b62b38" },
    no_disponible: { label: "No disponible", cls: "muted", fill: "#e6e7ea", stroke: "#a6abb5", text: "#5b616d" },
  };

  function todayPlus(days) {
    const d = new Date(2026, 5, 2); // 2 jun 2026 (fecha del proyecto)
    d.setDate(d.getDate() + days);
    return d;
  }
  function fmtFecha(d) {
    const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","setiembre","octubre","noviembre","diciembre"];
    return d.getDate() + " de " + meses[d.getMonth()] + " de " + d.getFullYear();
  }
  function fmtFechaCorta(d) {
    return String(d.getDate()).padStart(2,"0") + "/" + String(d.getMonth()+1).padStart(2,"0") + "/" + d.getFullYear();
  }

  window.LIB = { money, money2, num, pct, cuotaMensual, planPagos, ESTADOS, todayPlus, fmtFecha, fmtFechaCorta, TC };
})();
