let boot = null;
let map = null;
let markerLayer = null;
let pickLayer = null;
let toastTimer = 0;
let hashDone = false;

const FILTERS = [
  { id: "tous", label: "Tous" },
  { id: "bouchon", label: "Bouchons" },
  { id: "accident", label: "Accidents" },
  { id: "travaux", label: "Travaux" },
  { id: "police", label: "Police" },
  { id: "route_barree", label: "Routes barrées" },
  { id: "autre", label: "Autres" },
];

const TYPE_STYLE = {
  bouchon: { pin: "#F5B400", glyph: "#1F1600", chipText: "#1F1600" },
  accident: { pin: "#E10600", glyph: "#E10600", chipText: "#ffffff" },
  travaux: { pin: "#E4570E", glyph: "#9A3412", chipText: "#1a1a1a" },
  police: { pin: "#1A62D6", glyph: "#1A62D6", chipText: "#ffffff" },
  route_barree: { pin: "#1A1A1A", glyph: "#1A1A1A", chipText: "#ffffff" },
  autre: { pin: "#52606D", glyph: "#52606D", chipText: "#ffffff" },
};

const GLYPH = {
  bouchon: '<path d="M2.3 9.1 3.7 6.5A1.3 1.3 0 0 1 4.9 5.8h6.2c.5 0 .9.3 1.1.7l1.5 2.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M1.6 9.1h12.8v2.3c0 .5-.4.9-.9.9H2.5c-.5 0-.9-.4-.9-.9V9.1z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="4.7" cy="12.5" r="1" fill="currentColor"/><circle cx="11.3" cy="12.5" r="1" fill="currentColor"/>',
  accident: '<path d="M8 1.4 14.6 14.2H1.4L8 1.4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 6.1v3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="12.1" r=".9" fill="currentColor"/>',
  travaux: '<path d="M8 1.2 12.4 13.2H3.6L8 1.2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M2.2 14.2h11.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  police: '<path d="M8 1.2 14 3.3v4.6c0 3.5-2.4 5.6-6 6.9-3.6-1.3-6-3.4-6-6.9V3.3L8 1.2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  route_barree: '<rect x="1.2" y="4.2" width="13.6" height="7.6" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 4.6 6.2 11.4M7.4 4.6 9.6 11.4M10.8 4.6l2.2 6.8" stroke="currentColor" stroke-width="1.4"/>',
  autre: '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 7.1V11.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="4.8" r=".9" fill="currentColor"/>',
};

function emptyDraft() {
  return { type: "", commentaire: "", lieuId: "", lieu: "", latitude: null, longitude: null };
}

const state = {
  reports: [],
  tendance: null,
  filter: "tous",
  mode: "feed",
  returnMode: "feed",
  selectedId: null,
  loading: false,
  loaded: false,
  error: null,
  picking: false,
  saving: false,
  commentSending: false,
  commentError: "",
  detailDraft: "",
  errors: {},
  draft: emptyDraft(),
  markerKey: "",
  place: null,
  searchOpen: false,
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function styleOf(type) {
  return TYPE_STYLE[type] || TYPE_STYLE.autre;
}

function iconSvg(type) {
  return `<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">${GLYPH[type] || GLYPH.autre}</svg>`;
}

function csrf() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.content : "";
}

function prefersReduced() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function motion() {
  return prefersReduced() ? 0 : 0.55;
}

function isDesktop() {
  return window.matchMedia("(min-width: 960px)").matches;
}

function homeZoom() {
  return window.innerWidth < 720 ? 12 : boot.centre.zoom;
}

function appuisCourt(n) {
  if (!n) return "pas confirmé";
  return `${n}×`;
}

function appuisPhrase(n) {
  if (n === 0) return "Aucun conducteur n'a encore confirmé.";
  if (n === 1) return "1 conducteur confirme ce signalement.";
  return `${n} conducteurs confirment ce signalement.`;
}

function precisionsCourt(n) {
  if (!n) return "";
  if (n === 1) return "1 précision";
  return `${n} précisions`;
}

function messageFrom(error, fallback) {
  if (error && error.status === 403) return "La session a expiré. Rechargez la page pour publier.";
  if (error && error.status === 0) return "Pas de connexion. Réessayez dès que le réseau revient.";
  if (error && error.data && error.data.message) return error.data.message;
  return fallback;
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.hidden = true;
  }, 3800);
}

async function api(url, options = {}) {
  const method = options.method || "GET";
  const headers = { Accept: "application/json" };
  if (method !== "GET" && method !== "HEAD") headers["X-CSRFToken"] = csrf();
  if (options.body) headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.body,
      credentials: "same-origin",
    });
  } catch (error) {
    const failure = new Error("network");
    failure.status = 0;
    failure.data = {};
    throw failure;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const failure = new Error("http");
    failure.status = response.status;
    failure.data = data;
    throw failure;
  }
  return data;
}

function visiblePx() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--sheet-visible").trim();
  if (raw.endsWith("px")) return parseFloat(raw);
  if (raw.endsWith("dvh") || raw.endsWith("vh")) return (window.innerHeight * parseFloat(raw)) / 100;
  return window.innerHeight * 0.46;
}

function sheetCeiling() {
  if (isDesktop()) return Math.round(window.innerHeight - 32);
  const top = document.querySelector(".topbar");
  const reserve = top ? Math.ceil(top.getBoundingClientRect().bottom) + 10 : 132;
  return Math.max(220, window.innerHeight - reserve);
}

function setVisible(px) {
  const next = Math.max(96, Math.min(sheetCeiling(), Math.round(px)));
  document.documentElement.style.setProperty("--sheet-visible", `${next}px`);
  const top = document.querySelector(".topbar");
  const needed = top ? Math.ceil(top.getBoundingClientRect().bottom) + 64 : 180;
  document.body.classList.toggle("sheet-covers", !isDesktop() && window.innerHeight - next < needed);
}

function snapPoints() {
  const height = window.innerHeight;
  return [108, Math.round(height * 0.46), sheetCeiling()];
}

function snapTo(px) {
  const points = snapPoints();
  let best = points[0];
  let distance = Infinity;
  for (const point of points) {
    const delta = Math.abs(point - px);
    if (delta < distance) {
      distance = delta;
      best = point;
    }
  }
  setVisible(best);
}

function cycleSheet() {
  const points = snapPoints();
  const current = visiblePx();
  let index = 0;
  let best = Infinity;
  points.forEach((point, i) => {
    const delta = Math.abs(point - current);
    if (delta < best) {
      best = delta;
      index = i;
    }
  });
  setVisible(points[(index + 1) % points.length]);
}

function inside(latitude, longitude) {
  const bounds = boot.bornes;
  return latitude >= bounds.sud && latitude <= bounds.nord && longitude >= bounds.ouest && longitude <= bounds.est;
}

function haversine(lat1, lng1, lat2, lng2) {
  const earth = 6371;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(a)));
}

function fold(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function reportMatchesPlace(report, place) {
  if (!place) return true;
  const name = fold(place.nom);
  if (name && fold(report.lieu).includes(name)) return true;
  if (report.latitude == null || place.latitude == null) return false;
  return haversine(report.latitude, report.longitude, place.latitude, place.longitude) <= 1.2;
}

function nearestLieu(latitude, longitude) {
  let best = null;
  let bestKm = 1.4;
  for (const lieu of boot.lieux) {
    const distance = haversine(latitude, longitude, lieu.latitude, lieu.longitude);
    if (distance < bestKm) {
      best = lieu;
      bestKm = distance;
    }
  }
  return best;
}

function visibleReports() {
  return state.reports.filter((report) => {
    if (state.filter !== "tous" && report.type !== state.filter) return false;
    return reportMatchesPlace(report, state.place);
  });
}

function selected() {
  return state.reports.find((report) => report.id === state.selectedId) || null;
}

function upsert(report) {
  const index = state.reports.findIndex((item) => item.id === report.id);
  if (index === -1) state.reports.unshift(report);
  else state.reports[index] = report;
  state.reports.sort((a, b) => (a.cree_le < b.cree_le ? 1 : -1));
  state.markerKey = "";
}

function focusReport(report) {
  if (!map || !report) return;
  const zoom = Math.max(map.getZoom(), 15);
  map.flyTo([report.latitude, report.longitude], zoom, { duration: motion() });
}

function setTitle() {
  const report = state.mode === "detail" ? selected() : null;
  document.title = report
    ? `${report.type_label} · ${report.lieu} — Wayizé`
    : "Wayizé — Circulation à Libreville";
}

function initMap() {
  map = L.map("map", { zoomControl: false, minZoom: 11, maxZoom: 19 });
  L.control.zoom({ position: "bottomright" }).addTo(map);
  map.attributionControl.setPosition("bottomleft");
  const bounds = L.latLngBounds(
    [boot.bornes.sud, boot.bornes.ouest],
    [boot.bornes.nord, boot.bornes.est],
  );
  map.setMaxBounds(bounds.pad(0.2));
  map.setView([boot.centre.latitude, boot.centre.longitude], homeZoom());

  // Le serveur de tuiles officiel refuse l'application (403). OSM France
  // diffuse les mêmes données, avec l'attribution qu'il demande.
  const tiles = L.tileLayer("https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", {
    subdomains: "abc",
    maxZoom: 20,
    crossOrigin: "anonymous",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://www.openstreetmap.fr/">OSM France</a>',
  });
  let tileErrors = 0;
  tiles.on("tileerror", () => {
    tileErrors += 1;
    if (tileErrors === 4) toast("Le fond de carte ne se charge pas. Vérifiez la connexion.");
  });
  tiles.addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  pickLayer = L.layerGroup().addTo(map);
  map.on("click", (event) => {
    if (!state.picking) return;
    setPickedPoint(event.latlng);
  });
  window.setTimeout(() => map.invalidateSize(), 200);
}

function markerHtml(report) {
  const style = styleOf(report.type);
  const selectedClass = report.id === state.selectedId ? " is-selected" : "";
  return `
    <div class="marker${selectedClass}">
      <span class="marker-label">${esc(report.lieu)}</span>
      <svg class="pin-svg" viewBox="0 0 44 58" width="44" height="56" aria-hidden="true">
        <path d="M22 54C22 54 3.5 34.5 3.5 20.8 3.5 10.2 11.8 2.2 22 2.2S40.5 10.2 40.5 20.8C40.5 34.5 22 54 22 54z" fill="${style.pin}" stroke="#fff" stroke-width="1.5"/>
        <circle cx="22" cy="21" r="11" fill="#fff"/>
        <g transform="translate(14 13)" style="color:${style.glyph}">${GLYPH[report.type] || GLYPH.autre}</g>
      </svg>
    </div>`;
}

function syncMarkers() {
  if (!markerLayer) return;
  const reports = visibleReports();
  const placeKey = state.place ? state.place.nom : "";
  const key = `${state.selectedId}|${placeKey}|${reports.map((report) => `${report.id}:${report.appuis}:${report.commentaires[0] ? report.commentaires[0].id : 0}`).join(",")}`;
  if (key === state.markerKey) return;
  state.markerKey = key;
  markerLayer.clearLayers();
  for (const report of reports) {
    const id = report.id;
    const icon = L.divIcon({
      className: "wayize-divicon",
      html: markerHtml(report),
      iconSize: [148, 86],
      iconAnchor: [74, 84],
    });
    const marker = L.marker([report.latitude, report.longitude], {
      icon,
      keyboard: true,
      title: `${report.type_label} à ${report.lieu}`,
    });
    marker.on("click", (event) => {
      L.DomEvent.stopPropagation(event);
      if (state.picking) {
        setPickedPoint(event.latlng);
        return;
      }
      selectReport(id);
    });
    marker.addTo(markerLayer);
  }
}

function syncPick() {
  if (!pickLayer) return;
  pickLayer.clearLayers();
  const show = state.draft.latitude != null && (state.mode === "compose" || state.picking);
  if (!show) return;
  const icon = L.divIcon({
    className: "wayize-divicon",
    html: '<div class="pick-dot"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
  L.marker([state.draft.latitude, state.draft.longitude], {
    icon,
    interactive: false,
    keyboard: false,
    zIndexOffset: 600,
  }).addTo(pickLayer);
}

function renderChrome() {
  const button = document.getElementById("tendance");
  const title = document.getElementById("tendance-titre");
  const detail = document.getElementById("tendance-detail");
  button.classList.remove("tendance-fluide", "tendance-ralentie", "tendance-dense", "is-loading");
  const trend = state.tendance;
  if (!trend) {
    button.classList.add("is-loading");
    button.disabled = true;
    title.textContent = state.error ? "Carte indisponible" : "Lecture de la circulation…";
    detail.textContent = state.error ? "Réessayez dans un instant." : "Libreville";
    return;
  }
  button.classList.add(`tendance-${trend.niveau}`);
  button.disabled = !trend.focus_id;
  title.textContent = trend.titre;
  detail.textContent = trend.detail;
}

function offlineNote() {
  if (navigator.onLine) return "";
  return '<p class="offline-note">Hors ligne. Derniers signalements enregistrés sur cet appareil.</p>';
}

function itemHtml(report) {
  const style = styleOf(report.type);
  const bits = [report.type_label, report.relatif, appuisCourt(report.appuis)];
  const notes = precisionsCourt((report.commentaires || []).length);
  if (notes) bits.push(notes);
  const active = report.id === state.selectedId ? " is-active" : "";
  return `
    <button type="button" class="item${active}" data-action="open" data-id="${report.id}">
      <span class="type-icon" style="background:${style.pin};color:${style.chipText}">${iconSvg(report.type)}</span>
      <span class="item-body">
        <span class="item-title">${esc(report.lieu)}</span>
        <span class="item-excerpt">${esc(report.commentaire)}</span>
        <span class="item-meta">${bits.map(esc).join(" · ")}</span>
      </span>
    </button>`;
}

function emptyHtml() {
  const atPlace = state.place
    ? state.reports.some((report) => reportMatchesPlace(report, state.place))
    : false;
  if (state.place && state.filter !== "tous" && atPlace) {
    return `<div class="state"><h2>Rien pour ce filtre</h2><p>Aucun signalement de ce type vers ${esc(state.place.nom)}.</p></div>`;
  }
  if (state.place) {
    return `<div class="state"><h2>Rien vers ${esc(state.place.nom)}</h2><p>Aucun signalement pour ce lieu en ce moment.</p><button type="button" class="btn btn-ghost" data-action="clear-place">Voir tout Libreville</button></div>`;
  }
  if (state.filter !== "tous") {
    return `<div class="state"><h2>Rien pour ce filtre</h2><p>Aucun signalement de ce type pour le moment. Essayez un autre filtre, ou publiez ce que vous voyez sur la route.</p></div>`;
  }
  return `<div class="state"><h2>La route est calme</h2><p>Aucun signalement à Libreville pour l'instant. Si vous voyez un bouchon, un accident ou un contrôle, prévenez les conducteurs derrière vous.</p><button type="button" class="btn btn-primary" data-action="compose">Signaler un incident</button></div>`;
}

function renderFeed() {
  const items = visibleReports();
  const subtitle = state.place
    ? `Vers ${state.place.nom}`
    : (state.reports.length ? `Dernier signalement ${state.reports[0].relatif}` : "Libreville");
  const placeNote = state.place
    ? `<p class="sheet-place"><button type="button" data-action="clear-place">Tout Libreville</button></p>`
    : "";
  return `
    <div class="sheet-head">
      <div>
        <h1>En ce moment</h1>
        <p>${esc(subtitle)}</p>
        ${placeNote}
      </div>
      <button type="button" class="btn btn-primary btn-compact" data-action="compose">Signaler</button>
    </div>
    ${offlineNote()}
    <div class="chips" role="toolbar" aria-label="Filtrer les signalements">
      ${FILTERS.map((chip) => `<button type="button" class="chip" data-action="filter" data-filter="${chip.id}" aria-pressed="${state.filter === chip.id ? "true" : "false"}">${esc(chip.label)}</button>`).join("")}
    </div>
    ${items.length ? `<div class="list">${items.map(itemHtml).join("")}</div>` : emptyHtml()}
    <p class="footer-note">Signalements manuels, sans suivi GPS. Les conducteurs de Libreville préviennent ceux qui arrivent derrière.</p>`;
}

function renderLoading() {
  return `
    <div class="sheet-head"><div><h1>En ce moment</h1><p>Lecture des signalements…</p></div></div>
    <div class="skeleton-list" aria-hidden="true"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>`;
}

function renderError() {
  const offline = !navigator.onLine || (state.error && state.error.status === 0);
  const title = offline ? "Pas de connexion" : "Impossible de charger";
  const copy = offline
    ? "Ouvrez Wayizé une fois en ligne pour garder les signalements sur cet appareil."
    : "Les signalements n'ont pas pu être lus. Vérifiez la connexion, puis réessayez.";
  return `<div class="state"><h2>${title}</h2><p>${copy}</p><button type="button" class="btn btn-primary" data-action="retry">Réessayer</button></div>`;
}

function noteHtml(note) {
  return `<li class="note"><p>${esc(note.texte)}</p><span>Un conducteur · ${esc(note.relatif)}</span></li>`;
}

function renderDetail() {
  const report = selected();
  if (!report) {
    return `<div class="state"><h2>Signalement introuvable</h2><p>Il n'est plus dans la liste récente.</p><button type="button" class="btn btn-primary" data-action="back">Retour à la liste</button></div>`;
  }
  const style = styleOf(report.type);
  const notes = report.commentaires || [];
  return `
    <div class="sheet-head">
      <button type="button" class="btn btn-ghost btn-compact" data-action="back">Retour</button>
      <button type="button" class="btn btn-primary btn-compact" data-action="compose">Signaler</button>
    </div>
    <article class="detail">
      <div class="detail-kicker">
        <span class="type-pill" style="background:${style.pin};color:${style.chipText}">${esc(report.type_label)}</span>
        <span class="muted">${esc(report.relatif)}</span>
      </div>
      <h2>${esc(report.lieu)}</h2>
      <p class="detail-text">${esc(report.commentaire)}</p>
      <button type="button" class="appui${report.appuye ? " is-on" : ""}" data-action="appui" data-id="${report.id}" aria-pressed="${report.appuye ? "true" : "false"}" aria-label="${report.appuye ? "Confirmé" : "Confirmer"} ${report.appuis} fois">
        <span>${report.appuye ? "Confirmé" : "Confirmer"}</span>
        <span class="appui-count">${report.appuis}×</span>
      </button>
      <p class="appui-hint">${esc(appuisPhrase(report.appuis))}</p>
      <section class="notes" aria-label="Précisions">
        <h3>Précisions${notes.length ? ` <span>${notes.length}</span>` : ""}</h3>
        ${notes.length ? `<ul class="note-list">${notes.map(noteHtml).join("")}</ul>` : '<p class="muted">Aucune précision pour l\'instant. Ajoutez ce que vous voyez sur place.</p>'}
        <form id="comment-form" class="composer" novalidate>
          <input id="detail-commentaire" class="field${state.commentError ? " is-invalid" : ""}" type="text" maxlength="200" enterkeyhint="send" placeholder="Ajouter une précision…" value="${esc(state.detailDraft)}" ${state.commentSending ? "disabled" : ""}>
          <button class="btn btn-primary btn-compact" type="submit" ${state.commentSending ? "disabled" : ""}>Envoyer</button>
        </form>
        ${state.commentError ? `<p class="field-error">${esc(state.commentError)}</p>` : ""}
      </section>
    </article>`;
}

function renderCompose() {
  const text = state.draft.commentaire || "";
  return `
    <div class="sheet-head">
      <div>
        <h1>Nouveau signalement</h1>
        <p>Visible tout de suite par les autres conducteurs.</p>
      </div>
      <button type="button" class="btn btn-ghost btn-compact" data-action="back">Fermer</button>
    </div>
    <form id="compose-form" class="compose" novalidate>
      <p class="field-label">Type d'incident</p>
      <div class="type-grid">
        ${boot.types.map((type) => {
          const style = styleOf(type.id);
          const pressed = state.draft.type === type.id;
          return `<button type="button" class="type-option" data-action="type" data-type="${type.id}" aria-pressed="${pressed ? "true" : "false"}"><span class="type-icon" style="background:${style.pin};color:${style.chipText}">${iconSvg(type.id)}</span><span>${esc(type.label)}</span></button>`;
        }).join("")}
      </div>
      ${state.errors.type ? `<p class="field-error">${esc(state.errors.type)}</p>` : ""}
      <label class="field-label" for="commentaire">Que se passe-t-il ?</label>
      <textarea id="commentaire" class="field${state.errors.commentaire ? " is-invalid" : ""}" maxlength="280" placeholder="Ex. Deux files vers le marché, ça n'avance plus depuis le feu.">${esc(text)}</textarea>
      <div class="field-meta">
        <span>${state.errors.commentaire ? `<span class="field-error">${esc(state.errors.commentaire)}</span>` : "Une phrase suffit. Pas de nom, pas de numéro."}</span>
        <span id="commentaire-count">${text.trim().length}/280</span>
      </div>
      <label class="field-label" for="lieu-select">Lieu approximatif</label>
      <select id="lieu-select" class="field${state.errors.lieu ? " is-invalid" : ""}">
        <option value="">Choisir un quartier connu</option>
        ${boot.lieux.map((lieu) => `<option value="${lieu.id}"${state.draft.lieuId === lieu.id ? " selected" : ""}>${esc(lieu.nom)}</option>`).join("")}
      </select>
      <button type="button" class="btn btn-ghost btn-block pick-btn" data-action="pick">Choisir sur la carte</button>
      <p class="chosen${state.draft.latitude != null ? " is-set" : ""}">${state.draft.latitude != null ? esc(state.draft.lieu) : "Ou touchez la carte pour placer le point."}</p>
      ${state.errors.lieu ? `<p class="field-error">${esc(state.errors.lieu)}</p>` : ""}
      <button class="btn btn-primary btn-block" type="submit" ${state.saving ? "disabled" : ""}>${state.saving ? "Publication…" : "Publier le signalement"}</button>
    </form>`;
}

function renderSheet() {
  const root = document.getElementById("sheet-content");
  let html;
  if (state.loading && !state.loaded) html = renderLoading();
  else if (state.error && !state.loaded) html = renderError();
  else if (state.mode === "compose") html = renderCompose();
  else if (state.mode === "detail") html = renderDetail();
  else html = renderFeed();
  root.innerHTML = html;
}

function render() {
  renderSheet();
  renderChrome();
  syncMarkers();
  syncPick();
  setTitle();
  document.body.classList.toggle("is-picking", state.picking);
  document.body.classList.toggle("is-compose", state.mode === "compose");
  const banner = document.getElementById("pick-banner");
  if (banner) banner.hidden = !state.picking;
  if (state.searchOpen) renderSearchResults();
}

function showCompose() {
  state.returnMode = state.mode === "detail" ? "detail" : "feed";
  state.mode = "compose";
  state.picking = false;
  state.errors = {};
  if (!isDesktop()) setVisible(snapPoints()[2]);
  render();
}

function goBack() {
  state.picking = false;
  if (state.mode === "compose" && state.returnMode === "detail" && selected()) {
    state.mode = "detail";
    if (!isDesktop()) setVisible(snapPoints()[1]);
    render();
    return;
  }
  state.mode = "feed";
  state.selectedId = null;
  state.returnMode = "feed";
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  if (!isDesktop()) {
    const mid = snapPoints()[1];
    if (visiblePx() > mid + 40) setVisible(mid);
  }
  render();
}

function selectReport(id) {
  const report = state.reports.find((item) => item.id === id);
  if (!report) return;
  state.selectedId = id;
  state.mode = "detail";
  state.returnMode = "feed";
  state.picking = false;
  state.commentError = "";
  if (!isDesktop() && visiblePx() < snapPoints()[1] - 12) setVisible(snapPoints()[1]);
  history.replaceState(null, "", `#s-${id}`);
  render();
  focusReport(report);
}

function setFilter(filter) {
  state.filter = filter;
  state.mode = "feed";
  state.selectedId = null;
  state.picking = false;
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  render();
}

function setType(type) {
  state.draft.type = type;
  delete state.errors.type;
  render();
}

function chooseLieu(id) {
  const lieu = boot.lieux.find((item) => item.id === id);
  if (!lieu) {
    state.draft.lieuId = "";
    state.draft.lieu = "";
    state.draft.latitude = null;
    state.draft.longitude = null;
    render();
    return;
  }
  state.draft.lieuId = lieu.id;
  state.draft.lieu = lieu.nom;
  state.draft.latitude = lieu.latitude;
  state.draft.longitude = lieu.longitude;
  delete state.errors.lieu;
  render();
  map.flyTo([lieu.latitude, lieu.longitude], Math.max(map.getZoom(), 15), { duration: motion() });
}

function startPick() {
  state.picking = true;
  if (!isDesktop()) setVisible(snapPoints()[0]);
  render();
}

function setPickedPoint(latlng) {
  if (!inside(latlng.lat, latlng.lng)) {
    toast("Ce point est en dehors du Grand Libreville.");
    return;
  }
  const near = nearestLieu(latlng.lat, latlng.lng);
  state.draft.latitude = latlng.lat;
  state.draft.longitude = latlng.lng;
  state.draft.lieuId = "";
  state.draft.lieu = near ? `Près de ${near.nom}` : "Point choisi sur la carte";
  state.picking = false;
  delete state.errors.lieu;
  if (!isDesktop()) setVisible(snapPoints()[2]);
  render();
  map.flyTo([latlng.lat, latlng.lng], Math.max(map.getZoom(), 15), { duration: motion() });
}

function validate() {
  const errors = {};
  const text = state.draft.commentaire.trim();
  if (!state.draft.type) errors.type = "Choisissez le type d'incident.";
  if (text.length < 8) errors.commentaire = "Décrivez la situation en au moins 8 caractères.";
  else if (text.length > 280) errors.commentaire = "280 caractères maximum.";
  if (state.draft.latitude == null || !state.draft.lieu) {
    errors.lieu = "Indiquez un quartier connu ou un point sur la carte.";
  } else if (!inside(state.draft.latitude, state.draft.longitude)) {
    errors.lieu = "Ce point est en dehors du Grand Libreville.";
  }
  return errors;
}

async function publish(event) {
  event.preventDefault();
  if (state.saving) return;
  state.errors = validate();
  if (Object.keys(state.errors).length) {
    render();
    return;
  }
  state.saving = true;
  render();
  try {
    const data = await api("/api/signalements/", {
      method: "POST",
      body: JSON.stringify({
        type: state.draft.type,
        commentaire: state.draft.commentaire.trim(),
        lieu: state.draft.lieu,
        latitude: state.draft.latitude,
        longitude: state.draft.longitude,
      }),
    });
    state.draft = emptyDraft();
    state.saving = false;
    state.errors = {};
    state.selectedId = data.signalement.id;
    state.mode = "detail";
    state.returnMode = "feed";
    state.filter = "tous";
    upsert(data.signalement);
    history.replaceState(null, "", `#s-${data.signalement.id}`);
    toast("Signalement publié. Merci d'avoir prévenu les autres.");
    render();
    focusReport(data.signalement);
  } catch (error) {
    state.saving = false;
    if (error.data && error.data.erreurs) state.errors = error.data.erreurs;
    else toast(messageFrom(error, "Le signalement n'a pas pu être publié."));
    render();
  }
}

async function support(id) {
  const current = state.reports.find((item) => item.id === id);
  if (!current || current.appuye) {
    toast("Vous avez déjà confirmé ce signalement.");
    return;
  }
  try {
    const data = await api(`/api/signalements/${id}/appui/`, { method: "POST" });
    upsert(data.signalement);
    render();
  } catch (error) {
    toast(messageFrom(error, "La confirmation n'a pas pu être enregistrée."));
  }
}

async function sendComment(event) {
  event.preventDefault();
  if (state.commentSending || !state.selectedId) return;
  const texte = state.detailDraft.trim();
  if (texte.length < 2) {
    state.commentError = "Écrivez au moins deux caractères.";
    render();
    return;
  }
  state.commentSending = true;
  state.commentError = "";
  render();
  try {
    const data = await api(`/api/signalements/${state.selectedId}/commentaires/`, {
      method: "POST",
      body: JSON.stringify({ texte }),
    });
    state.detailDraft = "";
    state.commentSending = false;
    upsert(data.signalement);
    render();
  } catch (error) {
    state.commentSending = false;
    state.detailDraft = texte;
    const fields = error.data && error.data.erreurs;
    state.commentError = (fields && fields.texte) || messageFrom(error, "La précision n'a pas pu être envoyée.");
    render();
  }
}

async function reload() {
  const first = !state.loaded;
  if (first) {
    state.loading = true;
    state.error = null;
    render();
  }
  try {
    const data = await api("/api/signalements/");
    state.reports = data.signalements;
    state.tendance = data.tendance;
    state.loaded = true;
    state.loading = false;
    state.error = null;
    state.markerKey = "";
    render();
    applyHashOnce();
  } catch (error) {
    state.loading = false;
    if (!state.loaded) {
      state.error = error;
      render();
    } else {
      toast(messageFrom(error, "Actualisation impossible."));
    }
  }
}

async function quietRefresh() {
  if (document.hidden || state.mode === "compose" || state.picking || state.saving || state.commentSending) return;
  const active = document.activeElement;
  if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
  try {
    const data = await api("/api/signalements/");
    state.reports = data.signalements;
    state.tendance = data.tendance;
    state.loaded = true;
    state.markerKey = "";
    if (state.mode === "detail" && !selected()) {
      state.mode = "feed";
      state.selectedId = null;
    }
    render();
  } catch (error) {
    if (!navigator.onLine) render();
  }
}

function applyHashOnce() {
  if (hashDone) return;
  hashDone = true;
  const match = /^#s-(\d+)$/.exec(location.hash);
  if (!match) return;
  const id = Number(match[1]);
  if (state.reports.some((report) => report.id === id)) selectReport(id);
}

function clearPlace() {
  state.place = null;
  state.markerKey = "";
  if (map) map.flyTo([boot.centre.latitude, boot.centre.longitude], homeZoom(), { duration: motion() });
  render();
}

function searchHits(query) {
  const q = fold(query.trim());
  const lieux = boot.lieux.filter((lieu) => !q || fold(lieu.nom).includes(q));
  const places = (q ? lieux : lieux.slice(0, 6)).slice(0, 6);
  const reports = q
    ? state.reports.filter((report) => fold(report.lieu).includes(q)).slice(0, 6)
    : [];
  return { places, reports, query: q };
}

function renderSearchResults() {
  const list = document.getElementById("search-results");
  if (!list) return;
  if (!state.searchOpen) {
    list.hidden = true;
    return;
  }
  const input = document.getElementById("search-input");
  const { places, reports, query } = searchHits(input ? input.value : "");
  const placeHtml = places.map((lieu) => {
    const count = state.reports.filter((report) => reportMatchesPlace(report, lieu)).length;
    const meta = count ? `${count} signalement${count > 1 ? "s" : ""}` : "Aucun signalement";
    return `<li><button type="button" class="search-hit" role="option" data-kind="lieu" data-id="${esc(lieu.id)}"><strong>${esc(lieu.nom)}</strong><span>${meta}</span></button></li>`;
  }).join("");
  const reportHtml = reports.map((report) => (
    `<li><button type="button" class="search-hit" role="option" data-kind="report" data-id="${report.id}"><strong>${esc(report.lieu)}</strong><span>${esc(report.type_label)} · ${esc(report.relatif)} · ${report.appuis}×</span></button></li>`
  )).join("");
  if (!placeHtml && !reportHtml) {
    list.innerHTML = `<li class="search-empty">${query ? "Aucun lieu pour cette recherche." : "Tapez un quartier ou un lieu."}</li>`;
  } else {
    list.innerHTML = placeHtml + reportHtml;
  }
  list.hidden = false;
}

function setSearchOpen(open) {
  state.searchOpen = open;
  const root = document.getElementById("search");
  const field = document.getElementById("search-field");
  const toggle = document.getElementById("search-toggle");
  root.classList.toggle("is-open", open);
  field.hidden = !open;
  toggle.hidden = open;
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  if (!open) {
    document.getElementById("search-results").hidden = true;
    return;
  }
  document.getElementById("search-input").focus();
  renderSearchResults();
}

function chooseSearchPlace(id) {
  const lieu = boot.lieux.find((item) => item.id === id);
  if (!lieu) return;
  state.place = { nom: lieu.nom, latitude: lieu.latitude, longitude: lieu.longitude };
  state.mode = "feed";
  state.selectedId = null;
  state.filter = "tous";
  state.markerKey = "";
  state.returnMode = "feed";
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  setSearchOpen(false);
  if (!isDesktop()) setVisible(Math.min(snapPoints()[1], sheetCeiling()));
  if (map) map.flyTo([lieu.latitude, lieu.longitude], 15, { duration: motion() });
  render();
  const found = visibleReports();
  if (!found.length) toast(`Aucun signalement vers ${lieu.nom}.`);
  else if (found.length === 1) selectReport(found[0].id);
}

function chooseSearchReport(id) {
  setSearchOpen(false);
  selectReport(id);
}

function onSheetClick(event) {
  const el = event.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  if (action === "filter") setFilter(el.dataset.filter);
  else if (action === "open") selectReport(Number(el.dataset.id));
  else if (action === "back") goBack();
  else if (action === "compose") showCompose();
  else if (action === "type") setType(el.dataset.type);
  else if (action === "pick") startPick();
  else if (action === "appui") support(Number(el.dataset.id));
  else if (action === "retry") reload();
  else if (action === "clear-place") clearPlace();
}

function onSubmit(event) {
  if (event.target.id === "compose-form") publish(event);
  else if (event.target.id === "comment-form") sendComment(event);
}

function onChange(event) {
  if (event.target.id === "lieu-select") chooseLieu(event.target.value);
}

function onInput(event) {
  if (event.target.id === "commentaire") {
    state.draft.commentaire = event.target.value;
    const counter = document.getElementById("commentaire-count");
    if (counter) counter.textContent = `${event.target.value.trim().length}/280`;
  }
  if (event.target.id === "detail-commentaire") state.detailDraft = event.target.value;
}

function bindGrabber() {
  const grabber = document.getElementById("grabber");
  let drag = null;
  grabber.addEventListener("pointerdown", (event) => {
    if (isDesktop()) return;
    drag = { y: event.clientY, h: visiblePx(), moved: false };
    document.body.classList.add("sheet-dragging");
    grabber.setPointerCapture(event.pointerId);
  });
  grabber.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const delta = drag.y - event.clientY;
    if (Math.abs(delta) > 4) drag.moved = true;
    setVisible(drag.h + delta);
  });
  const end = () => {
    if (!drag) return;
    document.body.classList.remove("sheet-dragging");
    if (drag.moved) snapTo(visiblePx());
    else cycleSheet();
    drag = null;
  };
  grabber.addEventListener("pointerup", end);
  grabber.addEventListener("pointercancel", end);
}

function bind() {
  const sheet = document.getElementById("sheet-content");
  sheet.addEventListener("click", onSheetClick);
  sheet.addEventListener("submit", onSubmit);
  sheet.addEventListener("change", onChange);
  sheet.addEventListener("input", onInput);
  document.getElementById("recenter").addEventListener("click", () => {
    state.place = null;
    state.markerKey = "";
    map.flyTo([boot.centre.latitude, boot.centre.longitude], homeZoom(), { duration: motion() });
    render();
  });
  document.getElementById("search-toggle").addEventListener("click", () => setSearchOpen(true));
  document.getElementById("search-close").addEventListener("click", () => setSearchOpen(false));
  document.getElementById("search-field").addEventListener("submit", (event) => {
    event.preventDefault();
    const { places, reports } = searchHits(document.getElementById("search-input").value);
    if (places.length) chooseSearchPlace(places[0].id);
    else if (reports.length) chooseSearchReport(reports[0].id);
  });
  document.getElementById("search-input").addEventListener("input", renderSearchResults);
  document.getElementById("search-results").addEventListener("click", (event) => {
    const hit = event.target.closest(".search-hit");
    if (!hit) return;
    if (hit.dataset.kind === "lieu") chooseSearchPlace(hit.dataset.id);
    else chooseSearchReport(Number(hit.dataset.id));
  });
  document.addEventListener("pointerdown", (event) => {
    if (!state.searchOpen || event.target.closest("#search")) return;
    setSearchOpen(false);
  });
  document.getElementById("tendance").addEventListener("click", () => {
    if (state.tendance && state.tendance.focus_id) selectReport(state.tendance.focus_id);
  });
  document.getElementById("pick-cancel").addEventListener("click", () => {
    state.picking = false;
    if (!isDesktop()) setVisible(snapPoints()[2]);
    render();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.searchOpen) {
      setSearchOpen(false);
      return;
    }
    if (state.picking) {
      state.picking = false;
      if (!isDesktop()) setVisible(snapPoints()[2]);
      render();
      return;
    }
    if (state.mode !== "feed") goBack();
  });
  window.addEventListener("resize", () => {
    if (map) map.invalidateSize();
    if (!isDesktop()) snapTo(visiblePx());
  });
  window.addEventListener("online", () => reload());
  window.addEventListener("offline", () => render());
  bindGrabber();
}

function start() {
  boot = JSON.parse(document.getElementById("boot-data").textContent);
  initMap();
  bind();
  if (!isDesktop()) setVisible(visiblePx());
  reload();
  window.setInterval(quietRefresh, 45000);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
