import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, override_settings


class _Api(BaseHTTPRequestHandler):
    vu = {}

    def _send(self, status, payload):
        brut = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(brut)))
        self.end_headers()
        self.wfile.write(brut)

    def _noter(self):
        _Api.vu = {
            "path": self.path,
            "session": self.headers.get("X-Wayize-Session", ""),
            "request_id": self.headers.get("X-Request-Id", ""),
            "cookie": self.headers.get("Cookie", ""),
            "authorization": self.headers.get("Authorization", ""),
        }

    def do_GET(self):
        self._noter()
        if self.path.startswith("/api/carte/"):
            self._send(
                200,
                {
                    "lieux": [
                        {
                            "id": "mont-bouet",
                            "nom": "Mont-Bouët",
                            "latitude": 0.4017445,
                            "longitude": 9.4493184,
                        }
                    ],
                    "types": [{"id": "bouchon", "label": "Bouchon"}],
                    "centre": {"latitude": 0.408, "longitude": 9.453, "zoom": 13},
                    "bornes": {"sud": 0.25, "ouest": 9.3, "nord": 0.56, "est": 9.58},
                },
            )
            return
        if self.path.startswith("/api/signalements/"):
            self._send(
                200,
                {"signalements": [], "tendance": {"niveau": "fluide", "titre": "Circulation fluide"}},
            )
            return
        if self.path.startswith("/api/sante/"):
            self._send(200, {"service": "api", "ok": True})
            return
        if self.path.startswith("/api/admin/apercu"):
            self._send(
                200,
                {
                    "signalements": 3,
                    "comptes": 1,
                    "premium": 0,
                    "admins": 1,
                    "appuis": 4,
                    "degages": 1,
                    "en_retrait": 0,
                    "par_type": [{"id": "bouchon", "label": "Bouchon", "n": 2}],
                    "semaine": [{"label": "mer.", "n": 2, "pct": 100, "date": "2026-10-28"}],
                    "reglages": {"duree_heures": 3, "seuil_degage": 2, "plafond_heure": 8},
                },
            )
            return
        self._send(404, {"message": "introuvable"})

    def do_POST(self):
        self._noter()
        length = int(self.headers.get("Content-Length", "0") or 0)
        self.rfile.read(length)
        if self.path.startswith("/api/admin/entree"):
            self._send(
                200,
                {
                    "compte": {
                        "id": 7,
                        "email": "ada@wayize.ga",
                        "est_admin": True,
                        "premium": False,
                    },
                    "jeton": "0123456789abcdef0123456789abcdef",
                },
            )
            return
        self._send(201, {"signalement": {"id": 1, "lieu": "Glass"}})

    def log_message(self, fmt, *args):
        return


class WebSliceTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), _Api)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        port = cls.server.server_address[1]
        cls.override = override_settings(API_UPSTREAM=f"http://127.0.0.1:{port}")
        cls.override.enable()

    @classmethod
    def tearDownClass(cls):
        cls.override.disable()
        cls.server.shutdown()
        cls.server.server_close()
        super().tearDownClass()

    def test_home_is_french_and_installable(self):
        with self.assertLogs("wayize", level="INFO") as captured:
            response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Wayizé")
        self.assertContains(response, "Libreville")
        self.assertContains(response, "/manifest.webmanifest")
        self.assertContains(response, "mont-bouet")
        journal = "\n".join(captured.output)
        self.assertIn("boundary.call", journal)
        self.assertIn("/api/carte/", journal)
        self.assertNotIn(_Api.vu["session"], journal)
        self.assertNotIn("dev-only-wayize", journal)
        self.assertTrue(_Api.vu["session"])
        self.assertEqual(_Api.vu["cookie"], "")

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
        self.assertEqual(worker["Service-Worker-Allowed"], "/")
        source = b"".join(worker.streaming_content).decode("utf-8")
        self.assertIn("wayize-shell-v7", source)
        self.assertIn("app.js?v=20261112a", source)
        self.assertIn("wayize-tiles-v3", source)
        self.assertIn("notificationclick", source)
        self.assertIn('addEventListener("push"', source)
        self.assertNotIn("tile.openstreetmap.org", source)
        self.assertNotIn("server.arcgisonline.com", source)

        script = (Path(__file__).resolve().parent / "static" / "trafic" / "js" / "app.js").read_text(encoding="utf-8")
        self.assertIn("World_Imagery/MapServer/tile/", script)
        self.assertIn("https://tile.openstreetmap.org/{z}/{x}/{y}.png", script)
        self.assertNotIn("World_Street_Map", script)
        self.assertNotIn("World_Topo_Map", script)
        style = (Path(__file__).resolve().parent / "static" / "trafic" / "css" / "app.css").read_text(encoding="utf-8")
        self.assertNotIn("contrast(1.25) saturate(2) brightness(0.82)", style)
        self.assertNotIn("tile.openstreetmap.fr/osmfr/", script)
        self.assertIn("×${n}", script)
        self.assertIn("wayize.memoire.v1", script)
        self.assertIn("Activer Premium", script)
        self.assertIn("Les autres usagers de la route", script)
        self.assertIn("pin-count", script)
        self.assertIn("tendance-panel", script)
        self.assertIn("usagers confirment", script)
        self.assertIn("C'est dégagé", script)
        self.assertIn("lieu-saisie", script)
        self.assertIn("lieux-connus", script)
        self.assertIn('uiIcon("alarm")', script)
        self.assertIn("beforeinstallprompt", script)
        self.assertIn("await evenement.prompt()", script)
        self.assertIn("navigator.share", script)
        self.assertIn("showNotification", script)
        self.assertIn("demanderNotifications", script)
        self.assertIn("lireVapidPublic", script)
        self.assertIn("invitePushHtml", script)
        self.assertIn("assurerPushEtat", script)
        self.assertIn("desabonnerPush", script)
        self.assertIn('data-reglage="pushTel"', script)
        self.assertIn('id="push-route"', script)
        self.assertIn("Recevez une alerte quand quelque chose se passe sur la route.", script)
        self.assertNotIn("Sans compte. Alerte système quand un signalement sort", script)
        self.assertIn("/api/notifications/etat/", script)
        self.assertIn("/api/notifications/abonnement/", script)
        self.assertIn("actif: false", script)
        html = (Path(__file__).resolve().parent / "templates" / "trafic" / "index.html").read_text(encoding="utf-8")
        self.assertIn("app.js' %}?v=20261112a", html)
        self.assertIn("app.css' %}?v=20261112a", html)
        self.assertIn('data-action="share"', script)
        self.assertIn('label: "Commentaire"', script)
        self.assertIn('court: "Com"', script)
        self.assertIn("sheet-toggle", script)
        self.assertIn("brand-home", script)
        self.assertIn("/position/", script)
        self.assertNotIn('label: "Phrase"', script)
        self.assertIn('href="/admin/"', script)
        self.assertIn("state.compte.est_admin", script)
        self.assertNotIn("conducteurs confirment", script)
        self.assertNotIn("${n}×", script)
        self.assertNotIn("déjà confirmé", script)

    def test_proxy_forwards_the_anonymous_session_not_the_cookie(self):
        with self.assertLogs("wayize", level="INFO") as captured:
            response = self.client.post(
                "/api/signalements/",
                data=json.dumps({"type": "bouchon"}),
                content_type="application/json",
            )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["signalement"]["lieu"], "Glass")
        self.assertEqual(_Api.vu["path"].split("?")[0], "/api/signalements/")
        self.assertTrue(_Api.vu["session"])
        self.assertEqual(_Api.vu["cookie"], "")
        self.assertEqual(_Api.vu["authorization"], "")
        self.assertIn("boundary.call", "\n".join(captured.output))
        self.assertNotIn(_Api.vu["session"], "\n".join(captured.output))

    def test_icons_are_shipped(self):
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

    def test_admin_console_keeps_the_token_out_of_the_page(self):
        jeton = "0123456789abcdef0123456789abcdef"
        porte = self.client.get("/admin/connexion/")
        self.assertEqual(porte.status_code, 200)
        self.assertContains(porte, "premier compte")
        self.assertContains(porte, "Identifiant")
        self.assertContains(porte, "wa-field")
        self.assertContains(porte, "Entrer")
        self.assertNotContains(porte, jeton)
        accueil = self.client.get("/admin/")
        self.assertEqual(accueil.status_code, 302)
        self.assertIn("/admin/connexion/", accueil["Location"])

        with self.assertLogs("wayize", level="INFO") as captured:
            entree = self.client.post(
                "/admin/connexion/",
                {"email": "ada@wayize.ga", "mot_de_passe": "libreville"},
            )
        self.assertEqual(entree.status_code, 302)
        self.assertNotIn(jeton, entree.content.decode())
        journal = "\n".join(captured.output)
        self.assertNotIn(jeton, journal)
        self.assertNotIn("libreville", journal)

        board = self.client.get("/admin/")
        self.assertEqual(board.status_code, 200)
        self.assertContains(board, "Vue d’ensemble")
        self.assertContains(board, "ada@wayize.ga")
        self.assertNotContains(board, jeton)
        self.assertEqual(board["Cache-Control"], "no-store")

        self.client.post("/admin/sortie/")
        ferme = self.client.get("/admin/")
        self.assertEqual(ferme.status_code, 302)


class ProdSettingsTests(SimpleTestCase):
    def test_dev_module_stays_the_default(self):
        self.assertEqual(settings.SETTINGS_MODULE, "wayize_web.settings")
        self.assertIsNone(settings.SECURE_PROXY_SSL_HEADER)

    def test_prod_module_refuses_a_missing_secret(self):
        with patch.dict(os.environ, {"DJANGO_SECRET_KEY": ""}, clear=False):
            sys.modules.pop("wayize_web.prod", None)
            try:
                with self.assertRaises(ImproperlyConfigured):
                    __import__("wayize_web.prod")
            finally:
                sys.modules.pop("wayize_web.prod", None)

    def test_public_host_and_origin_defaults(self):
        from wayize_web.reglages import hotes, origines, securite_proxy

        with patch.dict(os.environ, {"WAYIZE_HOSTS": "", "WAYIZE_CSRF_ORIGINS": ""}, clear=False):
            self.assertEqual(hotes(False), ["*"])
            self.assertEqual(hotes(True), ["wayize.gabomazone.com"])
            self.assertEqual(origines(False), [])
            self.assertEqual(origines(True), ["https://wayize.gabomazone.com"])
        self.assertEqual(securite_proxy()["SECURE_PROXY_SSL_HEADER"], ("HTTP_X_FORWARDED_PROTO", "https"))
        self.assertFalse(securite_proxy()["SECURE_SSL_REDIRECT"])
