"""Identité anonyme transmise par le frontal. La valeur n'est jamais journalisée."""

import re

_CLE = re.compile(r"^[A-Za-z0-9]{8,64}$")


def cle_session(request):
    brute = request.headers.get("X-Wayize-Session", "")
    if not _CLE.match(brute):
        return ""
    return brute
