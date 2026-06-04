/* ============================================================
   Datos de ejemplo — inventario y catálogo base (genérico)
   ============================================================ */
(function () {
  // PRNG determinista para datos estables
  let _s = 20260602;
  const rnd = () => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const between = (a, b, d = 2) => +(a + rnd() * (b - a)).toFixed(d);

  const MANZANAS = [
    { id: "A", n: 11, etapa: "2DA ETAPA", base: 47000 },
    { id: "B", n: 12, etapa: "2DA ETAPA", base: 41000 },
    { id: "C", n: 6,  etapa: "1RA ETAPA", base: 52000 },
    { id: "D", n: 14, etapa: "1RA ETAPA", base: 38000 },
    { id: "E", n: 14, etapa: "1RA ETAPA", base: 33000 },
    { id: "F", n: 12, etapa: "1RA ETAPA", base: 36000 },
    { id: "G", n: 14, etapa: "1RA ETAPA", base: 35000 },
    { id: "H", n: 16, etapa: "3RA ETAPA", base: 31000 },
    { id: "I", n: 14, etapa: "1RA ETAPA", base: 34000 },
    { id: "J", n: 12, etapa: "1RA ETAPA", base: 37000 },
    { id: "K", n: 14, etapa: "1RA ETAPA", base: 33500 },
    { id: "L", n: 9,  etapa: "2DA ETAPA", base: 45000 },
    { id: "M", n: 18, etapa: "2DA ETAPA", base: 30600 },
    { id: "N", n: 14, etapa: "2DA ETAPA", base: 32000 },
  ];

  const TIPOLOGIAS = [
    "Lote Residencial", "Lote Residencial", "Lote Residencial", "Lote Residencial",
    "Esquina", "Esquina + Av. Principal", "Frente a parque", "Lote Comercial",
  ];

  const lotes = [];
  let soldQuota = 48, sepQuota = 7; // distribución como en el screenshot
  MANZANAS.forEach((mz) => {
    for (let i = 1; i <= mz.n; i++) {
      const r = rnd();
      let estado = "disponible";
      // sembrar vendidos / separados de forma dispersa
      if (soldQuota > 0 && r < 0.20) { estado = "vendido"; soldQuota--; }
      else if (sepQuota > 0 && r > 0.93) { estado = "separado"; sepQuota--; }
      const esquina = i === 1 || i === mz.n;
      const area = between(118, 252, 2);
      const frente = between(7, 14, 2);
      lotes.push({
        id: mz.id + "-" + String(i).padStart(2, "0"),
        codigo: mz.id + i,
        manzana: mz.id,
        numero: i,
        etapa: mz.etapa,
        tipologia: esquina ? pick(["Esquina", "Esquina + Av. Principal"]) : pick(TIPOLOGIAS.slice(0, 4)),
        area,
        frente,
        fondo: +(area / frente).toFixed(2),
        ladoDer: between(16, 18, 2),
        ladoIzq: between(16, 18, 2),
        orientacion: pick(["Norte", "Sur", "Este", "Oeste", "Sur-Poniente", "Nor-Oriente"]),
        precioLista: Math.round((mz.base + (area - 150) * 60 + (esquina ? 4000 : 0)) / 100) * 100,
        estado,
      });
    }
  });

  // forzar reparto exacto restante a vendido si quedó cupo
  for (let k = 0; k < lotes.length && soldQuota > 0; k++) {
    if (lotes[k].estado === "disponible") { lotes[k].estado = "vendido"; soldQuota--; }
  }
  for (let k = lotes.length - 1; k >= 0 && sepQuota > 0; k--) {
    if (lotes[k].estado === "disponible") { lotes[k].estado = "separado"; sepQuota--; }
  }

  // Única cuenta inicial: superusuario con control total.
  // Luis David Arce (larce) crea y habilita las demás cuentas desde "Usuarios".
  const asesores = [
    { id: "larce", nombre: "Luis David Arce", usuario: "larce", password: "larce2026",
      rol: "Gerente General", iniciales: "LA", color: "#7c3aed", activo: true, super: true },
  ];

  // Autores ficticios SOLO para poblar los datos de demostración (no son cuentas de acceso).
  const demoAutores = [
    { id: "u1", nombre: "Lucía Fernández", rol: "Asesora comercial", iniciales: "LF", color: "#2f5bd7" },
    { id: "u2", nombre: "Marco Salazar", rol: "Asesor comercial", iniciales: "MS", color: "#0f9b6c" },
    { id: "u5", nombre: "Paola Quispe", rol: "Coordinador de ventas", iniciales: "PQ", color: "#d98213" },
    { id: "u3", nombre: "Daniela Ríos", rol: "SubGerente Comercial", iniciales: "DR", color: "#b3324a" },
  ];

  const condiciones = {
    plazoMaximo: 36,
    tasaAnualSugerida: 8,
    juegoPlanos: 10000,
    topes: {
      estandar:  { contado: 3400, financiamiento: 1400 },
      excepcion: { contado: 4000, financiamiento: 2000, esperaSeg: 30 },
      vb:        { esperaSeg: 120 },
    },
    aprobadores: ["SubGerente Comercial", "Gerente General"],
    validezDias: 3,
    tipoCambio: 3.75, // S/ por US$
  };

  const total = lotes.length;
  const stats = {
    total,
    disponibles: lotes.filter(l => l.estado === "disponible").length,
    separados: lotes.filter(l => l.estado === "separado").length,
    vendidos: lotes.filter(l => l.estado === "vendido").length,
  };

  window.APP = {
    proyecto: { nombre: "Tu Proyecto", etapa: "", ubicacion: "" },
    manzanas: MANZANAS,
    lotes,
    asesores,
    demoAutores,
    condiciones,
    stats,
  };
})();
