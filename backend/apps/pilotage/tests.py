import json
from datetime import timedelta

from django.test import Client, TestCase
from django.utils import timezone

from apps.comptes.models import Compte
from apps.signalements.models import Signalement


def _post(client, url, payload, jeton=""):
    headers = {}
    if jeton:
        headers["HTTP_X_WAYIZE_COMPTE"] = jeton
    return client.post(
        url,
        data=json.dumps(payload),
        content_type="application/json",
        **headers,
    )


def _inscrire(client, email):
    created = _post(
        client,
        "/api/comptes/inscription/",
        {"email": email, "mot_de_passe": "libreville"},
    )
    return created


class AdminConsoleTests(TestCase):
    def test_first_login_becomes_admin_and_the_journal_stays_clean(self):
        _inscrire(self.client, "ada@wayize.ga")
        _inscrire(self.client, "boa@wayize.ga")
        with self.assertLogs("wayize", level="INFO") as captured:
            entree = _post(
                self.client,
                "/api/admin/entree/",
                {"email": "ada@wayize.ga", "mot_de_passe": "libreville"},
            )
        self.assertEqual(entree.status_code, 200, entree.content)
        corps = entree.json()
        self.assertTrue(corps["compte"]["est_admin"])
        self.assertNotIn("secret", corps["compte"])
        jeton = corps["jeton"]
        journal = "\n".join(captured.output)
        self.assertIn("admin.bootstrapped", journal)
        self.assertIn("admin.login", journal)
        self.assertNotIn(jeton, journal)
        self.assertNotIn("libreville", journal)
        self.assertNotIn("ada@wayize.ga", journal)

        autre = _post(
            self.client,
            "/api/admin/entree/",
            {"email": "boa@wayize.ga", "mot_de_passe": "libreville"},
        )
        self.assertEqual(autre.status_code, 403)
        self.assertFalse(Compte.objects.get(email="boa@wayize.ga").est_admin)

        mauvais = _post(
            self.client,
            "/api/admin/entree/",
            {"email": "ada@wayize.ga", "mot_de_passe": "mauvais-mot"},
        )
        self.assertEqual(mauvais.status_code, 401)

        apercu = self.client.get("/api/admin/apercu/")
        self.assertEqual(apercu.status_code, 401)
        refuse = self.client.get(
            "/api/admin/apercu/",
            HTTP_X_WAYIZE_COMPTE=Compte.objects.get(email="boa@wayize.ga").jeton,
        )
        self.assertEqual(refuse.status_code, 403)

    def test_short_identifiant_opens_the_console_without_a_journal_leak(self):
        from apps.comptes.secrets import chiffrer, correspond, nouveau_jeton

        secret = chiffrer("court")
        self.assertFalse(correspond("court", secret))
        self.assertTrue(correspond("court", secret, minimum=4))
        Compte.objects.create(email="garde", secret=secret, jeton=nouveau_jeton(), est_admin=True)
        with self.assertLogs("wayize", level="INFO") as captured:
            entree = _post(
                self.client,
                "/api/admin/entree/",
                {"email": "garde", "mot_de_passe": "court"},
            )
        self.assertEqual(entree.status_code, 200, entree.content)
        self.assertTrue(entree.json()["compte"]["est_admin"])
        journal = "\n".join(captured.output)
        self.assertIn("admin.login", journal)
        self.assertNotIn("court", journal)
        self.assertNotIn("garde", journal)
        trop_court = _post(
            self.client,
            "/api/admin/entree/",
            {"email": "garde", "mot_de_passe": "abc"},
        )
        self.assertEqual(trop_court.status_code, 401)

    def test_settings_change_lifetime_threshold_and_hourly_cap(self):
        _inscrire(self.client, "ada@wayize.ga")
        entree = _post(
            self.client,
            "/api/admin/entree/",
            {"email": "ada@wayize.ga", "mot_de_passe": "libreville"},
        )
        jeton = entree.json()["jeton"]
        hors = _post(
            self.client,
            "/api/admin/reglages/",
            {"duree_heures": 0, "seuil_degage": 2, "plafond_heure": 8},
            jeton,
        )
        self.assertEqual(hors.status_code, 400)
        self.assertEqual(self.client.get("/api/admin/reglages/", HTTP_X_WAYIZE_COMPTE=jeton).json()["duree_heures"], 3)

        frais = self.client.post(
            "/api/signalements/",
            data=json.dumps(
                {
                    "type": "bouchon",
                    "commentaire": "File courte devant le feu, ça repart.",
                    "lieu": "Glass",
                    "latitude": 0.3771157,
                    "longitude": 9.4532994,
                }
            ),
            content_type="application/json",
            HTTP_X_WAYIZE_SESSION="consoleun",
        )
        self.assertEqual(frais.status_code, 201, frais.content)
        frais_id = frais.json()["signalement"]["id"]
        ancien = Signalement.objects.create(
            type="bouchon",
            commentaire="Verification duree trop vieux pour une heure.",
            lieu="Glass",
            latitude=0.3771157,
            longitude=9.4532994,
            session_cle="vieux",
            cree_le=timezone.now() - timedelta(minutes=70),
        )
        encore = self.client.get("/api/signalements/")
        self.assertIn(ancien.pk, [item["id"] for item in encore.json()["signalements"]])
        self.assertEqual(encore.json()["duree_heures"], 3)
        self.assertEqual(encore.json()["seuil_degage"], 2)

        regle = _post(
            self.client,
            "/api/admin/reglages/",
            {"duree_heures": 1, "seuil_degage": 3, "plafond_heure": 2},
            jeton,
        )
        self.assertEqual(regle.status_code, 200, regle.content)
        self.assertEqual(regle.json()["duree_heures"], 1)
        liste = self.client.get("/api/signalements/")
        ids = [item["id"] for item in liste.json()["signalements"]]
        self.assertNotIn(ancien.pk, ids)
        self.assertFalse(Signalement.objects.filter(pk=ancien.pk).exists())
        self.assertIn(frais_id, ids)
        self.assertEqual(liste.json()["duree_heures"], 1)
        self.assertEqual(liste.json()["seuil_degage"], 3)

        url = f"/api/signalements/{frais_id}/degage/"
        un = Client(HTTP_X_WAYIZE_SESSION="voixunaa").post(url)
        self.assertEqual(un.status_code, 200)
        self.assertIn("signalement", un.json())
        deux = Client(HTTP_X_WAYIZE_SESSION="voixdeux").post(url)
        self.assertIn("signalement", deux.json())
        self.assertTrue(Signalement.objects.filter(pk=frais_id).exists())
        trois = Client(HTTP_X_WAYIZE_SESSION="voixtrois").post(url)
        self.assertTrue(trois.json()["retire"])
        self.assertFalse(Signalement.objects.filter(pk=frais_id).exists())

        for index in range(2):
            cree = self.client.post(
                "/api/signalements/",
                data=json.dumps(
                    {
                        "type": "travaux",
                        "commentaire": f"Travaux de verification numero {index} au bord.",
                        "lieu": "Glass",
                        "latitude": 0.3771157,
                        "longitude": 9.4532994,
                    }
                ),
                content_type="application/json",
                HTTP_X_WAYIZE_SESSION="consoleheure",
            )
            self.assertEqual(cree.status_code, 201, cree.content)
        bloque = self.client.post(
            "/api/signalements/",
            data=json.dumps(
                {
                    "type": "travaux",
                    "commentaire": "Troisieme essai au-dela du plafond regle.",
                    "lieu": "Glass",
                    "latitude": 0.3771157,
                    "longitude": 9.4532994,
                }
            ),
            content_type="application/json",
            HTTP_X_WAYIZE_SESSION="consoleheure",
        )
        self.assertEqual(bloque.status_code, 429)

    def test_admin_removes_a_report_and_cannot_drop_the_last_admin(self):
        _inscrire(self.client, "ada@wayize.ga")
        entree = _post(
            self.client,
            "/api/admin/entree/",
            {"email": "ada@wayize.ga", "mot_de_passe": "libreville"},
        )
        jeton = entree.json()["jeton"]
        ada = Compte.objects.get(email="ada@wayize.ga")
        with self.assertLogs("wayize", level="INFO") as captured:
            listed = self.client.get("/api/admin/comptes/", HTTP_X_WAYIZE_COMPTE=jeton)
        self.assertEqual(listed.status_code, 200)
        self.assertEqual(listed.json()["comptes"][0]["email"], "ada@wayize.ga")
        self.assertNotIn("ada@wayize.ga", "\n".join(captured.output))
        self.assertNotIn(jeton, "\n".join(captured.output))

        garde = _post(
            self.client,
            f"/api/admin/comptes/{ada.id}/",
            {"premium": True, "est_admin": False},
            jeton,
        )
        self.assertEqual(garde.status_code, 400)
        ada.refresh_from_db()
        self.assertTrue(ada.est_admin)
        self.assertFalse(ada.premium)

        cree = self.client.post(
            "/api/signalements/",
            data=json.dumps(
                {
                    "type": "accident",
                    "commentaire": "Verification retrait console, voie de droite.",
                    "lieu": "Okala",
                    "latitude": 0.3771157,
                    "longitude": 9.4532994,
                }
            ),
            content_type="application/json",
            HTTP_X_WAYIZE_SESSION="consoleretrait",
        )
        pk = cree.json()["signalement"]["id"]
        with self.assertLogs("wayize", level="INFO") as retire:
            gone = self.client.post(
                f"/api/admin/signalements/{pk}/retirer/",
                data="{}",
                content_type="application/json",
                HTTP_X_WAYIZE_COMPTE=jeton,
            )
        self.assertEqual(gone.status_code, 200)
        self.assertTrue(gone.json()["retire"])
        self.assertFalse(Signalement.objects.filter(pk=pk).exists())
        journal = "\n".join(retire.output)
        self.assertIn("signalement.removed", journal)
        self.assertNotIn("Verification retrait", journal)
        self.assertNotIn(jeton, journal)

        manquant = self.client.post(
            "/api/admin/signalements/999999/retirer/",
            data="{}",
            content_type="application/json",
            HTTP_X_WAYIZE_COMPTE=jeton,
        )
        self.assertEqual(manquant.status_code, 404)

    def test_site_settings_cover_price_map_and_closed_signups(self):
        _inscrire(self.client, "ada@wayize.ga")
        entree = _post(
            self.client,
            "/api/admin/entree/",
            {"email": "ada@wayize.ga", "mot_de_passe": "libreville"},
        )
        jeton = entree.json()["jeton"]
        avant = self.client.get("/api/admin/reglages/", HTTP_X_WAYIZE_COMPTE=jeton)
        self.assertEqual(avant.json()["prix_premium"], 1500)
        self.assertEqual(avant.json()["fond_defaut"], "satellite")
        self.assertTrue(avant.json()["routes_actives"])
        self.assertTrue(avant.json()["inscriptions_ouvertes"])

        regle = _post(
            self.client,
            "/api/admin/reglages/",
            {
                "duree_heures": 3,
                "seuil_degage": 2,
                "plafond_heure": 8,
                "prix_premium": 2500,
                "fond_defaut": "routes",
                "routes_actives": False,
                "inscriptions_ouvertes": False,
            },
            jeton,
        )
        self.assertEqual(regle.status_code, 200, regle.content)
        self.assertEqual(regle.json()["prix_premium"], 2500)
        self.assertEqual(regle.json()["fond_defaut"], "satellite")
        self.assertFalse(regle.json()["routes_actives"])
        self.assertFalse(regle.json()["inscriptions_ouvertes"])
        carte = self.client.get("/api/carte/")
        self.assertEqual(carte.json()["reglages"]["prix_premium"], 2500)
        self.assertFalse(carte.json()["reglages"]["routes_actives"])

        ferme = _post(
            self.client,
            "/api/comptes/inscription/",
            {"email": "ferme@wayize.ga", "mot_de_passe": "libreville"},
        )
        self.assertEqual(ferme.status_code, 403)
        self.assertFalse(Compte.objects.filter(email="ferme@wayize.ga").exists())

        abonnes = self.client.get("/api/admin/comptes/?filtre=abonnes", HTTP_X_WAYIZE_COMPTE=jeton)
        self.assertEqual(abonnes.status_code, 200)
        self.assertEqual(abonnes.json()["comptes"], [])
        self.assertEqual(abonnes.json()["filtre"], "abonnes")
        self.assertEqual(abonnes.json()["page"], 1)
        self.assertGreaterEqual(abonnes.json()["pages"], 1)

        self.assertEqual(avant.json()["lien_android"], "")
        self.assertEqual(avant.json()["lien_apple"], "")
        refuse = _post(
            self.client,
            "/api/admin/reglages/",
            {
                "duree_heures": 3,
                "seuil_degage": 2,
                "plafond_heure": 8,
                "prix_premium": 2500,
                "fond_defaut": "satellite",
                "routes_actives": False,
                "inscriptions_ouvertes": False,
                "lien_android": "http://exemple.invalid/app.apk",
            },
            jeton,
        )
        self.assertEqual(refuse.status_code, 400)
        publie = _post(
            self.client,
            "/api/admin/reglages/",
            {
                "duree_heures": 3,
                "seuil_degage": 2,
                "plafond_heure": 8,
                "prix_premium": 2500,
                "fond_defaut": "satellite",
                "routes_actives": False,
                "inscriptions_ouvertes": False,
                "lien_android": "https://exemple.invalid/app.apk",
                "lien_apple": "",
            },
            jeton,
        )
        self.assertEqual(publie.status_code, 200, publie.content)
        self.assertEqual(publie.json()["lien_android"], "https://exemple.invalid/app.apk")
        self.assertEqual(publie.json()["lien_apple"], "")
        self.assertEqual(self.client.get("/api/carte/").json()["reglages"]["lien_android"], "https://exemple.invalid/app.apk")
