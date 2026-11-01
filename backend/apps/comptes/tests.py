import json
from urllib.parse import parse_qs, urlparse

from django.test import TestCase, override_settings

from apps.comptes.models import Compte


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend", DEBUG=True)
class CompteTests(TestCase):
    def _json(self, url, payload, jeton="", session=""):
        headers = {}
        if jeton:
            headers["HTTP_X_WAYIZE_COMPTE"] = jeton
        if session:
            headers["HTTP_X_WAYIZE_SESSION"] = session
        return self.client.post(
            url,
            data=json.dumps(payload),
            content_type="application/json",
            **headers,
        )

    def _confirmer(self, created):
        lien = created.json()["lien"]
        clair = parse_qs(urlparse(lien).query)["confirmer"][0]
        return self._json("/api/comptes/confirmer/", {"jeton": clair})

    def test_signup_login_and_premium_lists(self):
        created = self._json(
            "/api/comptes/inscription/",
            {"email": "Awa@Exemple.GA", "mot_de_passe": "libreville", "pseudo": "Awa L"},
        )
        self.assertEqual(created.status_code, 201)
        self.assertNotIn("jeton", created.json())
        self.assertIn("confirmer=", created.json()["lien"])
        ouvert = self._confirmer(created)
        self.assertEqual(ouvert.status_code, 200)
        jeton = ouvert.json()["jeton"]
        self.assertEqual(ouvert.json()["compte"]["email"], "awa@exemple.ga")
        self.assertEqual(ouvert.json()["compte"]["pseudo"], "Awa L")
        self.assertFalse(ouvert.json()["compte"]["premium"])
        self.assertNotIn(jeton, str(created.wsgi_request))

        me = self.client.get("/api/comptes/moi/", HTTP_X_WAYIZE_COMPTE=jeton)
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["compte"]["email"], "awa@exemple.ga")

        refused = self._json("/api/comptes/listes/", {"nom": "Matin"}, jeton)
        self.assertEqual(refused.status_code, 402)

        wrong = self._json(
            "/api/comptes/connexion/",
            {"email": "awa@exemple.ga", "mot_de_passe": "mauvais-mot"},
        )
        self.assertEqual(wrong.status_code, 401)

        again = self._json(
            "/api/comptes/connexion/",
            {"email": "awa@exemple.ga", "mot_de_passe": "libreville"},
        )
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.json()["jeton"], jeton)

        activated = self.client.post("/api/comptes/premium/", HTTP_X_WAYIZE_COMPTE=jeton)
        self.assertEqual(activated.status_code, 200)
        self.assertTrue(activated.json()["compte"]["premium"])

        made = self._json("/api/comptes/listes/", {"nom": "Matin"}, jeton)
        self.assertEqual(made.status_code, 201)
        liste_id = made.json()["compte"]["listes"][0]["id"]
        added = self._json(
            f"/api/comptes/listes/{liste_id}/lieux/",
            {"lieu_id": "pk5"},
            jeton,
        )
        self.assertEqual(added.status_code, 200)
        self.assertEqual(added.json()["compte"]["listes"][0]["lieux"], ["pk5"])

        unknown = self._json(
            f"/api/comptes/listes/{liste_id}/lieux/",
            {"lieu_id": "nulle-part"},
            jeton,
        )
        self.assertEqual(unknown.status_code, 400)
        self.assertEqual(Compte.objects.count(), 1)

    def test_confirmation_reset_and_signed_precision(self):
        created = self._json(
            "/api/comptes/inscription/",
            {"email": "mina@exemple.ga", "mot_de_passe": "libreville", "pseudo": "Mina"},
        )
        bloque = self._json(
            "/api/comptes/connexion/",
            {"email": "mina@exemple.ga", "mot_de_passe": "libreville"},
        )
        self.assertEqual(bloque.status_code, 403)
        ouvert = self._confirmer(created)
        jeton = ouvert.json()["jeton"]
        self.client.post("/api/comptes/premium/", HTTP_X_WAYIZE_COMPTE=jeton)

        oubli = self._json("/api/comptes/mot-oublie/", {"email": "mina@exemple.ga"})
        self.assertEqual(oubli.status_code, 200)
        clair = parse_qs(urlparse(oubli.json()["lien"]).query)["reinitialiser"][0]
        neuf = self._json(
            "/api/comptes/mot-nouveau/",
            {"jeton": clair, "mot_de_passe": "nouveau-mot"},
        )
        self.assertEqual(neuf.status_code, 200)
        self.assertNotEqual(neuf.json()["jeton"], jeton)
        ancien = self._json(
            "/api/comptes/connexion/",
            {"email": "mina@exemple.ga", "mot_de_passe": "libreville"},
        )
        self.assertEqual(ancien.status_code, 401)
        jeton = neuf.json()["jeton"]

        cree = self._json(
            "/api/signalements/",
            {
                "type": "accident",
                "commentaire": "Collision légère sur la bretelle vers Lalala.",
                "lieu": "Échangeur IAI",
                "latitude": 0.3709641,
                "longitude": 9.4764893,
            },
            session="sessionmina",
        )
        self.assertEqual(cree.status_code, 201, cree.content)
        pk = cree.json()["signalement"]["id"]
        signe = self._json(
            f"/api/signalements/{pk}/commentaires/",
            {"texte": "La voie de gauche est prise."},
            jeton,
            "sessionmina",
        )
        self.assertEqual(signe.json()["signalement"]["commentaires"][0]["auteur"], "Mina")
        masque = self._json(
            f"/api/signalements/{pk}/commentaires/",
            {"texte": "Je passe quand même.", "anonyme": True},
            jeton,
            "sessionmina",
        )
        self.assertEqual(masque.json()["signalement"]["commentaires"][0]["auteur"], "Un usager")
