# Wayizé

Carte de circulation pour les conducteurs de Libreville. On y signale un bouchon, un accident, des travaux, un contrôle ou une route barrée, et les autres peuvent appuyer le signalement ou ajouter une précision. La carte reste ouverte sans compte. Un compte permet de suivre des listes de lieux. Premium ajoute un trajet, des alertes, le GPS et un mode conduite ; l’activer ici n’effectue aucun débit.

Wayizé is a mobile-first map for drivers in Libreville, Gabon. People report traffic incidents by hand. Reports, supports, and comments live in Django’s default SQLite file, behind a small HTTP API.

## Découpage

Le dépôt suit le même dessin que [Gabomazone_SPA](https://github.com/Stevy64/Gabomazone_SPA) (Stevy64) : un processus frontal et une API Django dont les domaines sont des applications séparées. Il n’existe pas de dépôt public nommé `gabomazone-eamac`. Gabomazone parle en HTTP JSON : le navigateur appelle `/api/…`, et nginx (en Docker) ou le frontal (en local) transmet à l’API. L’identité anonyme est une clé de session, comme le panier invité de Gabomazone (`session_key`), passée ici dans l’en-tête `X-Wayize-Session` parce que les deux processus ne partagent pas le cookie.

```
frontend/                 carte PWA (Django), port 8647
  wayize_web/             réglages du frontal (settings = dev, prod = production)
  web/                    pages, manifeste, proxy /api
backend/                  API, port 8648 (loopback)
  wayize_api/             réglages de l'API (settings = dev, prod = production)
  apps/signalements/      signalements, graine, cadre de carte
  apps/comptes/           comptes, listes de lieux, droit Premium
  apps/pilotage/          réglages de la carte et console d'administration
  apps/appuis/            un appui par navigateur
  apps/commentaires/      précisions
  apps/lieux/             quartiers connus
nginx.conf                site nginx de wayize.gabomazone.com (TLS, frontal seul)
deploy/                   unités systemd et exemples de variables, sans secret
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
WAYIZE_API_URL=http://127.0.0.1:8648 python manage.py runserver 127.0.0.1:8647
```

Sous Windows PowerShell, dans `frontend` :

```powershell
$env:WAYIZE_API_URL = "http://127.0.0.1:8648"
python manage.py runserver 127.0.0.1:8647
```

Ouvrir [http://127.0.0.1:8647](http://127.0.0.1:8647). Ces commandes chargent `wayize_web.settings` et `wayize_api.settings`. Rien à exporter d'autre : `DEBUG` est actif, les hôtes sont ouverts, la base est `backend/db.sqlite3`.

## Local et production

Le développement et la production sont deux modules. Les serveurs locaux ci-dessus ne changent pas. La production se lance avec gunicorn et `DJANGO_SETTINGS_MODULE`.

| | Local | Production |
| --- | --- | --- |
| Frontal | `wayize_web.settings`, `runserver 127.0.0.1:8647` | `wayize_web.prod`, gunicorn sur `127.0.0.1:8647` |
| API | `wayize_api.settings`, `runserver 127.0.0.1:8648` | `wayize_api.prod`, gunicorn sur `127.0.0.1:8648` |
| Hôtes | `*` | `WAYIZE_HOSTS` (défaut `wayize.gabomazone.com`) |
| CSRF | origines vides | `https://wayize.gabomazone.com` |
| TLS | non | nginx, en-tête `X-Forwarded-Proto` |
| Base | SQLite | SQLite pour un seul processus API ; PostgreSQL dès qu'il y en a plusieurs |

Variables. Aucune n'est dans le dépôt. Les modèles vides sont `deploy/web.env.example` et `deploy/api.env.example`.

| Variable | Processus | Rôle |
| --- | --- | --- |
| `DJANGO_SETTINGS_MODULE` | les deux | `wayize_web.prod` ou `wayize_api.prod` |
| `DJANGO_SECRET_KEY` | les deux, une valeur chacune | obligatoire en prod, 32 caractères ou plus, autre que la clé `dev-only-…` |
| `WAYIZE_HOSTS` | frontal | hôtes publics, séparés par des virgules |
| `WAYIZE_CSRF_ORIGINS` | frontal | origines HTTPS des formulaires `/admin/` |
| `WAYIZE_API_URL` | frontal | où joindre l'API. Défaut `http://127.0.0.1:8648`. Dans un cluster, le nom du service interne |
| `WAYIZE_API_HOSTS` | API | hôtes acceptés pour cet appel. Défaut prod `127.0.0.1,localhost`. Ne pas y mettre le nom public |
| `WAYIZE_STATIC_ROOT` | frontal | dossier de `collectstatic`. Défaut `frontend/staticfiles` |
| `DATABASE_URL` | API | vide = SQLite. Sinon `postgresql://UTILISATEUR:MOT@HOTE:5432/wayize?sslmode=require` |
| `WAYIZE_SQLITE_PATH` | API | autre chemin que `backend/db.sqlite3` |
| `WAYIZE_SEED` | API | `0` pour ne pas insérer les signalements d'exemple à la première migration |
| `DJANGO_DEBUG` | dev seulement | `0` coupe le mode debug. Ignoré par les modules `prod` |

Générer une clé : `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Le mot de passe d'une `DATABASE_URL` se met entre les `:` et le `@`, encodé (un `@` dans le mot devient `%40`).

Migration, depuis `backend`, avec les variables de l'API déjà posées :

```bash
python manage.py migrate
```

La première fois, si `WAYIZE_SEED` n'est pas `0`, une dizaine de signalements d'exemple sont créés. `seed_signalements --force` les régénère. `collectstatic` se lance depuis `frontend` et remplit `STATIC_ROOT`, que nginx sert sous `/static/`.

Les journaux restent des lignes JSON sur la sortie d'erreur (logger `wayize`). gunicorn et nginx les laissent passer : `journalctl -u wayize-web -u wayize-api` sur une instance, ou la sortie du conteneur dans un cluster. L'en-tête `X-Request-Id` relie les deux processus. Rien de secret n'y entre.

Le guide pas à pas pour OVHcloud est [docs/ovh-clusters.md](docs/ovh-clusters.md). Le site nginx est [nginx.conf](nginx.conf) : TLS devant, seul le frontal est publié.

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
| `signalement.rejected` / `signalement.rate_limited` | `signalements` | validation ou plafond horaire (8 par défaut) |
| `appui.recorded` / `appui.removed` | `appuis` | confirmation ajoutée ou retirée |
| `degage.recorded` / `degage.removed` | `appuis` | un usager dit que c'est dégagé, ou retire son vote |
| `signalement.cleared` | `appuis` | autant de votes « dégagé » que le seuil (2 par défaut) retirent l'alerte |
| `signalement.expired` | `signalements` | alertes plus vieilles que la durée réglée (3 h par défaut), nombre seulement |
| `signalement.removed` | `pilotage` | un administrateur retire un signalement, id seulement |
| `admin.login` / `admin.bootstrapped` | `pilotage` | entrée dans la console, id du compte seulement |
| `reglages.updated` | `pilotage` | durée, seuil « dégagé » et plafond horaire |
| `compte.updated` | `pilotage` | droit Premium ou administration, id seulement |
| `commentaire.created` | `commentaires` | précision : id et longueur, pas le texte |
| `error` | les deux | exception, type et message court |

L’en-tête de réponse `X-Request-Id` est le même des deux côtés, ce qui relie une action dans le journal du frontal à celui de l’API.

## Cette version

- Carte centrée sur Libreville. Fond satellite ou plan routier (Esri).
- Signalement manuel : type, phrase courte, quartier de la liste ou nom saisi, avec un point sur la carte si le nom est nouveau.
- Confirmation, que l'on peut retirer, et précisions courtes, avec les compteurs.
- Liste des signalements récents, qui recentre la carte. Une alerte disparaît au bout de trois heures (réglable). Deux usagers qui disent « c'est dégagé » la retirent tout de suite ; un seul vote reste visible. Le seuil est réglable.
- Administration sur `/admin/` : aperçu, signalements, comptes, durée de vie, seuil « dégagé » et plafond horaire. S'il n'y a pas encore d'administrateur, le premier compte qui se connecte le devient.
- Tendance sur la durée de vie des alertes, en cercle, qui se déploie en barre.
- États vide, chargement et erreur. Téléphone et bureau.
- PWA : manifeste, service worker, icônes. Sur `localhost`, le navigateur peut proposer l’installation.

Le fuseau horaire est `Africa/Libreville`. L’interface est en français.

## Hors périmètre

Le paiement mobile money n’est pas branché : activer Premium enregistre le droit, sans débit. La clé `dev-only-…` ne sert qu’aux modules de développement. En production le module `prod` refuse de démarrer sans `DJANGO_SECRET_KEY`.

## Crédits

- Carte : images satellite et plan des rues [Esri](https://www.esri.com/) (Maxar, HERE, Garmin, OpenStreetMap). Le trafic en direct des cartes commerciales n'est pas branché.
- [Leaflet](https://leafletjs.com/) 1.9.4 (BSD-2-Clause), fichiers dans `frontend/web/static/trafic/vendor/leaflet/`.
- DM Sans, licence SIL Open Font License : `frontend/web/static/trafic/fonts/OFL.txt`.
- Découpage des services : [Gabomazone_SPA](https://github.com/Stevy64/Gabomazone_SPA).
