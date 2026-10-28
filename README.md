# Wayizé

Carte de circulation pour les conducteurs de Libreville. On y signale un bouchon, un accident, des travaux, un contrôle ou une route barrée, et les autres peuvent appuyer le signalement ou ajouter une précision. La carte reste ouverte sans compte. Un compte permet de suivre des listes de lieux. Premium ajoute un trajet, des alertes, le GPS et un mode conduite ; l’activer ici n’effectue aucun débit.

Wayizé is a mobile-first map for drivers in Libreville, Gabon. People report traffic incidents by hand. Reports, supports, and comments live in Django’s default SQLite file, behind a small HTTP API.

## Découpage

Le dépôt suit le même dessin que [Gabomazone_SPA](https://github.com/Stevy64/Gabomazone_SPA) (Stevy64) : un processus frontal et une API Django dont les domaines sont des applications séparées. Il n’existe pas de dépôt public nommé `gabomazone-eamac`. Gabomazone parle en HTTP JSON : le navigateur appelle `/api/…`, et nginx (en Docker) ou le frontal (en local) transmet à l’API. L’identité anonyme est une clé de session, comme le panier invité de Gabomazone (`session_key`), passée ici dans l’en-tête `X-Wayize-Session` parce que les deux processus ne partagent pas le cookie.

```
frontend/                 carte PWA (Django), port 8647
  wayize_web/             réglages du frontal
  web/                    pages, manifeste, proxy /api
backend/                  API, port 8648 (loopback)
  wayize_api/             réglages, comme gabomazone_api
  apps/signalements/      signalements, graine, cadre de carte
  apps/comptes/           comptes, listes de lieux, droit Premium
  apps/appuis/            un appui par navigateur
  apps/commentaires/      précisions
  apps/lieux/             quartiers connus
nginx.conf                le même découpage / et /api, si un jour un proxy externe est utile
```

Les applications de l’API lisent les signalements dans le même processus et la même base SQLite. Un compte facultatif garde des listes de lieux. Premium (trajet, alertes, GPS, mode conduite) s’active sur ce serveur sans débit : le paiement mobile money n’est pas branché. Le téléphone garde le dernier flux dans son stockage local.

## Lancer en local

Python 3.12 et un navigateur suffisent. Deux terminaux :

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# API
cd backend
python manage.py migrate
python manage.py runserver 127.0.0.1:8648

# Carte, dans un autre terminal
cd frontend
WAYIZE_API_URL=http://127.0.0.1:8648 python manage.py runserver 0.0.0.0:8647
```

Ouvrir [http://127.0.0.1:8647](http://127.0.0.1:8647).

`migrate` crée `backend/db.sqlite3` et y place une dizaine de signalements d’exemple (Mont-Bouët, PK5, l’aéroport Léon-Mba, Owendo, Nzeng-Ayong…). Pour les régénérer :

```bash
cd backend && python manage.py seed_signalements --force
```

Les tests :

```bash
cd backend && python manage.py test
cd frontend && python manage.py test
```

## Journaux

Chaque processus écrit une ligne JSON sur la sortie d’erreur, logger `wayize`. Rien de secret n’y entre : pas de clé Django, pas de cookie, pas de jeton CSRF, pas de clé de session, pas le texte d’un signalement ni d’une précision.

| Événement | Où | Quand |
| --- | --- | --- |
| `http.request` | `web` et `api` | chaque page ou appel, avec `request_id`, méthode, chemin, statut, durée |
| `boundary.call` | `web` | le frontal appelle l’API (`/api/carte/`, `/api/signalements/`, …) |
| `boundary.error` | `web` | l’API ne répond pas |
| `boundary.read` | `appuis`, `commentaires` | lecture du signalement visé |
| `signalement.created` | `signalements` | création : id, type, lieu, longueur du texte |
| `signalement.rejected` / `signalement.rate_limited` | `signalements` | validation ou plafond de 8 par heure |
| `appui.recorded` | `appuis` | appui, et s’il est nouveau |
| `commentaire.created` | `commentaires` | précision : id et longueur, pas le texte |
| `error` | les deux | exception, type et message court |

L’en-tête de réponse `X-Request-Id` est le même des deux côtés, ce qui relie une action dans le journal du frontal à celui de l’API.

## Cette version

- Carte centrée sur Libreville, fond OpenStreetMap.
- Signalement manuel : type, phrase courte, quartier connu ou point posé sur la carte.
- Appui (une fois par navigateur) et précisions courtes, avec les compteurs.
- Liste des signalements récents, qui recentre la carte.
- Tendance des quatre dernières heures.
- États vide, chargement et erreur. Téléphone et bureau.
- PWA : manifeste, service worker, icônes. Sur `localhost`, le navigateur peut proposer l’installation.

Le fuseau horaire est `Africa/Libreville`. L’interface est en français.

## Hors périmètre

Le paiement mobile money n’est pas branché : activer Premium enregistre le droit, sans débit. La clé secrète par défaut ne sert qu’en local ; en dehors de cette machine, définir `DJANGO_SECRET_KEY` (une valeur par processus, ou la même, elle n’est pas journalisée).

## Crédits

- Carte : données [OpenStreetMap](https://www.openstreetmap.org/copyright), tuiles [OSM France](https://www.openstreetmap.fr/). Le serveur `tile.openstreetmap.org` refuse l'application.
- [Leaflet](https://leafletjs.com/) 1.9.4 (BSD-2-Clause), fichiers dans `frontend/web/static/trafic/vendor/leaflet/`.
- DM Sans, licence SIL Open Font License : `frontend/web/static/trafic/fonts/OFL.txt`.
- Découpage des services : [Gabomazone_SPA](https://github.com/Stevy64/Gabomazone_SPA).
