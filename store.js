/* ============================================================
   STORE — persistencia (localStorage) + datos demo + helpers
   de fecha y cuenta regresiva (tiempo real).
   ============================================================ */
(function () {
  const NS = "cotizador.v1.";
  const has = (k) => localStorage.getItem(NS + k) !== null;
  function load(k, fallback) {
    try {
      const raw = localStorage.getItem(NS + k);
      if (raw == null) return typeof fallback === "function" ? fallback() : fallback;
      return JSON.parse(raw);
    } catch (e) { return typeof fallback === "function" ? fallback() : fallback; }
  }
  function save(k, v) {
    try { localStorage.setItem(NS + k, JSON.stringify(v)); return true; }
    catch (e) { console.warn("No se pudo guardar", k, e && e.name); return false; }
  }
  function remove(k) { try { localStorage.removeItem(NS + k); } catch (e) { /* noop */ } }
  function clearAll() {
    Object.keys(localStorage).filter(x => x.startsWith(NS)).forEach(x => localStorage.removeItem(x));
    try { idbDel("planoImg"); } catch (e) { /* noop */ }
  }

  // ---- IndexedDB: blobs grandes (plano) que no caben en localStorage ----
  let _dbP = null;
  function idb() {
    if (_dbP) return _dbP;
    _dbP = new Promise((res, rej) => {
      const r = indexedDB.open(NS + "blobs", 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("kv")) r.result.createObjectStore("kv"); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return _dbP;
  }
  async function idbGet(k) {
    const db = await idb();
    return new Promise((res, rej) => {
      const rq = db.transaction("kv", "readonly").objectStore("kv").get(k);
      rq.onsuccess = () => res(rq.result == null ? null : rq.result);
      rq.onerror = () => rej(rq.error);
    });
  }
  async function idbSet(k, v) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put(v, k);
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error);
    });
  }
  async function idbDel(k) {
    const db = await idb();
    return new Promise((res, rej) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").delete(k);
      tx.oncomplete = () => res(true);
      tx.onerror = () => rej(tx.error);
    });
  }

  // ---- tiempo real ----
  const DAY = 86400000;
  function fmtLeft(ms) {
    if (ms <= 0) return "Vencida";
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    if (d > 0) return d + "d " + h + "h";
    if (h > 0) return h + "h " + String(m).padStart(2, "0") + "m";
    if (m > 0) return m + "m " + String(ss).padStart(2, "0") + "s";
    return ss + "s";
  }
  function fmtFechaHora(ts) {
    const d = new Date(ts);
    const meses = ["ene","feb","mar","abr","may","jun","jul","ago","set","oct","nov","dic"];
    return d.getDate() + " " + meses[d.getMonth()] + " " + d.getFullYear();
  }
  // "hace X" relativo (para el ranking de conexiones)
  function fmtDesde(ts) {
    if (!ts) return "—";
    const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return "hace instantes";
    const m = Math.floor(s / 60); if (m < 60) return "hace " + m + " min";
    const h = Math.floor(m / 60); if (h < 24) return "hace " + h + " h";
    const d = Math.floor(h / 24); if (d === 1) return "ayer";
    if (d < 30) return "hace " + d + " días";
    return fmtFechaHora(ts);
  }

  // ---- datos demo ----
  const NOMBRES = [
    "Carlos Ramírez", "María Fernanda Soto", "Luis Alberto Díaz", "Patricia Vega",
    "Jorge Mendoza", "Andrea Campos", "Roberto Chávez", "Lucía Paredes",
    "Diego Salinas", "Carmen Rojas", "Fernando Ato", "Gabriela Núñez",
    "Sergio Bautista", "Rosa Linares", "Manuel Espinoza", "Valeria Ríos",
  ];
  const TELS = ["987 654 321", "961 220 145", "954 778 012", "999 145 880", "942 663 197", "915 880 234", "933 471 562", "968 204 711"];

  function seed(APP) {
    // PRNG determinista
    let s = 99173;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const now = Date.now();

    const comerciales = (APP.demoAutores && APP.demoAutores.length)
      ? APP.demoAutores
      : APP.asesores.filter(a => /asesor|coordinador/i.test(a.rol));
    const lotes = APP.lotes;
    const disponibles = lotes.filter(l => l.estado === "disponible");
    const vendidos = lotes.filter(l => l.estado === "vendido");

    // clientes
    const clientes = NOMBRES.map((nombre, i) => ({
      id: "c" + (i + 1),
      nombre,
      dni: String(10000000 + Math.floor(rnd() * 89999999)),
      telefono: pick(TELS),
      email: nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ".").replace(/[^a-z.]/g, "") + "@gmail.com",
      createdAt: now - Math.floor(rnd() * 40) * DAY,
    }));

    // cotizaciones (historial) — repartidas en ~35 días
    const cotizaciones = [];
    const folioDe = (lote, ts) => "COT-" + lote.id.replace("-", "") + "-" + new Date(ts).getDate() + "" + (new Date(ts).getMonth() + 1);
    function mkCot(lote, estado, daysAgo) {
      const cli = pick(clientes);
      const ase = pick(comerciales);
      const fin = rnd() > 0.4;
      const desc = rnd() > 0.6 ? Math.round(lote.precioLista * (0.02 + rnd() * 0.06) / 100) * 100 : 0;
      const precioVenta = lote.precioLista + 10000 - desc;
      const inicial = Math.round(precioVenta * (0.1 + rnd() * 0.3));
      const plazo = pick([12, 18, 24, 36]);
      const saldo = precioVenta - inicial;
      const cuota = LIB.cuotaMensual(saldo, 8, plazo);
      const ts = now - Math.floor(daysAgo * DAY) - Math.floor(rnd() * DAY);
      cotizaciones.push({
        id: folioDe(lote, ts) + "-" + (cotizaciones.length + 1),
        ts,
        loteId: lote.id, manzana: lote.manzana, numero: lote.numero, tipologia: lote.tipologia,
        asesorId: ase.id, asesorNombre: ase.nombre,
        clienteId: cli.id, clienteNombre: cli.nombre, clienteContacto: cli.telefono,
        canal: pick(["whatsapp", "email"]),
        modo: fin ? "financiamiento" : "contado",
        moneda: "PEN",
        precioVenta, descuento: desc, inicial: fin ? inicial : 0, cuota: fin ? Math.round(cuota) : 0, plazo: fin ? plazo : 0,
        estado,
      });
    }
    // aceptadas: ligadas a vendidos
    vendidos.slice(0, 8).forEach((l, i) => mkCot(l, "aceptada", 5 + i * 3));
    // enviadas: a disponibles
    for (let i = 0; i < 10; i++) mkCot(pick(disponibles), "enviada", 1 + Math.floor(rnd() * 18));
    // vencidas y rechazadas
    for (let i = 0; i < 3; i++) mkCot(pick(disponibles), "vencida", 22 + i * 2);
    for (let i = 0; i < 2; i++) mkCot(pick(disponibles), "rechazada", 8 + i * 4);
    cotizaciones.sort((a, b) => b.ts - a.ts);

    // reservas — a partir de los lotes "separado"
    const separados = lotes.filter(l => l.estado === "separado");
    const reservas = separados.map((l, i) => {
      const cli = pick(clientes);
      const ase = pick(comerciales);
      const createdAt = now - Math.floor(rnd() * 2 * DAY);
      // la mayoría vence en 1-3 días; una vence pronto para mostrar la cuenta regresiva
      const expiresAt = i === 0 ? now + 4 * 60000 : createdAt + (APP.condiciones.validezDias) * DAY;
      const dd = Math.max(1, Math.round((expiresAt - createdAt) / DAY));
      return {
        id: "RSV-" + l.id + "-" + (i + 1),
        loteId: l.id, manzana: l.manzana, numero: l.numero, precioLista: l.precioLista,
        asesorId: ase.id, asesorNombre: ase.nombre,
        clienteId: cli.id, clienteNombre: cli.nombre, clienteContacto: cli.telefono,
        createdAt, expiresAt, dias: dd, estado: "activa",
        historial: [{ ts: createdAt, accion: "creada", por: ase.nombre, detalle: dd + " días de plazo" }],
      };
    });

    return { clientes, cotizaciones, reservas };
  }

  // ---- ranking de conexiones (demo) ----
  // Registros de actividad ficticios para que el ranking se vea poblado en modo demo.
  function seedConexiones(APP) {
    const now = Date.now();
    let s = 4127;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    const autores = APP.demoAutores || [];
    const recs = autores.map((a, i) => {
      const count = 6 + Math.floor(rnd() * 40);
      const lastSeen = now - Math.floor(rnd() * 3 * DAY) - i * 3600000;
      return { id: a.id, nombre: a.nombre, rol: a.rol, color: a.color, iniciales: a.iniciales,
        count, firstSeen: now - (25 + Math.floor(rnd() * 20)) * DAY, lastSeen };
    });
    return recs;
  }

  // Deja en blanco el trabajo (cotizaciones/reservas/clientes/conexiones) conservando
  // inventario (lotes/plano), marca, condiciones y cuentas.
  function vaciarTrabajo() {
    save("cotizaciones", []);
    save("reservas", []);
    save("clientes", []);
    save("conexiones", []);
  }

  window.STORE = { has, load, save, remove, clearAll, idbGet, idbSet, idbDel, fmtLeft, fmtFechaHora, fmtDesde, seed, seedConexiones, vaciarTrabajo, DAY };
})();
