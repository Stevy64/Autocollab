import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

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
        self._send(404, {"message": "introuvable"})

    def do_POST(self):
        self._noter()
        length = int(self.headers.get("Content-Length", "0") or 0)
        self.rfile.read(length)
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
        self.assertIn("wayize-shell-v2", source)
        self.assertIn("wayize-tiles-v3", source)
        self.assertIn("tile.openstreetmap.fr", source)
        self.assertNotIn("tile.openstreetmap.org", source)

        script = (Path(__file__).resolve().parent / "static" / "trafic" / "js" / "app.js").read_text(encoding="utf-8")
        self.assertIn("tile.openstreetmap.fr/osmfr/", script)
        self.assertNotIn("tile.openstreetmap.org", script)
        self.assertIn("Confirmé", script)
        self.assertIn("Confirmer", script)
        self.assertNotIn("Appuyé", script)
        self.assertNotIn("Appuyer", script)
        self.assertIn("search-toggle", script)

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
