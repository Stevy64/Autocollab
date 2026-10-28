import json
from datetime import timedelta
from types import SimpleNamespace

from django.test import Client, SimpleTestCase, TestCase
from django.utils import timezone

from apps.signalements.geo import LIEUX, dans_libreville
from apps.signalements.models import Signalement
from apps.signalements.present import relatif, tendance
from apps.signalements.seed import ensure_seed

CLE = "navigateurun"
AUTRE = "navigateurtwo"


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
    def setUp(self):
        self.client = Client(HTTP_X_WAYIZE_SESSION=CLE)

    def post_json(self, url, body, client=None):
        client = client or self.client
        return client.post(
            url,
            data=json.dumps(body),
            content_type="application/json",
            HTTP_X_WAYIZE_SESSION=client.defaults.get("HTTP_X_WAYIZE_SESSION", CLE),
        )

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
        with self.assertLogs("wayize", level="INFO") as captured:
            created = self.post_json("/api/signalements/", payload())
        self.assertEqual(created.status_code, 201, created.content)
        report = created.json()["signalement"]
        self.assertEqual(report["lieu"], "Glass")
        self.assertEqual(report["type_label"], "Bouchon")
        self.assertEqual(report["appuis"], 0)
        journal = "\n".join(captured.output)
        self.assertIn("signalement.created", journal)
        self.assertIn('"lieu": "Glass"', journal)
        self.assertNotIn(CLE, journal)
        self.assertNotIn("dev-only-wayize", journal)
        self.assertNotIn(payload()["commentaire"], journal)

        libre = self.post_json(
            "/api/signalements/",
            payload(lieu="Okala", commentaire="Bouchon vers un quartier saisi à la main."),
        )
        self.assertEqual(libre.status_code, 201, libre.content)
        self.assertEqual(libre.json()["signalement"]["lieu"], "Okala")

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

    def test_support_toggles_and_stacks_across_drivers(self):
        created = self.post_json(
            "/api/signalements/",
            payload(
                type="accident",
                commentaire="Deux véhicules sur la bretelle, voie de gauche prise.",
            ),
        )
        pk = created.json()["signalement"]["id"]
        url = f"/api/signalements/{pk}/appui/"
        with self.assertLogs("wayize", level="INFO") as captured:
            first = self.client.post(url)
        with self.assertLogs("wayize", level="INFO") as removed:
            second = self.client.post(url)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["signalement"]["appuis"], 1)
        self.assertTrue(first.json()["signalement"]["appuye"])
        self.assertEqual(second.json()["signalement"]["appuis"], 0)
        self.assertFalse(second.json()["signalement"]["appuye"])
        journal = "\n".join(captured.output)
        self.assertIn("appui.recorded", journal)
        self.assertIn("appui.removed", "\n".join(removed.output))
        self.assertIn("boundary.read", journal)
        self.assertNotIn(CLE, journal)

        again = self.client.post(url)
        self.assertEqual(again.json()["signalement"]["appuis"], 1)
        other = Client(HTTP_X_WAYIZE_SESSION=AUTRE)
        third = other.post(url)
        self.assertEqual(third.json()["signalement"]["appuis"], 2)
        self.assertTrue(third.json()["signalement"]["appuye"])

        missing = self.client.post("/api/signalements/999999/appui/")
        self.assertEqual(missing.status_code, 404)

    def test_two_clear_votes_remove_the_report(self):
        created = self.post_json("/api/signalements/", payload())
        pk = created.json()["signalement"]["id"]
        url = f"/api/signalements/{pk}/degage/"
        with self.assertLogs("wayize", level="INFO") as captured:
            first = self.client.post(url)
        self.assertEqual(first.status_code, 200, first.content)
        self.assertEqual(first.json()["signalement"]["degages"], 1)
        self.assertTrue(first.json()["signalement"]["degage"])
        self.assertTrue(Signalement.objects.filter(pk=pk).exists())
        journal = "\n".join(captured.output)
        self.assertIn("degage.recorded", journal)
        self.assertNotIn(CLE, journal)

        with self.assertLogs("wayize", level="INFO") as removed:
            off = self.client.post(url)
        self.assertEqual(off.json()["signalement"]["degages"], 0)
        self.assertFalse(off.json()["signalement"]["degage"])
        self.assertIn("degage.removed", "\n".join(removed.output))
        self.assertNotIn(CLE, "\n".join(removed.output))

        again = self.client.post(url)
        self.assertEqual(again.json()["signalement"]["degages"], 1)
        other = Client(HTTP_X_WAYIZE_SESSION=AUTRE)
        with self.assertLogs("wayize", level="INFO") as cleared:
            second = other.post(url)
        self.assertEqual(second.status_code, 200, second.content)
        self.assertTrue(second.json()["retire"])
        self.assertEqual(second.json()["id"], pk)
        self.assertFalse(Signalement.objects.filter(pk=pk).exists())
        journal_fin = "\n".join(cleared.output)
        self.assertIn("signalement.cleared", journal_fin)
        self.assertIn("degage.recorded", journal_fin)
        self.assertNotIn(CLE, journal_fin)
        self.assertNotIn(AUTRE, journal_fin)

    def test_reports_expire_after_three_hours(self):
        created = self.post_json("/api/signalements/", payload())
        fresh_id = created.json()["signalement"]["id"]
        old = Signalement.objects.create(
            type="bouchon",
            commentaire="Ancien bouchon qui ne devrait plus s'afficher.",
            lieu="Glass",
            latitude=0.3771157,
            longitude=9.4532994,
            session_cle="vieux",
            cree_le=timezone.now() - timedelta(hours=3, minutes=1),
        )
        listed = self.client.get("/api/signalements/")
        ids = [item["id"] for item in listed.json()["signalements"]]
        self.assertNotIn(old.pk, ids)
        self.assertFalse(Signalement.objects.filter(pk=old.pk).exists())
        self.assertIn(fresh_id, ids)

    def test_comment_shows_up_for_everyone(self):
        created = self.post_json("/api/signalements/", payload())
        pk = created.json()["signalement"]["id"]
        url = f"/api/signalements/{pk}/commentaires/"
        short = self.post_json(url, {"texte": "x"})
        self.assertEqual(short.status_code, 400)

        phrase = "Je confirme, la voie de gauche est prise."
        with self.assertLogs("wayize", level="INFO") as captured:
            posted = self.post_json(url, {"texte": phrase})
        self.assertEqual(posted.status_code, 201)
        notes = posted.json()["signalement"]["commentaires"]
        self.assertEqual(notes[0]["texte"], phrase)
        journal = "\n".join(captured.output)
        self.assertIn("commentaire.created", journal)
        self.assertNotIn(phrase, journal)

        listed = self.client.get("/api/signalements/")
        match = next(item for item in listed.json()["signalements"] if item["id"] == pk)
        self.assertEqual(match["commentaires"][0]["texte"], phrase)

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

    def test_known_places_and_map_frame(self):
        response = self.client.get("/api/lieux/")
        noms = [lieu["nom"] for lieu in response.json()["lieux"]]
        self.assertIn("Quartier Louis", noms)
        self.assertIn("Owendo", noms)
        cadre = self.client.get("/api/carte/")
        self.assertEqual(cadre.status_code, 200)
        self.assertEqual(cadre.json()["centre"]["latitude"], 0.408)
        self.assertIn("mont-bouet", {lieu["id"] for lieu in cadre.json()["lieux"]})

    def test_health_and_request_id(self):
        response = self.client.get("/api/sante/")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])
        self.assertTrue(response["X-Request-Id"])
