// supabase/functions/admin-set-password/index.ts
//
// Cotizador de Cuotas — Edge Function para que un ADMINISTRADOR
// cambie la contraseña de cualquier usuario de forma SEGURA.
//
// La llave service_role (de administrador) vive SOLO aquí, en el servidor,
// nunca en el navegador. La app llama a esta función con la sesión del admin;
// la función verifica que quien llama tenga permiso y recién entonces
// cambia la contraseña del usuario destino.
//
// ── CÓMO DESPLEGARLA (una sola vez) ────────────────────────────────────────
// 1. Instala la CLI de Supabase:  https://supabase.com/docs/guides/cli
// 2. En la carpeta del proyecto:
//      supabase login
//      supabase link --project-ref sfgpskqrbwddlyxfunsv
//      supabase functions deploy admin-set-password
// 3. Las variables SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY
//    ya existen automáticamente en el entorno de las Edge Functions, no hay
//    que configurarlas a mano.
// ────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const esGerencia = (rol: string) => /gerente|subgerente/i.test(rol || "");
const esJefatura = (rol: string) => /coordinador|jefatura|jefe/i.test(rol || "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  try {
    const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
    const ANON          = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1) Identificar a quien llama por su sesión (JWT del header Authorization)
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "No autorizado." }, 401);

    const caller = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: who } = await caller.auth.getUser();
    if (!who?.user) return json({ error: "Sesión inválida." }, 401);

    // 2) Verificar que quien llama sea administrador (con la llave de servicio)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: prof } = await admin
      .from("profiles").select("super, rol, accesos, activo").eq("id", who.user.id).single();

    const puede =
      !!prof &&
      prof.activo !== false &&
      (prof.super === true ||
        prof.accesos?.usuarios === true ||
        esGerencia(prof.rol) ||
        esJefatura(prof.rol));

    if (!puede) return json({ error: "No tienes permiso para cambiar contraseñas." }, 403);

    // 3) Validar datos de entrada
    const { userId, newPassword } = await req.json();
    if (!userId || typeof newPassword !== "string" || newPassword.length < 4)
      return json({ error: "Datos inválidos. La contraseña debe tener al menos 4 caracteres." }, 400);

    // 4) Cambiar la contraseña del usuario destino
    const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) return json({ error: error.message }, 400);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
