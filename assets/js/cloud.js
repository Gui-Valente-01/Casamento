/* =========================================================
   Cloud — camada de dados (Supabase)
   Sem back-end próprio: usa funções RPC do Supabase.
   - Leitura do site: pública (get_site)
   - Dados do painel e gravações: protegidos por senha de edição
   Se a nuvem não estiver configurada/online, os métodos retornam
   null e o app usa o conteúdo padrão (config.js).
   ========================================================= */
window.Cloud = (function () {
  "use strict";
  const cfg = window.SUPABASE || {};
  let client = null;

  function configured() { return !!(cfg.url && cfg.anonKey); }
  function init() {
    if (client) return client;
    if (!configured() || !window.supabase) return null;
    client = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: false },
    });
    return client;
  }

  async function rpc(fn, args) {
    const c = init();
    if (!c) return { data: null, error: new Error("cloud-offline") };
    try {
      return await c.rpc(fn, args || {});
    } catch (e) {
      return { data: null, error: e };
    }
  }

  /* ---- Site (público) ---- */
  async function getSite() {
    const { data, error } = await rpc("get_site");
    if (error) { console.warn("[Cloud] getSite:", error.message); return null; }
    return data || null;
  }
  async function saveSite(content, pass) {
    const { data, error } = await rpc("save_site", { p_content: content, p_pass: pass });
    if (error) throw error;
    return data;
  }

  /* ---- Painel (privado, exige senha) ---- */
  async function getPanel(pass) {
    const { data, error } = await rpc("get_panel", { p_pass: pass });
    if (error) { console.warn("[Cloud] getPanel:", error.message); return null; }
    return data || null;
  }
  async function savePanel(panelData, pass) {
    const { data, error } = await rpc("save_panel", { p_data: panelData, p_pass: pass });
    if (error) throw error;
    return data;
  }

  /* ---- Autenticação por senha de edição ---- */
  async function verifyPass(pass) {
    const { data, error } = await rpc("verify_pass", { p_pass: pass });
    if (error) return false;
    return data === true;
  }
  async function changePass(oldPass, newPass) {
    const { data, error } = await rpc("change_pass", { p_old: oldPass, p_new: newPass });
    if (error) throw error;
    return data === true;
  }

  return { configured, init, getSite, saveSite, getPanel, savePanel, verifyPass, changePass };
})();
