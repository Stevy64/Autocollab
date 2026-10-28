"""Mot de passe et jeton. Ni l'un ni l'autre ne sont journalisés."""

import hashlib
import hmac
import re
import secrets

_EMAIL = re.compile(r"^[^@\s]{1,80}@[^@\s]{1,80}\.[^@\s]{2,24}$")
_JETON = re.compile(r"^[a-f0-9]{32}$")


def email_propre(valeur):
    if not isinstance(valeur, str):
        return ""
    propre = valeur.strip().lower()
    if not _EMAIL.match(propre):
        return ""
    return propre


def mot_valide(valeur):
    return isinstance(valeur, str) and 8 <= len(valeur) <= 72


def chiffrer(mot, sel=None):
    sel = sel or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", mot.encode("utf-8"), sel.encode("ascii"), 120_000)
    return f"pbkdf2${sel}${digest.hex()}"


def correspond(mot, stocke):
    try:
        algo, sel, _digest = stocke.split("$", 2)
    except ValueError:
        return False
    if algo != "pbkdf2" or not mot_valide(mot):
        return False
    return hmac.compare_digest(chiffrer(mot, sel), stocke)


def nouveau_jeton():
    return secrets.token_hex(16)


def jeton_entete(request):
    brut = request.headers.get("X-Wayize-Compte", "")
    if not _JETON.match(brut):
        return ""
    return brut
