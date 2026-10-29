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

Les noms de variables sont ceux de [docs/ovh-clusters.md](ovh-clusters.md). Sur ce cluster, deux d’entre elles changent par rapport à une installation sans Kubernetes : `WAYIZE_API_URL` vaut `http://wayize-api:8648`, et `WAYIZE_API_HOSTS` nomme le service interne. L’API n’a pas d’Ingress. Le navigateur ne parle qu’au frontal, qui ajoute `X-Wayize-Session`.

Un seul pod API, SQLite sur un disque du nœud, pas de `DATABASE_URL`. `WAYIZE_SEED=0` évite d’insérer les signalements d’exemple.

### Image

Le VPS n’a pas de registre d’images. On construit l’image sur place et k3s l’utilise sans aller la chercher sur Internet.

```bash
sudo apt install -y docker.io
sudo git clone https://github.com/Stevy64/Autocollab.git /srv/wayize
sudo tee /srv/wayize/Dockerfile >/dev/null <<'EOF'
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# Cette clé ne sert qu'à collectstatic pendant la construction.
# Les vraies clés sont celles des Secrets, à l'étape suivante.
ENV DJANGO_SETTINGS_MODULE=wayize_web.prod
ENV DJANGO_SECRET_KEY=construction-de-limage-seulement-pas-la-cle-reelle
RUN python frontend/manage.py collectstatic --noinput
EOF
sudo docker build -t wayize:1 /srv/wayize
sudo docker save wayize:1 | sudo k3s ctr images import -
sudo k3s ctr images ls | grep wayize
```

Ça a marché si `grep` affiche `wayize:1`.

### Variables

Les clés sont générées sur le VPS. Elles ne vont pas dans le dépôt.

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
sudo tee /etc/wayize/api.env >/dev/null <<EOF
DJANGO_SETTINGS_MODULE=wayize_api.prod
DJANGO_SECRET_KEY=${API_KEY}
WAYIZE_API_HOSTS=wayize-api,wayize-api.wayize.svc.cluster.local,127.0.0.1,localhost
WAYIZE_SEED=0
WAYIZE_SQLITE_PATH=/data/db.sqlite3
EOF
sudo chmod 600 /etc/wayize/web.env /etc/wayize/api.env
unset WEB_KEY API_KEY
kubectl -n wayize create secret generic wayize-web --from-env-file=/etc/wayize/web.env
kubectl -n wayize create secret generic wayize-api --from-env-file=/etc/wayize/api.env
```

Si une commande répond `already exists`, les Secrets sont déjà là. Pour les refaire : `kubectl -n wayize delete secret wayize-web wayize-api`, puis relancez les deux `create`.

Ça a marché si `kubectl -n wayize get secrets` liste `wayize-web` et `wayize-api`.

### API

Un disque de 1 Gio, un seul pod, la migration juste avant le démarrage. Le module `prod` refuse une clé trop courte ou qui commence par `dev-only-`.

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
          image: docker.io/library/wayize:1
          imagePullPolicy: Never
          workingDir: /app/backend
          command: ["gunicorn", "wayize_api.wsgi:application", "--bind", "0.0.0.0:8648", "--workers", "1"]
          envFrom:
            - secretRef:
                name: wayize-api
          ports:
            - containerPort: 8648
          readinessProbe:
            httpGet:
              path: /api/sante/
              port: 8648
          volumeMounts:
            - name: data
              mountPath: /data
      initContainers:
        - name: migrate
          image: docker.io/library/wayize:1
          imagePullPolicy: Never
          workingDir: /app/backend
          command: ["python", "manage.py", "migrate", "--noinput"]
          envFrom:
            - secretRef:
                name: wayize-api
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
kubectl -n wayize rollout status deployment/wayize-api
```

Ça a marché si `rollout` se termine par `successfully rolled out`.

### Frontal et certificat

nginx est dans le pod, pas sur le VPS. Il sert `/static/` et transmet le reste à gunicorn. Il repasse `X-Forwarded-Proto` tel que Traefik l’a reçu : Django s’en sert pour le cookie de la console. Sans ça, `/admin/` ne garde pas la session.

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
      listen 80;
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
          image: docker.io/library/wayize:1
          imagePullPolicy: Never
          command: ["sh", "-c", "cp -a /app/frontend/staticfiles/. /static/"]
          volumeMounts:
            - name: static
              mountPath: /static
      containers:
        - name: gunicorn
          image: docker.io/library/wayize:1
          imagePullPolicy: Never
          workingDir: /app/frontend
          command: ["gunicorn", "wayize_web.wsgi:application", "--bind", "127.0.0.1:8647", "--workers", "1"]
          envFrom:
            - secretRef:
                name: wayize-web
        - name: nginx
          image: docker.io/library/nginx:1.27
          ports:
            - containerPort: 80
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
      targetPort: 80
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
kubectl -n wayize rollout status deployment/wayize-web
kubectl -n wayize get certificate
```

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

## 11. L’application suivante

Même cluster, même Traefik, même émetteur `letsencrypt`, même IPv4.

1. `kubectl create namespace NOM`.
2. Une entrée DNS `A` : le nouveau sous-domaine, cible `REMPLACER_PAR_IPV4`. Pas de second cluster.
3. Un Ingress dont `host` est ce sous-domaine, avec l’annotation `cert-manager.io/cluster-issuer: letsencrypt` et un `secretName` à lui.
4. Ses Secrets et son disque dans son namespace. Pas ceux de `wayize`.

Le service publié est celui que le navigateur doit voir. Une API interne, comme celle de Wayizé, reste un Service sans Ingress.
