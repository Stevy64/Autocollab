# Premier cluster sur le VPS

Ce guide part d’un VPS OVH vide. À la fin, une seule machine fait tourner Kubernetes. Plusieurs applications pourront y vivre, chacune dans son tiroir et sur son sous-domaine. La première est Wayizé, sur `wayize.gabomazone.com`.

Vous n’avez pas besoin d’avoir déjà utilisé Kubernetes. Les mots qui reviennent :

- le **nœud**, c’est le VPS ;
- un **pod**, c’est un programme qui tourne ;
- un **namespace**, c’est le tiroir d’une application ;
- un **Ingress**, c’est la règle « ce sous-domaine va vers cette application » ;
- un **Secret**, ce sont les variables d’environnement, qui ne vont pas dans git.

k3s est le bon choix ici : c’est un Kubernetes complet en un seul programme, prévu pour une petite machine, et il amène déjà Traefik pour recevoir les sous-domaines.

Lisez ce guide de haut en bas. Les étapes 1 à 7 préparent la machine, une seule fois. L’étape 8 crée le tiroir de Wayizé, l’étape 9 son nom de domaine, l’étape 10 l’installe. À l’étape 10.1 on **construit l’image sur le VPS** (pas de registre GHCR). Continuez ensuite à 10.2. Ne revenez pas en arrière. L’étape 11 envoie vers le guide de l’application suivante. Chacun de ces guides a sa propre suite 1, 2, 3, et ne reprend pas les numéros de celui-ci.

Dans le terminal, on ne colle que le contenu d’un bloc de commandes (le cadre gris), puis on attend qu’il se termine. Les titres, les phrases et les lignes « Ça a marché si » ne sont pas des commandes. Si le shell répond `command not found` sur un mot français, ce mot a été collé par erreur : on l’ignore, on n’installe rien.

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

**Alertes téléphone.** Après que le site répond en HTTPS (fin de 10.5), les notifications système hors app se règlent à la section **[10.7 Alertes téléphone en prod](#107-alertes-téléphone-en-prod)** — un chemin unique, de la génération des clés jusqu’au test sur le téléphone.

Deux façons de garder les données. Le reste (image, frontal, certificat, mise à jour) est le même.

| | SQLite | Postgres |
| --- | --- | --- |
| Quand | Un seul processus API. C’est le départ de Wayizé. | Plusieurs pods ou workers API, ou une autre application du VPS. |
| Où | Un fichier sur un disque du nœud, `WAYIZE_SQLITE_PATH`. | Une base dans le Postgres du cluster, `DATABASE_URL`. Pas de second Postgres par application. |
| Réplicas API | `1`, et `--workers 1` | `1` pour commencer. Vous pourrez monter ensuite. |

`WAYIZE_SEED=0` évite d’insérer les signalements d’exemple. Le module `prod` refuse une clé trop courte ou qui commence par `dev-only-`.

Si vous restez sur un seul processus, suivez les blocs **SQLite** et sautez la section 10.2. Si vous voulez Postgres pour Wayizé, faites la section 10.2 avant les blocs **Postgres**. Les applications de l’étape 11 utilisent ce même Postgres : ne sautez la section 10.2 que si Wayizé reste seul sur ce VPS.

### 10.1 Obtenir l’image (sur le VPS, sans registre)

**Pas de GHCR.** On ne tire pas `ghcr.io/stevy64/wayize:…`. On construit l’image sur le VPS, on l’importe dans k3s, et les Deployments utilisent l’étiquette locale `wayize:local` avec `imagePullPolicy: Never`. Aucun jeton de registre, aucun `imagePullSecrets`.

Le fichier de construction est `deploy/Dockerfile.wayize` (utilisateur non root `app`, uid 10001). Docker (ou buildah) ne sert qu’à construire ; les pods restent ceux de k3s. L’image nginx des manifests ne change pas.

#### Construire et importer

Si `/srv/wayize` existe déjà, ne clonez pas une seconde fois. Le dépôt applicatif est [Stevy64/Wayize](https://github.com/Stevy64/Wayize).

```bash
sudo apt install -y docker.io
sudo mkdir -p /srv/wayize
sudo chown "$USER:$USER" /srv/wayize
if [ ! -d /srv/wayize/.git ]; then
  git clone https://github.com/Stevy64/Wayize.git /srv/wayize
fi
cd /srv/wayize
git pull --ff-only
sudo docker build -f deploy/Dockerfile.wayize -t wayize:local .
sudo docker save wayize:local | sudo k3s ctr images import -
sudo k3s ctr images ls | grep wayize
```

Sans Docker, avec buildah :

```bash
sudo apt install -y buildah
cd /srv/wayize
sudo buildah bud -f deploy/Dockerfile.wayize -t docker.io/library/wayize:local .
sudo buildah push docker.io/library/wayize:local docker-archive:/tmp/wayize-local.tar
sudo k3s ctr images import /tmp/wayize-local.tar
rm -f /tmp/wayize-local.tar
sudo k3s ctr images ls | grep wayize
```

Ça a marché si `grep` affiche `docker.io/library/wayize:local` (ou un nom équivalent contenant `wayize:local`).

Les manifests des étapes 10.4 et 10.5 utilisent déjà :

```yaml
image: docker.io/library/wayize:local
imagePullPolicy: Never
```

`Never` interdit à k3s d’interroger Internet pour cette image : elle doit figurer dans `k3s ctr images ls` **avant** le démarrage des pods.

Passez à l’étape 10.2.

#### Bloqué maintenant : `ImagePullBackOff` sur `ghcr.io/stevy64/wayize:main`

Si les pods affichent `ImagePullBackOff` / `ErrImagePull` et que `kubectl -n wayize describe pod …` cite `ghcr.io/stevy64/wayize:main`, le cluster essaie encore le registre. On arrête ça : construire en local, importer, puis **forcer** les Deployments (et le Job migrate s’il existe) vers `wayize:local`.

Collez ce bloc **tel quel** sur le VPS (SSH) :

```bash
cd /srv/wayize
git pull --ff-only
sudo apt install -y docker.io
sudo docker build -f deploy/Dockerfile.wayize -t wayize:local .
sudo docker save wayize:local | sudo k3s ctr images import -
sudo k3s ctr images ls | grep wayize

# API (conteneur api ; + migrate si le Deployment SQLite l’embarque)
kubectl -n wayize set image deployment/wayize-api \
  api=docker.io/library/wayize:local \
  migrate=docker.io/library/wayize:local
kubectl -n wayize patch deployment wayize-api --type=json -p='[
  {"op":"replace","path":"/spec/template/spec/containers/0/imagePullPolicy","value":"Never"},
  {"op":"replace","path":"/spec/template/spec/initContainers/0/imagePullPolicy","value":"Never"}
]' 2>/dev/null || kubectl -n wayize patch deployment wayize-api --type=json -p='[
  {"op":"replace","path":"/spec/template/spec/containers/0/imagePullPolicy","value":"Never"}
]'

# Frontal (static + gunicorn)
kubectl -n wayize set image deployment/wayize-web \
  static=docker.io/library/wayize:local \
  gunicorn=docker.io/library/wayize:local
kubectl -n wayize patch deployment wayize-web --type=json -p='[
  {"op":"replace","path":"/spec/template/spec/containers/0/imagePullPolicy","value":"Never"},
  {"op":"replace","path":"/spec/template/spec/containers/1/imagePullPolicy","value":"Never"}
]'

# Job migrate Postgres (s’il existe) : à relancer avec la bonne image
if kubectl -n wayize get job wayize-migrate >/dev/null 2>&1; then
  kubectl -n wayize delete job wayize-migrate --ignore-not-found
fi

kubectl -n wayize delete pods -l app=wayize-api --force --grace-period=0 2>/dev/null || true
kubectl -n wayize delete pods -l app=wayize-web --force --grace-period=0 2>/dev/null || true
kubectl -n wayize rollout status deployment/wayize-api --timeout=180s
kubectl -n wayize rollout status deployment/wayize-web --timeout=180s
kubectl -n wayize get pods
```

Si le patch `initContainers` échoue parce qu’il n’y en a pas (chemin Postgres), c’est normal : le second `patch` (conteneur seul) suffit pour l’API.

Ça a marché si `get pods` montre `Running` / `1/1` (ou `2/2` pour le web) **sans** `ImagePullBackOff`, et si :

```bash
kubectl -n wayize get deploy wayize-api wayize-web -o wide
kubectl -n wayize get deploy -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{range .spec.template.spec.containers[*]}{.image}{" "}{.imagePullPolicy}{"\n"}{end}{end}'
```

affiche `docker.io/library/wayize:local` et `Never` (plus de `ghcr.io`).

Retirez aussi un éventuel secret de registre devenu inutile :

```bash
kubectl -n wayize delete secret ghcr --ignore-not-found
```

### 10.2 Postgres du cluster

Une seule instance pour tout le VPS, dans le namespace `donnees`. Chaque application a sa base et son utilisateur, dont le mot de passe est un Secret de son namespace. Rien de cela ne va dans git. Le Service n’a pas d’Ingress : le port 5432 ne sort pas du cluster.

Le conteneur démarre avec l’utilisateur `postgres` (uid 999). `fsGroup` rend le disque accessible à ce groupe. On ne passe pas par `gosu` : sur ce VPS, `gosu` reste bloqué, le journal reste vide, et la sonde répond `no response`. L’annotation AppArmor est nécessaire sur Ubuntu : sans elle, la reprise après un arrêt brutal échoue avec `could not signal for checkpoint: Permission denied` et le pod ne devient jamais prêt.

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
      annotations:
        container.apparmor.security.beta.kubernetes.io/postgres: unconfined
    spec:
      securityContext:
        runAsUser: 999
        runAsGroup: 999
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
sudo k3s ctr images pull docker.io/library/postgres:16
kubectl apply -f "$HOME/k8s/postgres.yaml"
kubectl -n donnees rollout status deployment/postgres --timeout=300s
kubectl -n donnees get pods
```

Le champ `PGDATA` du manifeste est un sous-dossier du disque. Au premier démarrage ce disque n’est pas toujours vide, et Postgres refuse alors de créer la base. `Recreate` arrête l’ancien pod avant d’en lancer un autre : ce disque ne se monte que sur un pod à la fois.

Si `create secret` répond `already exists`, ne le refaites pas : le mot de passe déjà enregistré est celui du disque.

Ça a marché si `get pods` affiche `Running` et `1/1`. `kubectl -n donnees get svc postgres` ne doit pas afficher d’adresse externe.

Si le rollout affiche `timed out`, le pod n’est pas prêt. On ne lance pas `psql`. On colle seulement ce bloc, et on lit la dernière ligne `Warning` ainsi que les journaux :

```bash
kubectl -n donnees describe pod -l app=postgres | tail -n 40
kubectl -n donnees logs deploy/postgres --tail=50
```

`ImagePullBackOff` ou `ErrImagePull` : le téléchargement a échoué. Relancez `sudo k3s ctr images pull docker.io/library/postgres:16`, puis `kubectl -n donnees delete pod -l app=postgres`, puis le `rollout status`. `CrashLoopBackOff` : le journal dit pourquoi. On ne passe à la base Wayizé qu’une fois le pod `1/1`.

Une base par application. Ici, Wayizé. Le mot de passe reste dans le Secret `wayize-api` (`DATABASE_URL`), pas dans un fichier du dépôt. Cette commande ne quitte pas le VPS.

```bash
APP_PW=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")
kubectl -n donnees exec -i deploy/postgres -- psql -U postgres -v ON_ERROR_STOP=1 <<SQL
CREATE USER wayize WITH PASSWORD '${APP_PW}';
CREATE DATABASE wayize OWNER wayize;
SQL
```

Gardez `APP_PW` le temps d’écrire `DATABASE_URL` à la section 10.3, puis cette section fera `unset APP_PW`.

Ça a marché si `psql` répond deux fois `CREATE`.

Pour l’application suivante, les mêmes deux lignes SQL avec un autre nom (`CREATE USER autre ...`, `CREATE DATABASE autre OWNER autre`). Pas un second Deployment Postgres.

### 10.3 Variables

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

Les trois lignes `WAYIZE_VAPID_*` restent commentées ici. Sans elles, le téléphone n’a pas d’alerte système quand Wayizé est fermée. Après le premier démarrage réussi (site HTTPS OK), suivez la section **[10.7 Alertes téléphone en prod](#107-alertes-téléphone-en-prod)** — une seule suite de commandes.

```bash
sudo tee /etc/wayize/api.env >/dev/null <<EOF
DJANGO_SETTINGS_MODULE=wayize_api.prod
DJANGO_SECRET_KEY=${API_KEY}
WAYIZE_API_HOSTS=wayize-api,wayize-api.wayize.svc.cluster.local,127.0.0.1,localhost
WAYIZE_SEED=0
WAYIZE_SQLITE_PATH=/data/db.sqlite3
# WAYIZE_VAPID_PUBLIC_KEY=
# WAYIZE_VAPID_PRIVATE_KEY=
# WAYIZE_VAPID_SUBJECT=mailto:contact@wayize.gabomazone.com
EOF
```

**Postgres** — seulement après la section 10.2. Le mot de passe est celui de la base `wayize`, pas celui de l’administrateur Postgres. `sslmode=disable` convient ici : le Service n’est pas publié sur Internet. Pour une base OVH hors du VPS, reprenez `sslmode=require` comme dans `docs/ovh-clusters.md`.

```bash
sudo tee /etc/wayize/api.env >/dev/null <<EOF
DJANGO_SETTINGS_MODULE=wayize_api.prod
DJANGO_SECRET_KEY=${API_KEY}
WAYIZE_API_HOSTS=wayize-api,wayize-api.wayize.svc.cluster.local,127.0.0.1,localhost
WAYIZE_SEED=0
DATABASE_URL=postgresql://wayize:${APP_PW}@postgres.donnees.svc.cluster.local:5432/wayize?sslmode=disable
# WAYIZE_VAPID_PUBLIC_KEY=
# WAYIZE_VAPID_PRIVATE_KEY=
# WAYIZE_VAPID_SUBJECT=mailto:contact@wayize.gabomazone.com
EOF
```

Puis, dans les deux cas :

```bash
sudo chmod 600 /etc/wayize/web.env /etc/wayize/api.env
unset WEB_KEY API_KEY APP_PW
sudo k3s kubectl -n wayize create secret generic wayize-web --from-env-file=/etc/wayize/web.env
sudo k3s kubectl -n wayize create secret generic wayize-api --from-env-file=/etc/wayize/api.env
```

`kubectl` sans `sudo` ne peut pas lire ces fichiers : ils appartiennent à root et le mode 600 les ferme aux autres. L’erreur `permission denied` se règle avec `sudo k3s kubectl`, pas en changeant le mode.

Si une commande répond `already exists` : `kubectl -n wayize delete secret wayize-web wayize-api`, puis relancez les deux `create`.

Ça a marché si `kubectl -n wayize get secrets` liste `wayize-web` et `wayize-api`.

### 10.4 API

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
          image: docker.io/library/wayize:local
          imagePullPolicy: Never
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
          image: docker.io/library/wayize:local
          imagePullPolicy: Never
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

Si le déploiement SQLite est déjà en service et que son disque contient des signalements, ne collez pas le bloc qui suit. Il remplacerait l’API par une base Postgres vide. Le Postgres du namespace `donnees` reste utile pour les autres applications. Wayizé, lui, garde le bloc SQLite.

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
          image: docker.io/library/wayize:local
          imagePullPolicy: Never
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
          image: docker.io/library/wayize:local
          imagePullPolicy: Never
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

### 10.5 Frontal et certificat

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
          image: docker.io/library/wayize:local
          imagePullPolicy: Never
          command: ["sh", "-c", "cp -R /app/frontend/staticfiles/. /static/ && find /static -mindepth 1 -exec chmod a+rX {} +"]
          securityContext:
            runAsNonRoot: true
            runAsUser: 10001
            allowPrivilegeEscalation: false
          volumeMounts:
            - name: static
              mountPath: /static
      containers:
        - name: gunicorn
          image: docker.io/library/wayize:local
          imagePullPolicy: Never
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

### 10.6 Mettre à jour

On refait seulement cette étape à chaque publication. Les étapes 1 à 10.5 ne se rejouent pas. Le Secret, la base et les disques restent en place. **Toujours sans GHCR** : on reconstruit `wayize:local` sur le VPS, on réimporte dans k3s, on redémarre les pods.

```bash
cd /srv/wayize
git pull --ff-only
sudo docker build -f deploy/Dockerfile.wayize -t wayize:local .
sudo docker save wayize:local | sudo k3s ctr images import -
kubectl -n wayize rollout restart deployment/wayize-api deployment/wayize-web
kubectl -n wayize rollout status deployment/wayize-api --timeout=180s
kubectl -n wayize rollout status deployment/wayize-web --timeout=180s
curl -fsS https://wayize.gabomazone.com/sante/
```

Ça a marché si les deux `rollout` se terminent par `successfully rolled out`, et si `curl` répond encore `"api": true`.

Pour revenir à un commit précis :

```bash
cd /srv/wayize
git fetch origin
git checkout COMMITHASH
sudo docker build -f deploy/Dockerfile.wayize -t wayize:local .
sudo docker save wayize:local | sudo k3s ctr images import -
kubectl -n wayize rollout restart deployment/wayize-api deployment/wayize-web
kubectl -n wayize rollout status deployment/wayize-api --timeout=180s
kubectl -n wayize rollout status deployment/wayize-web --timeout=180s
git checkout main
```

Si un Job `wayize-migrate` (Postgres) doit refaire la migration après une mise à jour de schéma, recréez-le comme à l’étape 10.4 une fois la nouvelle image importée.

### 10.7 Alertes téléphone en prod

Cette section se fait **après** que `https://wayize.gabomazone.com/sante/` répond avec `"api": true` (fin de 10.5). Une seule fois. On reste sur le VPS, en SSH, sauf pour le test téléphone à la fin.

Sans ces clés, le téléphone n’alerte que si Wayizé est ouverte à l’écran. Avec elles, une notification système peut arriver **même si l’app est fermée** (Web Push).

| Où | Quoi |
| --- | --- |
| Fichier sur le VPS | `/etc/wayize/api.env` (mode 600, root) — on y ajoute trois lignes `WAYIZE_VAPID_*` |
| Secret Kubernetes | `wayize-api` dans le namespace `wayize` — recopié depuis ce fichier |
| Modèle dans le dépôt | `deploy/api.env.example` (ne pas y coller de vraies clés) |
| Instance sans k3s | même variables ; voir [ovh-clusters.md](ovh-clusters.md) § Notifications téléphone |

**Avant de commencer.** Ne collez jamais la clé privée dans git, dans un ticket ou dans le chat. Android Chrome : PWA ou site HTTPS + permission. iPhone / iPad : **iOS 16.4 ou plus**, et Wayizé **sur l’écran d’accueil** (Safari → Partager → Sur l’écran d’accueil) — un simple onglet Safari ne suffit pas.

Faites les étapes **dans l’ordre**. Ne sautez pas.

#### Étape A — Générer les clés

Sur le VPS :

```bash
npx --yes web-push generate-vapid-keys
```

L’écran affiche une **Public Key** et une **Private Key**. Gardez-les sous la main (bloc-notes local, pas un fichier du dépôt).

Autre possibilité si Node n’est pas installé, depuis un clone du dépôt :

```bash
cd /srv/wayize   # ou le chemin de votre clone
python3 deploy/generate_vapid_keys.py
```

Ça écrit `deploy/vapid.local.env` (fichier **gitignoré**). Ouvrez-le seulement pour copier les trois lignes, ne le committez pas.

Ça a marché si vous avez deux longues chaînes (publique et privée), sans les avoir mises dans git.

#### Étape B — Les coller dans `/etc/wayize/api.env`

```bash
sudoedit /etc/wayize/api.env
```

Dans l’éditeur, **ajoutez ou décommentez** exactement ces trois lignes (remplacez les points de suspension par vos clés ; une seule ligne chacune, sans espace autour du `=`) :

```bash
WAYIZE_VAPID_PUBLIC_KEY=...la_Public_Key...
WAYIZE_VAPID_PRIVATE_KEY=...la_Private_Key...
WAYIZE_VAPID_SUBJECT=mailto:contact@wayize.gabomazone.com
```

Laissez intactes les autres lignes déjà présentes (`DJANGO_SECRET_KEY`, `DATABASE_URL` ou `WAYIZE_SQLITE_PATH`, etc.). Enregistrez et quittez.

Ça a marché si `sudo grep WAYIZE_VAPID /etc/wayize/api.env` montre les trois noms (les valeurs restent sur le VPS).

#### Étape C — Recréer le Secret et redémarrer l’API

Le pod ne lit pas le fichier directement : il lit le Secret `wayize-api`. On le recrée depuis le fichier, puis on redémarre l’API.

```bash
sudo k3s kubectl -n wayize delete secret wayize-api
sudo k3s kubectl -n wayize create secret generic wayize-api --from-env-file=/etc/wayize/api.env
kubectl -n wayize rollout restart deployment/wayize-api
kubectl -n wayize rollout status deployment/wayize-api --timeout=180s
```

(`sudo k3s kubectl` pour lire `/etc/wayize/api.env` en mode 600 ; le `rollout` peut rester sans `sudo` si votre compte y a droit.)

Ça a marché si le `rollout status` se termine par `successfully rolled out`.

#### Étape D — Migration

La table des abonnements Push doit exister.

**SQLite** (un pod API, volume) :

```bash
kubectl -n wayize exec deploy/wayize-api -- python manage.py migrate --noinput
```

**Postgres** (Job de l’étape 10.4) :

```bash
kubectl -n wayize delete job wayize-migrate --ignore-not-found
kubectl apply -f "$HOME/k8s/wayize-api.yaml"
kubectl -n wayize wait --for=condition=complete job/wayize-migrate --timeout=180s
```

Ça a marché si la commande se termine sans erreur rouge.

#### Étape E — Contrôle `"push": true`

```bash
curl -fsS https://wayize.gabomazone.com/api/notifications/etat/
curl -fsS https://wayize.gabomazone.com/sante/
```

Ça a marché si la première réponse contient `"push": true` (et une `vapid_public` non vide). La seconde doit aussi montrer `"push": true`.

Si vous lisez `"push": false` : les clés ne sont pas arrivées dans le pod. Vérifiez le fichier, recréez le Secret (étape C), puis :

```bash
kubectl -n wayize exec deploy/wayize-api -- printenv | grep WAYIZE_VAPID
```

(La clé privée s’affiche : ne la copiez nulle part.)

#### Étape F — Téléphone : installer, autoriser, tester

1. Ouvrez `https://wayize.gabomazone.com/` sur le téléphone.
2. **Installer** Wayizé (bouton Installer, ou sur iPhone : Partager → Sur l’écran d’accueil). Rouvrez l’icône installée.
3. Compte → panneau **Alertes** → **Autoriser les notifications téléphone** → Accepter dans la boîte du système.
4. Fermez complètement Wayizé (pas seulement un onglet en arrière-plan).
5. Depuis un autre appareil (ou l’admin), publiez un signalement. Le téléphone doit montrer une notification système (centre de notifications / barre d’état), pas seulement un toast dans l’app.

Ça a marché si la notification système apparaît alors que Wayizé est fermée.

Si `"push": true` mais rien n’arrive : réinstallez la PWA, refaites l’autorisation, puis regardez `kubectl -n wayize logs deploy/wayize-api | grep push` (événements `push.subscribed` / `push.sent` / `push.error`).

## 11. L’application suivante

Le cluster est en place. On ne refait pas les étapes 1 à 7, ni le Postgres de l’étape 10.2. Chaque application a son guide, numéroté à partir de 1. On ouvre celui de l’application, et on le suit jusqu’au bout.

| Application | Adresse | Guide |
| --- | --- | --- |
| Zanalyze | `zanalyze.gabomazone.com` | `docs/ovh-cluster.md` du dépôt Zanalyze |
| Gab Event | `gabevent.gabomazone.com` | `docs/ovh-cluster.md` du dépôt Gab-Event |
| Fallaman | `fallaman.gabomazone.com` | `Fallaman/docs/ovh-cluster.md` du dépôt Fallaman-Web |
| Gaboma Hub | `hub.gabomazone.com` | `docs/ovh-cluster.md` du dépôt Gaboma-Hub |

Dans chacun : un namespace, un nom de domaine, une base dans le Postgres déjà là, l’image (construites sur le VPS comme à l’étape 10.1, sans GHCR), les variables du projet, puis le lancement. Le Secret et le disque de Wayizé ne sont pas réutilisés. Une API interne, comme celle de Wayizé, reste sans Ingress.
