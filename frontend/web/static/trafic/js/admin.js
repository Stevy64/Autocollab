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

  document.querySelectorAll("[data-confirm]").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      const message = form.getAttribute("data-confirm");
      if (message && !window.confirm(message)) event.preventDefault();
    });
  });
})();
