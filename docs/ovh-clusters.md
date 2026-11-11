# Héberger Wayizé sur wayize.gabomazone.com

Wayizé, c’est deux processus Django. Le frontal (la carte, le proxy `/api/`, la console `/admin/`) est le seul qui parle à Internet. L’API (signalements, comptes, réglages) reste sur le loopback ou le réseau interne du cluster. Le navigateur n’appelle jamais l’API directement : le frontal ajoute l’en-tête `X-Wayize-Session` avant de la joindre.

Un sous-domaine porte une application. `wayize.gabomazone.com` est Wayizé. Une autre application du même compte OVH a son propre sous-domaine, son propre secret et sa propre base.

Le développement local ne change pas : `127.0.0.1:8647` pour la carte, `127.0.0.1:8648` pour l’API, modules `wayize_web.settings` et `wayize_api.settings`. La production charge `wayize_web.prod` et `wayize_api.prod`.

## Enregistrement DNS

Dans la zone `gabomazone.com` (espace client OVH, domaine, zone DNS), une seule entrée pour le sous-domaine `wayize`.

Instance avec une IPv4 publique, ou une IP flottante :

| Champ | Valeur |
| --- | --- |
| Sous-domaine | `wayize` |
| Type | `A` |
| Cible | l’IPv4 publique de l’instance |
| TTL | 300 le temps de la mise en place, puis la valeur habituelle de la zone |

Répartiteur de charge ou ingress qui a déjà un nom d’hôte :

| Champ | Valeur |
| --- | --- |
| Sous-domaine | `wayize` |
| Type | `CNAME` |
| Cible | ce nom d’hôte, pas une adresse IP |

Ne pas créer à la fois un `A` et un `CNAME` pour `wayize`. Ajouter un `AAAA` seulement si l’instance a une IPv6 publique. Vérifier avec `dig +short wayize.gabomazone.com` avant de demander un certificat.

## Variables

Deux fichiers, mode `600`, propriétaire du compte qui lance gunicorn. Les modèles sont `deploy/web.env.example` et `deploy/api.env.example`. Ne pas les commiter une fois remplis. Générer chaque clé avec :

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(48))"
```

Frontal, `/etc/wayize/web.env` :

```bash
DJANGO_SETTINGS_MODULE=wayize_web.prod
DJANGO_SECRET_KEY=valeur-d-au-moins-32-caracteres
WAYIZE_HOSTS=wayize.gabomazone.com
WAYIZE_CSRF_ORIGINS=https://wayize.gabomazone.com
WAYIZE_API_URL=http://127.0.0.1:8648
```

API, `/etc/wayize/api.env` :

```bash
DJANGO_SETTINGS_MODULE=wayize_api.prod
DJANGO_SECRET_KEY=une-autre-valeur-ou-la-meme
WAYIZE_API_HOSTS=127.0.0.1,localhost
WAYIZE_SEED=0
# Web Push (alertes téléphone hors onglet) — générer avec npx web-push generate-vapid-keys
# WAYIZE_VAPID_PUBLIC_KEY=
# WAYIZE_VAPID_PRIVATE_KEY=
# WAYIZE_VAPID_SUBJECT=mailto:contact@wayize.gabomazone.com
```

`WAYIZE_SEED=0` empêche la première migration d’insérer les signalements d’exemple (Mont-Bouët, PK5, l’aéroport…). Sans cette variable, ils sont créés.

Sans `WAYIZE_VAPID_PUBLIC_KEY` et `WAYIZE_VAPID_PRIVATE_KEY`, le site peut encore afficher une permission de notification, mais **aucun Push n’est envoyé** quand l’app est fermée. Sur un cluster, la procédure complète (Secret, rollout, téléphone) est la section **10.7** de [premier-cluster.md](premier-cluster.md).

`DATABASE_URL` reste absent tant qu’un seul processus API écrit dans SQLite. Le fichier est `backend/db.sqlite3`, ou le chemin `WAYIZE_SQLITE_PATH`. PostgreSQL est le magasin dès qu’il y a un deuxième processus API, un deuxième pod, ou une sauvegarde qui n’est pas une copie de fichier :

```bash
DATABASE_URL=postgresql://UTILISATEUR:MOT@HOTE:5432/wayize?sslmode=require
```

Un `@` dans le mot de passe s’écrit `%40`. Le module `prod` refuse de démarrer si `DJANGO_SECRET_KEY` manque, fait moins de 32 caractères, ou commence par `dev-only-`. `DJANGO_DEBUG` est ignoré en production.

Dans un cluster, `WAYIZE_API_URL` devient `http://wayize-api:8648` et `WAYIZE_API_HOSTS` nomme le service, pas le site public :

```bash
WAYIZE_API_HOSTS=wayize-api,wayize-api.wayize.svc.cluster.local,127.0.0.1,localhost
```

`WAYIZE_HOSTS` ne s’applique pas à l’API. Le mettre dans le fichier de l’API ne change rien : l’API lit `WAYIZE_API_HOSTS`.

## Une instance Public Cloud

1. Créer une instance Ubuntu 24.04 ou Debian 12 dans le projet Public Cloud, avec une clé SSH. Adresse publique, ou IP flottante si l’adresse de l’instance est privée. Même région que la base si vous en ajoutez une plus tard.
2. Groupe de sécurité : TCP 22 depuis votre adresse, TCP 80 et 443 depuis Internet. Ne pas ouvrir 8647 ni 8648.
3. Paquets, compte, et le clone dont la racine est `/srv/wayize` (les unités systemd visent `backend/`, `frontend/` et `.venv` à cet endroit) :

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip nginx certbot
sudo useradd --system --shell /usr/sbin/nologin wayize
sudo mkdir -p /etc/wayize /var/www/certbot
sudo chown wayize:wayize /etc/wayize
sudo git clone https://github.com/Stevy64/Autocollab.git /srv/wayize
sudo chown -R wayize:wayize /srv/wayize
sudo -u wayize python3 -m venv /srv/wayize/.venv
sudo -u wayize /srv/wayize/.venv/bin/pip install -r /srv/wayize/requirements.txt
```

4. Fichiers d’environnement, puis migration et fichiers statiques. Remplacer les clés des exemples avant la migration :

```bash
sudo install -m 600 -o wayize -g wayize /srv/wayize/deploy/api.env.example /etc/wayize/api.env
sudo install -m 600 -o wayize -g wayize /srv/wayize/deploy/web.env.example /etc/wayize/web.env
sudoedit /etc/wayize/api.env /etc/wayize/web.env
sudo -u wayize bash -lc 'set -a; source /etc/wayize/api.env; set +a; cd /srv/wayize/backend && /srv/wayize/.venv/bin/python manage.py migrate'
sudo -u wayize bash -lc 'set -a; source /etc/wayize/web.env; set +a; cd /srv/wayize/frontend && /srv/wayize/.venv/bin/python manage.py collectstatic --noinput'
```

5. Unités systemd, fournies dans le dépôt :

```bash
sudo cp /srv/wayize/deploy/wayize-api.service /etc/systemd/system/
sudo cp /srv/wayize/deploy/wayize-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now wayize-api wayize-web
```

`ss -ltnp | grep -E '8647|8648'` doit montrer `127.0.0.1` seulement. L’unité API lance un worker. C’est voulu avec SQLite. Avec PostgreSQL, `--workers 2` dans l’unité API est possible.

6. Certificat, puis le site nginx du dépôt. Tant que le certificat n’existe pas, un bloc provisoire répond au défi ACME :

```bash
sudo tee /etc/nginx/sites-available/wayize >/dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name wayize.gabomazone.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 404; }
}
EOF
sudo ln -sfn /etc/nginx/sites-available/wayize /etc/nginx/sites-enabled/wayize
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot certonly --webroot -w /var/www/certbot -d wayize.gabomazone.com
sudo cp /srv/wayize/nginx.conf /etc/nginx/sites-available/wayize
sudo nginx -t && sudo systemctl reload nginx
```

Le renouvellement est le minuteur installé par certbot. `sudo certbot renew --dry-run` doit passer. Le bloc 80 du fichier final sert encore `/.well-known/acme-challenge/`.

Si le TLS est déjà terminé devant l’instance (répartiteur de charge OVH), ne pas écouter 443 sur l’instance. Le répartiteur doit envoyer `X-Forwarded-Proto: https` vers le port 80, et le `location /` doit faire `proxy_pass` au lieu de rediriger. Sans cet en-tête, Django ne marque pas le cookie de session comme sûr et la console `/admin/` ne tient pas la session.

7. Contrôle :

```bash
curl -fsS https://wayize.gabomazone.com/sante/
```

La réponse attendue contient `"service": "web"`, `"ok": true` et `"api": true`. Ouvrir `https://wayize.gabomazone.com/` puis `https://wayize.gabomazone.com/admin/`.

## PostgreSQL

Rester sur SQLite si un seul processus gunicorn API tourne et que le fichier est sur le disque de l’instance (ou un volume monté via `WAYIZE_SQLITE_PATH`). Ne pas lancer un deuxième worker ni un deuxième serveur sur ce fichier.

Pour passer à PostgreSQL : créer une base PostgreSQL du Public Cloud dans la même région, de préférence sur le réseau privé de l’instance. Récupérer l’hôte, le port, l’utilisateur, le nom de la base et le mot de passe dans l’interface de cette base. Les poser dans `DATABASE_URL` (voir plus haut), avec `sslmode=require` si le service exige TLS. Relancer la migration une fois, puis redémarrer `wayize-api`. Le frontal n’a pas de `DATABASE_URL` : ses signalements ne sont pas dans sa base, seulement le cookie signé.

Sauvegarde : les sauvegardes automatiques sont celles du service de base, pas une copie de `db.sqlite3`. Si vous restez sur SQLite, copier le fichier pendant que l’API est arrêtée, ou utiliser l’outil `.backup` de SQLite.

## Managed Kubernetes

Un namespace pour Wayizé, par exemple `wayize`. Le secret vient des mêmes variables, pas d’un fichier dans git :

```bash
kubectl -n wayize create secret generic wayize-api --from-env-file=/etc/wayize/api.env
kubectl -n wayize create secret generic wayize-web --from-env-file=/etc/wayize/web.env
```

Deux déploiements, deux services ClusterIP.

- `wayize-api` : image qui lance `gunicorn wayize_api.wsgi:application --bind 0.0.0.0:8648`. Sans `DATABASE_URL`, `replicas: 1` et un volume ReadWriteOnce monté sur `WAYIZE_SQLITE_PATH`. Avec `DATABASE_URL`, plusieurs réplicas sont possibles et il n’y a pas de volume SQLite. `--workers 1` par pod si le magasin est SQLite.
- `wayize-web` : `gunicorn wayize_web.wsgi:application --bind 0.0.0.0:8647`. Deux réplicas conviennent. `WAYIZE_API_URL=http://wayize-api:8648`.

L’ingress a un seul hôte, `wayize.gabomazone.com`, un seul chemin `/`, et le service `wayize-web`. Pas de chemin vers l’API. Le contrôleur d’ingress doit transmettre `X-Forwarded-Proto`. L’ingress nginx le fait. Le TLS est le certificat déjà utilisé sur le cluster, ou cert-manager avec Let’s Encrypt en HTTP-01. Le DNS est alors le `CNAME` vers le nom du répartiteur, ou le `A` vers son adresse, pas les deux.

La migration est un Job, une fois, avec le secret de l’API et la commande `python manage.py migrate`. Ne pas la lancer au démarrage de chaque pod si plusieurs réplicas partent ensemble.

Les journaux sont la sortie standard des pods : `kubectl -n wayize logs deploy/wayize-web` et `deploy/wayize-api`. Même lignes JSON que sur l’instance.

Chaque autre application du cluster a son namespace ou au minimum son ingress, son secret et son hôte. Elle ne réutilise pas le secret Wayizé ni le volume SQLite.

## Journaux

Sur l’instance :

```bash
journalctl -u wayize-api -u wayize-web -f
sudo tail -f /var/log/nginx/error.log
```

Chaque ligne applicative est du JSON, logger `wayize`, sur la sortie d’erreur. Les champs utiles sont `service` (`web` ou `api`), `event`, `request_id`, `path`, `status`, `ms`. L’en-tête de réponse `X-Request-Id` est le même des deux côtés. Les noms de champs qui contiennent un secret, un mot de passe, un cookie, un jeton ou un e-mail sont retirés. Le tableau des événements est dans le README.

## Notifications téléphone (instance systemd)

Même besoin que sur le cluster : clés VAPID dans `/etc/wayize/api.env`, puis redémarrage de l’API. Ne pas inventer l’IP du VPS ni coller la clé privée dans git.

```bash
npx --yes web-push generate-vapid-keys
sudoedit /etc/wayize/api.env   # WAYIZE_VAPID_PUBLIC_KEY, WAYIZE_VAPID_PRIVATE_KEY, WAYIZE_VAPID_SUBJECT
sudo -u wayize bash -lc 'set -a; source /etc/wayize/api.env; set +a; cd /srv/wayize/backend && /srv/wayize/.venv/bin/python manage.py migrate'
sudo systemctl restart wayize-api
curl -fsS https://wayize.gabomazone.com/api/notifications/etat/
```

`"push": true` confirme la config. Sur le téléphone : installer la PWA (écran d’accueil sur iOS), Compte → Alertes → Autoriser. Détail cluster : [premier-cluster.md](premier-cluster.md) §10.7.

## Mettre à jour

```bash
cd /srv/wayize
sudo -u wayize git pull --ff-only
sudo -u wayize /srv/wayize/.venv/bin/pip install -r requirements.txt
sudo -u wayize bash -lc 'set -a; source /etc/wayize/api.env; set +a; cd /srv/wayize/backend && /srv/wayize/.venv/bin/python manage.py migrate'
sudo -u wayize bash -lc 'set -a; source /etc/wayize/web.env; set +a; cd /srv/wayize/frontend && /srv/wayize/.venv/bin/python manage.py collectstatic --noinput'
sudo systemctl restart wayize-api
sudo systemctl restart wayize-web
curl -fsS https://wayize.gabomazone.com/sante/
```

Si `migrate` échoue, ne pas redémarrer. Pour revenir en arrière : `git checkout` du commit précédent, `pip install`, redémarrage. Ne pas défaire une migration sans avoir lu l’opération inverse.

Dans le cluster : construire l’image, lancer le Job de migration, puis mettre à jour l’image des deux déploiements. L’API d’abord, le frontal ensuite.

## À ne pas faire

- Publier 8647 ou 8648 dans le groupe de sécurité ou dans un Service de type LoadBalancer pour l’API.
- Envoyer `/api/` à l’API dans nginx ou dans l’ingress. Le frontal est la porte.
- Lancer plus d’un processus API sur un fichier SQLite.
- Commiter `/etc/wayize/*.env`, `DATABASE_URL` ou `DJANGO_SECRET_KEY`.
- Réutiliser la clé `dev-only-…`. Le module `prod` s’arrête si vous le faites.
