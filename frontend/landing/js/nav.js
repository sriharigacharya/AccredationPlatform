/* =====================================================
   AcademiQ — Shared Navigation JS
   Handles sidebar toggle, active links, scroll reveal
   ===================================================== */

(function () {
  "use strict";

  // ── Sidebar toggle (mobile) ──────────────────────────
  const sidebar  = document.getElementById("sidebar");
  const sbToggle = document.getElementById("sb-toggle");
  const overlay  = document.getElementById("sb-overlay");

  if (sbToggle && sidebar) {
    sbToggle.addEventListener("click", () => {
      sidebar.classList.toggle("open");
      if (overlay) overlay.classList.toggle("show");
    });
  }
  if (overlay) {
    overlay.addEventListener("click", () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("show");
    });
  }

  // ── Active link: mark the current page ──────────────
  const currentFile = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".sb-link").forEach(link => {
    const href = (link.getAttribute("href") || "").split("/").pop();
    if (href === currentFile) link.classList.add("active");
  });

  // ── Scroll reveal (IntersectionObserver) ────────────
  const rvEls = document.querySelectorAll(".rv");
  if (rvEls.length) {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("show"); obs.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -28px 0px" });
    rvEls.forEach(el => obs.observe(el));
  }

  // ── Animated counters ────────────────────────────────
  document.querySelectorAll("[data-count]").forEach(el => {
    const target = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || "";
    const prefix = el.dataset.prefix || "";
    if (isNaN(target)) return;
    const obs2 = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      obs2.disconnect();
      let n = 0;
      const steps = 50;
      const inc = target / steps;
      const tick = () => {
        n = Math.min(n + inc, target);
        el.textContent = prefix + (Number.isInteger(target) ? Math.round(n) : n.toFixed(1)) + suffix;
        if (n < target) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    obs2.observe(el);
  });

  // ── Pill toggle helper ───────────────────────────────
  document.querySelectorAll(".pill-toggle").forEach(group => {
    group.querySelectorAll(".pill-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        group.querySelectorAll(".pill-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const target = btn.dataset.target;
        if (target) {
          document.querySelectorAll(".toggle-panel").forEach(p => p.hidden = true);
          const panel = document.getElementById(target);
          if (panel) panel.hidden = false;
        }
      });
    });
  });

  // ── Filter chip toggle ───────────────────────────────
  document.querySelectorAll(".chip[data-filter]").forEach(chip => {
    chip.addEventListener("click", () => {
      chip.classList.toggle("active");
    });
  });

})();
