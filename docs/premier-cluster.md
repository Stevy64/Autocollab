# Premier cluster sur le VPS

Ce guide part d’un VPS OVH vide. À la fin, une seule machine fait tourner Kubernetes. Plusieurs applications pourront y vivre, chacune dans son tiroir et sur son sous-domaine. La première est Wayizé, sur `wayize.gabomazone.com`.

Vous n’avez pas besoin d’avoir déjà utilisé Kubernetes. Les mots qui reviennent :

- le **nœud**, c’est le VPS ;
- un **pod**, c’est un programme qui tourne ;
- un **namespace**, c’est le tiroir d’une application ;
- un **Ingress**, c’est la règle « ce sous-domaine va vers cette application » ;
- un **Secret**, ce sont les variables d’environnement, qui ne vont pas dans git.

k3s est le bon choix ici : c’est un Kubernetes complet en un seul programme, prévu pour une petite machine, et il amène déjà Traefik pour recevoir les sous-domaines.

## Les deux valeurs à remplir

Notez-les avant de commencer. Le guide ne les invente pas.

| Marque | Où la trouver | À quoi elle sert |
| --- | --- | --- |
| `REMPLACER_PAR_IPV4` | La fiche du VPS dans l’espace client OVH, ligne IPv4 | SSH, et l’enregistrement DNS |
| `REMPLACER_PAR_EMAIL` | Une boîte que vous lisez vraiment | Le compte Let’s Encrypt, pour les avis d’expiration |

Le nom d’utilisateur SSH est celui de l’image installée : `ubuntu` pour Ubuntu, `debian` pour Debian. Il est indiqué sur la même fiche. Ci-dessous, `UTILISATEUR` désigne ce nom.

Les commandes de l’étape 1 se lancent sur votre PC Windows. À partir de l’étape 2, elles se lancent sur le VPS, dans cette session SSH. Si `whoami` affiche `root`, enlevez `sudo`. Sinon, gardez-le.

## 1. Ouvrir la session SSH

Dans PowerShell :

```powershell
ssh UTILISATEUR@REMPLACER_PAR_IPV4
```

La première fois, la question sur l’empreinte de la machine se valide avec `yes`. Le mot de passe ou la clé sont ceux choisis à l’installation du VPS.

Ça a marché si l’invite affiche le nom du VPS et non plus `PS`.

## 2. Mettre le système à jour

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl ca-certificates git dnsutils python3
sudo ufw status
```

Si `ufw` est inactif, ne l’activez pas : il se bat avec Kubernetes. S’il est déjà actif : `sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp`.

Dans la fiche OVH du VPS, si un pare-feu réseau est déjà activé, autorisez seulement TCP 22, 80 et 443. S’il n’y en a pas, n’en créez pas. Ne publiez pas le port 6443 : `kubectl` s’utilise dans cette session SSH.

```bash
sudo reboot
```

Reconnectez-vous avec la même commande `ssh`.

Ça a marché si `hostname -I` contient `REMPLACER_PAR_IPV4`.

## 3. Installer k3s

Traefik, le programme qui écoutera les ports 80 et 443, est inclus. N’installez pas nginx sur le VPS : il prendrait ces ports. Si une installation précédente l’a laissé : `sudo systemctl disable --now nginx`.

```bash
curl -sfL https://get.k3s.io | sudo sh -
sudo k3s kubectl get nodes
```

Attendez que la colonne `STATUS` vaille `Ready`. Si elle reste `NotReady` et que `sudo journalctl -u k3s -n 50` parle de swap : `sudo swapoff -a`, puis relancez `sudo k3s kubectl get nodes`.

Ça a marché si la ligne du nœud se termine par `Ready`.

## 4. Rendre kubectl utilisable

`kubectl` est la commande qui parle au cluster. k3s l’a installée, mais son fichier d’accès appartient à root.

```bash
mkdir -p "$HOME/.kube"
sudo cp /etc/rancher/k3s/k3s.yaml "$HOME/.kube/config"
sudo chown "$USER:$USER" "$HOME/.kube/config"
chmod 600 "$HOME/.kube/config"
grep -q KUBECONFIG "$HOME/.bashrc" || echo 'export KUBECONFIG=$HOME/.kube/config' >> "$HOME/.bashrc"
export KUBECONFIG="$HOME/.kube/config"
kubectl get nodes
```

Ça a marché si `kubectl get nodes` affiche `Ready` sans `sudo`.

## 5. Vérifier l’entrée Traefik

Rien à installer. k3s a déjà démarré Traefik dans le namespace `kube-system`.

```bash
kubectl -n kube-system get pods
kubectl -n kube-system get svc traefik
curl -sI http://127.0.0.1 | head -n 1
```

Ça a marché si un pod dont le nom commence par `traefik` est `Running`, et si `curl` répond `HTTP/1.1 404` : personne n’a encore de site, mais le port 80 répond.

## 6. Installer cert-manager

cert-manager demande les certificats à Let’s Encrypt et les renouvelle.

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
kubectl -n cert-manager rollout status deployment/cert-manager
kubectl -n cert-manager rollout status deployment/cert-manager-webhook
kubectl -n cert-manager rollout status deployment/cert-manager-cainjector
```

Si l’adresse `latest` répond 404, copiez la commande `kubectl apply` de la page <https://cert-manager.io/docs/installation/kubectl/> et relancez les trois `rollout`.

Ça a marché si les trois `rollout` se terminent par `successfully rolled out`.

## 7. Créer le compte Let’s Encrypt

Un seul émetteur pour toutes les applications du VPS. Remplacez l’adresse avant d’enregistrer le fichier.

```bash
mkdir -p "$HOME/k8s"
tee "$HOME/k8s/letsencrypt.yaml" >/dev/null <<'EOF'
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt
spec:
  acme:
    email: REMPLACER_PAR_EMAIL
    server: https://acme-v02.api.letsencrypt.org/directory
    privateKeySecretRef:
      name: letsencrypt-account-key
    solvers:
      - http01:
          ingress:
            ingressClassName: traefik
EOF
nano "$HOME/k8s/letsencrypt.yaml"
kubectl apply -f "$HOME/k8s/letsencrypt.yaml"
kubectl get clusterissuer letsencrypt
```

Dans nano : flèches, puis `Ctrl+O`, Entrée, `Ctrl+X`.

Ça a marché si `kubectl get clusterissuer` affiche `letsencrypt` et `True`.

## 8. Un namespace par application

```bash
kubectl create namespace wayize
kubectl get namespaces
```

Wayizé vivra dans `wayize`. La prochaine application aura son propre namespace, créé avec la même commande et un autre nom. Elle ne réutilisera ni les Secrets ni le disque de Wayizé. Traefik et l’émetteur `letsencrypt` restent partagés.

Ça a marché si `wayize` apparaît dans la liste.

## 9. Ajouter un sous-domaine

Le geste est toujours le même. Pour Wayizé, le sous-domaine est `wayize`.

Dans la zone DNS `gabomazone.com` (espace client OVH, domaine, zone DNS), une entrée, pas deux :

| Champ | Valeur |
| --- | --- |
| Sous-domaine | `wayize` |
| Type | `A` |
| Cible | `REMPLACER_PAR_IPV4` |
| TTL | 300 le temps de la mise en place |

Pas de `CNAME` en plus sur `wayize`.

```bash
dig +short wayize.gabomazone.com
```

Ça a marché si la commande affiche exactement `REMPLACER_PAR_IPV4`. Si elle n’affiche rien, attendez et relancez-la. Ne passez pas à l’Ingress tant que ce n’est pas le cas : Let’s Encrypt doit joindre le VPS sous ce nom.

L’Ingress, plus bas, nomme l’hôte `wayize.gabomazone.com`, pointe vers le service public de l’application, et porte l’annotation `cert-manager.io/cluster-issuer: letsencrypt`. C’est cette annotation qui déclenche le certificat. Le secret TLS (`wayize-tls`) est créé par cert-manager, pas à la main.

## 10. Installer Wayizé

Les noms de variables sont ceux de [docs/ovh-clusters.md](ovh-clusters.md). Sur ce cluster, `WAYIZE_API_URL` vaut `http://wayize-api:8648`, et `WAYIZE_API_HOSTS` nomme le service interne. L’API n’a pas d’Ingress. Le navigateur ne parle qu’au frontal, qui ajoute `X-Wayize-Session`.

Deux façons de garder les données. Le reste (image, frontal, certificat, mise à jour) est le même.

| | SQLite | Postgres |
| --- | --- | --- |
| Quand | Un seul processus API. C’est le départ de Wayizé. | Plusieurs pods ou workers API, ou une autre application du VPS. |
| Où | Un fichier sur un disque du nœud, `WAYIZE_SQLITE_PATH`. | Une base dans le Postgres du cluster, `DATABASE_URL`. Pas de second Postgres par application. |
| Réplicas API | `1`, et `--workers 1` | `1` pour commencer. Vous pourrez monter ensuite. |

`WAYIZE_SEED=0` évite d’insérer les signalements d’exemple. Le module `prod` refuse une clé trop courte ou qui commence par `dev-only-`.

Si vous restez sur un seul processus, suivez les blocs **SQLite** et sautez la section 10.3. Si vous voulez Postgres pour Wayizé, faites la section 10.3 avant les blocs **Postgres**.

### 10.1 Image, construite par GitHub Actions

Le dépôt public peut construire l’image sur les runners gratuits `ubuntu-latest`, puis la déposer sur GHCR (le registre d’images de GitHub, inclus avec le dépôt). Le VPS la télécharge. GitHub n’ouvre pas de session SSH et n’envoie pas de mot de passe.

Deux fichiers d’exemple sont déjà dans le dépôt, pas dans le code de l’application :

- `deploy/Dockerfile.wayize` — image non root (utilisateur `app`, uid 10001), sonde de santé ;
- `deploy/wayize-image.yml` — le workflow. Les actions sont épinglées sur un commit. Le seul jeton est `GITHUB_TOKEN`, créé par GitHub pour le job. Il n’y a pas de secret à coller dans le fichier.

Kubernetes n’utilise pas la ligne `HEALTHCHECK` du Dockerfile. Les sondes du Deployment, plus bas, sont le contrôle qui compte. La ligne sert si vous lancez le conteneur à la main.

Pour que GitHub lance le workflow à chaque push sur `main` qui touche l’application :

```bash
sudo mkdir -p /srv/wayize
sudo chown "$USER:$USER" /srv/wayize
git clone https://github.com/Stevy64/Autocollab.git /srv/wayize
cd /srv/wayize
git config user.email "REMPLACER_PAR_EMAIL"
git config user.name "$USER"
mkdir -p .github/workflows
cp deploy/wayize-image.yml .github/workflows/wayize-image.yml
git add .github/workflows/wayize-image.yml
git commit -m "Build the Wayize image on GHCR."
git push origin main
```

`git config` ici ne concerne que ce clone. Le push part de votre dépôt GitHub, pas d’une session ouverte par Actions.

Si `git push` demande un mot de passe, ce n’est pas celui du VPS : c’est un jeton GitHub à vous, créé sur le site (réglage du compte, jetons). Ne l’écrivez pas dans un fichier du dépôt.

Ouvrez l’onglet Actions du dépôt. Le job `build` doit devenir vert. L’image s’appelle `ghcr.io/stevy64/wayize`. Deux étiquettes : `main`, et le SHA du commit (affiché dans le journal du job). Le SHA sert à revenir en arrière.

Ça a marché si le job Actions est vert et si le journal dit que l’image a été poussée.

### 10.2 Le cluster télécharge l’image

GHCR laisse souvent le paquet privé, même pour un dépôt public. Pour ce dépôt public, le plus simple est de rendre le paquet public : sur GitHub, paquet `wayize`, réglage du paquet, visibilité publique. Le VPS le tire alors sans jeton.

```bash
sudo k3s ctr images pull ghcr.io/stevy64/wayize:main
```

Ça a marché si la commande se termine sans `unauthorized`.

Si vous gardez le paquet privé : créez sur GitHub un jeton qui peut seulement lire les paquets (`read:packages`). Sur le VPS, pas dans git :

```bash
read -rs GHCR_TOKEN
kubectl -n wayize create secret docker-registry ghcr \
  --docker-server=ghcr.io \
  --docker-username=Stevy64 \
  --docker-password="$GHCR_TOKEN"
unset GHCR_TOKEN
```

Ajoutez alors, sous `spec.template.spec` de chaque Deployment Wayizé :

```yaml
imagePullSecrets:
  - name: ghcr
```

Les manifests plus bas supposent le paquet public. L’image est `ghcr.io/stevy64/wayize:main` et `imagePullPolicy: Always`, pour qu’une mise à jour télécharge de nouveau l’étiquette `main`.

### 10.3 Postgres du cluster

Une seule instance pour tout le VPS, dans le namespace `donnees`. Chaque application a sa base et son utilisateur, dont le mot de passe est un Secret de son namespace. Rien de cela ne va dans git. Le Service n’a pas d’Ingress : le port 5432 ne sort pas du cluster.

L’image officielle démarre en root le temps de préparer le disque, puis continue en utilisateur `postgres`. On ne la force pas en non-root.

```bash
kubectl create namespace donnees --dry-run=client -o yaml | kubectl apply -f -
PG_PW=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
kubectl -n donnees create secret generic postgres-admin --from-literal=password="$PG_PW"
unset PG_PW
tee "$HOME/k8s/postgres.yaml" >/dev/null <<'EOF'
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
  namespace: donnees
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: local-path
  resources:
    requests:
      storage: 2Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: donnees
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      securityContext:
        fsGroup: 999
      containers:
        - name: postgres
          image: docker.io/library/postgres:16
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_USER
              value: postgres
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-admin
                  key: password
            - name: POSTGRES_DB
              value: postgres
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          readinessProbe:
            exec:
              command: ["pg_isready", "-U", "postgres"]
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: postgres-data
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: donnees
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
EOF
kubectl apply -f "$HOME/k8s/postgres.yaml"
kubectl -n donnees rollout status deployment/postgres --timeout=180s
```

`PGDATA` est un sous-dossier du disque. Au premier démarrage ce disque n’est pas toujours vide, et Postgres refuse alors de créer la base. `Recreate` arrête l’ancien pod avant d’en lancer un autre : ce disque ne se monte que sur un pod à la fois.

Si `create secret` répond `already exists`, ne le refaites pas : le mot de passe déjà enregistré est celui du disque.

Ça a marché si le pod `postgres` est `Running` et `READY` 1/1. `kubectl -n donnees get svc postgres` ne doit pas afficher d’adresse externe.

Une base par application. Ici, Wayizé. Le mot de passe reste dans le Secret `wayize-api` (`DATABASE_URL`), pas dans un fichier du dépôt. Cette commande ne quitte pas le VPS.

```bash
APP_PW=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")
kubectl -n donnees exec -i deploy/postgres -- psql -U postgres -v ON_ERROR_STOP=1 <<SQL
CREATE USER wayize WITH PASSWORD '${APP_PW}';
CREATE DATABASE wayize OWNER wayize;
SQL
```

Gardez `APP_PW` le temps d’écrire `DATABASE_URL` à la section 10.4, puis cette section fera `unset APP_PW`.

Ça a marché si `psql` répond deux fois `CREATE`.

Pour l’application suivante, les mêmes deux lignes SQL avec un autre nom (`CREATE USER autre ...`, `CREATE DATABASE autre OWNER autre`). Pas un second Deployment Postgres.

### 10.4 Variables

Les clés sont générées sur le VPS. `token_urlsafe` donne un mot qui peut entrer dans une URL tel quel.

```bash
WEB_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
API_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
sudo mkdir -p /etc/wayize
sudo tee /etc/wayize/web.env >/dev/null <<EOF
DJANGO_SETTINGS_MODULE=wayize_web.prod
DJANGO_SECRET_KEY=${WEB_KEY}
WAYIZE_HOSTS=wayize.gabomazone.com
WAYIZE_CSRF_ORIGINS=https://wayize.gabomazone.com
WAYIZE_API_URL=http://wayize-api:8648
EOF
```

Le fichier de l’API change selon le stockage.

**SQLite** — un processus, un fichier. Pas de `DATABASE_URL`.

```bash
sudo tee /etc/wayize/api.env >/dev/null <<EOF
DJANGO_SETTINGS_MODULE=wayize_api.prod
DJANGO_SECRET_KEY=${API_KEY}
WAYIZE_API_HOSTS=wayize-api,wayize-api.wayize.svc.cluster.local,127.0.0.1,localhost
WAYIZE_SEED=0
WAYIZE_SQLITE_PATH=/data/db.sqlite3
EOF
```

**Postgres** — seulement après la section 10.3. Le mot de passe est celui de la base `wayize`, pas celui de l’administrateur Postgres. `sslmode=disable` convient ici : le Service n’est pas publié sur Internet. Pour une base OVH hors du VPS, reprenez `sslmode=require` comme dans `docs/ovh-clusters.md`.

```bash
sudo tee /etc/wayize/api.env >/dev/null <<EOF
DJANGO_SETTINGS_MODULE=wayize_api.prod
DJANGO_SECRET_KEY=${API_KEY}
WAYIZE_API_HOSTS=wayize-api,wayize-api.wayize.svc.cluster.local,127.0.0.1,localhost
WAYIZE_SEED=0
DATABASE_URL=postgresql://wayize:${APP_PW}@postgres.donnees.svc.cluster.local:5432/wayize?sslmode=disable
EOF
```

Puis, dans les deux cas :

```bash
sudo chmod 600 /etc/wayize/web.env /etc/wayize/api.env
unset WEB_KEY API_KEY APP_PW
kubectl -n wayize create secret generic wayize-web --from-env-file=/etc/wayize/web.env
kubectl -n wayize create secret generic wayize-api --from-env-file=/etc/wayize/api.env
```

Si une commande répond `already exists` : `kubectl -n wayize delete secret wayize-web wayize-api`, puis relancez les deux `create`.

Ça a marché si `kubectl -n wayize get secrets` liste `wayize-web` et `wayize-api`.

### 10.5 API

Le frontal, à la section suivante, est identique pour les deux stockages. Seule l’API change. La sonde doit envoyer `Host: localhost`, sinon le rollout reste bloqué.

**SQLite.** Un disque de 1 Gio, un seul pod, la migration dans ce pod. L’utilisateur du conteneur est `10001`, le même que l’image. `fsGroup` lui donne le droit d’écrire sur le disque. `Recreate` arrête l’ancien pod avant le nouveau : ce disque ne se monte que sur un pod à la fois.

```bash
tee "$HOME/k8s/wayize-api.yaml" >/dev/null <<'EOF'
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: wayize-data
  namespace: wayize
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: local-path
  resources:
    requests:
      storage: 1Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wayize-api
  namespace: wayize
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: wayize-api
  template:
    metadata:
      labels:
        app: wayize-api
    spec:
      securityContext:
        fsGroup: 10001
      containers:
        - name: api
          image: ghcr.io/stevy64/wayize:main
          imagePullPolicy: Always
          workingDir: /app/backend
          command: ["gunicorn", "wayize_api.wsgi:application", "--bind", "0.0.0.0:8648", "--workers", "1"]
          envFrom:
            - secretRef:
                name: wayize-api
          securityContext:
            runAsNonRoot: true
            runAsUser: 10001
            allowPrivilegeEscalation: false
          ports:
            - containerPort: 8648
          readinessProbe:
            httpGet:
              path: /api/sante/
              port: 8648
              httpHeaders:
                - name: Host
                  value: localhost
          livenessProbe:
            httpGet:
              path: /api/sante/
              port: 8648
              httpHeaders:
                - name: Host
                  value: localhost
            initialDelaySeconds: 20
          volumeMounts:
            - name: data
              mountPath: /data
      initContainers:
        - name: migrate
          image: ghcr.io/stevy64/wayize:main
          imagePullPolicy: Always
          workingDir: /app/backend
          command: ["python", "manage.py", "migrate", "--noinput"]
          envFrom:
            - secretRef:
                name: wayize-api
          securityContext:
            runAsNonRoot: true
            runAsUser: 10001
            allowPrivilegeEscalation: false
          volumeMounts:
            - name: data
              mountPath: /data
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: wayize-data
---
apiVersion: v1
kind: Service
metadata:
  name: wayize-api
  namespace: wayize
spec:
  selector:
    app: wayize-api
  ports:
    - port: 8648
      targetPort: 8648
EOF
kubectl apply -f "$HOME/k8s/wayize-api.yaml"
kubectl -n wayize rollout status deployment/wayize-api --timeout=180s
```

**Postgres.** Pas de disque SQLite, pas d’`initContainer` : avec plusieurs pods, chacun migrerait en même temps. Un Job unique migre, puis le Deployment démarre. Vous pouvez plus tard passer `replicas` au-dessus de 1. Ne le faites pas tant que le Job n’est pas `Complete`.

```bash
tee "$HOME/k8s/wayize-api.yaml" >/dev/null <<'EOF'
apiVersion: batch/v1
kind: Job
metadata:
  name: wayize-migrate
  namespace: wayize
spec:
  backoffLimit: 2
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: ghcr.io/stevy64/wayize:main
          imagePullPolicy: Always
          workingDir: /app/backend
          command: ["python", "manage.py", "migrate", "--noinput"]
          envFrom:
            - secretRef:
                name: wayize-api
          securityContext:
            runAsNonRoot: true
            runAsUser: 10001
            allowPrivilegeEscalation: false
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wayize-api
  namespace: wayize
spec:
  replicas: 1
  selector:
    matchLabels:
      app: wayize-api
  template:
    metadata:
      labels:
        app: wayize-api
    spec:
      containers:
        - name: api
          image: ghcr.io/stevy64/wayize:main
          imagePullPolicy: Always
          workingDir: /app/backend
          command: ["gunicorn", "wayize_api.wsgi:application", "--bind", "0.0.0.0:8648", "--workers", "1"]
          envFrom:
            - secretRef:
                name: wayize-api
          securityContext:
            runAsNonRoot: true
            runAsUser: 10001
            allowPrivilegeEscalation: false
          ports:
            - containerPort: 8648
          readinessProbe:
            httpGet:
              path: /api/sante/
              port: 8648
              httpHeaders:
                - name: Host
                  value: localhost
          livenessProbe:
            httpGet:
              path: /api/sante/
              port: 8648
              httpHeaders:
                - name: Host
                  value: localhost
            initialDelaySeconds: 20
---
apiVersion: v1
kind: Service
metadata:
  name: wayize-api
  namespace: wayize
spec:
  selector:
    app: wayize-api
  ports:
    - port: 8648
      targetPort: 8648
EOF
kubectl -n wayize delete job wayize-migrate --ignore-not-found
kubectl apply -f "$HOME/k8s/wayize-api.yaml"
kubectl -n wayize wait --for=condition=complete job/wayize-migrate --timeout=180s
kubectl -n wayize rollout status deployment/wayize-api --timeout=180s
```

Basculer plus tard de SQLite vers Postgres crée une base vide : les signalements déjà dans le fichier ne suivent pas tout seuls. Faites-le avant d’avoir des données auxquelles vous tenez, ou gardez le disque SQLite le temps de décider. Ne lancez pas les deux en même temps.

Ça a marché si `rollout` se termine par `successfully rolled out`. Sur le chemin Postgres, le Job doit d’abord être `Complete` (`kubectl -n wayize get job`).

### 10.6 Frontal et certificat

Identique pour SQLite et Postgres. nginx est dans le pod, en non-root, port 8080. Il sert `/static/` et transmet le reste à gunicorn. Il repasse `X-Forwarded-Proto` tel que Traefik l’a reçu : Django s’en sert pour le cookie de la console. Sans ça, `/admin/` ne garde pas la session.

La sonde de préparation appelle `/sante/`. Tant que l’API ne répond pas, le site ne reçoit pas de visites. Ce n’est pas une sonde de vie : un trou de l’API ne doit pas relancer le frontal en boucle.

```bash
tee "$HOME/k8s/wayize-web.yaml" >/dev/null <<'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: wayize-nginx
  namespace: wayize
data:
  default.conf: |
    server {
      listen 8080;
      location /static/ {
        alias /usr/share/nginx/html/static/;
      }
      location / {
        proxy_pass http://127.0.0.1:8647;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
        proxy_set_header X-Forwarded-Host $http_x_forwarded_host;
      }
    }
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: wayize-web
  namespace: wayize
spec:
  replicas: 1
  selector:
    matchLabels:
      app: wayize-web
  template:
    metadata:
      labels:
        app: wayize-web
    spec:
      initContainers:
        - name: static
          image: ghcr.io/stevy64/wayize:main
          imagePullPolicy: Always
          command: ["sh", "-c", "cp -a /app/frontend/staticfiles/. /static/ && chmod -R a+rX /static"]
          securityContext:
            runAsNonRoot: true
            runAsUser: 10001
            allowPrivilegeEscalation: false
          volumeMounts:
            - name: static
              mountPath: /static
      containers:
        - name: gunicorn
          image: ghcr.io/stevy64/wayize:main
          imagePullPolicy: Always
          workingDir: /app/frontend
          command: ["gunicorn", "wayize_web.wsgi:application", "--bind", "127.0.0.1:8647", "--workers", "1"]
          envFrom:
            - secretRef:
                name: wayize-web
          securityContext:
            runAsNonRoot: true
            runAsUser: 10001
            allowPrivilegeEscalation: false
        - name: nginx
          image: docker.io/nginxinc/nginx-unprivileged:1.27
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /sante/
              port: 8080
          volumeMounts:
            - name: static
              mountPath: /usr/share/nginx/html/static
            - name: nginx-conf
              mountPath: /etc/nginx/conf.d/default.conf
              subPath: default.conf
      volumes:
        - name: static
          emptyDir: {}
        - name: nginx-conf
          configMap:
            name: wayize-nginx
---
apiVersion: v1
kind: Service
metadata:
  name: wayize-web
  namespace: wayize
spec:
  selector:
    app: wayize-web
  ports:
    - port: 80
      targetPort: 8080
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: wayize
  namespace: wayize
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt
spec:
  ingressClassName: traefik
  tls:
    - hosts:
        - wayize.gabomazone.com
      secretName: wayize-tls
  rules:
    - host: wayize.gabomazone.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: wayize-web
                port:
                  number: 80
EOF
kubectl apply -f "$HOME/k8s/wayize-web.yaml"
kubectl -n wayize rollout status deployment/wayize-web --timeout=180s
kubectl -n wayize get certificate
```

Si le tirage de nginx répond introuvable, remplacez `1.27` par l’étiquette indiquée sur la page de l’image `nginxinc/nginx-unprivileged`, puis `kubectl apply` à nouveau.

Le certificat met souvent une minute. Relancez `kubectl -n wayize get certificate` jusqu’à `READY` = `True`. S’il reste `False` : `kubectl -n wayize describe certificate wayize-tls`. La cause la plus fréquente est un DNS qui ne pointe pas encore vers le VPS, ou le port 80 fermé.

Ça a marché si cette commande répond avec `"api": true` :

```bash
curl -fsS https://wayize.gabomazone.com/sante/
```

Ouvrez ensuite `https://wayize.gabomazone.com/` et `https://wayize.gabomazone.com/admin/`.

Les journaux :

```bash
kubectl -n wayize logs deploy/wayize-api
kubectl -n wayize logs deploy/wayize-web -c gunicorn
```

Ce sont les mêmes lignes JSON que dans le README. `X-Request-Id` relie le frontal et l’API.

### 10.7 Mettre à jour

GitHub construit l’image. Le VPS va la chercher. Personne ne se connecte en SSH depuis Actions, et aucun mot de passe ne voyage dans le workflow.

Quand le job est vert, sur le VPS :

```bash
sudo tee /usr/local/bin/wayize-deploy >/dev/null <<'EOF'
#!/bin/sh
set -eu
kubectl -n wayize rollout restart deployment/wayize-api
kubectl -n wayize rollout status deployment/wayize-api --timeout=180s
kubectl -n wayize rollout restart deployment/wayize-web
kubectl -n wayize rollout status deployment/wayize-web --timeout=180s
EOF
sudo chmod 755 /usr/local/bin/wayize-deploy
wayize-deploy
```

`imagePullPolicy: Always` fait retélécharger l’étiquette `main` au redémarrage des pods.

Ça a marché si les deux `rollout` se terminent par `successfully rolled out`, puis si `curl -fsS https://wayize.gabomazone.com/sante/` répond encore `"api": true`.

Pour revenir au commit d’avant, remplacez `main` par le SHA affiché dans Actions (les deux conteneurs qui utilisent l’image Wayizé) :

```bash
kubectl -n wayize set image deployment/wayize-api \
  api=ghcr.io/stevy64/wayize:SHA \
  migrate=ghcr.io/stevy64/wayize:SHA
kubectl -n wayize set image deployment/wayize-web \
  static=ghcr.io/stevy64/wayize:SHA \
  gunicorn=ghcr.io/stevy64/wayize:SHA
```

Sur le chemin Postgres, le conteneur `migrate` est dans le Job, pas dans le Deployment : la première commande `set image` n’a alors que `api=...`.

## 11. L’application suivante

Même cluster, même Traefik, même émetteur `letsencrypt`, même IPv4. Pas un second k3s.

1. `kubectl create namespace NOM`.
2. Une entrée DNS `A` : le nouveau sous-domaine, cible `REMPLACER_PAR_IPV4`.
3. Un Ingress dont `host` est ce sous-domaine, avec l’annotation `cert-manager.io/cluster-issuer: letsencrypt` et un `secretName` à lui.
4. Copier `deploy/wayize-image.yml` vers un second workflow, changer le nom de l’image (`ghcr.io/stevy64/autre`) et les `paths`. Épingler les actions de la même façon. Le paquet GHCR se règle comme à la section 10.2.
5. Choisir le stockage :
   - fichier local : un PVC et `replicas: 1` dans son namespace, comme le bloc SQLite ;
   - Postgres : les deux lignes `CREATE USER` / `CREATE DATABASE` de la section 10.3, avec le nom de l’application, et un Secret `DATABASE_URL` dans son namespace. On ne réinstalle pas Postgres.
6. Ses Secrets restent dans son namespace. Pas ceux de `wayize`, pas le disque `wayize-data`.
7. Un script du même genre que `wayize-deploy`, qui ne redémarre que les Deployments de ce namespace.

Le service publié est celui que le navigateur doit voir. Une API interne, comme celle de Wayizé, reste un Service sans Ingress.
