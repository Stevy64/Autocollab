let boot = null;
let map = null;
let fondSatellite = null;
let fondAxes = null;
let fondRoutes = null;
let markerLayer = null;
let pickLayer = null;
let nomLayer = null;
let trajetLayer = null;
let gpsLayer = null;
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

const PHRASES = {
  bouchon: [
    "Ça n'avance plus, plusieurs files.",
    "Bouchon au feu, circulation très lente.",
    "Embouteillage, prévoir un détour.",
  ],
  accident: [
    "Accident sur la voie, circulation bloquée.",
    "Véhicules arrêtés après un choc.",
    "Accident, une voie est prise.",
  ],
  travaux: [
    "Travaux sur la chaussée, passage étroit.",
    "Chantier, la circulation est déviée.",
    "Travaux, une file seulement.",
  ],
  police: [
    "Contrôle de police, ça ralentit.",
    "Contrôle sur la voie, files qui se forment.",
    "Barrage policier, prévoyez du temps.",
  ],
  route_barree: [
    "Route barrée, il faut faire demi-tour.",
    "Voie fermée, aucun passage.",
    "Route coupée, prenez un autre chemin.",
  ],
  autre: [
    "Obstacle sur la voie, ralentissement.",
    "Situation inhabituelle, soyez prudents.",
    "Gêne à la circulation à cet endroit.",
  ],
};

const FAQ = [
  {
    id: "quoi",
    q: "Wayizé, c'est quoi ?",
    a: "Une carte de la circulation à Libreville. Les usagers y signalent un bouchon, un accident, des travaux, un contrôle ou une route barrée. Les autres peuvent confirmer ou préciser.",
  },
  {
    id: "compte",
    q: "Faut-il un compte ?",
    a: "Non. La carte, les signalements et les notifications téléphone (Web Push) restent ouverts sans compte. Un compte confirme son adresse email. Premium ajoute le trajet domicile–travail, les listes, les alertes à l'approche, le GPS, le mode conduite et un pseudo sur les précisions.",
  },
  {
    id: "vite",
    q: "Comment signaler vite ?",
    a: "Touchez Signaler, choisissez le type, puis le quartier. Un commentaire est déjà proposé : vous pouvez le garder ou en prendre un autre. Trois gestes suffisent. Si le lieu n'est pas dans la liste, touchez la carte.",
  },
  {
    id: "duree",
    q: "Combien de temps un signalement reste-t-il ?",
    a: "Par défaut, environ trois heures. Ce délai peut être ajusté. Un signalement plus ancien disparaît de la carte.",
  },
  {
    id: "confirmer",
    q: "À quoi sert Confirmer ?",
    a: "À dire que vous voyez la même chose. Le compteur augmente. Vous pouvez retirer votre confirmation en recliquant.",
  },
  {
    id: "degage",
    q: "À quoi sert C'est dégagé ?",
    a: "À dire que la voie est libre. Par défaut, deux usagers qui le disent retirent l'alerte tout de suite. Un seul vote reste visible. Vous pouvez annuler le vôtre.",
  },
  {
    id: "gps",
    q: "La carte suit-elle ma position ?",
    a: "Pas pour signaler. Le lieu se choisit dans la liste ou sur la carte. Le GPS n'existe que dans Premium : il prévient quand vous approchez d'un lieu suivi. Wayizé ne trace pas vos déplacements.",
  },
  {
    id: "premium",
    q: "Que comprend Premium, et est-ce payant ?",
    a: "Listes de quartiers, trajet, alertes à l'approche, GPS, heures de vigilance, mode conduite et silence de deux heures. Les alertes téléphone sur la route sont gratuites pour tout le monde (interrupteur sur la carte). Sur cette version, activer Premium enregistre le droit sans débit : le paiement mobile money n'est pas branché.",
  },
  {
    id: "install",
    q: "Comment installer Wayizé ?",
    a: "Quand le navigateur le permet, le bouton Installer ouvre la boîte d'installation (beforeinstallprompt). Sur iPhone : Partager, puis Sur l'écran d'accueil. Si Wayizé est déjà installée, l'écran le dit. Un lien Android ou Apple n'apparaît que s'il a été publié dans les paramètres.",
  },
  {
    id: "retrait",
    q: "Un signalement faux peut-il être retiré ?",
    a: "Oui. Deux votes « dégagé » le retirent, ou il expire au bout de sa durée. Un administrateur peut aussi le retirer. N'écrivez ni nom, ni numéro, ni plaque.",
  },
];

const CGU = [
  {
    titre: "1. Objet",
    paragraphes: [
      "Les présentes conditions générales d'utilisation (ci-après « CGU ») régissent l'accès et l'utilisation de l'application et du site Wayizé (ci-après le « Service »). En consultant la carte, en publiant un signalement ou en créant un compte, vous acceptez ces CGU. Si vous ne les acceptez pas, vous ne devez pas utiliser le Service.",
    ],
  },
  {
    titre: "2. Nature du Service",
    paragraphes: [
      "Wayizé est une carte collaborative de la circulation à Libreville, alimentée par les usagers. Le Service affiche des signalements, des confirmations et des précisions. Il n'est pas un service officiel de l'État, de la police ou de la voirie, et il ne remplace ni le code de la route, ni votre jugement au volant.",
      "Les informations sont indicatives. Elles peuvent être incomplètes, inexactes ou déjà périmées. Vous restez seul responsable de votre conduite.",
    ],
  },
  {
    titre: "3. Signalements",
    paragraphes: [
      "Vous ne signalez que ce que vous constatez : un bouchon, un accident, des travaux, un contrôle, une route barrée ou une autre gêne. Une phrase et un lieu approximatif suffisent.",
    ],
    liste: [
      "pas d'insultes, de rumeurs ni de contenus illicites ;",
      "pas de nom, de numéro de téléphone, de plaque ou d'autre donnée personnelle ;",
      "pas de signalement répété pour saturer la carte.",
    ],
  },
  {
    titre: "4. Compte et Premium",
    paragraphes: [
      "Le compte est facultatif. Vous êtes responsable de la confidentialité de votre mot de passe et de l'usage de votre compte. L'éditeur peut suspendre un accès en cas d'abus, de fraude ou d'usage contraire aux présentes CGU.",
      "Premium ajoute des outils de veille (listes, trajet, alertes, GPS à l'approche, mode conduite). Sur cette version, l'activer enregistre un droit sur le serveur et n'effectue aucun débit. Lorsqu'un paiement sera proposé, son prix et ses conditions seront indiqués avant toute validation.",
    ],
  },
  {
    titre: "5. Données",
    paragraphes: [
      "Sans compte, une clé de session distingue votre navigateur pour les confirmations, les votes « dégagé » et le plafond de signalements. Elle ne constitue pas un compte. Avec un compte, l'adresse email et les listes de lieux sont enregistrées pour faire fonctionner le Service.",
      "Les journaux techniques ne conservent ni le texte d'un signalement, ni le mot de passe, ni la clé de session.",
    ],
  },
  {
    titre: "6. Propriété intellectuelle",
    paragraphes: [
      "L'interface, le nom Wayizé et les textes du Service sont protégés. Le fond de carte vient d'OpenStreetMap. Toute extraction massive ou exploitation commerciale non autorisée est interdite.",
    ],
  },
  {
    titre: "7. Limitation de responsabilité",
    paragraphes: [
      "Le Service est fourni en l'état et selon disponibilité. Dans les limites autorisées par la loi, l'éditeur n'est pas responsable des dommages liés à l'utilisation de la carte, à un signalement inexact, à une indisponibilité ou à une décision prise sur la route à partir des informations affichées.",
    ],
  },
  {
    titre: "8. Modification des CGU",
    paragraphes: [
      "L'éditeur peut modifier les présentes CGU. La version applicable est celle affichée dans le Service à la date de consultation. Continuer à utiliser Wayizé après une mise à jour vaut acceptation des nouvelles conditions.",
    ],
  },
  {
    titre: "9. Droit applicable",
    paragraphes: [
      "Les présentes CGU sont régies par le droit gabonais. Tout litige relatif à leur interprétation ou à leur exécution sera soumis aux juridictions gabonaises compétentes, sous réserve des dispositions d'ordre public.",
    ],
  },
  {
    titre: "10. Acceptation",
    paragraphes: [
      "En utilisant le Service, en publiant un signalement ou en cochant la case d'acceptation lors de la création d'un compte, vous reconnaissez avoir lu et accepté les présentes CGU.",
    ],
  },
];

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
  deplacerId: null,
  deplacementEnCours: false,
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
  comptePseudo: "",
  compteCgu: false,
  compteMode: "connexion",
  compteLien: "",
  compteMessage: "",
  compteJetonMail: "",
  commentAnonyme: null,
  gpsEtat: "Position en attente.",
  veille: "",
  comptePanneau: "veille",
  autreTrajet: false,
  legal: null,
  faqOuverte: "",
  lieuOuvert: false,
  typesOuverts: false,
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

function iconeType(type, presse) {
  const style = styleOf(type);
  const fond = presse ? "#fff" : style.pin;
  const encre = presse ? style.pin : style.chipText;
  return `<span class="type-mini" style="background:${fond};color:${encre}">${iconSvg(type, 12)}</span>`;
}

function chipHtml(chip, attrs) {
  const style = styleOf(chip.id);
  const presse = attrs.includes('aria-pressed="true"');
  const icone = GLYPH[chip.id]
    ? `<span class="chip-ico" style="color:${presse ? "#fff" : style.pin}">${iconSvg(chip.id, 14)}</span>`
    : "";
  return `<button type="button" class="chip" ${attrs}><span class="chip-label">${icone}${esc(chip.label)}</span></button>`;
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
  eye: '<path d="M2.5 12S6.2 6.2 12 6.2 21.5 12 21.5 12 17.8 17.8 12 17.8 2.5 12 2.5 12z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  eyeOff: '<path d="M3.2 3.2 20.8 20.8M9.4 6.5A9 9 0 0 1 12 6.2c5.8 0 9.5 5.8 9.5 5.8a16 16 0 0 1-3.1 3.6M6.2 7.4C4 8.9 2.5 12 2.5 12s3.7 5.8 9.5 5.8c1.1 0 2.1-.2 3-.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M10 10.2a2.6 2.6 0 0 0 3.6 3.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  car: '<path d="M4 14.5h16M6.2 14.2 7.6 9.2A1.4 1.4 0 0 1 9 8.2h6a1.4 1.4 0 0 1 1.4 1l1.4 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="8" cy="16.2" r="1.2" fill="currentColor"/><circle cx="16" cy="16.2" r="1.2" fill="currentColor"/>',
  sheetDown: '<path d="M4.5 15.2h15a1.4 1.4 0 0 1 1.4 1.4v2.4a1.4 1.4 0 0 1-1.4 1.4h-15a1.4 1.4 0 0 1-1.4-1.4v-2.4a1.4 1.4 0 0 1 1.4-1.4z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.2 8.2 12 12l3.8-3.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  sheetUp: '<path d="M4.5 15.2h15a1.4 1.4 0 0 1 1.4 1.4v2.4a1.4 1.4 0 0 1-1.4 1.4h-15a1.4 1.4 0 0 1-1.4-1.4v-2.4a1.4 1.4 0 0 1 1.4-1.4z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.2 12 12 8.2 15.8 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  share: '<circle cx="18" cy="5" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="6" cy="12" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="18" cy="19" r="2.4" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.2 10.8 15.6 6.4M8.2 13.2 15.6 17.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
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
  if (error && error.status === 403) {
    return (error.data && error.data.message)
      || "La session a expiré. Rechargez la page, puis réessayez.";
  }
  if (error && error.status === 0) return "Pas de connexion. Réessayez dès que le réseau revient.";
  if (error && error.data && error.data.message) return String(error.data.message);
  if (error && error.status >= 400) return `${fallback} (${error.status})`;
  if (error && error.message && error.message !== "http" && error.message !== "network") {
    return String(error.message).slice(0, 180);
  }
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
  if (method !== "GET" && method !== "HEAD") {
    const jetonCsrf = csrf();
    if (!jetonCsrf) {
      const failure = new Error("Jeton CSRF manquant. Rechargez la page.");
      failure.status = 403;
      failure.data = { message: "Jeton CSRF manquant. Rechargez la page." };
      throw failure;
    }
    headers["X-CSRFToken"] = jetonCsrf;
  }
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
  const brut = await response.text();
  let data = {};
  if (brut) {
    try {
      data = JSON.parse(brut);
    } catch (error) {
      if (response.status === 403) {
        data = { message: "Jeton CSRF refusé. Rechargez la page, puis réessayez." };
      } else if (!response.ok) {
        data = { message: `Erreur serveur (${response.status}).` };
      }
    }
  }
  if (!response.ok) {
    const failure = new Error((data && data.message) || "http");
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
  peindrePoignee(next);
}

function peindrePoignee(px) {
  const grabber = document.getElementById("grabber");
  if (!grabber) return;
  const haute = px >= sheetCeiling() - 28;
  grabber.classList.toggle("is-haute", haute);
  grabber.setAttribute("aria-label", haute ? "Baisser la liste" : "Déployer la liste");
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

function feuilleCachee() {
  return document.body.classList.contains("is-sheet-hidden");
}

function peindreBascule() {
  const bouton = document.getElementById("sheet-toggle");
  if (!bouton) return;
  const cachee = feuilleCachee();
  bouton.setAttribute("aria-pressed", cachee ? "false" : "true");
  bouton.setAttribute("aria-label", cachee ? "Afficher les signalements" : "Masquer les signalements");
  bouton.innerHTML = uiIcon(cachee ? "sheetUp" : "sheetDown", 20);
}

function revelerFeuille() {
  if (!feuilleCachee()) return;
  document.body.classList.remove("is-sheet-hidden");
  peindreBascule();
}

function basculerFeuille() {
  document.body.classList.toggle("is-sheet-hidden");
  peindreBascule();
  if (map) window.setTimeout(() => map.invalidateSize(), 240);
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
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function cleNom(nom) {
  return fold(nom)
    .replace(/['’.-]/g, " ")
    .replace(/\bpk\s+(\d+)\b/g, "pk$1")
    .replace(/\s+/g, " ")
    .trim();
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

function surveillerTuiles(couche) {
  let erreurs = 0;
  couche.on("tileerror", () => {
    erreurs += 1;
    if (erreurs === 4) toast("Le fond de carte ne se charge pas. Vérifiez la connexion.");
  });
}

function reglagesCarte() {
  const reg = boot && boot.reglages;
  return reg && typeof reg === "object" ? reg : {};
}

function routesProposees() {
  return reglagesCarte().routes_actives !== false;
}

function prixPremium() {
  const n = Number(reglagesCarte().prix_premium);
  if (!Number.isFinite(n) || n < 0) return 1500;
  return Math.round(n);
}

function libellePrix() {
  const n = prixPremium();
  if (!n) return "offert pour le moment";
  return `${new Intl.NumberFormat("fr-FR").format(n)} F / mois`;
}

function fondInitial() {
  const memoire = lireMemoire().fond;
  const defaut = reglagesCarte().fond_defaut === "routes" ? "routes" : "satellite";
  const choisi = memoire === "routes" || memoire === "satellite" ? memoire : defaut;
  return choisi === "routes" && routesProposees() ? "routes" : choisi === "routes" ? "satellite" : choisi;
}

function appliquerFond(id) {
  let choisi = id === "routes" ? "routes" : "satellite";
  if (choisi === "routes" && !routesProposees()) choisi = "satellite";
  if (!map) return;
  if (choisi === "routes") {
    if (map.hasLayer(fondSatellite)) map.removeLayer(fondSatellite);
    if (map.hasLayer(fondAxes)) map.removeLayer(fondAxes);
    if (!map.hasLayer(fondRoutes)) fondRoutes.addTo(map);
  } else {
    if (map.hasLayer(fondRoutes)) map.removeLayer(fondRoutes);
    if (!map.hasLayer(fondSatellite)) fondSatellite.addTo(map);
    if (!map.hasLayer(fondAxes)) fondAxes.addTo(map);
    fondAxes.bringToFront();
  }
  document.querySelectorAll("[data-fond]").forEach((bouton) => {
    bouton.setAttribute("aria-pressed", bouton.dataset.fond === choisi ? "true" : "false");
  });
  document.body.classList.toggle("is-routes", choisi === "routes");
  ecrireMemoire({ fond: choisi });
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

  // Satellite Esri, avec le tracé des axes par-dessus. Le mode Routes est la
  // carte classique : fond clair, noms de voies, rues de la ville. Le trafic
  // en direct des cartes commerciales demande une clé que ce serveur n'a pas.
  fondSatellite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      maxNativeZoom: 18,
      attribution: 'Images © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    },
  );
  fondAxes = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, maxNativeZoom: 18, attribution: "" },
  );
  fondRoutes = L.tileLayer(
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      maxNativeZoom: 19,
      attribution: 'Carte © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  );
  surveillerTuiles(fondSatellite);
  surveillerTuiles(fondRoutes);
  document.querySelectorAll('[data-fond="routes"]').forEach((bouton) => {
    bouton.hidden = !routesProposees();
  });
  appliquerFond(fondInitial());
  map.createPane("noms");
  const paneNoms = map.getPane("noms");
  paneNoms.style.zIndex = "450";
  paneNoms.style.pointerEvents = "none";
  nomLayer = L.layerGroup({ pane: "noms" }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  trajetLayer = L.layerGroup().addTo(map);
  gpsLayer = L.layerGroup().addTo(map);
  pickLayer = L.layerGroup().addTo(map);
  map.on("click", (event) => {
    if (!state.picking) return;
    if (state.deplacerId) {
      envoyerDeplacement(event.latlng);
      return;
    }
    setPickedPoint(event.latlng);
  });
  map.on("zoomend moveend", () => {
    syncMarkers();
    syncNoms();
  });
  syncNoms();
  window.setTimeout(() => {
    map.invalidateSize();
    syncNoms();
  }, 200);
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

function syncNoms() {
  if (!nomLayer || !map || !boot) return;
  const zoom = map.getZoom();
  const plafond = zoom >= 15 ? 3 : zoom >= 13 ? 1 : 0;
  const ecartCatalogue = zoom >= 15 ? 28 : zoom >= 13 ? 46 : 64;
  const ecartExtra = zoom >= 15 ? 44 : 78;
  const bornes = map.getBounds().pad(0.08);
  const actifs = new Set(state.reports.map((report) => fold(report.lieu)));
  const catalogue = boot.lieux.map((lieu) => ({
    nom: lieu.nom,
    latitude: lieu.latitude,
    longitude: lieu.longitude,
  })).sort((a, b) => {
    const actif = (nom) => (actifs.has(fold(nom)) ? 0 : 1);
    if (actif(a.nom) !== actif(b.nom)) return actif(a.nom) - actif(b.nom);
    return a.nom.length - b.nom.length;
  });
  const extra = (window.QUARTIERS_CARTE || [])
    .filter((lieu) => lieu.p <= plafond)
    .filter((lieu) => !catalogue.some((item) => (
      cleNom(item.nom) === cleNom(lieu.n)
      || haversine(item.latitude, item.longitude, lieu.a, lieu.o) < 0.65
    )))
    .map((lieu) => ({ nom: lieu.n, latitude: lieu.a, longitude: lieu.o, extra: true }));
  const poses = [];
  nomLayer.clearLayers();
  for (const lieu of [...catalogue, ...extra]) {
    if (!bornes.contains([lieu.latitude, lieu.longitude])) continue;
    const point = map.latLngToContainerPoint([lieu.latitude, lieu.longitude]);
    const largeur = Math.max(lieu.nom.length <= 4 ? 30 : 44, lieu.nom.length * 7.2);
    const ecart = lieu.extra ? ecartExtra : ecartCatalogue;
    const touche = poses.some((autre) => (
      Math.abs(autre.x - point.x) < (autre.w + largeur) / 2 + 6
      && Math.abs(autre.y - point.y) < ecart * 0.42
    ));
    if (touche) continue;
    poses.push({ x: point.x, y: point.y, w: largeur });
    const icon = L.divIcon({
      className: "lieu-nom",
      html: `<span class="${zoom >= 15 ? "is-pres" : ""}">${esc(lieu.nom)}</span>`,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
    L.marker([lieu.latitude, lieu.longitude], {
      icon,
      pane: "noms",
      interactive: false,
      keyboard: false,
    }).addTo(nomLayer);
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
    <article class="item${active}">
      <button type="button" class="item-main" data-action="open" data-id="${report.id}">
        <span class="type-dot item-dot" style="background:${style.pin}"></span>
        <span class="item-body">
          <span class="item-top">
            <span class="item-title">${esc(report.lieu)}</span>
            <span class="item-count">×${report.appuis}</span>
          </span>
          <span class="item-excerpt">${esc(report.commentaire)}</span>
          <span class="item-meta">${esc(meta)}</span>
          ${report.degages ? `<span class="item-clear">${uiIcon("clear", 14)} Dégagé ×${report.degages}</span>` : ""}
        </span>
      </button>
      <button type="button" class="item-share" data-action="share" data-id="${report.id}" aria-label="Partager ce signalement">${uiIcon("share", 18)}</button>
    </article>`;
}

function emptyHtml() {
  const atPlace = state.place
    ? state.reports.some((report) => reportMatchesPlace(report, state.place))
    : false;
  if (state.place && state.filter !== "tous" && atPlace) {
    return `<div class="state"><h2>Rien pour ce filtre</h2><p>Aucun signalement de ce type vers ${esc(state.place.nom)}.</p></div>`;
  }
  if (state.place) {
    return `<div class="state"><h2>Rien vers ${esc(state.place.nom)}</h2><p>Aucun signalement pour ce lieu en ce moment.</p><button type="button" class="btn btn-ghost" data-action="clear-place">Voir toute la ville</button></div>`;
  }
  const liste = listeActive();
  if (state.trajet) {
    return `<div class="state"><h2>Rien sur ce trajet</h2><p>Aucun signalement entre ${esc(nomLieu(state.trajet.depart))} et ${esc(nomLieu(state.trajet.arrivee))}.</p><button type="button" class="btn btn-ghost" data-action="clear-place">Voir toute la ville</button></div>`;
  }
  if (liste) {
    return `<div class="state"><h2>Rien dans ${esc(liste.nom)}</h2><p>Aucun signalement pour les lieux de cette liste.</p><button type="button" class="btn btn-ghost" data-action="clear-place">Voir toute la ville</button></div>`;
  }
  if (state.filter !== "tous") {
    return `<div class="state"><h2>Rien pour ce filtre</h2><p>Aucun signalement de ce type pour le moment. Essayez un autre filtre, ou publiez ce que vous voyez sur la route.</p></div>`;
  }
  return `<div class="state"><h2>La route est calme</h2><p>Aucun signalement à Libreville pour l'instant. Si une situation peut créer un bouchon, signalez-la.</p><button type="button" class="btn btn-primary" data-action="compose">${uiIcon("alarm")} Signaler un incident</button></div>`;
}

function boutonCompte() {
  const premium = Boolean(state.compte && state.compte.premium);
  return `<button type="button" class="btn btn-ghost btn-compact" data-action="compte">${uiIcon(premium ? "star" : "user")} ${premium ? "Premium" : "Compte"}</button>`;
}

function boutonSignaler() {
  return `<button type="button" class="btn btn-primary btn-compact btn-signaler" data-action="compose">${uiIcon("alarm")} Signaler</button>`;
}

function pushActifSouhaite() {
  try {
    const v = localStorage.getItem("wayize.push.actif");
    if (v === "0") return false;
    if (v === "1") return true;
  } catch (error) {
    // localStorage peut être indisponible.
  }
  return false;
}

function memoriserPushActif(actif) {
  try {
    localStorage.setItem("wayize.push.actif", actif ? "1" : "0");
  } catch (error) {
    // ignore
  }
  if (!boot.reglages || typeof boot.reglages !== "object") boot.reglages = {};
  boot.reglages.push_actif = !!actif;
}

function aidePushCourte() {
  if (estIOSInstall() && !dejaInstallee()) {
    return "Sur iPhone : ajoutez Wayizé à l’écran d’accueil, puis activez.";
  }
  return "Recevez une alerte quand quelque chose se passe sur la route.";
}

function pushServeurPret() {
  return reglagesCarte().push === true || Boolean(reglagesCarte().vapid_public);
}

async function assurerPushEtat() {
  try {
    const data = await api("/api/notifications/etat/");
    if (!data || typeof data !== "object") return false;
    if (!boot.reglages || typeof boot.reglages !== "object") boot.reglages = {};
    boot.reglages.push = !!data.push;
    if (typeof data.abonnements === "number") boot.reglages.abonnements = data.abonnements;
    if (data.vapid_public) boot.reglages.vapid_public = data.vapid_public;
    return !!data.push;
  } catch (error) {
    return pushServeurPret();
  }
}

function invitePushHtml(options) {
  const dansReglages = options && options.reglages;
  const pushServeur = pushServeurPret();
  // Toujours visible sous « En ce moment » dès que le serveur a le Push (etat push:true),
  // même si Notification/PushManager manquent encore (on explique pourquoi).
  if (!pushServeur && !dansReglages) return "";
  const notifOk = "Notification" in window;
  const notif = notifOk ? etatNotifications() : "unsupported";
  const bloque = notif === "denied";
  const indispo = !notifOk || notif === "unsupported" || !pushDisponibleNavigateur();
  const actif = pushServeur && !bloque && !indispo && pushActifSouhaite() && notif === "granted";
  let aide = aidePushCourte();
  if (!pushServeur) aide = "Le serveur n’a pas encore les clés pour les alertes téléphone.";
  else if (bloque) aide = "Débloquez Wayizé dans les paramètres du navigateur.";
  else if (indispo) {
    aide = estIOSInstall() && !dejaInstallee()
      ? "Sur iPhone : ajoutez Wayizé à l’écran d’accueil, puis activez."
      : "Ce navigateur ne peut pas afficher d’alerte téléphone ici.";
  }
  const desactive = !pushServeur || bloque || indispo;
  const corps = `
    <label class="switch" id="push-route-switch"${desactive ? ' aria-disabled="true"' : ""}>
      <span class="switch-copy"><strong>${uiIcon("bell", 16)} Alertes sur la route</strong><small>${esc(aide)}</small></span>
      <input type="checkbox" data-reglage="pushTel" ${actif ? "checked" : ""} ${desactive ? "disabled" : ""}>
      <span class="switch-ui" aria-hidden="true"></span>
    </label>`;
  if (dansReglages) return corps;
  return `<div class="push-invite" id="push-route" data-push="${pushServeur ? "on" : "off"}">${corps}</div>`;
}

function renderFeed() {
  const items = visibleReports();
  const liste = listeActive();
  const suivi = decrireSuivi();
  const subtitle = suivi
    ? ""
    : (state.reports.length ? `Dernier signalement ${state.reports[0].relatif}` : "Libreville");
  return `
    <div class="feed">
    <div class="feed-bar">
      <div class="sheet-head">
        <h1>En ce moment</h1>
        <div class="sheet-actions">
          ${boutonCompte()}
          ${boutonSignaler()}
        </div>
        ${subtitle ? `<p>${esc(subtitle)}</p>` : ""}
        ${bandeauSuivi(suivi)}
      </div>
      ${offlineNote()}
      ${invitePushHtml()}
      <div class="chips" role="toolbar" aria-label="Filtrer les signalements">
        ${FILTERS.map((chip) => chipHtml(chip, `data-action="filter" data-filter="${chip.id}" aria-pressed="${state.filter === chip.id ? "true" : "false"}"`)).join("")}
      </div>
    </div>
    ${items.length ? `<div class="list">${items.map(itemHtml).join("")}</div>` : emptyHtml()}
    ${state.reports.length >= 100 && state.filter === "tous" && !state.place && !state.trajet && !liste ? `<p class="list-cap">Les 100 signalements les plus récents. Les plus anciens quittent la liste.</p>` : ""}
    <p class="footer-note">Signalements manuels, sans suivi GPS. Les autres usagers de la route signalent toute situation susceptible de créer les bouchons.</p>
    <div class="legal-links">
      <button type="button" class="btn btn-ghost" data-action="cgu">CGU</button>
      <button type="button" class="btn btn-ghost" data-action="faq">FAQ</button>
    </div>
    </div>`;
}

function renderLoading() {
  return `
    <div class="feed">
    <div class="feed-bar">
      <div class="sheet-head"><div><h1>En ce moment</h1><p>Lecture des signalements…</p></div></div>
      ${invitePushHtml()}
    </div>
    <div class="skeleton-list" aria-hidden="true"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>
    </div>`;
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
  const qui = note.auteur || "Un usager";
  return `<li class="note"><p>${esc(note.texte)}</p><span>${esc(qui)} · ${esc(note.relatif)}</span></li>`;
}

function commentaireAnonyme() {
  if (state.commentAnonyme != null) return state.commentAnonyme;
  return !!(state.compte && state.compte.anonyme);
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
      ${boutonSignaler()}
    </div>
    <article class="detail">
      <div class="detail-kicker">
        <span class="detail-type"><span class="type-dot" style="background:${style.pin}"></span>${esc(report.type_label)}</span>
        <span class="muted">${esc(report.relatif)}</span>
      </div>
      <h2>${esc(report.lieu)}</h2>
      ${report.mien ? `<button type="button" class="btn-text pick-link" data-action="deplacer" data-id="${report.id}">${uiIcon("pin")} Déplacer le point</button>` : ""}
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
        <button type="button" class="appui share-action" data-action="share" data-id="${report.id}" aria-label="Partager">
          <span>${uiIcon("share")} Partager</span>
        </button>
      </div>
      <p class="appui-hint">${esc(hint)}<br><span class="degage-hint">${esc(degageHint)}</span></p>
      <section class="notes" aria-label="Précisions">
        <div class="notes-head">
          <h3>Précisions</h3>
          ${notes.length ? `<span class="notes-count">${notes.length}</span>` : ""}
        </div>
        ${notes.length
          ? `<div class="note-scroll" tabindex="0"><ul class="note-list">${notes.map(noteHtml).join("")}</ul></div>${notes.length >= 30 ? `<p class="notes-cap">Les 30 précisions les plus récentes.</p>` : ""}`
          : `<p class="notes-empty">Aucune précision pour l'instant. Ajoutez ce que vous voyez sur place.</p>`}
        ${state.compte && state.compte.premium && state.compte.pseudo ? `
          <label class="check comment-anonyme">
            <input id="comment-anonyme" type="checkbox" ${commentaireAnonyme() ? "checked" : ""}>
            <span>Commenter en anonyme</span>
          </label>` : ""}
        <form id="comment-form" class="composer" novalidate>
          <input id="detail-commentaire" class="field${state.commentError ? " is-invalid" : ""}" type="text" maxlength="200" enterkeyhint="send" placeholder="Ajouter une précision…" value="${esc(state.detailDraft)}" ${state.commentSending ? "disabled" : ""}>
          <button class="btn btn-primary btn-compact" type="submit" ${state.commentSending ? "disabled" : ""}>Envoyer</button>
        </form>
        ${state.commentError ? `<p class="field-error">${esc(state.commentError)}</p>` : ""}
      </section>
    </article>`;
}

function phrasesDuType() {
  return PHRASES[state.draft.type] || [];
}

function etapesSignalement() {
  const typeOk = Boolean(state.draft.type);
  const lieuOk = (state.draft.lieu || "").trim().length >= 2 && state.draft.latitude != null;
  const texteOk = (state.draft.commentaire || "").trim().length >= 8;
  const etapes = [
    { id: "type", label: "Type", fait: typeOk },
    { id: "lieu", label: "Lieu", fait: lieuOk },
  ];
  if (lieuOk) etapes.push({ id: "commentaire", label: "Commentaire", court: "Com", fait: texteOk });
  return etapes;
}

function consigneSignalement() {
  if (state.saving) return "Publication…";
  const erreurs = validate();
  if (erreurs.type) return "Choisissez ce que vous voyez";
  if (erreurs.lieu) {
    const { connus, ajouter } = propositionsLieu(state.draft.lieu);
    if (ajouter && !connus.length) return "Placez le nouveau quartier sur la carte";
    if ((state.draft.lieu || "").trim()) return "Choisissez un quartier, ou ajoutez-le";
    return "Indiquez le quartier";
  }
  if (erreurs.commentaire) return "Gardez le commentaire, ou écrivez le vôtre";
  if ((state.draft.lieu || "").trim() && !state.draft.lieuId) return "Ce quartier sera ajouté à la liste";
  return "Prêt";
}

function propositionsLieu(requete) {
  const texte = String(requete || "").trim();
  const q = fold(texte);
  if (!q) return { connus: [], ajouter: false };
  const connus = boot.lieux.filter((lieu) => fold(lieu.nom).includes(q)).slice(0, 6);
  const exact = boot.lieux.some((lieu) => fold(lieu.nom) === q);
  return { connus, ajouter: texte.length >= 2 && !exact && !texte.startsWith("Près de ") };
}

function htmlPropositions() {
  const { connus, ajouter } = propositionsLieu(state.draft.lieu || "");
  if (!state.lieuOuvert || (!connus.length && !ajouter)) return `<ul id="lieux-connus" class="lieu-propositions" hidden></ul>`;
  const items = connus.map((lieu) => (
    `<li><button type="button" class="lieu-hit${state.draft.lieuId === lieu.id ? " is-on" : ""}" data-action="lieu-rapide" data-lieu="${esc(lieu.id)}">${esc(lieu.nom)}</button></li>`
  )).join("");
  const ajout = ajouter
    ? `<li><button type="button" class="lieu-hit is-add" data-action="lieu-nouveau">Ajouter « ${esc((state.draft.lieu || "").trim())} »</button></li>`
    : "";
  return `<ul id="lieux-connus" class="lieu-propositions" role="listbox">${items}${ajout}</ul>`;
}

function peindreLieux() {
  const liste = document.getElementById("lieux-connus");
  if (!liste) return;
  const enveloppe = document.createElement("div");
  enveloppe.innerHTML = htmlPropositions();
  liste.replaceWith(enveloppe.firstElementChild);
}

function memoriserLieu(lieu) {
  if (!lieu || !lieu.id || !lieu.nom) return;
  const index = boot.lieux.findIndex((item) => item.id === lieu.id || fold(item.nom) === fold(lieu.nom));
  if (index === -1) boot.lieux.push(lieu);
  else boot.lieux[index] = { ...boot.lieux[index], ...lieu };
  boot.lieux.sort((a, b) => (fold(a.nom) < fold(b.nom) ? -1 : 1));
  syncNoms();
}

function htmlTypes() {
  const choisi = boot.types.find((type) => type.id === state.draft.type);
  if (choisi && !state.typesOuverts) {
    return `<button type="button" class="type-actuel" data-action="types" aria-expanded="false">${iconeType(choisi.id, false)}<span>${esc(choisi.label)}</span><span class="type-changer">Changer</span></button>`;
  }
  return `<div class="type-grid" role="group" aria-label="Type d'incident">
        ${boot.types.map((type) => {
          const pressed = state.draft.type === type.id;
          return `<button type="button" class="type-option" data-action="type" data-type="${type.id}" aria-pressed="${pressed ? "true" : "false"}">${iconeType(type.id, pressed)}<span>${esc(type.label)}</span></button>`;
        }).join("")}
      </div>`;
}

function renderCompose() {
  const text = state.draft.commentaire || "";
  const etapes = etapesSignalement();
  const courant = etapes.find((etape) => !etape.fait);
  const pret = !courant;
  const phrases = phrasesDuType();
  const lieuOk = (state.draft.lieu || "").trim().length >= 2 && state.draft.latitude != null;
  const place = state.draft.latitude != null
    ? `<button type="button" class="btn-text pick-link" data-action="pick">Déplacer le point</button>`
    : `<button type="button" class="btn btn-ghost btn-block pick-btn${(state.draft.lieu || "").trim() ? " is-needed" : ""}" data-action="pick">Placer sur la carte</button>`;
  const lieuBloc = state.draft.type ? `
      <label class="field-label" for="lieu-saisie">Quartier</label>
      <div class="lieu-cherche" id="lieu-cherche">
        <input id="lieu-saisie" class="field${state.errors.lieu ? " is-invalid" : ""}" maxlength="120" autocomplete="off" enterkeyhint="search" placeholder="Rechercher ou ajouter un quartier" value="${esc(state.draft.lieu)}" role="combobox" aria-autocomplete="list" aria-controls="lieux-connus" aria-expanded="${state.lieuOuvert ? "true" : "false"}">
        ${htmlPropositions()}
      </div>
      <p class="chosen${state.draft.latitude != null ? " is-set" : ""}"${lieuAide() ? "" : " hidden"}>${esc(lieuAide())}</p>
      ${state.errors.lieu ? `<p class="field-error" id="lieu-erreur">${esc(state.errors.lieu)}</p>` : ""}
      ${place}` : "";
  const commentaireBloc = lieuOk ? `
      <p class="field-label">Commentaire</p>
      <div class="phrase-row" role="group" aria-label="Commentaires rapides">
        ${phrases.map((phrase, index) => `<button type="button" class="phrase" data-action="phrase" data-index="${index}" aria-pressed="${text.trim() === phrase ? "true" : "false"}">${esc(phrase)}</button>`).join("")}
      </div>
      <label class="sr-only" for="commentaire">Modifier le commentaire</label>
      <textarea id="commentaire" class="field${state.errors.commentaire ? " is-invalid" : ""}" maxlength="280" rows="2" placeholder="Ou écrivez ce que vous voyez.">${esc(text)}</textarea>
      <div class="field-meta">
        <span>${state.errors.commentaire ? `<span class="field-error">${esc(state.errors.commentaire)}</span>` : "Pas de nom, pas de numéro."}</span>
        <span id="commentaire-count">${text.trim().length}/280</span>
      </div>` : "";
  return `
    <div class="compose-scroll">
    <div class="sheet-head">
      <div>
        <h1>Signaler</h1>
        <p>Un type, un lieu, un commentaire.</p>
      </div>
      <button type="button" class="btn btn-ghost btn-compact" data-action="back">Fermer</button>
    </div>
    <form id="compose-form" class="compose" novalidate>
      <ol class="compose-steps" aria-label="Étapes">
        ${etapes.map((etape) => {
          const classe = etape.fait ? "is-done" : courant && courant.id === etape.id ? "is-current" : "";
          const libelle = etape.court
            ? `<span class="step-long">${esc(etape.label)}</span><span class="step-short">${esc(etape.court)}</span>`
            : esc(etape.label);
          return `<li class="${classe}">${libelle}</li>`;
        }).join("")}
      </ol>
      ${htmlTypes()}
      ${state.errors.type ? `<p class="field-error">${esc(state.errors.type)}</p>` : ""}
      ${lieuBloc}
      ${commentaireBloc}
    </form>
    </div>
    <div class="compose-dock">
      <p id="compose-status" class="compose-status${pret ? " is-ready" : ""}">${esc(consigneSignalement())}</p>
      <button class="btn btn-primary btn-block" type="submit" form="compose-form" ${state.saving ? "disabled" : ""}>${state.saving ? "Publication…" : "Publier"}</button>
      <p class="compose-legal">Situation réelle seulement. <button type="button" class="btn-text" data-action="cgu">CGU</button> · <button type="button" class="btn-text" data-action="faq">FAQ</button></p>
    </div>`;
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

function typeSurveille(report) {
  const types = assurerReglages().types;
  if (!Array.isArray(types) || !types.length) return true;
  return types.includes(report.type);
}

function correspondVeille(report) {
  if (!typeSurveille(report)) return false;
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

function urlSignalement(report) {
  return `${location.origin}${location.pathname}#s-${report.id}`;
}

async function partagerSignalement(id) {
  const report = state.reports.find((item) => item.id === Number(id)) || selected();
  if (!report || Number(report.id) !== Number(id)) {
    toast("Ce signalement n'est plus là.");
    return;
  }
  const url = urlSignalement(report);
  const titre = `Wayizé — ${report.type_label}`;
  const texte = `${report.type_label} à ${report.lieu} : ${report.commentaire}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: titre, text: texte, url });
      return;
    }
  } catch (error) {
    if (error && error.name === "AbortError") return;
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(`${texte}\n${url}`);
      toast("Lien copié.");
      return;
    }
  } catch (error) {
    // On bascule sur le champ de secours.
  }
  window.prompt("Copiez le lien du signalement :", url);
}

function nettoyerCleVapid(brut) {
  let cle = String(brut || "").trim();
  if ((cle.startsWith("\"") && cle.endsWith("\"")) || (cle.startsWith("'") && cle.endsWith("'"))) {
    cle = cle.slice(1, -1).trim();
  }
  cle = cle.replace(/\s+/g, "");
  if (!cle || cle.includes("BEGIN") || cle.includes("-----")) return "";
  return cle;
}

function urlBase64VersUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const brut = atob(base64);
  const sortie = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i += 1) sortie[i] = brut.charCodeAt(i);
  return sortie;
}

function cleVapidVersApplicationServerKey(brut) {
  const cle = nettoyerCleVapid(brut);
  if (!cle) throw new Error("Clé VAPID absente ou illisible.");
  let bytes;
  try {
    bytes = urlBase64VersUint8Array(cle);
  } catch (error) {
    throw new Error("Clé VAPID illisible (base64).");
  }
  // Point P-256 non compressé : 0x04 + X(32) + Y(32).
  if (bytes.length !== 65) {
    throw new Error(`Clé VAPID incorrecte (${bytes.length} octets, 65 attendus).`);
  }
  if (bytes[0] !== 4) {
    throw new Error("Clé VAPID : format de point non compressé attendu.");
  }
  return bytes;
}

async function notifierOS(phrase, options) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const opts = options || {};
  const payload = {
    body: phrase,
    icon: "/static/trafic/icons/icon-192.png",
    badge: "/static/trafic/icons/favicon-32.png",
    tag: opts.tag || "wayize-alerte",
    renotify: true,
    data: { url: opts.url || "/" },
  };
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification("Wayizé", payload);
      return;
    }
  } catch (error) {
    // Retombe sur Notification directe.
  }
  try {
    new Notification("Wayizé", payload);
  } catch (error) {
    // Le navigateur refuse parfois hors geste utilisateur.
  }
}

async function lireVapidPublic() {
  let cle = nettoyerCleVapid(reglagesCarte().vapid_public || "");
  if (cle) {
    if (!boot.reglages || typeof boot.reglages !== "object") boot.reglages = {};
    boot.reglages.vapid_public = cle;
    return cle;
  }
  try {
    const data = await api("/api/notifications/etat/");
    if (data) {
      if (!boot.reglages || typeof boot.reglages !== "object") boot.reglages = {};
      boot.reglages.push = !!data.push;
      if (typeof data.abonnements === "number") boot.reglages.abonnements = data.abonnements;
      cle = nettoyerCleVapid(data.vapid_public || "");
      if (cle) {
        boot.reglages.vapid_public = cle;
        return cle;
      }
    }
  } catch (error) {
    // L'API peut être temporairement indisponible.
  }
  return "";
}

function pushDisponibleNavigateur() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  // iOS : Push seulement dans la PWA ajoutée à l'écran d'accueil (iOS 16.4+).
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent || "")
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios && !dejaInstallee()) return false;
  return true;
}

function payloadAbonnement(sub) {
  const json = sub && typeof sub.toJSON === "function" ? sub.toJSON() : null;
  const endpoint = (json && json.endpoint) || (sub && sub.endpoint) || "";
  const keys = (json && json.keys) || {};
  const p256dh = keys.p256dh || "";
  const auth = keys.auth || "";
  if (!endpoint || !p256dh || !auth) {
    throw new Error("Abonnement Push incomplet (endpoint ou clés manquants).");
  }
  return {
    endpoint: String(endpoint),
    keys: { p256dh: String(p256dh), auth: String(auth) },
  };
}

async function abonnerPush(options) {
  const silencieux = options && options.silencieux;
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return { ok: false, raison: "permission" };
  }
  if (!pushDisponibleNavigateur()) {
    if (!silencieux) {
      toast("Sur iPhone, ajoutez Wayizé à l'écran d'accueil, puis réessayez.");
    }
    return { ok: false, raison: "navigateur" };
  }
  // Préférer la clé déjà en mémoire (boot / etat) pour limiter les awaits avant subscribe.
  let cle = nettoyerCleVapid(reglagesCarte().vapid_public || "");
  if (!cle) cle = await lireVapidPublic();
  if (!cle) {
    if (!silencieux) {
      toast("Le serveur n'a pas encore les clés VAPID. Les alertes téléphone resteront inactives.");
    }
    return { ok: false, raison: "vapid" };
  }
  let applicationServerKey;
  try {
    applicationServerKey = cleVapidVersApplicationServerKey(cle);
  } catch (error) {
    if (!silencieux) toast(messageFrom(error, "Clé VAPID invalide sur le serveur."));
    return { ok: false, raison: "vapid" };
  }
  try {
    if ("serviceWorker" in navigator) {
      await navigator.serviceWorker.register("/sw.js");
    }
    const reg = await navigator.serviceWorker.ready;
    if (!reg.pushManager) {
      throw new Error("PushManager indisponible sur ce navigateur.");
    }
    let sub = await reg.pushManager.getSubscription();
    let cleConnue = "";
    try { cleConnue = nettoyerCleVapid(localStorage.getItem("wayize.vapid.public") || ""); } catch (error) { cleConnue = ""; }
    if (sub && cleConnue && cleConnue !== cle) {
      try { await sub.unsubscribe(); } catch (error) { /* ignore */ }
      sub = null;
    }
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      } catch (error) {
        const detail = (error && (error.message || error.name)) || "refus du navigateur";
        throw new Error(`Inscription Push refusée : ${detail}`);
      }
    }
    const corps = payloadAbonnement(sub);
    let enregistre;
    try {
      enregistre = await api("/api/notifications/abonnement/", {
        method: "POST",
        body: JSON.stringify(corps),
      });
    } catch (error) {
      try { await sub.unsubscribe(); } catch (ignore) { /* ignore */ }
      throw error;
    }
    try { localStorage.setItem("wayize.vapid.public", cle); } catch (error) { /* ignore */ }
    memoriserPushActif(true);
    if (enregistre && typeof enregistre.abonnements === "number") {
      if (!boot.reglages || typeof boot.reglages !== "object") boot.reglages = {};
      boot.reglages.push = true;
      boot.reglages.vapid_public = cle;
      boot.reglages.abonnements = enregistre.abonnements;
    }
    return { ok: true, abonnements: enregistre && enregistre.abonnements };
  } catch (error) {
    memoriserPushActif(false);
    if (!silencieux) {
      toast(messageFrom(error, "L'abonnement aux notifications a échoué."));
    }
    return { ok: false, raison: "erreur", error };
  }
}

async function desabonnerPush(options) {
  const silencieux = options && options.silencieux;
  let endpoint = "";
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        endpoint = (sub.toJSON() && sub.toJSON().endpoint) || sub.endpoint || "";
        await sub.unsubscribe();
      }
    }
  } catch (error) {
    // On coupe côté serveur même si le navigateur refuse unsubscribe.
  }
  try {
    const corps = { actif: false };
    if (endpoint) corps.endpoint = endpoint;
    const data = await api("/api/notifications/abonnement/", {
      method: "POST",
      body: JSON.stringify(corps),
    });
    if (data && typeof data.abonnements === "number") {
      if (!boot.reglages || typeof boot.reglages !== "object") boot.reglages = {};
      boot.reglages.abonnements = data.abonnements;
    }
  } catch (error) {
    if (!silencieux) {
      toast(messageFrom(error, "La coupure des notifications a échoué."));
    }
    memoriserPushActif(false);
    return { ok: false, raison: "erreur" };
  }
  memoriserPushActif(false);
  if (!silencieux) toast("Alertes téléphone coupées.");
  return { ok: true };
}

async function demanderNotifications(options) {
  const silencieux = options && options.silencieux;
  if (!("Notification" in window)) {
    if (!silencieux) toast("Ce navigateur ne propose pas les notifications.");
    return "unsupported";
  }
  if (Notification.permission === "granted") {
    const abo = await abonnerPush({ silencieux });
    if (!silencieux && abo.ok) toast("Alertes sur la route activées.");
    return "granted";
  }
  if (Notification.permission === "denied") {
    if (!silencieux) toast("Les notifications sont bloquées dans le navigateur.");
    memoriserPushActif(false);
    return "denied";
  }
  const resultat = await Notification.requestPermission();
  if (resultat === "granted") {
    const abo = await abonnerPush({ silencieux });
    // abonnerPush a déjà toasté l'erreur détaillée si besoin.
    if (!silencieux && abo.ok) toast("Alertes sur la route activées.");
    if (!abo.ok) memoriserPushActif(false);
  } else {
    memoriserPushActif(false);
    if (!silencieux) toast("Notifications refusées.");
  }
  return resultat;
}

function etatNotifications() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function alerter(phrase, options) {
  const reglages = assurerReglages();
  if (!dansLesHeures()) return;
  state.veille = phrase;
  peindreVeille();
  if (reglages.visuel !== false) {
    toast(phrase);
    notifierOS(phrase, options);
  }
  if (reglages.son) bip();
}

function peindreVeille() {
  const el = document.getElementById("veille");
  if (!el) return;
  if (!state.veille) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  el.innerHTML = `<p>${esc(state.veille)}</p><button type="button" id="veille-fermer">Fermer</button>`;
  const fermer = document.getElementById("veille-fermer");
  if (fermer) fermer.addEventListener("click", () => {
    state.veille = "";
    peindreVeille();
  });
}

function syncTrajet() {
  if (!trajetLayer) return;
  trajetLayer.clearLayers();
  if (!state.trajet || !state.compte || !state.compte.premium) return;
  const depart = lieuParId(state.trajet.depart);
  const arrivee = lieuParId(state.trajet.arrivee);
  if (!depart || !arrivee) return;
  const trace = [[depart.latitude, depart.longitude], [arrivee.latitude, arrivee.longitude]];
  const sombre = document.body.classList.contains("is-routes");
  L.polyline(trace, { color: sombre ? "#171717" : "#ffffff", weight: 7, opacity: 0.9 }).addTo(trajetLayer);
  L.polyline(trace, { color: sombre ? "#ffffff" : "#171717", weight: 2, opacity: 0.95, dashArray: "10 8" }).addTo(trajetLayer);
}

function champLieu(nomChamp, choisi, label) {
  const lieu = choisi ? lieuParId(choisi) : null;
  return `
    <div class="pick champ">
      <span>${esc(label)}</span>
      <input class="field pick-input" type="text" autocomplete="off" placeholder="Rechercher un quartier" aria-label="${esc(label)}" value="${lieu ? esc(lieu.nom) : ""}">
      <input type="hidden" name="${esc(nomChamp)}" value="${esc(choisi || "")}">
      <ul class="lieu-propositions pick-resultats" hidden></ul>
    </div>`;
}

function peindrePick(input) {
  const pick = input.closest(".pick");
  if (!pick) return;
  const liste = pick.querySelector(".pick-resultats");
  const hidden = pick.querySelector('input[type="hidden"]');
  document.querySelectorAll(".pick-resultats").forEach((autre) => {
    if (autre !== liste) {
      autre.hidden = true;
    }
  });
  const q = fold(input.value.trim());
  const exact = q ? boot.lieux.find((lieu) => fold(lieu.nom) === q) : null;
  hidden.value = exact ? exact.id : "";
  if (q.length < 1) {
    liste.hidden = true;
    liste.innerHTML = "";
    return;
  }
  const hits = boot.lieux.filter((lieu) => fold(lieu.nom).includes(q)).slice(0, 8);
  liste.hidden = false;
  liste.innerHTML = hits.length
    ? hits.map((lieu) => `<li><button type="button" class="lieu-hit" data-action="choisir-lieu" data-id="${esc(lieu.id)}" data-nom="${esc(lieu.nom)}">${esc(lieu.nom)}</button></li>`).join("")
    : `<li class="lieu-vide">Aucun quartier sous ce nom.</li>`;
}

function choisirLieuPick(el) {
  const pick = el.closest(".pick");
  if (!pick) return;
  const input = pick.querySelector(".pick-input");
  const hidden = pick.querySelector('input[type="hidden"]');
  input.value = el.dataset.nom || "";
  hidden.value = el.dataset.id || "";
  const liste = pick.querySelector(".pick-resultats");
  liste.hidden = true;
  liste.innerHTML = "";
}

function incidentsCouloir(departId, arriveeId) {
  const depart = lieuParId(departId);
  const arrivee = lieuParId(arriveeId);
  if (!depart || !arrivee) return [];
  return state.reports.filter((report) => (
    encoreValide(report)
    && report.latitude != null
    && distanceSegmentKm(report.latitude, report.longitude, depart, arrivee) <= 1.5
  ));
}

function decrireSuivi() {
  const liste = listeActive();
  if (state.trajet) {
    const domicile = state.compte && state.compte.domicile_id;
    const travail = state.compte && state.compte.travail_id;
    const maison = domicile && travail && state.trajet.depart === domicile && state.trajet.arrivee === travail;
    return {
      kicker: maison ? "Trajet habituel" : "Trajet en cours",
      titre: `${nomLieu(state.trajet.depart)} → ${nomLieu(state.trajet.arrivee)}`,
      detail: "La carte est limitée à ce chemin.",
    };
  }
  if (liste) {
    const n = (liste.lieux || []).length;
    return {
      kicker: "Liste en cours",
      titre: liste.nom,
      detail: n ? `${n} quartier${n > 1 ? "s" : ""} sur la carte.` : "Ajoutez un quartier pour filtrer la carte.",
    };
  }
  if (state.place) {
    return {
      kicker: "Lieu affiché",
      titre: state.place.nom,
      detail: "La liste ne montre que ce lieu.",
    };
  }
  return null;
}

function bandeauSuivi(suivi) {
  if (!suivi) return "";
  return `
    <div class="en-cours is-on suivi-bandeau">
      <div>
        <span>${esc(suivi.kicker)}</span>
        <strong>${esc(suivi.titre)}</strong>
      </div>
      <button type="button" data-action="clear-place">Toute la ville</button>
    </div>`;
}

function carteEnCours() {
  const suivi = decrireSuivi();
  if (!suivi) {
    return `
      <section class="en-cours">
        <div>
          <span>En cours</span>
          <strong>Toute la ville</strong>
          <em>Aucun trajet ni liste. La carte montre Libreville.</em>
        </div>
      </section>`;
  }
  return `
    <section class="en-cours is-on">
      <div>
        <span>${esc(suivi.kicker)}</span>
        <strong>${esc(suivi.titre)}</strong>
        <em>${esc(suivi.detail || "")}</em>
      </div>
      <button type="button" data-action="clear-place">Arrêter</button>
    </section>`;
}

function interrupteur(nom, on, label, hint) {
  return `
    <label class="switch">
      <span class="switch-copy"><strong>${esc(label)}</strong>${hint ? `<small>${esc(hint)}</small>` : ""}</span>
      <input type="checkbox" data-reglage="${esc(nom)}" ${on ? "checked" : ""}>
      <span class="switch-ui" aria-hidden="true"></span>
    </label>`;
}

function resumeTypes() {
  const choisis = assurerReglages().types;
  if (!Array.isArray(choisis) || !choisis.length) return "Tous les types.";
  return FILTERS.filter((chip) => chip.id !== "tous" && choisis.includes(chip.id)).map((chip) => chip.label).join(" · ");
}

function briefingHtml() {
  const domicile = state.compte.domicile_id || "";
  const travail = state.compte.travail_id || "";
  const distincts = domicile && travail && domicile !== travail;
  const incidents = distincts ? incidentsCouloir(domicile, travail) : [];
  const lignes = incidents.slice(0, 3).map((report) => (
    `<button type="button" class="briefing-hit" data-action="open" data-id="${report.id}"><strong>${esc(report.lieu)}</strong><span>${esc(report.type_label)} · ${esc(report.relatif)}</span></button>`
  )).join("");
  let resume = "Choisissez le domicile et le travail, puis suivez le trajet.";
  if (domicile && travail && domicile === travail) resume = "Choisissez deux lieux différents.";
  else if (distincts && incidents.length) resume = `${incidents.length} incident${incidents.length > 1 ? "s" : ""} sur ce chemin.`;
  else if (distincts) resume = "Rien sur ce chemin pour l'instant.";
  return `
    <form id="domicile-form" class="trajet-simple">
      ${champLieu("domicile", domicile, "Domicile")}
      ${champLieu("travail", travail, "Travail")}
      <button class="btn btn-primary btn-block" type="button" data-action="suivre-domicile">Suivre ce trajet</button>
    </form>
    <p class="briefing-compte">${esc(resume)}</p>
    ${lignes ? `<div class="briefing-list">${lignes}</div>` : ""}`;
}

function trajetAutreHtml() {
  const domicile = state.compte.domicile_id || "";
  const travail = state.compte.travail_id || "";
  const autreActif = !!(state.trajet && !(domicile && travail && state.trajet.depart === domicile && state.trajet.arrivee === travail));
  const ouvert = state.autreTrajet || autreActif;
  const depart = autreActif ? state.trajet.depart : "";
  const arrivee = autreActif ? state.trajet.arrivee : "";
  return `
    <button type="button" class="btn-text suite-lien" data-action="autre-trajet">${ouvert ? "Masquer l’autre trajet" : "Suivre un autre trajet"}</button>
    ${ouvert ? `
      <form id="trajet-form" class="trajet-simple">
        ${champLieu("depart", depart, "Départ")}
        ${champLieu("arrivee", arrivee, "Arrivée")}
        <button class="btn btn-primary btn-block" type="submit">${autreActif ? "Mettre à jour" : "Suivre cet autre trajet"}</button>
      </form>` : ""}`;
}

function typesVeilleHtml() {
  const choisis = assurerReglages().types;
  const tous = !Array.isArray(choisis) || !choisis.length;
  return FILTERS.filter((chip) => chip.id !== "tous").map((chip) => {
    const on = tous || choisis.includes(chip.id);
    return chipHtml(chip, `data-action="type-veille" data-type="${chip.id}" aria-pressed="${on ? "true" : "false"}"`);
  }).join("");
}

function silenceLibelle() {
  const jusqua = assurerReglages().silenceJusqua;
  if (jusqua && Date.now() < jusqua) {
    const heure = new Date(jusqua).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return `Silence jusqu’à ${heure}`;
  }
  return "Silence pendant 2 heures";
}

function enteteCompte(titre, sousTitre) {
  return `
    <div class="sheet-head">
      <div><h1>${titre}</h1><p>${sousTitre}</p></div>
      <button type="button" class="btn btn-ghost btn-compact" data-action="back">Fermer</button>
    </div>`;
}

function lienCourriel() {
  if (!state.compteLien) return "";
  const libelle = state.compteMode === "nouveau" ? "Choisir un mot de passe" : "Ouvrir le lien reçu";
  return `
    <a class="btn btn-primary btn-block" href="${esc(state.compteLien)}">${libelle}</a>
    <p class="muted auth-note">Le lien est affiché ici le temps que l'envoi d'emails soit branché sur ce serveur.</p>`;
}

function renderCompteInvite() {
  const mode = state.compteMode;
  const invitePush = invitePushHtml();
  if (mode === "attente") {
    return `
      ${enteteCompte("Compte", "Confirmez votre adresse.")}
      <form id="compte-form" class="auth" novalidate>
        <p>${esc(state.compteMessage || "Un message part vers votre adresse. Ouvrez-le pour activer le compte.")}</p>
        ${lienCourriel()}
        <button class="btn btn-ghost btn-block" type="submit" ${state.compteEnCours ? "disabled" : ""}>Renvoyer le message</button>
        <button type="button" class="btn-text auth-lien" data-action="auth-mode" data-mode="connexion">Retour à la connexion</button>
        ${state.compteErreur ? `<p class="field-error">${esc(state.compteErreur)}</p>` : ""}
      </form>
      ${carteInfos()}`;
  }
  if (mode === "oubli") {
    return `
      ${enteteCompte("Compte", "Recevoir un lien pour choisir un nouveau mot de passe.")}
      <form id="compte-form" class="auth" novalidate>
        <label class="auth-field" for="compte-email"><span>Email</span></label>
        <input id="compte-email" class="field" type="email" autocomplete="username" inputmode="email" required value="${esc(state.compteEmail)}" placeholder="vous@email.com">
        ${state.compteErreur ? `<p class="field-error">${esc(state.compteErreur)}</p>` : ""}
        <button class="btn btn-primary btn-block" type="submit" ${state.compteEnCours ? "disabled" : ""}>${state.compteEnCours ? "Un instant…" : "Envoyer le lien"}</button>
        ${lienCourriel()}
        <button type="button" class="btn-text auth-lien" data-action="auth-mode" data-mode="connexion">Retour à la connexion</button>
      </form>
      ${carteInfos()}`;
  }
  if (mode === "nouveau") {
    return `
      ${enteteCompte("Compte", "Choisissez un nouveau mot de passe.")}
      <form id="compte-form" class="auth" novalidate>
        <label class="auth-field" for="compte-mot"><span>Nouveau mot de passe</span></label>
        ${champMot(`autocomplete="new-password" minlength="8" required placeholder="8 caractères minimum"`)}
        ${state.compteErreur ? `<p class="field-error">${esc(state.compteErreur)}</p>` : ""}
        <button class="btn btn-primary btn-block" type="submit" ${state.compteEnCours ? "disabled" : ""}>${state.compteEnCours ? "Un instant…" : "Enregistrer"}</button>
      </form>
      ${carteInfos()}`;
  }
  const inscription = mode === "inscription";
  return `
    ${enteteCompte("Compte", "La carte reste ouverte sans compte.")}
    ${invitePush}
    <form id="compte-form" class="auth" novalidate>
      <div class="auth-switch" role="tablist" aria-label="Connexion ou inscription">
        <button type="button" role="tab" data-action="auth-mode" data-mode="connexion" aria-selected="${inscription ? "false" : "true"}">Connexion</button>
        <button type="button" role="tab" data-action="auth-mode" data-mode="inscription" aria-selected="${inscription ? "true" : "false"}">Inscription</button>
      </div>
      <label class="auth-field" for="compte-email"><span>Email</span></label>
      <input id="compte-email" class="field" type="email" autocomplete="username" inputmode="email" required value="${esc(state.compteEmail)}" placeholder="vous@email.com">
      ${inscription ? `
        <label class="auth-field" for="compte-pseudo"><span>Pseudo</span></label>
        <input id="compte-pseudo" class="field" type="text" maxlength="20" autocomplete="nickname" required value="${esc(state.comptePseudo || "")}" placeholder="Visible avec Premium">` : ""}
      <label class="auth-field" for="compte-mot"><span>Mot de passe</span></label>
      ${champMot(`autocomplete="${inscription ? "new-password" : "current-password"}" minlength="8" required placeholder="8 caractères minimum"`)}
      ${inscription ? `
        <label class="auth-cgu">
          <input id="compte-cgu" type="checkbox" ${state.compteCgu ? "checked" : ""}>
          <span>J’accepte les conditions d’utilisation.</span>
        </label>` : `<button type="button" class="btn-text auth-lien" data-action="auth-mode" data-mode="oubli">Mot de passe oublié</button>`}
      <button type="button" class="btn-text auth-lien" data-action="cgu">Lire les CGU</button>
      ${state.compteErreur ? `<p class="field-error">${esc(state.compteErreur)}</p>` : ""}
      <button class="btn btn-primary btn-block" type="submit" ${state.compteEnCours ? "disabled" : ""}>${state.compteEnCours ? "Un instant…" : inscription ? "Créer le compte" : "Se connecter"}</button>
    </form>
    ${carteInfos()}`;
}

function panneauVeille(listesHtml) {
  return `
    <section class="bloc">
      <h2 class="bloc-titre">Trajet habituel</h2>
      ${briefingHtml()}
      ${trajetAutreHtml()}
    </section>
    <section class="bloc">
      <h2 class="bloc-titre">Listes</h2>
      <form id="nouvelle-liste" class="champ-ligne">
        <input class="field" name="nom" maxlength="40" placeholder="Nouvelle liste, ex. Matin" aria-label="Nom de la liste">
        <button class="btn btn-primary btn-compact" type="submit">Créer</button>
      </form>
      ${listesHtml}
    </section>`;
}

function panneauAlertes(reglages) {
  const silence = reglages.silenceJusqua && Date.now() < reglages.silenceJusqua;
  return `
    <section class="bloc">
      <h2 class="bloc-titre">Sur la route</h2>
      <div class="reglages-carte">
        ${interrupteur("visuel", reglages.visuel, "Sur l’écran")}
        ${interrupteur("son", reglages.son, "Son")}
        ${invitePushHtml({ reglages: true })}
        ${interrupteur("gps", reglages.gps, "Position GPS", "Point sur la carte, alerte à l’approche")}
        ${reglages.gps ? `<p class="gps-etat" id="gps-etat">${esc(state.gpsEtat || "Position en attente.")}</p>` : ""}
        ${interrupteur("conduite", reglages.conduite, "Mode conduite", "Texte plus grand")}
      </div>
    </section>
    <section class="bloc">
      <h2 class="bloc-titre">Types d’alerte</h2>
      <p class="bloc-note">${esc(resumeTypes())}</p>
      <div class="chips" aria-label="Types qui déclenchent une alerte">${typesVeilleHtml()}</div>
    </section>
    <section class="bloc">
      <h2 class="bloc-titre">Quand</h2>
      <div class="reglages-carte">
        ${interrupteur("heures", reglages.heures, "Heures de vigilance", "Matin et soir seulement")}
        ${reglages.heures ? `
          <div class="heures-bloc">
            <label class="champ"><span>Matin</span><span class="heures-ligne"><input class="field" type="time" data-heure="debut" aria-label="Début du matin" value="${esc(reglages.debut)}"><input class="field" type="time" data-heure="fin" aria-label="Fin du matin" value="${esc(reglages.fin)}"></span></label>
            <label class="champ"><span>Soir</span><span class="heures-ligne"><input class="field" type="time" data-heure="debut2" aria-label="Début du soir" value="${esc(reglages.debut2)}"><input class="field" type="time" data-heure="fin2" aria-label="Fin du soir" value="${esc(reglages.fin2)}"></span></label>
          </div>` : ""}
        <button type="button" class="silence-row" data-action="silence">
          <span><strong>${silence ? esc(silenceLibelle()) : "Silence"}</strong><small>${silence ? "Les alertes sont coupées." : "Deux heures sans alerte."}</small></span>
          <em>${silence ? "Reprendre" : "2 h"}</em>
        </button>
      </div>
    </section>`;
}

function panneauProfil() {
  const pseudo = state.compte.pseudo || "";
  return `
    <section class="bloc">
      <h2 class="bloc-titre">Signature</h2>
      <form id="pseudo-form" class="champ-ligne">
        <label class="champ">
          <span>Pseudo</span>
          <input class="field" name="pseudo" maxlength="20" placeholder="Votre pseudo" aria-label="Pseudo" value="${esc(pseudo)}">
        </label>
        <button class="btn btn-primary btn-compact" type="submit">OK</button>
      </form>
      <div class="reglages-carte">
        <label class="switch">
          <span class="switch-copy"><strong>Anonyme</strong><small>${pseudo ? `Sinon, les précisions portent ${esc(pseudo)}.` : "Les précisions restent signées « Un usager »."}</small></span>
          <input type="checkbox" id="anonyme-defaut" ${state.compte.anonyme ? "checked" : ""}>
          <span class="switch-ui" aria-hidden="true"></span>
        </label>
      </div>
    </section>
    <p class="liens-calmes">
      <button type="button" class="btn-text" data-action="cgu">CGU</button>
      <button type="button" class="btn-text" data-action="faq">FAQ</button>
    </p>
    <button type="button" class="btn btn-ghost btn-block" data-action="sortie">${uiIcon("logout")} Se déconnecter</button>`;
}

function renderCompte() {
  if (!state.compte) return renderCompteInvite();
  const premium = state.compte.premium;
  const listes = state.compte.listes || [];
  const reglages = assurerReglages();
  const panneau = state.comptePanneau || "veille";
  const listesHtml = listes.map((liste) => {
    const on = state.listeId === liste.id;
    const lieux = liste.lieux || [];
    return `
    <article class="liste${on ? " is-on" : ""}">
      <header>
        <div>
          <h3>${esc(liste.nom)}</h3>
          ${on ? `<span class="pill-cours">En cours</span>` : `<p>${lieux.length ? `${lieux.length} quartier${lieux.length > 1 ? "s" : ""}` : "Liste vide"}</p>`}
        </div>
        <button type="button" class="btn ${on ? "btn-ghost" : "btn-primary"} btn-compact" data-action="suivre-liste" data-id="${liste.id}">${on ? "Arrêter" : "Suivre"}</button>
      </header>
      ${lieux.length ? `<div class="liste-lieux">${lieux.map((id) => `<button type="button" class="chip" data-action="retirer-lieu" data-liste="${liste.id}" data-lieu="${esc(id)}">${esc(nomLieu(id))} ×</button>`).join("")}</div>` : ""}
      <form class="liste-ajout" data-liste="${liste.id}">
        <div class="pick">
          <input class="field pick-input" type="text" autocomplete="off" placeholder="Ajouter un quartier" aria-label="Ajouter un quartier à ${esc(liste.nom)}">
          <input type="hidden" name="lieu_id" value="">
          <ul class="lieu-propositions pick-resultats" hidden></ul>
        </div>
        <button class="btn btn-ghost btn-compact" type="submit">Ajouter</button>
      </form>
      <button type="button" class="btn-text danger-lien" data-action="supprimer-liste" data-id="${liste.id}">Supprimer</button>
    </article>`;
  }).join("");
  const onglet = (id, label) => `<button type="button" role="tab" data-action="compte-panneau" data-panneau="${id}" aria-selected="${panneau === id ? "true" : "false"}">${label}</button>`;
  return `
    <div class="sheet-head">
      <div>
        <h1>${premium ? "Premium" : "Compte"}</h1>
        <p>${esc(state.compte.email)}</p>
      </div>
      <button type="button" class="btn btn-ghost btn-compact" data-action="back">Fermer</button>
    </div>
    ${premium ? carteEnCours() : ""}
    ${premium ? `<div class="segments" role="tablist" aria-label="Réglages Premium">${onglet("veille", "Veille")}${onglet("alertes", "Alertes")}${onglet("profil", "Profil")}</div>` : ""}
    <div class="compose">
      ${premium ? "" : `
        ${invitePushHtml()}
        <section class="offre">
          <h2>Personnaliser, ${esc(libellePrix())}</h2>
          <ul>
            <li>Briefing du trajet domicile–travail, incidents sur le chemin</li>
            <li>Listes de quartiers à suivre</li>
            <li>Alertes visuelles et sonores à l’approche, filtrées par type</li>
            <li>GPS : position sur la carte et alerte à l’approche</li>
            <li>Heures de vigilance, le matin et le soir</li>
            <li>Mode conduite, texte plus grand</li>
            <li>Silence de deux heures</li>
            <li>Pseudo signé sur les précisions, ou commentaire anonyme</li>
          </ul>
          <p class="muted">Les notifications téléphone sur nouveau signalement restent gratuites sans Premium. Le paiement mobile money n’est pas branché. Activer Premium ici enregistre le droit sur ce serveur, sans débit.</p>
          ${state.compteErreur ? `<p class="field-error">${esc(state.compteErreur)}</p>` : ""}
          <button type="button" class="btn btn-primary btn-block offre-activer" data-action="premium" ${state.compteEnCours ? "disabled" : ""}>${uiIcon("star")} Activer Premium</button>
        </section>
        ${carteInfos()}
        <button type="button" class="btn btn-ghost btn-block" data-action="sortie">${uiIcon("logout")} Se déconnecter</button>`}
      ${premium && panneau === "veille" ? panneauVeille(listesHtml) : ""}
      ${premium && panneau === "alertes" ? panneauAlertes(reglages) : ""}
      ${premium && panneau === "profil" ? panneauProfil() : ""}
      ${state.compte.est_admin ? `<a class="btn btn-ghost btn-block" href="/admin/">${uiIcon("layers")} Administration</a>` : ""}
    </div>`;
}

function carteInfos() {
  return `
    <section class="info-card">
      <h2>Informations</h2>
      <p class="muted">Conditions d’utilisation et questions fréquentes.</p>
      <button type="button" class="btn btn-ghost btn-block" data-action="cgu">Lire les CGU</button>
      <button type="button" class="btn btn-ghost btn-block" data-action="faq">Questions fréquentes</button>
    </section>`;
}

function htmlCgu() {
  return `
    <div class="legal-head">
      <div>
        <h2 id="legal-title">Conditions générales d’utilisation</h2>
        <p class="cgu-meta">Dernière mise à jour : 31 octobre 2026</p>
      </div>
      <button type="button" class="btn btn-ghost btn-compact" id="legal-close" data-legal="fermer">${uiIcon("close")} Fermer</button>
    </div>
    <div class="cgu-doc">
      ${CGU.map((section) => `
        <section>
          <h3>${esc(section.titre)}</h3>
          ${section.paragraphes.map((p) => `<p>${esc(p)}</p>`).join("")}
          ${section.liste ? `<ul>${section.liste.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}
        </section>`).join("")}
    </div>`;
}

function htmlFaq() {
  return `
    <div class="legal-head">
      <div>
        <h2 id="legal-title">Questions fréquentes</h2>
        <p class="cgu-meta">Wayizé · Libreville</p>
      </div>
      <button type="button" class="btn btn-ghost btn-compact" id="legal-close" data-legal="fermer">${uiIcon("close")} Fermer</button>
    </div>
    <div class="faq-list">
      ${FAQ.map((item) => {
        const ouvert = state.faqOuverte === item.id;
        return `
          <article class="faq-item">
            <button type="button" data-faq="${esc(item.id)}" aria-expanded="${ouvert ? "true" : "false"}">
              <span>${esc(item.q)}</span>
              <span aria-hidden="true">${ouvert ? "–" : "+"}</span>
            </button>
            ${ouvert ? `<p>${esc(item.a)}</p>` : ""}
          </article>`;
      }).join("")}
    </div>`;
}

function peindreLegal(focusSelector) {
  const root = document.getElementById("legal");
  const box = document.getElementById("legal-content");
  if (!root || !box) return;
  const ouvert = Boolean(state.legal);
  document.body.classList.toggle("is-legal", ouvert);
  const sheet = document.getElementById("sheet");
  const barre = document.querySelector(".topbar");
  if (sheet) sheet.inert = ouvert;
  if (barre) barre.inert = ouvert;
  if (!ouvert) {
    root.hidden = true;
    box.innerHTML = "";
    return;
  }
  root.hidden = false;
  box.innerHTML = state.legal === "faq" ? htmlFaq() : htmlCgu();
  const cible = focusSelector ? box.querySelector(focusSelector) : null;
  if (cible) cible.focus();
}

function ouvrirLegal(kind) {
  state.legal = kind;
  state.faqOuverte = kind === "faq" ? FAQ[0].id : "";
  peindreLegal("#legal-close");
}

function fermerLegal() {
  state.legal = null;
  peindreLegal();
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
  syncTrajet();
  syncPick();
  peindreVeille();
  setTitle();
  document.body.classList.toggle("is-picking", state.picking);
  document.body.classList.toggle("is-compose", state.mode === "compose");
  document.body.classList.toggle("is-detail", state.mode === "detail");
  document.body.classList.toggle("is-account", state.mode === "compte");
  document.body.classList.toggle("is-driving", !!(state.compte && state.compte.premium && assurerReglages().conduite));
  const banner = document.getElementById("pick-banner");
  if (banner) {
    banner.hidden = !state.picking;
    const texte = banner.querySelector("p");
    if (texte) {
      texte.textContent = state.deplacerId
        ? "Touchez la carte pour déplacer votre point"
        : "Touchez la carte pour placer le quartier";
    }
  }
  if (state.searchOpen) renderSearchResults();
}

function showCompose() {
  revelerFeuille();
  state.returnMode = state.mode === "detail" ? "detail" : "feed";
  state.mode = "compose";
  state.picking = false;
  state.errors = {};
  if (!(state.draft.lieu || "").trim() && state.place) appliquerLieuSaisi(state.place.nom);
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
  revelerFeuille();
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
  const connues = new Set(Object.values(PHRASES).flat());
  const actuel = (state.draft.commentaire || "").trim();
  state.draft.type = type;
  if (!actuel || connues.has(actuel)) {
    const phrases = PHRASES[type] || [];
    state.draft.commentaire = phrases[0] || "";
  }
  delete state.errors.type;
  delete state.errors.commentaire;
  state.typesOuverts = false;
  state.lieuOuvert = false;
  render();
  const champ = document.getElementById("lieu-cherche");
  if (champ) champ.scrollIntoView({ block: "nearest", behavior: prefersReduced() ? "auto" : "smooth" });
}

function choisirPhrase(index) {
  const phrases = phrasesDuType();
  const phrase = phrases[Number(index)];
  if (!phrase) return;
  state.draft.commentaire = phrase;
  delete state.errors.commentaire;
  render();
}

function choisirLieu(id) {
  const lieu = lieuParId(id);
  if (!lieu) return;
  appliquerLieuSaisi(lieu.nom);
  delete state.errors.lieu;
  state.lieuOuvert = false;
  render();
  if (map) map.flyTo([lieu.latitude, lieu.longitude], Math.max(map.getZoom(), 15), { duration: motion() });
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
  if (!nom) return "La liste s'affine pendant que vous écrivez.";
  if (lieuConnu(nom) && state.draft.latitude != null) return "";
  if (state.draft.latitude != null) return `« ${nom} » sera ajouté à la liste.`;
  return `« ${nom} » est nouveau. Placez-le sur la carte : il sera enregistré.`;
}

function preparerNouveauLieu() {
  const nom = (state.draft.lieu || "").replace(/\s+/g, " ").trim();
  if (nom.length < 2) return;
  state.draft.lieu = nom;
  state.draft.lieuId = "";
  state.lieuOuvert = false;
  delete state.errors.lieu;
  if (state.draft.latitude == null) startPick();
  else render();
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
  aide.hidden = !aide.textContent;
  aide.classList.toggle("is-set", state.draft.latitude != null);
  if (state.draft.latitude != null) {
    const erreur = document.getElementById("lieu-erreur");
    if (erreur) erreur.remove();
    const champ = document.getElementById("lieu-saisie");
    if (champ) champ.classList.remove("is-invalid");
  }
}

function startPick() {
  state.deplacerId = null;
  state.picking = true;
  if (!isDesktop()) setVisible(snapPoints()[0]);
  render();
}

function commencerDeplacement(id) {
  const report = state.reports.find((item) => item.id === id && item.mien);
  if (!report) return;
  state.deplacerId = id;
  state.picking = true;
  if (!isDesktop()) setVisible(snapPoints()[0]);
  render();
  if (map) map.flyTo([report.latitude, report.longitude], Math.max(map.getZoom(), 16), { duration: motion() });
}

async function envoyerDeplacement(latlng) {
  if (state.deplacementEnCours || !state.deplacerId) return;
  if (!inside(latlng.lat, latlng.lng)) {
    toast("Ce point est en dehors du Grand Libreville.");
    return;
  }
  const id = state.deplacerId;
  state.deplacementEnCours = true;
  try {
    const data = await api(`/api/signalements/${id}/position/`, {
      method: "POST",
      body: JSON.stringify({ latitude: latlng.lat, longitude: latlng.lng }),
    });
    upsert(data.signalement);
    state.picking = false;
    state.deplacerId = null;
    revelerFeuille();
    if (!isDesktop()) setVisible(snapPoints()[1]);
    toast("Point déplacé.");
    render();
    if (map) map.flyTo([latlng.lat, latlng.lng], Math.max(map.getZoom(), 16), { duration: motion() });
  } catch (error) {
    toast(messageFrom(error, "Le point n'a pas pu être déplacé."));
  } finally {
    state.deplacementEnCours = false;
  }
}

function annulerPick() {
  state.picking = false;
  state.deplacerId = null;
  if (!isDesktop()) setVisible(snapPoints()[state.mode === "detail" ? 1 : 2]);
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
  else if (state.draft.latitude == null) errors.lieu = "Placez ce quartier sur la carte. Il sera ajouté à la liste.";
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
    const nouveauLieu = Boolean(data.lieu) && !lieuConnu(data.lieu.nom);
    if (data.lieu) memoriserLieu(data.lieu);
    upsert(data.signalement);
    history.replaceState(null, "", `#s-${data.signalement.id}`);
    toast(nouveauLieu ? "Signalement publié. Le quartier rejoint la liste." : "Signalement publié.");
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
    const anonyme = commentaireAnonyme();
    const data = await api(`/api/signalements/${state.selectedId}/commentaires/`, {
      method: "POST",
      body: JSON.stringify({ texte, anonyme }),
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
  const connus = new Set(precedents.map((report) => report.id));
  const frais = suivants.filter((report) => !connus.has(report.id));
  if (!frais.length) return;
  let cibles = [];
  const veillePremium = state.compte && state.compte.premium && (state.listeId || state.trajet);
  if (veillePremium) {
    cibles = frais.filter(correspondVeille);
  } else if ("Notification" in window && Notification.permission === "granted") {
    cibles = frais.filter(typeSurveille);
  }
  if (!cibles.length) return;
  const phrase = cibles.length === 1
    ? `${cibles[0].type_label} vers ${cibles[0].lieu}`
    : veillePremium
      ? `${cibles.length} nouveaux signalements sur votre veille`
      : `${cibles.length} nouveaux signalements à Libreville`;
  const url = cibles.length === 1 ? urlSignalement(cibles[0]) : "/";
  alerter(phrase, { url, tag: cibles.length === 1 ? `wayize-${cibles[0].id}` : "wayize-alerte" });
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
  const avait = state.place || state.listeId || state.trajet;
  state.place = null;
  state.listeId = null;
  state.trajet = null;
  state.markerKey = "";
  ecrireMemoire({ listeActive: null, trajet: null });
  if (map) map.flyTo([boot.centre.latitude, boot.centre.longitude], homeZoom(), { duration: motion() });
  if (avait) toast("Toute la ville est affichée.");
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
let dernierGpsReport = 0;

function ecrireGps(texte) {
  state.gpsEtat = texte;
  const el = document.getElementById("gps-etat");
  if (el) el.textContent = texte;
}

function reglerGps() {
  if (gpsWatch && navigator.geolocation) navigator.geolocation.clearWatch(gpsWatch);
  gpsWatch = 0;
  if (gpsLayer) gpsLayer.clearLayers();
  const reglages = assurerReglages();
  if (!reglages.gps || !state.compte || !state.compte.premium || !navigator.geolocation) {
    ecrireGps(reglages.gps ? "La position n'est pas disponible sur cet appareil." : "GPS arrêté.");
    return;
  }
  ecrireGps("Position en attente.");
  gpsWatch = navigator.geolocation.watchPosition((position) => {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    if (gpsLayer) {
      gpsLayer.clearLayers();
      L.circleMarker([latitude, longitude], {
        radius: 7,
        color: "#171717",
        weight: 3,
        fillColor: "#ffffff",
        fillOpacity: 1,
      }).addTo(gpsLayer);
    }
    const proche = boot.lieux.find((lieu) => haversine(latitude, longitude, lieu.latitude, lieu.longitude) <= 1.2);
    ecrireGps(proche ? `Position reçue, près de ${proche.nom}.` : "Position reçue.");
    const liste = listeActive();
    const suivi = proche && ((liste && liste.lieux.includes(proche.id)) || (state.trajet && (state.trajet.depart === proche.id || state.trajet.arrivee === proche.id)));
    if (suivi && proche.id !== dernierGpsLieu) {
      dernierGpsLieu = proche.id;
      alerter(`Vous approchez de ${proche.nom}.`);
    }
    const incident = state.reports.find((report) => (
      encoreValide(report)
      && typeSurveille(report)
      && haversine(latitude, longitude, report.latitude, report.longitude) <= 1.2
    ));
    if (incident && incident.id !== dernierGpsReport) {
      dernierGpsReport = incident.id;
      alerter(`${incident.type_label} à proximité, vers ${incident.lieu}.`);
    }
  }, () => {
    ecrireGps("La position a été refusée.");
  }, { enableHighAccuracy: false, maximumAge: 20000, timeout: 12000 });
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
    if (state.mode === "compte" || state.mode === "feed") render();
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
  if (!isDesktop()) setVisible(state.compte ? snapPoints()[2] : Math.min(560, sheetCeiling()));
  render();
}

async function envoyerCompte(inscription) {
  const email = (document.getElementById("compte-email") || {}).value || "";
  const mot = (document.getElementById("compte-mot") || {}).value || "";
  const pseudoChamp = document.getElementById("compte-pseudo");
  if (pseudoChamp) state.comptePseudo = pseudoChamp.value.trim();
  const cgu = document.getElementById("compte-cgu");
  if (cgu) state.compteCgu = cgu.checked;
  state.compteEmail = email.trim();
  if (inscription && !state.compteCgu) {
    state.compteErreur = "Acceptez les conditions d’utilisation pour créer un compte.";
    render();
    return;
  }
  state.compteEnCours = true;
  state.compteErreur = "";
  render();
  try {
    const corps = { email, mot_de_passe: mot };
    if (inscription) corps.pseudo = state.comptePseudo || "";
    const data = await api(inscription ? "/api/comptes/inscription/" : "/api/comptes/connexion/", {
      method: "POST",
      body: JSON.stringify(corps),
    });
    state.compteEnCours = false;
    if (inscription) {
      state.compteMode = "attente";
      state.compteMessage = data.message || "Confirmez votre adresse pour ouvrir le compte.";
      state.compteLien = data.lien || "";
      toast("Confirmez votre adresse.");
      render();
      return;
    }
    appliquerCompte(data.compte, data.jeton);
    toast("Vous êtes connecté.");
    if (!isDesktop() && state.mode === "compte") setVisible(snapPoints()[2]);
    render();
  } catch (error) {
    state.compteEnCours = false;
    const champs = error.data && error.data.erreurs;
    state.compteErreur = (champs && (champs.email || champs.mot_de_passe || champs.pseudo)) || messageFrom(error, "Le compte n'a pas répondu.");
    if (!inscription && error.status === 403) {
      state.compteMode = "attente";
      state.compteMessage = state.compteErreur;
      state.compteLien = "";
    }
    render();
  }
}

function jetonDansLien(lien, cle) {
  try {
    return new URL(lien, location.origin).searchParams.get(cle) || "";
  } catch (error) {
    return "";
  }
}

async function confirmerAdresse(clair) {
  try {
    const data = await api("/api/comptes/confirmer/", {
      method: "POST",
      body: JSON.stringify({ jeton: clair }),
    });
    appliquerCompte(data.compte, data.jeton);
    state.mode = "compte";
    state.compteErreur = "";
    toast("Adresse confirmée. Vous êtes connecté.");
    render();
  } catch (error) {
    state.mode = "compte";
    state.compteMode = "connexion";
    state.compteErreur = messageFrom(error, "Ce lien n'est plus valable.");
    render();
  }
}

async function renvoyerConfirmation() {
  state.compteEnCours = true;
  state.compteErreur = "";
  render();
  try {
    const data = await api("/api/comptes/renvoyer/", {
      method: "POST",
      body: JSON.stringify({ email: state.compteEmail }),
    });
    state.compteEnCours = false;
    state.compteLien = data.lien || "";
    state.compteMessage = data.message || state.compteMessage;
    toast("Le message est renvoyé.");
    render();
  } catch (error) {
    state.compteEnCours = false;
    state.compteErreur = messageFrom(error, "Le message n'a pas pu partir.");
    render();
  }
}

async function demanderMot() {
  const email = (document.getElementById("compte-email") || {}).value || "";
  state.compteEmail = email.trim();
  state.compteEnCours = true;
  state.compteErreur = "";
  render();
  try {
    const data = await api("/api/comptes/mot-oublie/", {
      method: "POST",
      body: JSON.stringify({ email: state.compteEmail }),
    });
    state.compteEnCours = false;
    state.compteMessage = data.message || "";
    state.compteLien = data.lien || "";
    state.compteJetonMail = jetonDansLien(state.compteLien, "reinitialiser");
    toast("Si le compte existe, le lien est prêt.");
    render();
  } catch (error) {
    state.compteEnCours = false;
    state.compteErreur = messageFrom(error, "Le message n'a pas pu partir.");
    render();
  }
}

async function choisirMot() {
  const mot = (document.getElementById("compte-mot") || {}).value || "";
  state.compteEnCours = true;
  state.compteErreur = "";
  render();
  try {
    const data = await api("/api/comptes/mot-nouveau/", {
      method: "POST",
      body: JSON.stringify({ jeton: state.compteJetonMail, mot_de_passe: mot }),
    });
    state.compteEnCours = false;
    state.compteJetonMail = "";
    appliquerCompte(data.compte, data.jeton);
    toast("Mot de passe enregistré.");
    render();
  } catch (error) {
    state.compteEnCours = false;
    const champs = error.data && error.data.erreurs;
    state.compteErreur = (champs && champs.mot_de_passe) || messageFrom(error, "Le mot de passe n'a pas pu être enregistré.");
    render();
  }
}

async function enregistrerProfil(partiel, options) {
  const data = await api("/api/comptes/profil/", { method: "POST", body: JSON.stringify(partiel) });
  appliquerCompte(data.compte);
  if (!options || !options.silencieux) render();
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
    await demanderNotifications({ silencieux: true });
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
  const arret = state.listeId === id;
  const connue = ((state.compte && state.compte.listes) || []).find((liste) => liste.id === id);
  state.listeId = arret ? null : Number(id);
  state.trajet = null;
  state.place = null;
  state.markerKey = "";
  memoriserSession();
  if (arret) {
    toast("Suivi arrêté. Toute la ville est affichée.");
    render();
    return;
  }
  state.mode = "feed";
  if (!isDesktop()) setVisible(snapPoints()[1]);
  const liste = listeActive();
  const premier = liste && liste.lieux.length ? lieuParId(liste.lieux[0]) : null;
  if (premier && map) map.flyTo([premier.latitude, premier.longitude], 14, { duration: motion() });
  toast(connue ? `Liste « ${connue.nom} » en cours.` : "Liste en cours.");
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
  toast(`Trajet ${nomLieu(depart)} → ${nomLieu(arrivee)} en cours.`);
  render();
}

function changerReglage(nom, valeur) {
  const reglages = assurerReglages();
  if (nom === "pushTel") {
    if (valeur) {
      demanderNotifications().then((statut) => {
        if (statut !== "granted" || !pushActifSouhaite()) {
          memoriserPushActif(false);
        }
        render();
      });
    } else {
      desabonnerPush().then(() => render());
    }
    return;
  }
  reglages[nom] = valeur;
  memoriserSession();
  document.body.classList.toggle("is-driving", !!(state.compte && state.compte.premium && reglages.conduite));
  if (nom === "visuel" && valeur && pushActifSouhaite()) {
    demanderNotifications({ silencieux: true }).then(() => render());
  }
  if (nom === "gps") {
    if (valeur && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        if (map) map.flyTo([position.coords.latitude, position.coords.longitude], 15, { duration: motion() });
      }, () => toast("La position n'est pas disponible."));
    }
    reglerGps();
  }
  if (nom === "heures" || nom === "gps") render();
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

function champMot(attributs) {
  return `<div class="mot-ligne"><input id="compte-mot" class="field" type="password" ${attributs}><button type="button" class="mot-voir" data-action="voir-mot" aria-pressed="false" aria-label="Voir le mot de passe">${uiIcon("eye", 20)}</button></div>`;
}

function onSheetClick(event) {
  const el = event.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  if (action === "voir-mot") {
    const input = el.parentElement && el.parentElement.querySelector("input");
    if (!input) return;
    const visible = input.type === "password";
    input.type = visible ? "text" : "password";
    el.setAttribute("aria-pressed", visible ? "true" : "false");
    el.innerHTML = uiIcon(visible ? "eyeOff" : "eye", 20);
    el.setAttribute("aria-label", visible ? "Masquer le mot de passe" : "Voir le mot de passe");
    input.focus();
    return;
  }
  if (action === "filter") setFilter(el.dataset.filter);
  else if (action === "open") selectReport(Number(el.dataset.id));
  else if (action === "share") {
    event.preventDefault();
    partagerSignalement(Number(el.dataset.id));
  }
  else if (action === "notifications") demanderNotifications().then(() => render());
  else if (action === "back") goBack();
  else if (action === "compose") showCompose();
  else if (action === "auth-mode") {
    const email = document.getElementById("compte-email");
    if (email) state.compteEmail = email.value;
    const modes = ["connexion", "inscription", "oubli", "attente", "nouveau"];
    state.compteMode = modes.includes(el.dataset.mode) ? el.dataset.mode : "connexion";
    state.compteErreur = "";
    state.compteLien = "";
    render();
    const champ = document.getElementById("compte-email") || document.getElementById("compte-mot");
    if (champ) champ.focus();
  }
  else if (action === "ouvrir-trajet" || action === "suivre-domicile") {
    const form = document.getElementById("domicile-form");
    const data = form ? new FormData(form) : null;
    const domicile = data ? String(data.get("domicile") || "") : (state.compte && state.compte.domicile_id) || "";
    const travail = data ? String(data.get("travail") || "") : (state.compte && state.compte.travail_id) || "";
    if (!domicile || !travail || domicile === travail) {
      toast("Choisissez deux quartiers différents dans la liste.");
      return;
    }
    if (state.trajet && state.trajet.depart === domicile && state.trajet.arrivee === travail) {
      state.mode = "feed";
      if (!isDesktop()) setVisible(snapPoints()[1]);
      toast(`Trajet ${nomLieu(domicile)} → ${nomLieu(travail)} en cours.`);
      render();
      return;
    }
    enregistrerProfil({ domicile_id: domicile, travail_id: travail }, { silencieux: true })
      .then(() => suivreTrajet(domicile, travail))
      .catch((error) => toast(messageFrom(error, "Le trajet n'a pas pu être enregistré.")));
  }
  else if (action === "compte-panneau") {
    const panneau = el.dataset.panneau;
    if (panneau === "veille" || panneau === "alertes" || panneau === "profil") {
      state.comptePanneau = panneau;
      render();
    }
  }
  else if (action === "autre-trajet") {
    state.autreTrajet = !state.autreTrajet;
    render();
  }
  else if (action === "type-veille") {
    const reglages = assurerReglages();
    const tous = FILTERS.filter((chip) => chip.id !== "tous").map((chip) => chip.id);
    const actuel = Array.isArray(reglages.types) && reglages.types.length ? reglages.types.slice() : tous.slice();
    const type = el.dataset.type;
    const index = actuel.indexOf(type);
    if (index === -1) actuel.push(type);
    else actuel.splice(index, 1);
    reglages.types = actuel.length === tous.length || !actuel.length ? null : actuel;
    memoriserSession();
    render();
  }
  else if (action === "type") setType(el.dataset.type);
  else if (action === "types") {
    state.typesOuverts = !state.typesOuverts;
    state.lieuOuvert = false;
    render();
  }
  else if (action === "phrase") choisirPhrase(el.dataset.index);
  else if (action === "lieu-rapide") choisirLieu(el.dataset.lieu);
  else if (action === "lieu-nouveau") preparerNouveauLieu();
  else if (action === "cgu") ouvrirLegal("cgu");
  else if (action === "faq") ouvrirLegal("faq");
  else if (action === "pick") startPick();
  else if (action === "deplacer") commencerDeplacement(Number(el.dataset.id));
  else if (action === "appui") support(Number(el.dataset.id));
  else if (action === "degage") degager(Number(el.dataset.id));
  else if (action === "retry") reload();
  else if (action === "choisir-lieu") choisirLieuPick(el);
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
    const reglages = assurerReglages();
    if (reglages.silenceJusqua && Date.now() < reglages.silenceJusqua) {
      reglages.silenceJusqua = 0;
      memoriserSession();
      toast("Les alertes reprennent.");
    } else {
      reglages.silenceJusqua = Date.now() + 2 * 60 * 60 * 1000;
      memoriserSession();
      toast("Alertes en silence pour 2 heures.");
    }
    render();
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
    if (!lieu) {
      toast("Choisissez un quartier.");
      return;
    }
    ajouterLieuListe(Number(event.target.dataset.liste), String(lieu || "")).catch((error) => {
      toast(messageFrom(error, "Le lieu n'a pas pu être ajouté."));
    });
  } else if (event.target.id === "trajet-form") {
    event.preventDefault();
    const data = new FormData(event.target);
    suivreTrajet(String(data.get("depart") || ""), String(data.get("arrivee") || ""));
  } else if (event.target.id === "compte-form") {
    event.preventDefault();
    if (state.compteMode === "inscription") envoyerCompte(true);
    else if (state.compteMode === "oubli") demanderMot();
    else if (state.compteMode === "attente") renvoyerConfirmation();
    else if (state.compteMode === "nouveau") choisirMot();
    else envoyerCompte(false);
  } else if (event.target.id === "pseudo-form") {
    event.preventDefault();
    const pseudo = String(new FormData(event.target).get("pseudo") || "");
    enregistrerProfil({ pseudo }).catch((error) => toast(messageFrom(error, "Le pseudo n'a pas pu être enregistré.")));
  } else if (event.target.id === "domicile-form") {
    event.preventDefault();
    const data = new FormData(event.target);
    enregistrerProfil({
      domicile_id: String(data.get("domicile") || ""),
      travail_id: String(data.get("travail") || ""),
    }).catch((error) => toast(messageFrom(error, "Le trajet n'a pas pu être enregistré.")));
  }
}

function onChange(event) {
  if (event.target.id === "lieu-saisie") {
    const connu = appliquerLieuSaisi(event.target.value);
    if (connu && event.target.value !== connu.nom) event.target.value = connu.nom;
    afficherAideLieu();
    if (connu && map) map.flyTo([connu.latitude, connu.longitude], Math.max(map.getZoom(), 15), { duration: motion() });
  }
  if (event.target.id === "compte-cgu") state.compteCgu = event.target.checked;
  if (event.target.id === "comment-anonyme") state.commentAnonyme = event.target.checked;
  if (event.target.id === "anonyme-defaut") {
    state.commentAnonyme = event.target.checked;
    enregistrerProfil({ anonyme: event.target.checked }).catch((error) => toast(messageFrom(error, "Le réglage n'a pas pu être enregistré.")));
  }
  if (event.target.dataset.reglage) changerReglage(event.target.dataset.reglage, event.target.checked);
  if (event.target.dataset.heure) {
    assurerReglages()[event.target.dataset.heure] = event.target.value;
    memoriserSession();
  }
}

function onInput(event) {
  if (event.target.classList && event.target.classList.contains("pick-input")) peindrePick(event.target);
  if (event.target.id === "commentaire") {
    state.draft.commentaire = event.target.value;
    const counter = document.getElementById("commentaire-count");
    if (counter) counter.textContent = `${event.target.value.trim().length}/280`;
    peindreConsigne();
  }
  if (event.target.id === "detail-commentaire") state.detailDraft = event.target.value;
  if (event.target.id === "lieu-saisie") {
    const connu = appliquerLieuSaisi(event.target.value);
    const lieuOk = (state.draft.lieu || "").trim().length >= 2 && state.draft.latitude != null;
    if (lieuOk && !document.getElementById("commentaire")) {
      render();
      const champ = document.getElementById("lieu-saisie");
      if (champ) champ.focus();
      return;
    }
    state.lieuOuvert = !connu;
    afficherAideLieu();
    peindreLieux();
    peindreConsigne();
    const pick = document.querySelector(".pick-btn");
    if (pick) {
      pick.hidden = state.draft.latitude != null;
      pick.classList.toggle("is-needed", Boolean((state.draft.lieu || "").trim()) && state.draft.latitude == null);
    }
    event.target.setAttribute("aria-expanded", state.lieuOuvert ? "true" : "false");
  }
}

function peindreConsigne() {
  const el = document.getElementById("compose-status");
  if (!el) return;
  const pret = !Object.keys(validate()).length;
  el.textContent = consigneSignalement();
  el.classList.toggle("is-ready", pret);
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
  sheet.addEventListener("pointerdown", (event) => {
    const el = event.target.closest("[data-action='choisir-lieu']");
    if (!el) return;
    event.preventDefault();
    choisirLieuPick(el);
  });
  sheet.addEventListener("submit", onSubmit);
  sheet.addEventListener("change", onChange);
  sheet.addEventListener("input", onInput);
  sheet.addEventListener("focusin", (event) => {
    if (event.target.id !== "lieu-saisie") return;
    const valeur = event.target.value || "";
    if (valeur.trim().length < 2 || lieuConnu(valeur)) return;
    state.lieuOuvert = true;
    peindreLieux();
    event.target.setAttribute("aria-expanded", "true");
  });
  document.getElementById("legal").addEventListener("click", (event) => {
    if (event.target.id === "legal-backdrop" || event.target.closest("[data-legal='fermer']")) {
      fermerLegal();
      return;
    }
    const item = event.target.closest("[data-faq]");
    if (!item) return;
    const id = item.dataset.faq;
    state.faqOuverte = state.faqOuverte === id ? "" : id;
    peindreLegal(`[data-faq="${CSS.escape(id)}"]`);
  });
  document.getElementById("brand-home").addEventListener("click", () => {
    clearPlace();
  });
  document.getElementById("sheet-toggle").addEventListener("click", () => {
    basculerFeuille();
  });
  document.querySelector(".fonds").addEventListener("click", (event) => {
    const bouton = event.target.closest("[data-fond]");
    if (!bouton) return;
    appliquerFond(bouton.dataset.fond);
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
    annulerPick();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.legal) {
      fermerLegal();
      return;
    }
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
      annulerPick();
      return;
    }
    if (state.mode !== "feed") goBack();
  });
  window.addEventListener("resize", () => {
    if (map) {
      map.invalidateSize();
      syncNoms();
    }
    if (!isDesktop()) snapTo(visiblePx());
  });
  window.addEventListener("online", () => reload());
  window.addEventListener("offline", () => render());
  bindGrabber();
}

function lireLienCompte() {
  const params = new URLSearchParams(location.search);
  const confirmer = params.get("confirmer");
  const reinitialiser = params.get("reinitialiser");
  if (!confirmer && !reinitialiser) return;
  params.delete("confirmer");
  params.delete("reinitialiser");
  const reste = params.toString();
  history.replaceState(null, "", `${location.pathname}${reste ? `?${reste}` : ""}${location.hash}`);
  if (confirmer) {
    confirmerAdresse(confirmer);
    return;
  }
  state.compteJetonMail = reinitialiser;
  state.compteMode = "nouveau";
  state.mode = "compte";
}

let inviteInstall = null;

function lienApp(cle) {
  const valeur = String(reglagesCarte()[cle] || "").trim();
  return valeur.startsWith("https://") && !valeur.includes(" ") ? valeur : "";
}

function dejaInstallee() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function estIOSInstall() {
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function retirerBandeauInstall() {
  const bandeau = document.getElementById("install-banner");
  if (bandeau) bandeau.remove();
}

function afficherInstallee() {
  let vu = "";
  try { vu = localStorage.getItem("wayize.install.vu") || ""; } catch (error) { vu = ""; }
  if (vu === "1" || document.getElementById("install-banner")) return;
  const bandeau = document.createElement("aside");
  bandeau.id = "install-banner";
  bandeau.className = "install-banner is-done";
  bandeau.innerHTML = `<strong>Wayizé est installée</strong><p>L'application est déjà sur cet appareil.</p><div class="install-actions"><button type="button" class="is-quiet" data-fermer>OK</button></div>`;
  document.body.appendChild(bandeau);
  bandeau.querySelector("[data-fermer]").addEventListener("click", () => {
    try { localStorage.setItem("wayize.install.vu", "1"); } catch (error) { /* ignore */ }
    bandeau.remove();
  });
}

async function lancerInstall(bouton) {
  if (!inviteInstall) return;
  const evenement = inviteInstall;
  if (bouton) bouton.classList.add("is-busy");
  try {
    await evenement.prompt();
    const choix = await evenement.userChoice;
    inviteInstall = null;
    if (choix && choix.outcome === "accepted") {
      retirerBandeauInstall();
      return;
    }
  } catch (error) {
    // Le navigateur peut refuser un second prompt.
  }
  if (bouton) bouton.classList.remove("is-busy");
}

function proposerInstall() {
  if (document.getElementById("install-banner")) return;
  if (dejaInstallee()) {
    afficherInstallee();
    return;
  }
  let reporte = 0;
  try { reporte = Number(localStorage.getItem("wayize.install.reporte") || 0); } catch (error) { reporte = 0; }
  if (reporte && Date.now() - reporte < 3 * 24 * 60 * 60 * 1000) return;

  const android = lienApp("lien_android");
  const apple = lienApp("lien_apple");
  const peutInstaller = Boolean(inviteInstall);
  const ios = estIOSInstall();
  if (!peutInstaller && !ios && !android && !apple) return;

  const natif = [
    android ? `<a href="${esc(android)}" target="_blank" rel="noopener noreferrer">Android</a>` : "",
    apple ? `<a href="${esc(apple)}" target="_blank" rel="noopener noreferrer">Apple</a>` : "",
  ].join("");

  let titre = "Installer Wayizé";
  let precision = "Pour l'utiliser dans votre téléphone sans passer par un navigateur.";
  let actions = "";
  if (peutInstaller) {
    actions = `<button type="button" data-install>Installer</button>${natif}<button type="button" class="is-quiet" data-plus-tard>Plus tard</button>`;
  } else if (ios) {
    precision = "Sur iPhone : Partager, puis Sur l'écran d'accueil.";
    actions = `${natif}<button type="button" class="is-quiet" data-plus-tard>Plus tard</button>`;
  } else {
    titre = "Wayizé sur le téléphone";
    precision = "Ouvrez le lien de la boutique, ou utilisez le menu du navigateur pour installer l'application.";
    actions = `${natif}<button type="button" class="is-quiet" data-plus-tard>Plus tard</button>`;
  }

  const bandeau = document.createElement("aside");
  bandeau.id = "install-banner";
  bandeau.className = "install-banner";
  bandeau.innerHTML = `<strong>${titre}</strong><p>${precision}</p><div class="install-actions">${actions}</div>`;
  document.body.appendChild(bandeau);
  const bouton = bandeau.querySelector("[data-install]");
  if (bouton) bouton.addEventListener("click", () => lancerInstall(bouton));
  const plusTard = bandeau.querySelector("[data-plus-tard]");
  if (plusTard) {
    plusTard.addEventListener("click", () => {
      try { localStorage.setItem("wayize.install.reporte", String(Date.now())); } catch (error) { /* ignore */ }
      bandeau.remove();
    });
  }
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  inviteInstall = event;
  retirerBandeauInstall();
  if (boot) proposerInstall();
});
window.addEventListener("appinstalled", () => {
  inviteInstall = null;
  retirerBandeauInstall();
  try { localStorage.setItem("wayize.install.vu", "1"); } catch (error) { /* ignore */ }
  afficherInstallee();
});
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

function start() {
  boot = JSON.parse(document.getElementById("boot-data").textContent);
  if (!boot.reglages || typeof boot.reglages !== "object") boot.reglages = {};
  restaurerMemoire();
  lireLienCompte();
  initMap();
  bind();
  if (!isDesktop()) setVisible(visiblePx());
  render();
  // etat push peut manquer dans boot (cadre secours / cache) : on le relit puis on repeint le bandeau.
  assurerPushEtat().then((pret) => {
    if (pret) render();
  });
  reload();
  chargerCompte().then(() => reglerGps());
  window.setInterval(quietRefresh, 45000);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").then(() => {
      if (etatNotifications() === "granted" && pushActifSouhaite()) {
        abonnerPush({ silencieux: true });
      }
    }).catch(() => {});
  }
  proposerInstall();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
else start();
