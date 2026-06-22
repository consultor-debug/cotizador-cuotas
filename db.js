/*!
 * Cotizador de Cuotas
 * Copyright (c) 2026 Luis D.. Todos los derechos reservados.
 * Software propietario. Prohibida su copia, distribución o uso sin
 * autorización escrita del titular. Ver archivo LICENSE.
 */

/* ============================================================
   DB — capa de datos Supabase
   Autenticación, perfiles, estado compartido y conexiones.
   ============================================================ */
(function () {
  const URL  = "https://sfgpskqrbwddlyxfunsv.supabase.co";
  const KEY  = "sb_publishable_R9K6wUXH-DSeEQsrDSKkkA_GVONP2-u";

  const lib  = window.supabase || window.Supabase || {};
  const cc   = lib.createClient;
  if (!cc) { console.error("[DB] supabase-js no está cargado"); }

  const db = cc ? cc(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true } }) : null;

  // ---- AUTH ----
  async function getSession() {
    if (!db) return null;
    const { data } = await db.auth.getSession();
    return data.session || null;
  }

  async function login(usuario, pass) {
    if (!db) return { ok: false, motivo: "Base de datos no disponible." };
    const email = usuario.trim().toLowerCase() + "@cotizador.app";
    const { data, error } = await db.auth.signInWithPassword({ email, password: pass });
    if (error) return { ok: false, motivo: "Usuario o contraseña incorrectos." };
    const { data: prof } = await db.from("profiles").select("*").eq("id", data.user.id).single();
    if (!prof) { await db.auth.signOut(); return { ok: false, motivo: "Perfil no encontrado. Contacta al administrador." }; }
    if (prof.activo === false) { await db.auth.signOut(); return { ok: false, motivo: "Tu acceso está bloqueado. Contacta al administrador." }; }
    return { ok: true, session: data.session, profile: prof };
  }

  async function logout() { if (db) await db.auth.signOut(); }

  // Crea un usuario de autenticación sin cerrar la sesión del admin (cliente temporal)
  async function signUpUser(usuario, password) {
    if (!db || !cc) return { ok: false, motivo: "supabase-js no disponible." };
    const email = usuario.trim().toLowerCase() + "@cotizador.app";
    const tmp = cc(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await tmp.auth.signUp({ email, password });
    if (error) return { ok: false, motivo: error.message };
    if (!data.user) return { ok: false, motivo: "No se pudo crear la cuenta." };
    return { ok: true, userId: data.user.id };
  }

  async function countProfiles() {
    if (!db) return 0;
    try {
      const { data, error } = await db.rpc("count_profiles");
      return error ? 0 : (data || 0);
    } catch (e) { return 0; }
  }

  // ---- PERFILES ----
  async function loadProfiles() {
    if (!db) return [];
    const { data } = await db.from("profiles").select("*").order("created_at");
    return data || [];
  }

  async function upsertProfile(prof) {
    if (!db) return { ok: false };
    const { error } = await db.from("profiles").upsert(prof, { onConflict: "id" });
    return { ok: !error, error };
  }

  async function deleteProfile(id) {
    if (!db) return { ok: false };
    const { error } = await db.from("profiles").delete().eq("id", id);
    return { ok: !error };
  }

  // ---- ESTADO COMPARTIDO ----
  async function loadMain() {
    if (!db) return null;
    const { data } = await db.from("app_state").select("data").eq("id", "main").single();
    return (data && data.data) ? data.data : null;
  }

  async function saveMain(obj) {
    if (!db) return;
    await db.from("app_state").upsert({ id: "main", data: obj, updated_at: new Date().toISOString() });
  }

  async function loadAssets() {
    if (!db) return null;
    const { data } = await db.from("app_state").select("data").eq("id", "assets").single();
    return (data && data.data) ? data.data : null;
  }

  async function saveAssets(obj) {
    if (!db) return;
    await db.from("app_state").upsert({ id: "assets", data: obj, updated_at: new Date().toISOString() });
  }

  // ---- CONEXIONES ----
  async function loadConexiones() {
    if (!db) return [];
    const { data } = await db.from("conexiones").select("*").order("count", { ascending: false });
    return data || [];
  }

  async function upsertConexion(id, info) {
    if (!db) return;
    const now = new Date().toISOString();
    const { data: ex } = await db.from("conexiones").select("count, first_seen").eq("id", id).single();
    const count = ex ? (ex.count + 1) : 1;
    const first_seen = ex ? ex.first_seen : now;
    await db.from("conexiones").upsert({ id, ...info, count, first_seen, last_seen: now });
  }

  async function clearConexiones() {
    if (!db) return;
    await db.from("conexiones").delete().gte("count", 0);
  }

  // ---- REALTIME BROADCAST (sync en tiempo real entre usuarios) ----
  // Crea un canal de broadcast. El emisor NO recibe sus propios mensajes (self: false).
  // onRemoteUpdate(data) se llama cuando OTRO usuario guarda el estado principal.
  function createSyncChannel(userId, onRemoteUpdate) {
    if (!db) return { send: () => {}, unsub: () => {} };
    const channel = db.channel("cotizador_main", {
      config: { broadcast: { self: false } },
    });
    channel
      .on("broadcast", { event: "state" }, ({ payload }) => {
        if (payload && payload.by !== userId && payload.data) {
          onRemoteUpdate(payload.data);
        }
      })
      .subscribe();
    const send = (data) => {
      channel.send({ type: "broadcast", event: "state", payload: { by: userId, data } })
        .catch(() => {});
    };
    const unsub = () => { try { db.removeChannel(channel); } catch (e) {} };
    return { send, unsub };
  }

  window.DB = { db, getSession, login, logout, signUpUser, countProfiles,
    loadProfiles, upsertProfile, deleteProfile,
    loadMain, saveMain, loadAssets, saveAssets,
    loadConexiones, upsertConexion, clearConexiones,
    createSyncChannel };
})();
