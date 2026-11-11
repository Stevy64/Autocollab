#!/usr/bin/env python3
"""Génère une paire VAPID locale pour Web Push. N'écrit jamais dans le dépôt git.

Usage (venv activé, pywebpush déjà installé) :

    python deploy/generate_vapid_keys.py

Alternative Node : npx web-push generate-vapid-keys

Les clés partent dans deploy/vapid.local.env (gitignoré). Ne committez pas
la clé privée. Exportez les variables avant de lancer l'API.
"""

from __future__ import annotations

import base64
import sys
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def main() -> int:
    cible = Path(__file__).resolve().parent / "vapid.local.env"
    private = ec.generate_private_key(ec.SECP256R1())
    public = private.public_key()
    private_b64 = _b64url(
        private.private_numbers().private_value.to_bytes(32, "big")
    )
    public_b64 = _b64url(
        public.public_bytes(
            encoding=serialization.Encoding.X962,
            format=serialization.PublicFormat.UncompressedPoint,
        )
    )
    contenu = (
        "# Local/dev only — never commit.\n"
        f"WAYIZE_VAPID_PUBLIC_KEY={public_b64}\n"
        f"WAYIZE_VAPID_PRIVATE_KEY={private_b64}\n"
        "WAYIZE_VAPID_SUBJECT=mailto:dev@wayize.local\n"
    )
    cible.write_text(contenu, encoding="utf-8")
    print(f"Écrit {cible}")
    print("Public :", public_b64)
    print("Privée : conservée dans le fichier (ne pas committer).")
    print("PowerShell avant l'API :")
    print(
        r'  Get-Content deploy\vapid.local.env | ForEach-Object {'
        r' if ($_ -match "^([^#=]+)=(.*)$") { Set-Item "env:$($matches[1])" $matches[2] } }'
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ImportError:
        print(
            "cryptography manquant. pip install pywebpush, ou :\n"
            "  npx web-push generate-vapid-keys",
            file=sys.stderr,
        )
        raise SystemExit(1)
