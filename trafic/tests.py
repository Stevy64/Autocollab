import json
from datetime import timedelta
from types import SimpleNamespace

from django.test import Client, SimpleTestCase, TestCase
from django.utils import timezone

from .geo import LIEUX, dans_libreville
from .models import Signalement
from .present import relatif, tendance
from .seed import ensure_seed


def payload(**overrides):
    data = {
        "type": "bouchon",
        "commentaire": "Deux files au feu, ça n'avance plus du tout.",
        "lieu": "Glass",
        "latitude": 0.3771157,
        "longitude": 9.4532994,
    }
    data.update(overrides)
    return data


class GeoTests(SimpleTestCase):
    def test_known_places_are_inside_greater_libreville(self):
        for lieu in LIEUX:
            self.assertTrue(
                dans_libreville(lieu["latitude"], lieu["longitude"]),
                lieu["nom"],
            )

    def test_relatif_phrases(self):
        now = timezone.now()
        self.assertEqual(relatif(now, now), "à l'instant")
        self.assertEqual(relatif(now - timedelta(minutes=12), now), "il y a 12 min")
        self.assertEqual(relatif(now - timedelta(hours=3), now), "il y a 3 h")

    def test_dense_tendency_names_the_newest_hotspots(self):
        now = timezone.now()
        items = [
            SimpleNamespace(pk=1, type="bouchon", lieu="Nzeng-Ayong", cree_le=now - timedelta(minutes=5)),
            SimpleNamespace(pk=2, type="bouchon", lieu="Mont-Bouët", cree_le=now - timedelta(minutes=20)),
            SimpleNamespace(pk=3, type="accident", lieu="Échangeur IAI", cree_le=now - timedelta(minutes=40)),
        ]
        result = tendance(items, now)
        self.assertEqual(result["niveau"], "dense")
        self.assertEqual(result["focus_id"], 1)
        self.assertIn("Nzeng-Ayong", result["detail"])
        self.assertIn("Mont-Bouët", result["detail"])

    def test_quiet_roads_read_as_fluide(self):
        now = timezone.now()
        result = tendance([], now)
        self.assertEqual(result["niveau"], "fluide")
        self.assertIsNone(result["focus_id"])


class MapSliceTests(TestCase):
    def post_json(self, url, body):
        return self.client.post(
            url,
            data=json.dumps(body),
            content_type="application/json",
        )

    def test_home_is_french_and_installable(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Wayizé")
        self.assertContains(response, "Libreville")
        self.assertContains(response, "/manifest.webmanifest")
        self.assertContains(response, "mont-bouet")

    def test_manifest_and_service_worker(self):
        manifest = self.client.get("/manifest.webmanifest")
        self.assertEqual(manifest.status_code, 200)
        self.assertIn("manifest", manifest["Content-Type"])
        body = manifest.json()
        self.assertEqual(body["display"], "standalone")
        self.assertEqual(body["lang"], "fr")
        self.assertEqual(body["start_url"], "/")
        self.assertGreaterEqual(len(body["icons"]), 2)

        worker = self.client.get("/sw.js")
        self.assertEqual(worker.status_code, 200)
        self.assertIn("javascript", worker["Content-Type"])
        self.assertContains(worker, "wayize-shell-v2")
        self.assertEqual(worker["Service-Worker-Allowed"], "/")

    def test_seeded_reports_cover_the_city(self):
        response = self.client.get("/api/signalements/")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        lieux = {item["lieu"] for item in body["signalements"]}
        self.assertIn("Mont-Bouët", lieux)
        self.assertIn("Nzeng-Ayong", lieux)
        self.assertIn("Port d'Owendo", lieux)
        self.assertIn("Aéroport Léon-Mba", lieux)
        self.assertGreaterEqual(len(body["signalements"]), 10)
        self.assertEqual(body["tendance"]["niveau"], "dense")
        self.assertIn("focus_id", body["tendance"])

    def test_seed_is_idempotent_and_can_be_forced(self):
        self.assertEqual(ensure_seed(), 0)
        self.assertGreaterEqual(Signalement.objects.count(), 10)
        Signalement.objects.filter(session_cle="graine").delete()
        self.assertEqual(ensure_seed(force=True), 10)
        self.assertEqual(
            Signalement.objects.filter(session_cle="graine").count(),
            10,
        )

    def test_create_reject_and_list(self):
        created = self.post_json("/api/signalements/", payload())
        self.assertEqual(created.status_code, 201, created.content)
        report = created.json()["signalement"]
        self.assertEqual(report["lieu"], "Glass")
        self.assertEqual(report["type_label"], "Bouchon")
        self.assertEqual(report["appuis"], 0)

        missing = self.post_json("/api/signalements/", payload(commentaire="court"))
        self.assertEqual(missing.status_code, 400)
        self.assertIn("commentaire", missing.json()["erreurs"])

        outside = self.post_json(
            "/api/signalements/",
            payload(latitude=0.4, longitude=8.9, lieu="Hors ville"),
        )
        self.assertEqual(outside.status_code, 400)
        self.assertIn("Libreville", outside.json()["erreurs"]["lieu"])

        listed = self.client.get("/api/signalements/")
        ids = [item["id"] for item in listed.json()["signalements"]]
        self.assertIn(report["id"], ids)

    def test_support_is_once_per_browser_and_stacks_across_drivers(self):
        created = self.post_json("/api/signalements/", payload(type="accident", commentaire="Deux véhicules sur la bretelle, voie de gauche prise."))
        pk = created.json()["signalement"]["id"]
        url = f"/api/signalements/{pk}/appui/"
        first = self.client.post(url)
        second = self.client.post(url)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["signalement"]["appuis"], 1)
        self.assertEqual(second.json()["signalement"]["appuis"], 1)
        self.assertTrue(second.json()["signalement"]["appuye"])

        other = Client()
        third = other.post(url)
        self.assertEqual(third.json()["signalement"]["appuis"], 2)
        self.assertTrue(third.json()["signalement"]["appuye"])

        missing = self.client.post("/api/signalements/999999/appui/")
        self.assertEqual(missing.status_code, 404)

    def test_comment_shows_up_for_everyone(self):
        created = self.post_json("/api/signalements/", payload())
        pk = created.json()["signalement"]["id"]
        url = f"/api/signalements/{pk}/commentaires/"
        short = self.post_json(url, {"texte": "x"})
        self.assertEqual(short.status_code, 400)

        posted = self.post_json(url, {"texte": "Je confirme, la voie de gauche est prise."})
        self.assertEqual(posted.status_code, 201)
        notes = posted.json()["signalement"]["commentaires"]
        self.assertEqual(notes[0]["texte"], "Je confirme, la voie de gauche est prise.")

        listed = self.client.get("/api/signalements/")
        match = next(item for item in listed.json()["signalements"] if item["id"] == pk)
        self.assertEqual(match["commentaires"][0]["texte"], "Je confirme, la voie de gauche est prise.")

    def test_hourly_limit(self):
        for index in range(8):
            response = self.post_json(
                "/api/signalements/",
                payload(commentaire=f"Essai de limite numéro {index} vers le centre."),
            )
            self.assertEqual(response.status_code, 201, response.content)
        blocked = self.post_json(
            "/api/signalements/",
            payload(commentaire="Encore un signalement de trop pour cette heure."),
        )
        self.assertEqual(blocked.status_code, 429)

    def test_icons_are_shipped(self):
        from pathlib import Path

        root = Path(__file__).resolve().parent / "static" / "trafic" / "icons"
        for name in (
            "favicon-32.png",
            "apple-touch-icon.png",
            "icon-192.png",
            "icon-512.png",
            "icon-maskable-512.png",
        ):
            self.assertTrue((root / name).is_file(), name)
            self.assertGreater((root / name).stat().st_size, 400, name)

    def test_known_places_endpoint(self):
        response = self.client.get("/api/lieux/")
        noms = [lieu["nom"] for lieu in response.json()["lieux"]]
        self.assertIn("Quartier Louis", noms)
        self.assertIn("Owendo", noms)
