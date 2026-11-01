(function () {
  const body = document.body;
  const scrim = document.querySelector("[data-nav-close]");
  const openBtn = document.querySelector("[data-nav]");
  const collapseBtn = document.querySelector("[data-collapse]");
  const clef = "wayize.admin.menu";

  function setNav(ouvert) {
    body.classList.toggle("is-nav-open", ouvert);
    if (scrim) scrim.hidden = !ouvert;
  }

  if (openBtn) openBtn.addEventListener("click", function () { setNav(true); });
  if (scrim) scrim.addEventListener("click", function () { setNav(false); });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setNav(false);
  });

  if (collapseBtn) {
    try {
      if (localStorage.getItem(clef) === "1") body.classList.add("is-collapsed");
    } catch (error) {
      /* le menu reste ouvert */
    }
    collapseBtn.addEventListener("click", function () {
      const ferme = !body.classList.contains("is-collapsed");
      body.classList.toggle("is-collapsed", ferme);
      try { localStorage.setItem(clef, ferme ? "1" : "0"); } catch (error) { /* ignore */ }
    });
  }

  document.querySelectorAll(".wa-rights").forEach(function (form) {
    const button = form.querySelector("[type=submit]");
    if (!button) return;
    function snapshot() {
      return Array.from(form.querySelectorAll("input[type=checkbox]")).map(function (input) {
        return (input.name || "x") + ":" + (input.checked ? "1" : "0");
      }).join("|");
    }
    const initial = snapshot();
    function sync() {
      const idle = snapshot() === initial;
      button.disabled = idle;
      button.classList.toggle("is-idle", idle);
    }
    form.addEventListener("change", sync);
    sync();
  });

  document.querySelectorAll("[data-confirm]").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      const message = form.getAttribute("data-confirm");
      if (message && !window.confirm(message)) event.preventDefault();
    });
  });

  function depart() {
    body.classList.add("is-leaving");
  }

  document.addEventListener("click", function (event) {
    const lien = event.target.closest("a[href]");
    if (!lien || lien.target || lien.hasAttribute("download")) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    const url = new URL(lien.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname && url.search === location.search) return;
    depart();
  });

  document.addEventListener("submit", function (event) {
    if (event.defaultPrevented) return;
    const bouton = event.target.querySelector("[type=submit]");
    if (bouton && !bouton.disabled) bouton.classList.add("is-loading");
    depart();
  });
})();
