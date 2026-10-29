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
  tendanceOuverte: false,
  compte: null,
  jeton: "",
  listeId: null,
  trajet: null,
  reglages: null,
  compteErreur: "",
  compteEnCours: false,
  compteEmail: "",
  dureeHeures: 3,
  seuilDegage: 2,
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

function iconSvg(type, size = 18) {
  return `<svg class="ui-icon" viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true">${GLYPH[type] || GLYPH.autre}</svg>`;
}

const UI = {
  plus: '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  user: '<circle cx="12" cy="8.2" r="3.1" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.4 19.2c1.3-2.7 3.6-4 6.6-4s5.3 1.3 6.6 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  check: '<path d="M5 12.4 9.2 16.5 19 7.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  back: '<path d="M14.5 6.5 9 12l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  send: '<path d="M4.5 12 19 5.5l-5.6 13.2-2.2-5.6L4.5 12z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  pin: '<path d="M12 20.5s-5.2-4.8-5.2-9.2a5.2 5.2 0 0 1 10.4 0c0 4.4-5.2 9.2-5.2 9.2z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="11.2" r="1.7" fill="currentColor"/>',
  bell: '<path d="M6.2 16.5h11.6M12 4.2a4.6 4.6 0 0 1 4.6 4.6c0 3.2.8 4.4 1.4 5.2H6c.6-.8 1.4-2 1.4-5.2A4.6 4.6 0 0 1 12 4.2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10.2 17.2a1.8 1.8 0 0 0 3.6 0" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  alarm: '<path d="M6.2 16.5h11.6M12 4.2a4.6 4.6 0 0 1 4.6 4.6c0 3.2.8 4.4 1.4 5.2H6c.6-.8 1.4-2 1.4-5.2A4.6 4.6 0 0 1 12 4.2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10.2 17.2a1.8 1.8 0 0 0 3.6 0" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M19.2 5.2 21 3.6M4.8 5.2 3 3.6M12 2.2v1.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  clear: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.2 12.2 10.8 14.8 15.8 9.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  volume: '<path d="M5 10h2.4L11 6.8v10.4L7.4 14H5v-4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14.2 9.2a3.2 3.2 0 0 1 0 5.6M16.4 7.2a6 6 0 0 1 0 9.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  locate: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 3.5v2.4M12 18.1v2.4M3.5 12h2.4M18.1 12h2.4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  clock: '<circle cx="12" cy="12" r="7.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 8.2V12l2.5 1.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  moon: '<path d="M15.5 4.8A6.8 6.8 0 1 0 18 14.8 5.4 5.4 0 0 1 15.5 4.8z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  list: '<path d="M9 7h10M9 12h10M9 17h10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="5.5" cy="7" r="1" fill="currentColor"/><circle cx="5.5" cy="12" r="1" fill="currentColor"/><circle cx="5.5" cy="17" r="1" fill="currentColor"/>',
  route: '<circle cx="7" cy="7" r="2.2" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="17" cy="17" r="2.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 8.2c2.2 0 3.2 2.2 3.2 3.8S14.8 16 17 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  trash: '<path d="M5.5 8h13M9 8V6.2h6V8M8 8l.6 10.2h6.8L16 8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  logout: '<path d="M10 6.5V5.2h8.2v13.6H10v-1.3M5 12h9M11.2 8.8 14.4 12l-3.2 3.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  star: '<path d="m12 4.2 1.8 3.8 4.2.6-3 3 .7 4.2L12 13.8 8.3 15.8l.7-4.2-3-3 4.2-.6L12 4.2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  chevron: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  layers: '<path d="m12 4 8 4.2L12 12.4 4 8.2 12 4zM6.2 12.2 12 15.2l5.8-3M6.2 15.4 12 18.4l5.8-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  mail: '<rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m5 7.5 7 5.2 7-5.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  lock: '<rect x="6" y="10.5" width="12" height="8.2" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 10.5V8.4a3.5 3.5 0 0 1 7 0v2.1" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  car: '<path d="M4 14.5h16M6.2 14.2 7.6 9.2A1.4 1.4 0 0 1 9 8.2h6a1.4 1.4 0 0 1 1.4 1l1.4 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="8" cy="16.2" r="1.2" fill="currentColor"/><circle cx="16" cy="16.2" r="1.2" fill="currentColor"/>',
};

function uiIcon(name, size = 16) {
  const path = UI[name] || "";
  return `<svg class="ui-icon" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${path}</svg>`;
}

function csrf() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.content : "";
}

const CLE_MEMOIRE = "wayize.memoire.v1";

function reglagesDefaut() {
  return {
    son: true,
    visuel: true,
    gps: false,
    conduite: false,
    heures: false,
    debut: "06:00",
    fin: "09:00",
    debut2: "16:00",
    fin2: "20:00",
    silenceJusqua: 0,
  };
}

function lireMemoire() {
  try {
    const data = JSON.parse(localStorage.getItem(CLE_MEMOIRE) || "{}");
    return data && typeof data === "object" ? data : {};
  } catch (error) {
    return {};
  }
}

function ecrireMemoire(partiel) {
  const suivant = { ...lireMemoire(), ...partiel, enregistre_le: Date.now() };
  try {
    localStorage.setItem(CLE_MEMOIRE, JSON.stringify(suivant));
  } catch (error) {
    // Le quota du téléphone peut refuser l'écriture : l'app continue sans cache.
  }
  return suivant;
}

function assurerReglages() {
  if (!state.reglages) state.reglages = reglagesDefaut();
  return state.reglages;
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
  return `×${n}`;
}

function appuisPhrase(n) {
  if (n === 0) return "Aucun usager n'a encore confirmé.";
  if (n === 1) return "1 usager confirme ce signalement.";
  return `${n} usagers confirment ce signalement.`;
}

function phraseDegage(report) {
  const n = report.degages || 0;
  const seuil = Number(state.seuilDegage) || 2;
  if (report.degage) return "Vous dites que c'est dégagé. Recliquez pour annuler.";
  if (n <= 0) return "Si la situation n'est plus là, dites que c'est dégagé.";
  const reste = seuil - n;
  if (n === 1 && reste === 1) return "1 usager dit que c'est dégagé. Un deuxième retire l'alerte.";
  if (reste === 1) return `${n} usagers disent que c'est dégagé. Un de plus retire l'alerte.`;
  if (reste > 1) {
    const voix = n > 1 ? "disent" : "dit";
    return `${n} usager${n > 1 ? "s" : ""} ${voix} que c'est dégagé. Encore ${reste} votes pour retirer l'alerte.`;
  }
  return `${n} usagers disent que c'est dégagé.`;
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
  const jeton = state.jeton || "";
  if (/^[a-f0-9]{32}$/.test(jeton)) headers["X-Wayize-Compte"] = jeton;
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
  return window.innerHeight * 0.42;
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
  const peek = Math.round(Math.max(320, Math.min(390, height * 0.42)));
  return [112, peek, sheetCeiling()];
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

function lieuParId(id) {
  return boot.lieux.find((lieu) => lieu.id === id) || null;
}

function listeActive() {
  if (!state.compte || !state.listeId) return null;
  return (state.compte.listes || []).find((liste) => liste.id === state.listeId) || null;
}

function reportMatchesListe(report) {
  const liste = listeActive();
  if (!liste) return true;
  return (liste.lieux || []).some((id) => {
    const lieu = lieuParId(id);
    return lieu && reportMatchesPlace(report, lieu);
  });
}

function versMetres(latitude, longitude) {
  return {
    x: longitude * 111320 * Math.cos((0.4 * Math.PI) / 180),
    y: latitude * 110540,
  };
}

function distanceSegmentKm(latitude, longitude, depart, arrivee) {
  const point = versMetres(latitude, longitude);
  const a = versMetres(depart.latitude, depart.longitude);
  const b = versMetres(arrivee.latitude, arrivee.longitude);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy || 1;
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / len;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy)) / 1000;
}

function reportMatchesTrajet(report) {
  if (!state.trajet) return true;
  const depart = lieuParId(state.trajet.depart);
  const arrivee = lieuParId(state.trajet.arrivee);
  if (!depart || !arrivee || report.latitude == null) return false;
  return distanceSegmentKm(report.latitude, report.longitude, depart, arrivee) <= 1.5;
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

function noterPilotage(data) {
  const heures = Number(data && data.duree_heures);
  if (heures >= 1 && heures <= 12) state.dureeHeures = heures;
  const seuil = Number(data && data.seuil_degage);
  if (seuil >= 2 && seuil <= 5) state.seuilDegage = seuil;
}

function encoreValide(report) {
  const cree = Date.parse(report.cree_le || "");
  if (!cree) return true;
  const heures = Number(state.dureeHeures) || 3;
  return Date.now() - cree < heures * 60 * 60 * 1000;
}
const HEAT = ["accident", "route_barree", "bouchon", "police", "travaux", "autre"];

const CHAUDS = ["bouchon", "accident", "route_barree"];

function visibleReports() {
  return state.reports.filter((report) => {
    if (!encoreValide(report)) return false;
    if (state.filter !== "tous" && report.type !== state.filter) return false;
    if (state.trajet && !reportMatchesTrajet(report)) return false;
    if (state.listeId && !reportMatchesListe(report)) return false;
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
  map.on("zoomend moveend", () => syncMarkers());
  window.setTimeout(() => map.invalidateSize(), 200);
}

function markerHtml(report) {
  const style = styleOf(report.type);
  const selectedClass = report.id === state.selectedId ? " is-selected" : "";
  const clearing = report.degages ? " is-clearing" : "";
  return `
    <div class="marker${selectedClass}${clearing}">
      <span class="marker-label">${esc(report.lieu)}</span>
      <span class="pin-wrap">
        <svg class="pin-svg" viewBox="0 0 44 58" width="44" height="56" aria-hidden="true">
          <path d="M22 54C22 54 3.5 34.5 3.5 20.8 3.5 10.2 11.8 2.2 22 2.2S40.5 10.2 40.5 20.8C40.5 34.5 22 54 22 54z" fill="${style.pin}" stroke="#fff" stroke-width="1.5"/>
          <circle cx="22" cy="21" r="11" fill="#fff"/>
          <g transform="translate(14 13)" style="color:${style.glyph}">${GLYPH[report.type] || GLYPH.autre}</g>
        </svg>
        <span class="pin-count">×${report.appuis}</span>
      </span>
    </div>`;
}

function plusConfirme(reports) {
  return reports.slice().sort((a, b) => (b.appuis || 0) - (a.appuis || 0))[0];
}

function couleurGroupe(reports) {
  const type = reports.slice().sort((a, b) => HEAT.indexOf(a.type) - HEAT.indexOf(b.type))[0].type;
  return styleOf(type).pin;
}

function groupesCarte(reports) {
  const zoom = map.getZoom();
  const radius = zoom >= 16 ? 0 : zoom >= 14 ? 30 : 48;
  const groups = [];
  const ordered = reports.slice().sort((a, b) => (b.appuis || 0) - (a.appuis || 0));
  for (const report of ordered) {
    const point = map.latLngToContainerPoint([report.latitude, report.longitude]);
    const group = radius
      ? groups.find((item) => Math.hypot(item.x - point.x, item.y - point.y) <= radius)
      : null;
    if (group) group.reports.push(report);
    else groups.push({ x: point.x, y: point.y, reports: [report] });
  }
  if (radius) return groups;
  const spread = [];
  for (const group of groups) {
    if (group.reports.length === 1) {
      spread.push(group);
      continue;
    }
    group.reports.forEach((report, index) => {
      const angle = (index / group.reports.length) * Math.PI * 2;
      const pixel = map.latLngToContainerPoint([report.latitude, report.longitude]);
      const moved = map.containerPointToLatLng([
        pixel.x + Math.cos(angle) * 22,
        pixel.y + Math.sin(angle) * 22,
      ]);
      const next = map.latLngToContainerPoint(moved);
      spread.push({ x: next.x, y: next.y, reports: [report], latlng: moved });
    });
  }
  return spread;
}

function ouvrirGroupe(reports) {
  if (reports.length === 1) {
    selectReport(reports[0].id);
    return;
  }
  const bounds = L.latLngBounds(reports.map((report) => [report.latitude, report.longitude]));
  const same = bounds.getNorthEast().distanceTo(bounds.getSouthWest()) < 40;
  if (same) {
    map.setView(bounds.getCenter(), Math.max(map.getZoom(), 16), { animate: true });
    return;
  }
  if (map.getZoom() >= 16) {
    selectReport(plusConfirme(reports).id);
    return;
  }
  map.fitBounds(bounds.pad(0.5), { maxZoom: 16, animate: true });
}

function syncMarkers() {
  if (!markerLayer || !map) return;
  const reports = visibleReports();
  const groups = groupesCarte(reports);
  const key = `${state.selectedId}|${map.getZoom()}|${groups.map((group) => `${Math.round(group.x)}:${Math.round(group.y)}:${group.reports.map((report) => `${report.id}:${report.appuis}`).join("+")}`).join(";")}`;
  if (key === state.markerKey) return;
  state.markerKey = key;
  markerLayer.clearLayers();
  for (const group of groups) {
    const latlng = group.latlng || [group.reports[0].latitude, group.reports[0].longitude];
    if (group.reports.length === 1) {
      const report = group.reports[0];
      const icon = L.divIcon({
        className: "wayize-divicon",
        html: markerHtml(report),
        iconSize: [148, 86],
        iconAnchor: [74, 84],
      });
      const marker = L.marker(latlng, {
        icon,
        keyboard: true,
        title: `${report.type_label} à ${report.lieu}, confirmé ×${report.appuis}`,
        zIndexOffset: report.id === state.selectedId ? 400 : report.appuis,
      });
      marker.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        if (state.picking) {
          setPickedPoint(event.latlng);
          return;
        }
        selectReport(report.id);
      });
      marker.addTo(markerLayer);
      continue;
    }
    const max = plusConfirme(group.reports).appuis;
    const icon = L.divIcon({
      className: "wayize-divicon",
      html: `<div class="cluster" style="background:${couleurGroupe(group.reports)}"><strong>${group.reports.length}</strong><span>×${max}</span></div>`,
      iconSize: [52, 52],
      iconAnchor: [26, 26],
    });
    const marker = L.marker(latlng, {
      icon,
      keyboard: true,
      title: `${group.reports.length} signalements, jusqu'à ×${max}`,
      zIndexOffset: 200,
    });
    marker.on("click", (event) => {
      L.DomEvent.stopPropagation(event);
      if (state.picking) {
        setPickedPoint(event.latlng);
        return;
      }
      ouvrirGroupe(group.reports);
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

function incidentsNotables() {
  return state.reports
    .filter((report) => encoreValide(report) && CHAUDS.includes(report.type))
    .slice(0, 6);
}

function renderChrome() {
  const wrap = document.getElementById("tendance-wrap");
  const toggle = document.getElementById("tendance-toggle");
  const bar = document.getElementById("tendance-bar");
  const title = document.getElementById("tendance-titre");
  const detail = document.getElementById("tendance-detail");
  const panel = document.getElementById("tendance-panel");
  const liste = document.getElementById("tendance-liste");
  const trend = state.tendance;
  wrap.classList.remove("tendance-fluide", "tendance-ralentie", "tendance-dense", "is-loading", "is-open", "is-live");
  if (!trend) {
    state.tendanceOuverte = false;
    wrap.classList.add("is-loading");
    toggle.disabled = true;
    toggle.hidden = false;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Circulation");
    title.textContent = state.error ? "Carte indisponible" : "Lecture de la circulation…";
    detail.textContent = state.error ? "Réessayez dans un instant." : "Libreville";
    bar.hidden = true;
    panel.hidden = true;
    liste.innerHTML = "";
    return;
  }
  const open = state.tendanceOuverte;
  toggle.disabled = false;
  wrap.classList.add(`tendance-${trend.niveau}`);
  wrap.classList.toggle("is-open", open);
  if (trend.niveau === "dense") wrap.classList.add("is-live");
  toggle.hidden = open;
  bar.hidden = !open;
  toggle.setAttribute("aria-expanded", open ? "true" : "false");
  toggle.setAttribute("aria-label", trend.titre);
  title.textContent = trend.titre;
  detail.textContent = trend.detail;
  panel.hidden = !open;
  liste.innerHTML = incidentsNotables().map((report) => {
    const style = styleOf(report.type);
    const leve = report.degages ? ` · Dégagé ×${report.degages}` : "";
    return `<li><button type="button" class="tendance-hit" data-id="${report.id}">
      <span class="type-icon" style="background:${style.pin};color:${style.chipText}">${iconSvg(report.type, 16)}</span>
      <span class="tendance-hit-copy"><strong>${esc(report.lieu)}</strong><small>${esc(report.type_label)} · ${esc(report.relatif)}${leve}</small></span>
      <span class="item-count">×${report.appuis}</span>
    </button></li>`;
  }).join("");
}

function offlineNote() {
  if (navigator.onLine) return "";
  return '<p class="offline-note">Hors ligne. Derniers signalements enregistrés sur cet appareil.</p>';
}

function itemHtml(report) {
  const style = styleOf(report.type);
  const notes = (report.commentaires || []).length;
  const meta = `${report.type_label} · ${report.relatif}${notes ? ` · ${notes} précision${notes > 1 ? "s" : ""}` : ""}`;
  const active = report.id === state.selectedId ? " is-active" : "";
  return `
    <button type="button" class="item${active}" data-action="open" data-id="${report.id}">
      <span class="type-icon" style="background:${style.pin};color:${style.chipText}">${iconSvg(report.type, 20)}</span>
      <span class="item-body">
        <span class="item-top">
          <span class="item-title">${esc(report.lieu)}</span>
          <span class="item-count">×${report.appuis}</span>
        </span>
        <span class="item-excerpt">${esc(report.commentaire)}</span>
        <span class="item-meta">${esc(meta)}</span>
        ${report.degages ? `<span class="item-clear">${uiIcon("clear", 14)} Dégagé ×${report.degages}</span>` : ""}
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
    return `<div class="state"><h2>Rien vers ${esc(state.place.nom)}</h2><p>Aucun signalement pour ce lieu en ce moment.</p><button type="button" class="btn btn-ghost" data-action="clear-place">${uiIcon("pin")} Tout Libreville</button></div>`;
  }
  const liste = listeActive();
  if (state.trajet) {
    return `<div class="state"><h2>Rien sur ce trajet</h2><p>Aucun signalement entre ${esc(nomLieu(state.trajet.depart))} et ${esc(nomLieu(state.trajet.arrivee))}.</p><button type="button" class="btn btn-ghost" data-action="clear-place">${uiIcon("pin")} Tout Libreville</button></div>`;
  }
  if (liste) {
    return `<div class="state"><h2>Rien dans ${esc(liste.nom)}</h2><p>Aucun signalement pour les lieux de cette liste.</p><button type="button" class="btn btn-ghost" data-action="clear-place">${uiIcon("pin")} Tout Libreville</button></div>`;
  }
  if (state.filter !== "tous") {
    return `<div class="state"><h2>Rien pour ce filtre</h2><p>Aucun signalement de ce type pour le moment. Essayez un autre filtre, ou publiez ce que vous voyez sur la route.</p></div>`;
  }
  return `<div class="state"><h2>La route est calme</h2><p>Aucun signalement à Libreville pour l'instant. Si une situation peut créer un bouchon, signalez-la.</p><button type="button" class="btn btn-primary" data-action="compose">${uiIcon("alarm")} Signaler un incident</button></div>`;
}

function renderFeed() {
  const items = visibleReports();
  const liste = listeActive();
  const subtitle = state.trajet
    ? `Trajet ${nomLieu(state.trajet.depart)} → ${nomLieu(state.trajet.arrivee)}`
    : liste
      ? `Liste ${liste.nom}`
      : state.place
        ? `Vers ${state.place.nom}`
        : (state.reports.length ? `Dernier signalement ${state.reports[0].relatif}` : "Libreville");
  const placeNote = state.trajet || liste || state.place
    ? `<p class="sheet-place"><button type="button" data-action="clear-place">${uiIcon("pin", 14)} Tout Libreville</button></p>`
    : "";
  const compteLabel = state.compte && state.compte.premium ? "Premium" : "Compte";
  const compteIcon = state.compte && state.compte.premium ? "star" : "user";
  return `
    <div class="feed-bar">
      <div class="sheet-head">
        <h1>En ce moment</h1>
        <div class="sheet-actions">
          <button type="button" class="btn btn-ghost btn-compact" data-action="compte">${uiIcon(compteIcon)} ${compteLabel}</button>
          <button type="button" class="btn btn-primary btn-compact" data-action="compose">${uiIcon("alarm")} Signaler</button>
        </div>
        <p>${esc(subtitle)}</p>
        ${placeNote}
      </div>
      ${offlineNote()}
      <div class="chips" role="toolbar" aria-label="Filtrer les signalements">
        ${FILTERS.map((chip) => {
          const icon = chip.id === "tous" ? uiIcon("layers", 14) : iconSvg(chip.id, 14);
          return `<button type="button" class="chip" data-action="filter" data-filter="${chip.id}" aria-pressed="${state.filter === chip.id ? "true" : "false"}">${icon}<span>${esc(chip.label)}</span></button>`;
        }).join("")}
      </div>
    </div>
    ${items.length ? `<div class="list">${items.map(itemHtml).join("")}</div>` : emptyHtml()}
    <p class="footer-note">Signalements manuels, sans suivi GPS. Les autres usagers de la route signalent toute situation susceptible de créer les bouchons.</p>`;
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
    return `<div class="state"><h2>Signalement introuvable</h2><p>Il n'est plus dans la liste récente.</p><button type="button" class="btn btn-primary" data-action="back">${uiIcon("back")} Retour à la liste</button></div>`;
  }
  const style = styleOf(report.type);
  const notes = report.commentaires || [];
  const hint = report.appuye
    ? `${appuisPhrase(report.appuis)} Recliquez pour retirer la vôtre.`
    : appuisPhrase(report.appuis);
  const degages = report.degages || 0;
  const degageHint = phraseDegage(report);
  return `
    <div class="sheet-head">
      <button type="button" class="btn btn-ghost btn-compact" data-action="back">${uiIcon("back")} Retour</button>
      <button type="button" class="btn btn-primary btn-compact" data-action="compose">${uiIcon("alarm")} Signaler</button>
    </div>
    <article class="detail">
      <div class="detail-kicker">
        <span class="type-pill" style="background:${style.pin};color:${style.chipText}">${iconSvg(report.type, 14)} ${esc(report.type_label)}</span>
        <span class="muted">${esc(report.relatif)}</span>
      </div>
      <h2>${esc(report.lieu)}</h2>
      <p class="detail-text">${esc(report.commentaire)}</p>
      <div class="verdict">
        <button type="button" class="appui${report.appuye ? " is-on" : ""}" data-action="appui" data-id="${report.id}" aria-pressed="${report.appuye ? "true" : "false"}" aria-label="${report.appuye ? "Confirmé" : "Confirmer"} ×${report.appuis}">
          <span>${uiIcon(report.appuye ? "check" : "plus")} ${report.appuye ? "Confirmé" : "Confirmer"}</span>
          <span class="appui-count">×${report.appuis}</span>
        </button>
        <button type="button" class="appui degage${report.degage ? " is-on" : ""}" data-action="degage" data-id="${report.id}" aria-pressed="${report.degage ? "true" : "false"}" aria-label="${report.degage ? "Dégagé" : "C'est dégagé"} ×${degages}">
          <span>${uiIcon(report.degage ? "check" : "clear")} ${report.degage ? "Dégagé" : "C'est dégagé"}</span>
          <span class="appui-count">×${degages}</span>
        </button>
      </div>
      <p class="appui-hint">${esc(hint)}<br><span class="degage-hint">${esc(degageHint)}</span></p>
      <section class="notes" aria-label="Précisions">
        <h3>Précisions${notes.length ? ` <span>${notes.length}</span>` : ""}</h3>
        ${notes.length ? `<ul class="note-list">${notes.map(noteHtml).join("")}</ul>` : '<p class="muted">Aucune précision pour l\'instant. Ajoutez ce que vous voyez sur place.</p>'}
        <form id="comment-form" class="composer" novalidate>
          <input id="detail-commentaire" class="field${state.commentError ? " is-invalid" : ""}" type="text" maxlength="200" enterkeyhint="send" placeholder="Ajouter une précision…" value="${esc(state.detailDraft)}" ${state.commentSending ? "disabled" : ""}>
          <button class="btn btn-primary btn-compact" type="submit" ${state.commentSending ? "disabled" : ""}>${uiIcon("send")} Envoyer</button>
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
      <button type="button" class="btn btn-ghost btn-compact" data-action="back">${uiIcon("close")} Fermer</button>
    </div>
    <form id="compose-form" class="compose" novalidate>
      <p class="field-label">${uiIcon("layers", 14)} Type d'incident</p>
      <div class="type-grid">
        ${boot.types.map((type) => {
          const style = styleOf(type.id);
          const pressed = state.draft.type === type.id;
          return `<button type="button" class="type-option" data-action="type" data-type="${type.id}" aria-pressed="${pressed ? "true" : "false"}"><span class="type-icon" style="background:${style.pin};color:${style.chipText}">${iconSvg(type.id)}</span><span>${esc(type.label)}</span></button>`;
        }).join("")}
      </div>
      ${state.errors.type ? `<p class="field-error">${esc(state.errors.type)}</p>` : ""}
      <label class="field-label" for="commentaire">${uiIcon("list", 14)} Que se passe-t-il ?</label>
      <textarea id="commentaire" class="field${state.errors.commentaire ? " is-invalid" : ""}" maxlength="280" placeholder="Ex. Deux files vers le marché, ça n'avance plus depuis le feu.">${esc(text)}</textarea>
      <div class="field-meta">
        <span>${state.errors.commentaire ? `<span class="field-error">${esc(state.errors.commentaire)}</span>` : "Une phrase suffit. Pas de nom, pas de numéro."}</span>
        <span id="commentaire-count">${text.trim().length}/280</span>
      </div>
      <label class="field-label" for="lieu-saisie">${uiIcon("pin", 14)} Lieu approximatif</label>
      <input id="lieu-saisie" class="field${state.errors.lieu ? " is-invalid" : ""}" list="lieux-connus" maxlength="120" autocomplete="off" enterkeyhint="done" placeholder="Quartier de la liste, ou le vôtre" value="${esc(state.draft.lieu)}">
      <datalist id="lieux-connus">
        ${boot.lieux.map((lieu) => `<option value="${esc(lieu.nom)}"></option>`).join("")}
      </datalist>
      <button type="button" class="btn btn-ghost btn-block pick-btn" data-action="pick">${uiIcon("pin")} Choisir sur la carte</button>
      <p class="chosen${state.draft.latitude != null ? " is-set" : ""}">${esc(lieuAide())}</p>
      ${state.errors.lieu ? `<p class="field-error" id="lieu-erreur">${esc(state.errors.lieu)}</p>` : ""}
      <button class="btn btn-primary btn-block" type="submit" ${state.saving ? "disabled" : ""}>${uiIcon("send")} ${state.saving ? "Publication…" : "Publier le signalement"}</button>
    </form>`;
}

function nomLieu(id) {
  const lieu = lieuParId(id);
  return lieu ? lieu.nom : id;
}

function dansLesHeures() {
  const reglages = assurerReglages();
  if (!reglages.heures) return true;
  if (reglages.silenceJusqua && Date.now() < reglages.silenceJusqua) return false;
  const maintenant = new Date();
  const minutes = maintenant.getHours() * 60 + maintenant.getMinutes();
  const vers = (valeur) => {
    const [h, m] = String(valeur || "00:00").split(":");
    return Number(h) * 60 + Number(m || 0);
  };
  const couvre = (debut, fin) => {
    const a = vers(debut);
    const b = vers(fin);
    if (Number.isNaN(a) || Number.isNaN(b)) return true;
    return a <= b ? minutes >= a && minutes <= b : minutes >= a || minutes <= b;
  };
  return couvre(reglages.debut, reglages.fin) || couvre(reglages.debut2, reglages.fin2);
}

function correspondVeille(report) {
  if (state.trajet) return reportMatchesTrajet(report);
  if (state.listeId) return reportMatchesListe(report);
  return false;
}

function bip() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 740;
  gain.gain.value = 0.05;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
  osc.stop(ctx.currentTime + 0.24);
  osc.onended = () => ctx.close();
}

function alerter(phrase) {
  const reglages = assurerReglages();
  if (!dansLesHeures()) return;
  if (reglages.visuel !== false) {
    toast(phrase);
    if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
      new Notification("Wayizé", { body: phrase, silent: true });
    }
  }
  if (reglages.son) bip();
}

function renderCompte() {
  if (!state.compte) {
    return `
      <div class="sheet-head">
        <div><h1>Compte</h1><p>Pour suivre des lieux. La carte reste ouverte sans compte.</p></div>
        <button type="button" class="btn btn-ghost btn-compact" data-action="back">${uiIcon("close")} Fermer</button>
      </div>
      <form id="compte-form" class="compose" novalidate>
        <label class="field-label" for="compte-email">${uiIcon("mail", 14)} Email</label>
        <input id="compte-email" class="field" type="email" autocomplete="username" inputmode="email" required value="${esc(state.compteEmail)}">
        <label class="field-label" for="compte-mot">${uiIcon("lock", 14)} Mot de passe</label>
        <input id="compte-mot" class="field" type="password" autocomplete="current-password" minlength="8" required>
        ${state.compteErreur ? `<p class="field-error">${esc(state.compteErreur)}</p>` : ""}
        <div class="sheet-actions compte-actions">
          <button class="btn btn-primary" type="button" data-action="connexion" ${state.compteEnCours ? "disabled" : ""}>${uiIcon("user")} Se connecter</button>
          <button class="btn btn-ghost" type="button" data-action="inscription" ${state.compteEnCours ? "disabled" : ""}>${uiIcon("plus")} Créer un compte</button>
        </div>
      </form>`;
  }
  const premium = state.compte.premium;
  const listes = state.compte.listes || [];
  const reglages = assurerReglages();
  const options = boot.lieux.map((lieu) => `<option value="${esc(lieu.id)}">${esc(lieu.nom)}</option>`).join("");
  const listesHtml = listes.map((liste) => `
    <article class="liste${state.listeId === liste.id ? " is-on" : ""}">
      <header>
        <h3>${esc(liste.nom)}</h3>
        <button type="button" class="btn btn-ghost btn-compact" data-action="suivre-liste" data-id="${liste.id}">${uiIcon(state.listeId === liste.id ? "check" : "pin")} ${state.listeId === liste.id ? "Suivie" : "Suivre"}</button>
      </header>
      <div class="liste-lieux">
        ${(liste.lieux || []).map((id) => `<button type="button" class="chip" data-action="retirer-lieu" data-liste="${liste.id}" data-lieu="${esc(id)}">${esc(nomLieu(id))} ×</button>`).join("") || '<p class="muted">Aucun lieu pour l’instant.</p>'}
      </div>
      <form class="liste-ajout" data-liste="${liste.id}">
        <select class="field" name="lieu_id" aria-label="Ajouter un lieu à ${esc(liste.nom)}">${options}</select>
        <button class="btn btn-ghost btn-compact" type="submit">${uiIcon("plus")} Ajouter</button>
        <button type="button" class="btn btn-ghost btn-compact" data-action="supprimer-liste" data-id="${liste.id}">${uiIcon("trash")} Supprimer</button>
      </form>
    </article>`).join("");
  return `
    <div class="sheet-head">
      <div>
        <h1>${premium ? "Premium" : "Compte"}</h1>
        <p>${esc(state.compte.email)}</p>
      </div>
      <button type="button" class="btn btn-ghost btn-compact" data-action="sortie">${uiIcon("logout")} Sortir</button>
    </div>
    <div class="compose">
      ${premium ? "" : `
        <section class="offre">
          <h2>Personnaliser, 1 500 F / mois</h2>
          <ul>
            <li>Listes de quartiers à suivre</li>
            <li>Trajet domicile–travail, signalements sur le chemin</li>
            <li>Alertes visuelles et sonores</li>
            <li>GPS : alerte quand vous approchez d’un lieu suivi</li>
            <li>Heures de vigilance, le matin et le soir</li>
            <li>Mode conduite, texte plus grand</li>
            <li>Silence de deux heures</li>
          </ul>
          <p class="muted">Le paiement mobile money n’est pas branché. Activer Premium ici enregistre le droit sur ce serveur, sans débit.</p>
          ${state.compteErreur ? `<p class="field-error">${esc(state.compteErreur)}</p>` : ""}
          <button type="button" class="btn btn-primary btn-block" data-action="premium" ${state.compteEnCours ? "disabled" : ""}>${uiIcon("star")} Activer Premium</button>
        </section>`}
      ${premium ? `
        <section>
          <h2 class="field-label">${uiIcon("list", 14)} Listes de lieux</h2>
          ${listesHtml || '<p class="muted">Créez une liste, par exemple Matin ou Famille.</p>'}
          <form id="nouvelle-liste" class="liste-ajout">
            <input class="field" name="nom" maxlength="40" placeholder="Nom de la liste" aria-label="Nom de la liste">
            <button class="btn btn-primary btn-compact" type="submit">${uiIcon("plus")} Créer</button>
          </form>
        </section>
        <section>
          <h2 class="field-label">${uiIcon("route", 14)} Trajet</h2>
          <form id="trajet-form" class="trajet">
            <select class="field" name="depart" aria-label="Départ">${options}</select>
            <select class="field" name="arrivee" aria-label="Arrivée">${options}</select>
            <button class="btn btn-primary btn-compact" type="submit">${uiIcon("route")} ${state.trajet ? "Trajet suivi" : "Suivre ce trajet"}</button>
            ${state.trajet ? `<button type="button" class="btn btn-ghost btn-compact" data-action="oublier-trajet">${uiIcon("close")} Effacer</button>` : ""}
          </form>
        </section>
        <section class="reglages">
          <h2 class="field-label">${uiIcon("bell", 14)} Alertes</h2>
          <label class="check"><input type="checkbox" data-reglage="visuel" ${reglages.visuel ? "checked" : ""}><span>${uiIcon("bell")} Alertes visuelles</span></label>
          <label class="check"><input type="checkbox" data-reglage="son" ${reglages.son ? "checked" : ""}><span>${uiIcon("volume")} Alertes sonores</span></label>
          <label class="check"><input type="checkbox" data-reglage="gps" ${reglages.gps ? "checked" : ""}><span>${uiIcon("locate")} GPS et alerte à l’approche</span></label>
          <label class="check"><input type="checkbox" data-reglage="conduite" ${reglages.conduite ? "checked" : ""}><span>${uiIcon("car")} Mode conduite</span></label>
          <label class="check"><input type="checkbox" data-reglage="heures" ${reglages.heures ? "checked" : ""}><span>${uiIcon("clock")} Seulement aux heures de vigilance</span></label>
          <div class="heures">
            <input class="field" type="time" data-heure="debut" value="${esc(reglages.debut)}">
            <input class="field" type="time" data-heure="fin" value="${esc(reglages.fin)}">
            <input class="field" type="time" data-heure="debut2" value="${esc(reglages.debut2)}">
            <input class="field" type="time" data-heure="fin2" value="${esc(reglages.fin2)}">
          </div>
          <button type="button" class="btn btn-ghost btn-block" data-action="silence">${uiIcon("moon")} Silence pendant 2 heures</button>
        </section>` : ""}
      <button type="button" class="btn btn-ghost btn-block" data-action="back">${uiIcon("back")} Retour à la carte</button>
      ${state.compte.est_admin ? `<a class="btn btn-ghost btn-block" href="/admin/">${uiIcon("layers")} Administration</a>` : ""}
    </div>`;
}

function renderSheet() {
  const root = document.getElementById("sheet-content");
  let html;
  if (state.loading && !state.loaded) html = renderLoading();
  else if (state.error && !state.loaded) html = renderError();
  else if (state.mode === "compose") html = renderCompose();
  else if (state.mode === "compte") html = renderCompte();
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
  document.body.classList.toggle("is-driving", !!(state.compte && state.compte.premium && assurerReglages().conduite));
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
  state.tendanceOuverte = false;
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

function lieuConnu(nom) {
  const cle = fold(String(nom || "").trim());
  if (!cle) return null;
  return boot.lieux.find((lieu) => fold(lieu.nom) === cle) || null;
}

function nomPoseALaMain() {
  const nom = (state.draft.lieu || "").trim();
  if (!nom || state.draft.lieuId) return false;
  if (nom === "Point choisi sur la carte" || nom.startsWith("Près de ")) return false;
  return true;
}

function lieuAide() {
  const nom = (state.draft.lieu || "").trim();
  if (state.draft.latitude != null && nom) return "Point placé à Libreville.";
  if (nom) return "Ce quartier n'est pas dans la liste. Touchez la carte pour le placer.";
  return "Un nom de la liste, ou le vôtre.";
}

function appliquerLieuSaisi(valeur) {
  const nom = String(valeur || "").replace(/\s+/g, " ").trim();
  const connu = lieuConnu(nom);
  if (connu) {
    state.draft.lieuId = connu.id;
    state.draft.lieu = connu.nom;
    state.draft.latitude = connu.latitude;
    state.draft.longitude = connu.longitude;
    delete state.errors.lieu;
    return connu;
  }
  const venaitDuneListe = Boolean(state.draft.lieuId);
  state.draft.lieu = nom;
  state.draft.lieuId = "";
  if (venaitDuneListe) {
    state.draft.latitude = null;
    state.draft.longitude = null;
  }
  return null;
}

function afficherAideLieu() {
  const aide = document.querySelector(".chosen");
  if (!aide) return;
  aide.textContent = lieuAide();
  aide.classList.toggle("is-set", state.draft.latitude != null);
  if (state.draft.latitude != null) {
    const erreur = document.getElementById("lieu-erreur");
    if (erreur) erreur.remove();
    const champ = document.getElementById("lieu-saisie");
    if (champ) champ.classList.remove("is-invalid");
  }
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
  const garderNom = nomPoseALaMain();
  state.draft.latitude = latlng.lat;
  state.draft.longitude = latlng.lng;
  if (!garderNom) {
    state.draft.lieuId = "";
    state.draft.lieu = near ? `Près de ${near.nom}` : "Point choisi sur la carte";
  }
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
  const nomLieuSaisi = (state.draft.lieu || "").trim();
  if (nomLieuSaisi.length < 2) errors.lieu = "Indiquez le nom du quartier.";
  else if (nomLieuSaisi.length > 120) errors.lieu = "120 caractères maximum.";
  else if (state.draft.latitude == null) errors.lieu = "Ce quartier n'est pas dans la liste. Touchez la carte pour le placer.";
  else if (!inside(state.draft.latitude, state.draft.longitude)) errors.lieu = "Ce point est en dehors du Grand Libreville.";
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

async function degager(id) {
  const current = state.reports.find((item) => item.id === id);
  if (!current) return;
  try {
    const data = await api(`/api/signalements/${id}/degage/`, { method: "POST" });
    if (data.retire) {
      state.reports = state.reports.filter((item) => item.id !== id);
      state.markerKey = "";
      if (state.selectedId === id) {
        state.selectedId = null;
        state.mode = "feed";
        state.returnMode = "feed";
        history.replaceState(null, "", `${location.pathname}${location.search}`);
      }
      toast(
        (Number(state.seuilDegage) || 2) === 2
          ? "Deux usagers disent que c'est dégagé. L'alerte est retirée."
          : `${state.seuilDegage} usagers disent que c'est dégagé. L'alerte est retirée.`,
      );
      render();
      return;
    }
    upsert(data.signalement);
    render();
  } catch (error) {
    toast(messageFrom(error, "Le vote n'a pas pu être enregistré."));
  }
}

async function support(id) {
  const current = state.reports.find((item) => item.id === id);
  if (!current) return;
  const retirait = !!current.appuye;
  try {
    const data = await api(`/api/signalements/${id}/appui/`, { method: "POST" });
    upsert(data.signalement);
    if (retirait && data.signalement && !data.signalement.appuye) toast("Confirmation retirée.");
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
  const precedents = state.reports.slice();
  const avaitUnCache = state.loaded;
  if (!state.loaded) {
    state.loading = true;
    state.error = null;
    render();
  }
  try {
    const data = await api("/api/signalements/");
    noterPilotage(data);
    if (avaitUnCache) surveiller(precedents, data.signalements || []);
    state.reports = data.signalements;
    state.tendance = data.tendance;
    state.loaded = true;
    state.loading = false;
    state.error = null;
    state.markerKey = "";
    ecrireMemoire({
      feed: {
        signalements: data.signalements,
        tendance: data.tendance,
        duree_heures: state.dureeHeures,
        seuil_degage: state.seuilDegage,
      },
    });
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

function surveiller(precedents, suivants) {
  if (!state.compte || !state.compte.premium) return;
  if (!state.listeId && !state.trajet) return;
  const connus = new Set(precedents.map((report) => report.id));
  const frais = suivants.filter((report) => !connus.has(report.id) && correspondVeille(report));
  if (!frais.length) return;
  const phrase = frais.length === 1
    ? `${frais[0].type_label} vers ${frais[0].lieu}`
    : `${frais.length} nouveaux signalements sur votre veille`;
  alerter(phrase);
}

async function quietRefresh() {
  if (document.hidden || state.mode === "compose" || state.mode === "compte" || state.picking || state.saving || state.commentSending) return;
  const active = document.activeElement;
  if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
  try {
    const precedents = state.reports.slice();
    const regardait = state.mode === "detail" ? state.selectedId : null;
    const data = await api("/api/signalements/");
    noterPilotage(data);
    if (precedents.length) surveiller(precedents, data.signalements || []);
    state.reports = data.signalements;
    state.tendance = data.tendance;
    state.loaded = true;
    state.markerKey = "";
    ecrireMemoire({
      feed: {
        signalements: data.signalements,
        tendance: data.tendance,
        duree_heures: state.dureeHeures,
        seuil_degage: state.seuilDegage,
      },
    });
    if (state.mode === "detail" && !selected()) {
      state.mode = "feed";
      state.selectedId = null;
      if (regardait) toast("Ce signalement n'est plus là.");
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
  state.listeId = null;
  state.trajet = null;
  state.markerKey = "";
  ecrireMemoire({ listeActive: null, trajet: null });
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
    `<li><button type="button" class="search-hit" role="option" data-kind="report" data-id="${report.id}"><strong>${esc(report.lieu)}</strong><span>${esc(report.type_label)} · ${esc(report.relatif)} · ×${report.appuis}</span></button></li>`
  )).join("");
  if (!placeHtml && !reportHtml) {
    list.innerHTML = `<li class="search-empty">${query ? "Aucun lieu pour cette recherche." : "Tapez un quartier ou un lieu."}</li>`;
  } else {
    list.innerHTML = placeHtml + reportHtml;
  }
  list.hidden = false;
}

function setSearchOpen(open) {
  if (open && state.tendanceOuverte) {
    state.tendanceOuverte = false;
    renderChrome();
  }
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

let gpsWatch = 0;
let dernierGpsLieu = "";

function reglerGps() {
  if (gpsWatch && navigator.geolocation) navigator.geolocation.clearWatch(gpsWatch);
  gpsWatch = 0;
  const reglages = assurerReglages();
  if (!reglages.gps || !state.compte || !state.compte.premium || !navigator.geolocation) return;
  gpsWatch = navigator.geolocation.watchPosition((position) => {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const proche = boot.lieux.find((lieu) => haversine(latitude, longitude, lieu.latitude, lieu.longitude) <= 1.2);
    if (!proche || proche.id === dernierGpsLieu) return;
    const liste = listeActive();
    const suivi = liste && liste.lieux.includes(proche.id);
    const trajet = state.trajet && (state.trajet.depart === proche.id || state.trajet.arrivee === proche.id);
    if (!suivi && !trajet) return;
    dernierGpsLieu = proche.id;
    alerter(`Vous approchez de ${proche.nom}.`);
  }, () => {}, { enableHighAccuracy: false, maximumAge: 20000, timeout: 12000 });
}

function memoriserSession() {
  ecrireMemoire({
    jeton: state.jeton,
    compte: state.compte,
    listeActive: state.listeId,
    trajet: state.trajet,
    reglages: assurerReglages(),
  });
}

function appliquerCompte(compte, jeton) {
  state.compte = compte;
  if (jeton) state.jeton = jeton;
  memoriserSession();
  document.body.classList.toggle("is-driving", !!(compte && compte.premium && assurerReglages().conduite));
  reglerGps();
}

async function chargerCompte() {
  if (!state.jeton) return;
  try {
    const data = await api("/api/comptes/moi/");
    appliquerCompte(data.compte);
    if (state.mode === "compte") render();
  } catch (error) {
    if (error.status === 401) {
      state.jeton = "";
      state.compte = null;
      memoriserSession();
    }
  }
}

function ouvrirCompte() {
  state.mode = "compte";
  state.compteErreur = "";
  state.picking = false;
  if (!isDesktop()) setVisible(state.compte ? snapPoints()[2] : Math.min(430, sheetCeiling()));
  render();
}

async function envoyerCompte(inscription) {
  const email = (document.getElementById("compte-email") || {}).value || "";
  const mot = (document.getElementById("compte-mot") || {}).value || "";
  state.compteEmail = email.trim();
  state.compteEnCours = true;
  state.compteErreur = "";
  render();
  try {
    const data = await api(inscription ? "/api/comptes/inscription/" : "/api/comptes/connexion/", {
      method: "POST",
      body: JSON.stringify({ email, mot_de_passe: mot }),
    });
    state.compteEnCours = false;
    appliquerCompte(data.compte, data.jeton);
    toast(inscription ? "Compte créé." : "Vous êtes connecté.");
    if (!isDesktop() && state.mode === "compte") setVisible(snapPoints()[2]);
    render();
  } catch (error) {
    state.compteEnCours = false;
    const champs = error.data && error.data.erreurs;
    state.compteErreur = (champs && (champs.email || champs.mot_de_passe)) || messageFrom(error, "Le compte n'a pas répondu.");
    render();
  }
}

async function activerPremium() {
  state.compteEnCours = true;
  state.compteErreur = "";
  render();
  try {
    const data = await api("/api/comptes/premium/", { method: "POST", body: "{}" });
    state.compteEnCours = false;
    appliquerCompte(data.compte);
    toast("Premium est actif. Rien n'a été débité.");
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    render();
  } catch (error) {
    state.compteEnCours = false;
    state.compteErreur = messageFrom(error, "Premium n'a pas pu être activé.");
    render();
  }
}

function sortir() {
  state.compte = null;
  state.jeton = "";
  state.listeId = null;
  state.trajet = null;
  assurerReglages().gps = false;
  assurerReglages().conduite = false;
  reglerGps();
  memoriserSession();
  state.mode = "feed";
  state.markerKey = "";
  render();
}

async function creerListe(nom) {
  const data = await api("/api/comptes/listes/", { method: "POST", body: JSON.stringify({ nom }) });
  appliquerCompte(data.compte);
  render();
}

async function ajouterLieuListe(listeId, lieuId) {
  const data = await api(`/api/comptes/listes/${listeId}/lieux/`, {
    method: "POST",
    body: JSON.stringify({ lieu_id: lieuId }),
  });
  appliquerCompte(data.compte);
  render();
}

async function retirerLieuListe(listeId, lieuId) {
  const data = await api(`/api/comptes/listes/${listeId}/lieux/${lieuId}/`, { method: "DELETE" });
  appliquerCompte(data.compte);
  render();
}

async function supprimerListe(id) {
  const data = await api(`/api/comptes/listes/${id}/`, { method: "DELETE" });
  if (state.listeId === id) state.listeId = null;
  appliquerCompte(data.compte);
  render();
}

function suivreListe(id) {
  state.listeId = state.listeId === id ? null : Number(id);
  state.trajet = null;
  state.place = null;
  state.markerKey = "";
  memoriserSession();
  state.mode = "feed";
  if (!isDesktop()) setVisible(snapPoints()[1]);
  const liste = listeActive();
  const premier = liste && liste.lieux.length ? lieuParId(liste.lieux[0]) : null;
  if (premier && map) map.flyTo([premier.latitude, premier.longitude], 14, { duration: motion() });
  render();
}

function suivreTrajet(depart, arrivee) {
  if (!depart || !arrivee || depart === arrivee) {
    toast("Choisissez deux lieux différents.");
    return;
  }
  state.trajet = { depart, arrivee };
  state.listeId = null;
  state.place = null;
  state.markerKey = "";
  memoriserSession();
  state.mode = "feed";
  const a = lieuParId(depart);
  const b = lieuParId(arrivee);
  if (a && b && map) {
    map.fitBounds([[a.latitude, a.longitude], [b.latitude, b.longitude]], { padding: [40, 40] });
  }
  if (!isDesktop()) setVisible(snapPoints()[1]);
  render();
}

function changerReglage(nom, valeur) {
  const reglages = assurerReglages();
  reglages[nom] = valeur;
  memoriserSession();
  document.body.classList.toggle("is-driving", !!(state.compte && state.compte.premium && reglages.conduite));
  if (nom === "visuel" && valeur && "Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
  if (nom === "gps") {
    if (valeur && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        if (map) map.flyTo([position.coords.latitude, position.coords.longitude], 15, { duration: motion() });
      }, () => toast("La position n'est pas disponible."));
    }
    reglerGps();
  }
}

function restaurerMemoire() {
  const memoire = lireMemoire();
  state.jeton = typeof memoire.jeton === "string" ? memoire.jeton : "";
  state.reglages = { ...reglagesDefaut(), ...(memoire.reglages || {}) };
  state.listeId = memoire.listeActive || null;
  state.trajet = memoire.trajet || null;
  if (memoire.compte && memoire.compte.email) state.compte = memoire.compte;
  if (memoire.feed && Array.isArray(memoire.feed.signalements)) {
    noterPilotage(memoire.feed);
    state.reports = memoire.feed.signalements;
    state.tendance = memoire.feed.tendance || null;
    state.loaded = true;
  }
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
  else if (action === "degage") degager(Number(el.dataset.id));
  else if (action === "retry") reload();
  else if (action === "clear-place") clearPlace();
  else if (action === "compte") ouvrirCompte();
  else if (action === "connexion") envoyerCompte(false);
  else if (action === "inscription") envoyerCompte(true);
  else if (action === "premium") activerPremium();
  else if (action === "sortie") sortir();
  else if (action === "suivre-liste") suivreListe(Number(el.dataset.id));
  else if (action === "supprimer-liste") supprimerListe(Number(el.dataset.id));
  else if (action === "retirer-lieu") retirerLieuListe(Number(el.dataset.liste), el.dataset.lieu);
  else if (action === "oublier-trajet") {
    state.trajet = null;
    state.markerKey = "";
    memoriserSession();
    render();
  } else if (action === "silence") {
    assurerReglages().silenceJusqua = Date.now() + 2 * 60 * 60 * 1000;
    memoriserSession();
    toast("Alertes en silence pour 2 heures.");
  }
}

function onSubmit(event) {
  if (event.target.id === "compose-form") publish(event);
  else if (event.target.id === "comment-form") sendComment(event);
  else if (event.target.id === "nouvelle-liste") {
    event.preventDefault();
    const nom = new FormData(event.target).get("nom");
    creerListe(String(nom || "")).catch((error) => toast(messageFrom(error, "La liste n'a pas pu être créée.")));
  } else if (event.target.classList.contains("liste-ajout") && event.target.dataset.liste) {
    event.preventDefault();
    const lieu = new FormData(event.target).get("lieu_id");
    ajouterLieuListe(Number(event.target.dataset.liste), String(lieu || "")).catch((error) => {
      toast(messageFrom(error, "Le lieu n'a pas pu être ajouté."));
    });
  } else if (event.target.id === "trajet-form") {
    event.preventDefault();
    const data = new FormData(event.target);
    suivreTrajet(String(data.get("depart") || ""), String(data.get("arrivee") || ""));
  } else if (event.target.id === "compte-form") {
    event.preventDefault();
    envoyerCompte(false);
  }
}

function onChange(event) {
  if (event.target.id === "lieu-saisie") {
    const connu = appliquerLieuSaisi(event.target.value);
    if (connu && event.target.value !== connu.nom) event.target.value = connu.nom;
    afficherAideLieu();
    if (connu && map) map.flyTo([connu.latitude, connu.longitude], Math.max(map.getZoom(), 15), { duration: motion() });
  }
  if (event.target.dataset.reglage) changerReglage(event.target.dataset.reglage, event.target.checked);
  if (event.target.dataset.heure) {
    assurerReglages()[event.target.dataset.heure] = event.target.value;
    memoriserSession();
  }
}

function onInput(event) {
  if (event.target.id === "commentaire") {
    state.draft.commentaire = event.target.value;
    const counter = document.getElementById("commentaire-count");
    if (counter) counter.textContent = `${event.target.value.trim().length}/280`;
  }
  if (event.target.id === "detail-commentaire") state.detailDraft = event.target.value;
  if (event.target.id === "lieu-saisie") {
    appliquerLieuSaisi(event.target.value);
    afficherAideLieu();
  }
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
    clearPlace();
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
    if (state.searchOpen && !event.target.closest("#search")) setSearchOpen(false);
    if (state.tendanceOuverte && !event.target.closest("#tendance-wrap")) {
      state.tendanceOuverte = false;
      renderChrome();
    }
  });
  document.getElementById("tendance-toggle").addEventListener("click", () => {
    if (!state.tendance) return;
    if (state.searchOpen) setSearchOpen(false);
    state.tendanceOuverte = true;
    renderChrome();
  });
  document.getElementById("tendance-close").addEventListener("click", () => {
    state.tendanceOuverte = false;
    renderChrome();
  });
  document.getElementById("tendance-signaler").addEventListener("click", () => {
    state.tendanceOuverte = false;
    showCompose();
  });
  document.getElementById("tendance-panel").addEventListener("click", (event) => {
    const hit = event.target.closest(".tendance-hit");
    if (!hit) return;
    state.tendanceOuverte = false;
    selectReport(Number(hit.dataset.id));
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
    if (state.tendanceOuverte) {
      state.tendanceOuverte = false;
      renderChrome();
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
  restaurerMemoire();
  initMap();
  bind();
  if (!isDesktop()) setVisible(visiblePx());
  render();
  reload();
  chargerCompte().then(() => reglerGps());
  window.setInterval(quietRefresh, 45000);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
