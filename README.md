# Wayizé

Carte de circulation pour les conducteurs de Libreville. On y signale un bouchon, un accident, des travaux, un contrôle ou une route barrée, et les autres peuvent appuyer le signalement ou ajouter une précision. Pas de compte, pas de suivi GPS : le lieu se choisit sur la carte ou parmi les quartiers connus.

Wayizé is a mobile-first map for drivers in Libreville, Gabon. People report traffic incidents by hand. This slice stores everything in Django’s default SQLite file.

## Lancer en local

Python 3.12 et un navigateur suffisent.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8647
```

Ouvrir [http://127.0.0.1:8647](http://127.0.0.1:8647).

`migrate` crée `db.sqlite3` et y place une dizaine de signalements d’exemple (Mont-Bouët, PK5, l’aéroport Léon-Mba, Owendo, Nzeng-Ayong…). Pour les régénérer :

```bash
python manage.py seed_signalements --force
```

Les tests :

```bash
python manage.py test
```

## Cette version

- Carte centrée sur Libreville, avec le fond OpenStreetMap (quartiers, axes, noms de lieux).
- Signalement manuel : type, phrase courte, quartier connu ou point posé sur la carte.
- Appui (une fois par navigateur) et précisions courtes, avec les compteurs.
- Liste des signalements récents, filtrable, qui recentre la carte.
- Tendance des quatre dernières heures, calculée à partir des signalements.
- États vide, chargement et erreur. Mise en page téléphone et bureau.
- PWA : manifeste, service worker, icônes. Sur `localhost`, le navigateur peut proposer l’installation. Le worker met en cache l’interface et les derniers signalements pour une réouverture hors ligne.

Le fuseau horaire est `Africa/Libreville`. L’interface est en français.

## Hors périmètre

Pas de comptes, pas de paiement, pas de géolocalisation continue. La clé secrète par défaut ne sert qu’en local ; en dehors de cette machine, définir `DJANGO_SECRET_KEY`.

## Crédits

- Carte : [OpenStreetMap](https://www.openstreetmap.org/copyright).
- [Leaflet](https://leafletjs.com/) 1.9.4 (BSD-2-Clause), fichiers dans `trafic/static/trafic/vendor/leaflet/`.
- DM Sans, licence SIL Open Font License : `trafic/static/trafic/fonts/OFL.txt`.
