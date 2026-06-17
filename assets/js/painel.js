/* =========================================================
   Painel dos Noivos — gestão + editor de conteúdo
   Persistência: Supabase (nuvem) quando configurado; senão localStorage.
   ========================================================= */
(function () {
  "use strict";
  const DEFAULTS = window.WEDDING_DEFAULT || {};
  const cloudOn = window.Cloud && window.Cloud.configured();

  const LS_SITE = "casamento.site";
  const LS_PANEL = "casamento.painel.v1";
  const LS_PASS = "casamento.pass";

  const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const MES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  let pass = "";
  let site = clone(DEFAULTS);
  let panel = { visits: [], checklist: [], budget: [] };

  /* ---------- utils ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o || {})); }
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
  function fmtBRL(n) { return "R$ " + Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
  function ymd(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
  function parseYmd(s) { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); }
  function pad(n) { return String(n).padStart(2, "0"); }
  function mergeDeep(base, over) {
    const out = clone(base); if (!over) return out;
    Object.keys(over).forEach((k) => {
      const ov = over[k];
      if (ov && typeof ov === "object" && !Array.isArray(ov)) out[k] = mergeDeep(out[k] || {}, ov);
      else out[k] = ov;
    });
    return out;
  }
  function getPath(obj, path) { return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj); }
  function setPath(obj, path, val) {
    const keys = path.split("."); let o = obj;
    for (let i = 0; i < keys.length - 1; i++) { if (o[keys[i]] == null || typeof o[keys[i]] !== "object") o[keys[i]] = {}; o = o[keys[i]]; }
    o[keys[keys.length - 1]] = val;
  }

  /* ---------- toast ---------- */
  const toast = $("#toast"); let tt;
  function showToast(msg) { if (!toast) return; toast.textContent = msg; toast.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove("show"), 2600); }

  /* ---------- seed checklist ---------- */
  function seedChecklist() {
    return [
      { id: uid(), cat: "Cerimônia", text: "Definir e reservar a igreja/local", done: true },
      { id: uid(), cat: "Cerimônia", text: "Escolher o celebrante", done: false },
      { id: uid(), cat: "Recepção", text: "Visitar e fechar o espaço da festa", done: false },
      { id: uid(), cat: "Recepção", text: "Contratar o buffet", done: false },
      { id: uid(), cat: "Fornecedores", text: "Fotógrafo e filmagem", done: false },
      { id: uid(), cat: "Fornecedores", text: "Decoração e flores", done: false },
      { id: uid(), cat: "Fornecedores", text: "DJ / banda", done: false },
      { id: uid(), cat: "Roupas & Beleza", text: "Vestido da noiva", done: false },
      { id: uid(), cat: "Roupas & Beleza", text: "Traje do noivo", done: false },
      { id: uid(), cat: "Convidados", text: "Montar lista de convidados", done: false },
      { id: uid(), cat: "Convidados", text: "Enviar convites", done: false },
    ];
  }

  /* =========================================================
     PERSISTÊNCIA
     ========================================================= */
  async function persistSite() {
    if (cloudOn) {
      try { await window.Cloud.saveSite(site, pass); showToast("Site publicado! ✦"); }
      catch (e) { showToast("Erro ao publicar. Tente de novo."); console.warn(e); }
    } else {
      localStorage.setItem(LS_SITE, JSON.stringify(site)); showToast("Salvo neste navegador ✦");
    }
  }
  async function persistPanel() {
    if (cloudOn) { try { await window.Cloud.savePanel(panel, pass); } catch (e) { console.warn(e); } }
    else { localStorage.setItem(LS_PANEL, JSON.stringify(panel)); }
  }

  /* =========================================================
     LOGIN / INICIALIZAÇÃO
     ========================================================= */
  const lock = $("#lockScreen"), pnav = $("#pnav"), app = $("#app");

  function showApp() {
    if (lock) lock.style.display = "none";
    if (pnav) pnav.style.display = "";
    if (app) app.style.display = "";
    renderAll();
  }

  async function unlock(p) {
    const ok = await window.Cloud.verifyPass(p);
    if (!ok) return false;
    pass = p; localStorage.setItem(LS_PASS, p);
    site = mergeDeep(DEFAULTS, (await window.Cloud.getSite()) || {});
    const remotePanel = await window.Cloud.getPanel(pass);
    panel = remotePanel && remotePanel.checklist ? remotePanel : { visits: [], checklist: seedChecklist(), budget: [] };
    if (!remotePanel || !remotePanel.checklist) await persistPanel(); // semeia na 1ª vez
    return true;
  }

  function initLocal() {
    // modo sem nuvem: tudo no navegador
    try { const s = JSON.parse(localStorage.getItem(LS_SITE)); if (s) site = mergeDeep(DEFAULTS, s); } catch (e) {}
    try { const p = JSON.parse(localStorage.getItem(LS_PANEL)); if (p && p.checklist) panel = p; else panel = { visits: [], checklist: seedChecklist(), budget: [] }; } catch (e) { panel = { visits: [], checklist: seedChecklist(), budget: [] }; }
    setStatus(false);
    showApp();
  }

  function setStatus(isCloud) {
    const st = $("#pnavStatus"); const logout = $("#logoutBtn");
    if (st) {
      st.textContent = isCloud ? "Nuvem · sincronizado" : "Local · este navegador";
      st.className = "pnav__status " + (isCloud ? "cloud" : "local");
    }
    if (logout) logout.style.display = isCloud ? "" : "none";
    const cs = $("#connStatus");
    if (cs) cs.innerHTML = isCloud
      ? `<span class="conn__dot on"></span><span><b>Conectado à nuvem.</b> Suas edições sincronizam entre você e sua noiva.</span>`
      : `<span class="conn__dot off"></span><span><b>Modo local.</b> Os dados ficam só neste navegador (a nuvem ainda não foi configurada).</span>`;
  }

  async function boot() {
    if (!cloudOn) { initLocal(); return; }
    // nuvem configurada → exige senha
    setStatus(true);
    if (lock) lock.style.display = "grid";
    const saved = localStorage.getItem(LS_PASS);
    if (saved) {
      const ok = await unlock(saved).catch(() => false);
      if (ok) { showApp(); return; }
      localStorage.removeItem(LS_PASS);
    }
    // foca no campo
    setTimeout(() => $("#lockPass") && $("#lockPass").focus(), 100);
  }

  if ($("#lockForm")) {
    $("#lockForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#lockErr"); err.textContent = "";
      const p = $("#lockPass").value;
      if (!p) return;
      err.textContent = "Verificando…";
      const ok = await unlock(p).catch(() => false);
      if (ok) { err.textContent = ""; showApp(); }
      else err.textContent = "Senha incorreta. Tente novamente.";
    });
  }
  if ($("#logoutBtn")) {
    $("#logoutBtn").addEventListener("click", () => { localStorage.removeItem(LS_PASS); location.reload(); });
  }

  /* =========================================================
     ABAS
     ========================================================= */
  document.querySelectorAll(".tab").forEach((t) => {
    t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      const v = t.dataset.view;
      document.querySelectorAll(".view").forEach((view) => view.classList.add("hidden"));
      const target = $("#view-" + v);
      if (target) target.classList.remove("hidden");
      if (v === "site") renderSiteEditor();
    });
  });

  /* =========================================================
     STATS + CONTAGEM
     ========================================================= */
  function weddingDate() { const d = site.date ? new Date(site.date) : null; return d && !isNaN(d) ? d : null; }
  function diasRestantes() { const w = weddingDate(); if (!w) return null; return Math.max(0, Math.ceil((w.getTime() - Date.now()) / 86400000)); }
  function proximaVisita() {
    const hoje = ymd(new Date());
    return [...panel.visits].filter((v) => v.date >= hoje).sort((a, b) => a.date.localeCompare(b.date) || (a.time||"").localeCompare(b.time||""))[0] || null;
  }
  function renderStats() {
    const dias = diasRestantes();
    $("#statDays").textContent = dias !== null ? dias : "—";
    $("#pnavCountdown").textContent = dias !== null ? (dias > 0 ? `Faltam ${dias} dias` : "É hoje! 🎉") : "—";

    const total = panel.checklist.length, done = panel.checklist.filter((i) => i.done).length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    $("#statChk").textContent = pct + "%";
    $("#statChkSub").textContent = `${done} de ${total} concluídos`;
    $("#statChkBar").style.width = pct + "%";

    $("#statBudget").textContent = fmtBRL(panel.budget.reduce((s, b) => s + Number(b.val || 0), 0));

    const prox = proximaVisita();
    if (prox) { const d = parseYmd(prox.date); $("#statVisit").textContent = `${d.getDate()} ${MES_ABREV[d.getMonth()]}`; $("#statVisitSub").textContent = prox.local; }
    else { $("#statVisit").textContent = "—"; $("#statVisitSub").textContent = "nenhuma agendada"; }
  }
  setInterval(() => { if (app && app.style.display !== "none") renderStats(); }, 60000);

  /* =========================================================
     CALENDÁRIO
     ========================================================= */
  let view = new Date(); view.setDate(1);
  function renderCalendar() {
    const y = view.getFullYear(), m = view.getMonth();
    $("#calTitle").textContent = `${MESES[m]} ${y}`;
    const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
    const todayStr = ymd(new Date()); const w = weddingDate(); const weddingStr = w ? ymd(w) : null;
    const cells = [];
    for (let i = 0; i < first; i++) cells.push('<div class="cal__day empty"></div>');
    for (let d = 1; d <= days; d++) {
      const ds = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const hasEvent = panel.visits.some((v) => v.date === ds);
      let cls = "cal__day";
      if (ds === todayStr) cls += " today";
      if (ds === weddingStr) cls += " wedding"; else if (hasEvent) cls += " has-event";
      const dot = (hasEvent && ds !== weddingStr) ? '<span class="cal__dot"></span>' : "";
      cells.push(`<div class="${cls}" data-date="${ds}">${d}${dot}</div>`);
    }
    $("#calDays").innerHTML = cells.join("");
    $("#calDays").querySelectorAll(".cal__day:not(.empty)").forEach((c) => c.addEventListener("click", () => openVisitModal(c.dataset.date)));
  }
  function renderVisits() {
    const list = $("#visitList"), hoje = ymd(new Date());
    const up = [...panel.visits].filter((v) => v.date >= hoje).sort((a, b) => a.date.localeCompare(b.date) || (a.time||"").localeCompare(b.time||""));
    if (!up.length) { list.innerHTML = '<p class="empty-state">Nenhuma visita marcada ainda.<br>Clique num dia do calendário para agendar. 📅</p>'; return; }
    list.innerHTML = up.map((v) => {
      const d = parseYmd(v.date);
      return `<div class="visit"><div class="visit__date"><div class="d">${d.getDate()}</div><div class="m">${MES_ABREV[d.getMonth()]}</div></div>
        <div class="visit__info"><strong>${esc(v.local)}</strong>${v.time ? `<span class="visit__time"> · ${v.time}</span>` : ""}${v.obs ? `<p>${esc(v.obs)}</p>` : ""}</div>
        <button class="visit__del" data-id="${v.id}" title="Remover">✕</button></div>`;
    }).join("");
    list.querySelectorAll(".visit__del").forEach((b) => b.addEventListener("click", async () => { panel.visits = panel.visits.filter((v) => v.id !== b.dataset.id); await persistPanel(); renderAll(); showToast("Visita removida"); }));
  }
  // modal
  const modal = $("#visitModal");
  function openVisitModal(date) { $("#vData").value = date || ymd(new Date()); $("#vLocal").value = ""; $("#vHora").value = ""; $("#vObs").value = ""; modal.classList.add("open"); setTimeout(() => $("#vLocal").focus(), 50); }
  function closeModal() { modal.classList.remove("open"); }
  modal.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closeModal));
  $("#addVisitBtn").addEventListener("click", () => openVisitModal());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });
  $("#visitForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    panel.visits.push({ id: uid(), local: $("#vLocal").value.trim(), date: $("#vData").value, time: $("#vHora").value, obs: $("#vObs").value.trim() });
    await persistPanel(); closeModal(); renderAll(); showToast("Visita agendada! 📅");
  });
  $("#calPrev").addEventListener("click", () => { view.setMonth(view.getMonth() - 1); renderCalendar(); });
  $("#calNext").addEventListener("click", () => { view.setMonth(view.getMonth() + 1); renderCalendar(); });
  $("#calToday").addEventListener("click", () => { view = new Date(); view.setDate(1); renderCalendar(); });

  /* =========================================================
     CHECKLIST
     ========================================================= */
  function renderChecklist() {
    const list = $("#chkList");
    if (!panel.checklist.length) { list.innerHTML = '<p class="empty-state">Nenhuma tarefa. Adicione a primeira acima! ✨</p>'; return; }
    const cats = {};
    panel.checklist.forEach((i) => { (cats[i.cat] = cats[i.cat] || []).push(i); });
    list.innerHTML = Object.keys(cats).map((cat) => {
      const items = cats[cat], done = items.filter((i) => i.done).length;
      return `<div class="chk__cat"><div class="chk__cat-title">${esc(cat)}<span class="chk__cat-count">${done}/${items.length}</span></div>
        ${items.map((i) => `<div class="chk-item ${i.done ? "done" : ""}" data-id="${i.id}"><div class="chk-box">✓</div><span class="chk-text">${esc(i.text)}</span><button class="chk-del" title="Remover">✕</button></div>`).join("")}</div>`;
    }).join("");
    list.querySelectorAll(".chk-item").forEach((el) => {
      const itemId = el.dataset.id;
      el.querySelector(".chk-box").addEventListener("click", () => toggleChk(itemId));
      el.querySelector(".chk-text").addEventListener("click", () => toggleChk(itemId));
      el.querySelector(".chk-del").addEventListener("click", async (e) => { e.stopPropagation(); panel.checklist = panel.checklist.filter((i) => i.id !== itemId); await persistPanel(); renderAll(); });
    });
  }
  async function toggleChk(itemId) { const it = panel.checklist.find((i) => i.id === itemId); if (it) { it.done = !it.done; await persistPanel(); renderAll(); } }
  $("#chkForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = $("#chkInput").value.trim(); if (!text) return;
    panel.checklist.push({ id: uid(), cat: $("#chkCat").value, text, done: false });
    $("#chkInput").value = ""; await persistPanel(); renderAll(); showToast("Tarefa adicionada ✨");
  });

  /* =========================================================
     ORÇAMENTO
     ========================================================= */
  function renderBudget() {
    const list = $("#budList");
    if (!panel.budget.length) list.innerHTML = '<p class="empty-state">Adicione os custos do casamento para acompanhar o total. 💸</p>';
    else {
      list.innerHTML = panel.budget.map((b) => `<div class="bud-item" data-id="${b.id}"><span class="bud-item__name">${esc(b.name)}</span><div class="bud-item__right"><span class="bud-item__val">${fmtBRL(b.val)}</span><button class="bud-del" title="Remover">✕</button></div></div>`).join("");
      list.querySelectorAll(".bud-del").forEach((b) => b.addEventListener("click", async () => { const itemId = b.closest(".bud-item").dataset.id; panel.budget = panel.budget.filter((x) => x.id !== itemId); await persistPanel(); renderAll(); }));
    }
    $("#budTotal").textContent = fmtBRL(panel.budget.reduce((s, b) => s + Number(b.val || 0), 0));
  }
  $("#budForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#budName").value.trim(), val = parseFloat($("#budVal").value);
    if (!name || isNaN(val)) return;
    panel.budget.push({ id: uid(), name, val });
    $("#budName").value = ""; $("#budVal").value = ""; await persistPanel(); renderAll(); showToast("Custo adicionado 💸");
  });

  /* =========================================================
     EDITOR DO SITE
     ========================================================= */
  function fld(label, path, opts) {
    opts = opts || {};
    const val = esc(getPath(site, path) || "");
    const full = opts.full ? " full" : "";
    if (opts.area) return `<div class="ed-field${full}"><label>${label}</label><textarea data-path="${path}" rows="${opts.rows||3}">${val}</textarea></div>`;
    const type = opts.type || "text";
    return `<div class="ed-field${full}"><label>${label}</label><input type="${type}" data-path="${path}" value="${val}" /></div>`;
  }

  function renderSiteEditor() {
    const c = site;
    const paras = (c.story && Array.isArray(c.story.paragraphs)) ? c.story.paragraphs.join("\n") : "";
    const html = `
      <div class="ed-group">
        <h3 class="ed-group__title">O <em>casal</em> &amp; a data</h3>
        <div class="ed-grid">
          ${fld("Noiva", "noiva")}
          ${fld("Noivo", "noivo")}
          ${fld("Data e hora da cerimônia", "date", { type: "datetime-local" })}
          ${fld("Data por extenso (ex.: 15 de Novembro de 2026)", "dateLabel")}
          ${fld("Dia da semana", "weekday")}
          ${fld("Cidade / Local (hero)", "city")}
          ${fld("Hashtag", "hashtag")}
          ${fld("Prazo para confirmar presença (RSVP)", "rsvpDeadline")}
          ${fld("WhatsApp p/ RSVP (só números, com DDD)", "whatsapp", { full: true })}
          ${fld("Frase do convite (citação)", "quote", { area: true, full: true, rows: 2 })}
        </div>
      </div>

      <div class="ed-group">
        <h3 class="ed-group__title">Nossa <em>história</em></h3>
        <div class="ed-grid">
          ${fld("Título", "story.title", { full: true })}
          <div class="ed-field full"><label>Texto (um parágrafo por linha)</label><textarea data-path="story.paragraphs" data-type="lines" rows="6">${esc(paras)}</textarea></div>
          ${fld("Foto da história (link da imagem)", "storyPhoto", { full: true })}
        </div>
      </div>

      <div class="ed-group">
        <h3 class="ed-group__title">Cerimônia &amp; <em>Recepção</em></h3>
        <div class="ed-grid">
          ${fld("Cerimônia — Local", "ceremony.name")}
          ${fld("Cerimônia — Endereço", "ceremony.address")}
          ${fld("Cerimônia — Horário", "ceremony.time")}
          ${fld("Cerimônia — Link do mapa", "ceremony.maps")}
          ${fld("Recepção — Local", "reception.name")}
          ${fld("Recepção — Endereço", "reception.address")}
          ${fld("Recepção — Horário", "reception.time")}
          ${fld("Recepção — Link do mapa", "reception.maps")}
        </div>
      </div>

      <div class="ed-group">
        <h3 class="ed-group__title">Programação <em>do dia</em></h3>
        <p class="ed-group__hint">Horário, título e descrição de cada momento.</p>
        <div class="ed-list" id="edSchedule"></div>
        <button class="ed-add" id="addSched">+ Adicionar momento</button>
      </div>

      <div class="ed-group">
        <h3 class="ed-group__title">Galeria <em>de fotos</em></h3>
        <p class="ed-group__hint">Cole o link de cada foto (ex.: Unsplash, Google Drive público, ou um link direto).</p>
        <div class="ed-list" id="edGallery"></div>
        <button class="ed-add" id="addGal">+ Adicionar foto</button>
      </div>

      <div class="ed-group">
        <h3 class="ed-group__title">Presentes</h3>
        <div class="ed-grid">
          ${fld("Chave Pix", "gifts.pix", { full: true })}
          ${fld("Link da lista de presentes (loja) — opcional", "gifts.listUrl")}
          ${fld("Link das cotas de lua de mel — opcional", "gifts.honeymoonUrl")}
        </div>
      </div>

      <div class="ed-group">
        <h3 class="ed-group__title">Perguntas <em>frequentes</em></h3>
        <div class="ed-list" id="edFaq"></div>
        <button class="ed-add" id="addFaq">+ Adicionar pergunta</button>
      </div>
    `;
    $("#siteEditor").innerHTML = html;
    renderSchedRows(); renderGalRows(); renderFaqRows();
    $("#addSched").addEventListener("click", () => { collectSchedule(); site.schedule.push({ time: "", title: "", desc: "" }); renderSchedRows(); });
    $("#addGal").addEventListener("click", () => { collectGallery(); site.gallery.push(""); renderGalRows(); });
    $("#addFaq").addEventListener("click", () => { collectFaq(); site.faq.push({ q: "", a: "" }); renderFaqRows(); });
  }

  function renderSchedRows() {
    if (!Array.isArray(site.schedule)) site.schedule = [];
    $("#edSchedule").innerHTML = site.schedule.map((s, i) =>
      `<div class="ed-row sched" data-i="${i}"><input data-k="time" placeholder="16h00" value="${esc(s.time)}" />
        <div><input data-k="title" placeholder="Título" value="${esc(s.title)}" style="margin-bottom:8px;" /><textarea data-k="desc" rows="2" placeholder="Descrição">${esc(s.desc)}</textarea></div>
        <button class="ed-row__del" title="Remover" data-del="sched" data-i="${i}">✕</button></div>`
    ).join("");
    bindDel("sched");
  }
  function renderGalRows() {
    if (!Array.isArray(site.gallery)) site.gallery = [];
    $("#edGallery").innerHTML = site.gallery.map((u, i) =>
      `<div class="ed-row gal" data-i="${i}"><input data-k="url" placeholder="https://..." value="${esc(u)}" /><button class="ed-row__del" title="Remover" data-del="gal" data-i="${i}">✕</button></div>`
    ).join("");
    bindDel("gal");
  }
  function renderFaqRows() {
    if (!Array.isArray(site.faq)) site.faq = [];
    $("#edFaq").innerHTML = site.faq.map((f, i) =>
      `<div class="ed-row faq" data-i="${i}"><input data-k="q" placeholder="Pergunta" value="${esc(f.q)}" /><textarea data-k="a" rows="2" placeholder="Resposta">${esc(f.a)}</textarea><button class="ed-row__del" title="Remover" data-del="faq" data-i="${i}" style="position:absolute;top:8px;right:8px;">✕</button></div>`
    ).join("");
    bindDel("faq");
  }
  function bindDel(type) {
    document.querySelectorAll(`[data-del="${type}"]`).forEach((b) => b.addEventListener("click", () => {
      const i = +b.dataset.i;
      if (type === "sched") { collectSchedule(); site.schedule.splice(i, 1); renderSchedRows(); }
      if (type === "gal") { collectGallery(); site.gallery.splice(i, 1); renderGalRows(); }
      if (type === "faq") { collectFaq(); site.faq.splice(i, 1); renderFaqRows(); }
    }));
  }
  function collectSchedule() {
    site.schedule = [...document.querySelectorAll("#edSchedule .ed-row")].map((r) => ({
      time: r.querySelector('[data-k="time"]').value, title: r.querySelector('[data-k="title"]').value, desc: r.querySelector('[data-k="desc"]').value,
    }));
  }
  function collectGallery() {
    site.gallery = [...document.querySelectorAll("#edGallery .ed-row")].map((r) => r.querySelector('[data-k="url"]').value.trim()).filter(Boolean);
  }
  function collectFaq() {
    site.faq = [...document.querySelectorAll("#edFaq .ed-row")].map((r) => ({ q: r.querySelector('[data-k="q"]').value, a: r.querySelector('[data-k="a"]').value }));
  }
  function collectSiteEditor() {
    document.querySelectorAll("#siteEditor [data-path]").forEach((el) => {
      const path = el.dataset.path;
      let val = el.value;
      if (el.dataset.type === "lines") val = val.split("\n").map((s) => s.trim()).filter(Boolean);
      setPath(site, path, val);
    });
    collectSchedule(); collectGallery(); collectFaq();
  }
  async function saveSiteNow() { collectSiteEditor(); await persistSite(); }
  if ($("#saveSiteBtn")) $("#saveSiteBtn").addEventListener("click", saveSiteNow);
  if ($("#saveSiteBtn2")) $("#saveSiteBtn2").addEventListener("click", saveSiteNow);

  /* =========================================================
     TROCA DE SENHA
     ========================================================= */
  if ($("#passForm")) {
    $("#passForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!cloudOn) { showToast("Disponível só no modo nuvem."); return; }
      const o = $("#passOld").value, n = $("#passNew").value, n2 = $("#passNew2").value;
      if (n.length < 4) { showToast("A nova senha precisa de pelo menos 4 caracteres."); return; }
      if (n !== n2) { showToast("As senhas novas não conferem."); return; }
      try {
        const ok = await window.Cloud.changePass(o, n);
        if (ok) { pass = n; localStorage.setItem(LS_PASS, n); $("#passForm").reset(); showToast("Senha atualizada! 🔒"); }
        else showToast("Senha atual incorreta.");
      } catch (err) { showToast("Erro ao trocar a senha."); console.warn(err); }
    });
  }

  /* =========================================================
     RENDER GERAL
     ========================================================= */
  function renderAll() { renderStats(); renderCalendar(); renderVisits(); renderChecklist(); renderBudget(); }

  boot();
})();
