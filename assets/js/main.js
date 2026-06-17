/* =========================================================
   Site público — conteúdo dinâmico + interações (Editorial Luxe)
   Conteúdo vem da nuvem (Supabase) com fallback em WEDDING_DEFAULT.
   ========================================================= */
(function () {
  "use strict";
  const DEFAULTS = window.WEDDING_DEFAULT || {};
  let content = clone(DEFAULTS);
  let target = null; // timestamp da contagem regressiva

  function clone(o) { return JSON.parse(JSON.stringify(o || {})); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
  function $(s) { return document.querySelector(s); }
  function setText(sel, v) { const el = $(sel); if (el != null && v != null) el.textContent = v; }
  function setHTML(sel, v) { const el = $(sel); if (el != null && v != null) el.innerHTML = v; }
  function setAttr(sel, a, v) { const el = $(sel); if (el && v != null) el.setAttribute(a, v); }
  function mergeDeep(base, over) {
    const out = clone(base);
    if (!over) return out;
    Object.keys(over).forEach((k) => {
      const ov = over[k];
      if (ov && typeof ov === "object" && !Array.isArray(ov)) out[k] = mergeDeep(out[k] || {}, ov);
      else out[k] = ov;
    });
    return out;
  }

  /* =========================================================
     APLICAR CONTEÚDO AO DOM
     ========================================================= */
  function applyContent(c) {
    const names = `${esc(c.noiva)} <span class="amp">&amp;</span> ${esc(c.noivo)}`;
    const initials = `${esc((c.noiva || "")[0])} <span class="amp">&amp;</span> ${esc((c.noivo || "")[0])}`;
    const d = c.date ? new Date(c.date) : null;
    const year = d && !isNaN(d) ? d.getFullYear() : 2026;

    document.title = `${c.noiva} & ${c.noivo} · Nosso Casamento`;
    setHTML("#heroNames", names);
    setHTML("#footerNames", names);
    setHTML("#navLogo", initials);
    setHTML("#plMono", initials);
    setText("#plLabel", `${c.noiva} & ${c.noivo} · ${year}`);
    setText("#storySign", `${c.noiva} & ${c.noivo}`);
    setText("#storyCaption", `${c.noiva} & ${c.noivo}`);
    setText("#bandAuthor", `Com amor, ${c.noiva} & ${c.noivo}`);
    setText("#bandQuote", `"${c.quote}"`);
    setText("#heroCity", c.city);
    setText("#heroYear", String(year));
    setHTML("#heroDate", `<b>${esc(c.dateLabel)}</b> · ${esc(c.weekday)}`);
    setText("#footerHash", c.hashtag);
    if (d && !isNaN(d)) setText("#footerDate", `${pad(d.getDate())} · ${pad(d.getMonth() + 1)} · ${year}`);
    setText("#rsvpDeadline", c.rsvpDeadline);

    // História
    setHTML("#storyTitle", esc(c.story && c.story.title));
    if (c.story && Array.isArray(c.story.paragraphs)) {
      setHTML("#storyParas", c.story.paragraphs.map((p) => `<p>${esc(p)}</p>`).join(""));
    }
    if (c.storyPhoto) setAttr("#storyPhoto", "src", c.storyPhoto);

    // Evento
    if (c.ceremony) {
      setText("#cerName", c.ceremony.name); setText("#cerAddr", c.ceremony.address);
      setText("#cerTime", c.ceremony.time); if (c.ceremony.maps) setAttr("#cerMaps", "href", c.ceremony.maps);
    }
    if (c.reception) {
      setText("#recName", c.reception.name); setText("#recAddr", c.reception.address);
      setText("#recTime", c.reception.time); if (c.reception.maps) setAttr("#recMaps", "href", c.reception.maps);
    }

    // Programação
    if (Array.isArray(c.schedule)) {
      setHTML("#scheduleList", c.schedule.map((s) =>
        `<div class="tl-item reveal"><span class="tl-time">${esc(s.time)}</span><h4>${esc(s.title)}</h4><p>${esc(s.desc)}</p></div>`
      ).join(""));
    }

    // Galeria
    if (Array.isArray(c.gallery) && c.gallery.length) {
      const cls = ["g1", "g2", "g3", "g4", "g5"];
      const delays = ["", "d1", "", "d1", "d2"];
      setHTML("#galleryGrid", c.gallery.map((url, i) =>
        `<div class="gallery__item ${cls[i % cls.length]} figure reveal ${delays[i % delays.length]}"><div class="figure__ph"><img class="photo" src="${esc(url)}" alt="" loading="lazy" /></div></div>`
      ).join(""));
    }

    // Presentes
    if (c.gifts) {
      const pix = $("#pixKey");
      if (pix && c.gifts.pix) { pix.dataset.pix = c.gifts.pix; pix.textContent = "⎘ " + c.gifts.pix; }
      toggleLink("#giftList", c.gifts.listUrl);
      toggleLink("#giftHoney", c.gifts.honeymoonUrl);
    }

    // FAQ
    if (Array.isArray(c.faq)) {
      setHTML("#faqList", c.faq.map((f) =>
        `<div class="faq-item reveal"><button class="faq-item__q">${esc(f.q)} <span class="icon">+</span></button><div class="faq-item__a"><p>${esc(f.a)}</p></div></div>`
      ).join(""));
    }

    // Contagem regressiva
    target = d && !isNaN(d) ? d.getTime() : null;
    tick();

    wireDynamic();
  }

  function toggleLink(sel, url) {
    const el = $(sel);
    if (!el) return;
    const card = el.closest(".gift-card");
    if (url) { el.setAttribute("href", url); if (card) card.style.display = ""; }
    else if (card) { card.style.display = "none"; } // esconde o card se não houver link
  }

  /* =========================================================
     LIGA COMPORTAMENTOS EM ELEMENTOS DINÂMICOS
     ========================================================= */
  let io;
  function wireDynamic() {
    // reveal
    if (!io) {
      io = new IntersectionObserver(
        (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
      );
    }
    document.querySelectorAll(".reveal:not(.in)").forEach((r) => io.observe(r));

    // fotos com fallback
    document.querySelectorAll("img.photo").forEach((img) => {
      if (img._wired) return; img._wired = true;
      img.addEventListener("error", () => { img.style.opacity = "0"; });
    });

    // FAQ acordeão (rebind)
    document.querySelectorAll(".faq-item__q").forEach((q) => {
      if (q._wired) return; q._wired = true;
      q.addEventListener("click", () => {
        const item = q.parentElement;
        const ans = item.querySelector(".faq-item__a");
        const open = item.classList.contains("open");
        document.querySelectorAll(".faq-item").forEach((i) => { i.classList.remove("open"); i.querySelector(".faq-item__a").style.maxHeight = null; });
        if (!open) { item.classList.add("open"); ans.style.maxHeight = ans.scrollHeight + "px"; }
      });
    });

    // Pix copiar (rebind)
    document.querySelectorAll(".pix-key").forEach((k) => {
      if (k._wired) return; k._wired = true;
      k.addEventListener("click", () => {
        const key = k.dataset.pix || "";
        navigator.clipboard?.writeText(key).then(() => showToast("Chave Pix copiada! ✦"), () => showToast(key));
      });
    });
  }

  /* =========================================================
     INTERAÇÕES GERAIS
     ========================================================= */
  const pad = (n) => String(n).padStart(2, "0");

  // Preloader
  const preloader = $("#preloader");
  function hidePreloader() {
    if (!preloader) return;
    preloader.classList.add("lift");
    setTimeout(() => preloader.classList.add("hide"), 900);
    setTimeout(() => { preloader.style.display = "none"; }, 1800);
  }
  window.addEventListener("load", () => setTimeout(hidePreloader, 1300));
  setTimeout(hidePreloader, 3500);

  // Nav + progresso + parallax
  const nav = $("#nav"), navLinks = $("#navLinks"), navToggle = $("#navToggle"), progress = $("#scrollProgress");
  function onScroll() {
    const y = window.scrollY;
    if (nav) nav.classList.toggle("scrolled", y > 40);
    if (progress) { const h = document.documentElement.scrollHeight - window.innerHeight; progress.style.width = (h > 0 ? (y / h) * 100 : 0) + "%"; }
    const wm = $(".hero__watermark");
    if (wm && y < window.innerHeight) wm.style.transform = `translate(-50%, calc(-50% + ${y * 0.18}px))`;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  if (navToggle) {
    navToggle.addEventListener("click", () => { navLinks.classList.toggle("open"); navToggle.classList.toggle("open"); });
    navLinks.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => { navLinks.classList.remove("open"); navToggle.classList.remove("open"); }));
  }

  // Contagem regressiva
  const cd = { d: $("#cd-days"), h: $("#cd-hours"), m: $("#cd-mins"), s: $("#cd-secs") };
  function tick() {
    if (!target || !cd.d) return;
    let diff = target - Date.now(); if (diff < 0) diff = 0;
    cd.d.textContent = pad(Math.floor(diff / 86400000));
    cd.h.textContent = pad(Math.floor((diff % 86400000) / 3600000));
    cd.m.textContent = pad(Math.floor((diff % 3600000) / 60000));
    cd.s.textContent = pad(Math.floor((diff % 60000) / 1000));
  }
  setInterval(tick, 1000);

  // Toast
  const toast = $("#toast");
  let toastTimer;
  function showToast(msg) { if (!toast) return; toast.textContent = msg; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2600); }

  // RSVP via WhatsApp
  const form = $("#rsvpForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = form.name.value.trim(), going = form.going.value, guests = form.guests.value, msg = form.msg.value.trim();
      const casal = `${content.noiva || ""} & ${content.noivo || ""}`.trim();
      let text = `Olá! Confirmação de presença — Casamento ${casal}%0A%0A*Nome:* ${name}%0A*Resposta:* ${going}%0A*Pessoas:* ${guests}`;
      if (msg) text += `%0A*Recado:* ${msg}`;
      const phone = (content.whatsapp || "").replace(/\D/g, "");
      window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, "_blank");
      showToast("Abrindo o WhatsApp… 💌");
      form.reset();
    });
  }

  /* =========================================================
     INICIALIZAÇÃO
     ========================================================= */
  applyContent(content); // render imediato com defaults

  if (window.Cloud && window.Cloud.configured()) {
    // Nuvem ligada: lê o conteúdo compartilhado
    window.Cloud.getSite().then((remote) => {
      if (remote && typeof remote === "object") {
        content = mergeDeep(DEFAULTS, remote);
        applyContent(content);
      }
    }).catch(() => {});
  } else {
    // Modo local: usa o que foi salvo no painel deste navegador
    try {
      const local = JSON.parse(localStorage.getItem("casamento.site"));
      if (local && typeof local === "object") {
        content = mergeDeep(DEFAULTS, local);
        applyContent(content);
      }
    } catch (e) { /* ignora */ }
  }
})();
