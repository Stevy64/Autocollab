import json

from django.test import TestCase

from apps.comptes.models import Compte


class CompteTests(TestCase):
    def _json(self, url, payload, jeton=""):
        headers = {}
        if jeton:
            headers["HTTP_X_WAYIZE_COMPTE"] = jeton
        return self.client.post(
            url,
            data=json.dumps(payload),
            content_type="application/json",
            **headers,
        )

    def test_signup_login_and_premium_lists(self):
        created = self._json(
            "/api/comptes/inscription/",
            {"email": "Awa@Exemple.GA", "mot_de_passe": "libreville"},
        )
        self.assertEqual(created.status_code, 201)
        jeton = created.json()["jeton"]
        self.assertEqual(created.json()["compte"]["email"], "awa@exemple.ga")
        self.assertFalse(created.json()["compte"]["premium"])
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
