import os
import sys
from pathlib import Path
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase


class ReglagesApiTests(SimpleTestCase):
    def test_prod_module_refuses_a_missing_secret(self):
        with patch.dict(os.environ, {"DJANGO_SECRET_KEY": ""}, clear=False):
            sys.modules.pop("wayize_api.prod", None)
            try:
                with self.assertRaises(ImproperlyConfigured):
                    __import__("wayize_api.prod")
            finally:
                sys.modules.pop("wayize_api.prod", None)

    def test_public_host_does_not_become_the_api_host(self):
        from wayize_api.reglages import hotes

        with patch.dict(
            os.environ,
            {"WAYIZE_HOSTS": "wayize.gabomazone.com", "WAYIZE_API_HOSTS": ""},
            clear=False,
        ):
            self.assertEqual(hotes(True), ["127.0.0.1", "localhost"])
            self.assertEqual(hotes(False), ["*"])

    def test_database_url_selects_postgres_without_logging_the_password(self):
        from wayize_api.reglages import base_de_donnees

        with patch.dict(
            os.environ,
            {"DATABASE_URL": "postgresql://wayize:s%40cret@10.0.0.8:5432/wayize?sslmode=require"},
            clear=False,
        ):
            config = base_de_donnees(Path("/tmp"))["default"]
        self.assertEqual(config["ENGINE"], "django.db.backends.postgresql")
        self.assertEqual(config["NAME"], "wayize")
        self.assertEqual(config["USER"], "wayize")
        self.assertEqual(config["PASSWORD"], "s@cret")
        self.assertEqual(config["HOST"], "10.0.0.8")
        self.assertEqual(config["PORT"], "5432")
        self.assertEqual(config["OPTIONS"]["sslmode"], "require")

    def test_sqlite_remains_the_default_store(self):
        from wayize_api.reglages import base_de_donnees

        with patch.dict(os.environ, {"DATABASE_URL": "", "WAYIZE_SQLITE_PATH": ""}, clear=False):
            config = base_de_donnees(Path("/srv/wayize/backend"))["default"]
        self.assertEqual(config["ENGINE"], "django.db.backends.sqlite3")
        self.assertEqual(config["NAME"], Path("/srv/wayize/backend/db.sqlite3"))

    def test_database_url_rejects_a_non_postgres_scheme(self):
        from wayize_api.reglages import base_de_donnees

        with patch.dict(os.environ, {"DATABASE_URL": "mysql://a:b@localhost/wayize"}, clear=False):
            with self.assertRaises(ImproperlyConfigured) as raised:
                base_de_donnees(Path("/tmp"))
        self.assertNotIn("mysql://", str(raised.exception))
