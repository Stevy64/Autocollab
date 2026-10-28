from django.views.decorators.http import require_http_methods

from apps.http import erreur, lire_json, protege, reponse, texte_propre
from apps.journal import journal, request_id
from apps.signalements.geo import LIEUX

from .models import Compte, Liste, Suivi
from .present import presenter
from .secrets import correspond, chiffrer, email_propre, jeton_entete, mot_valide, nouveau_jeton

_LIEUX = {lieu["id"] for lieu in LIEUX}
_LISTES_MAX = 6
_LIEUX_MAX = 15


def _compte(request):
    jeton = jeton_entete(request)
    if not jeton:
        return None
    return Compte.objects.filter(jeton=jeton).first()


def _exiger(request):
    compte = _compte(request)
    if compte is None:
        return None, erreur("Connectez-vous pour continuer.", status=401)
    return compte, None


@protege("comptes")
@require_http_methods(["POST"])
def inscription(request):
    data, message = lire_json(request)
    if message:
        return erreur(message)
    email = email_propre(data.get("email"))
    mot = data.get("mot_de_passe")
    champs = {}
    if not email:
        champs["email"] = "Indiquez un email valide."
    if not mot_valide(mot):
        champs["mot_de_passe"] = "8 caractères minimum, 72 maximum."
    if champs:
        return erreur("Le compte n'a pas pu être créé.", champs=champs)
    if Compte.objects.filter(email=email).exists():
        return erreur("Un compte existe déjà avec cet email.", status=409)
    compte = Compte.objects.create(email=email, secret=chiffrer(mot), jeton=nouveau_jeton())
    journal("comptes", "compte.created", request_id=request_id(request), compte_id=compte.id)
    return reponse({"compte": presenter(compte), "jeton": compte.jeton}, status=201)


@protege("comptes")
@require_http_methods(["POST"])
def connexion(request):
    data, message = lire_json(request)
    if message:
        return erreur(message)
    email = email_propre(data.get("email"))
    mot = data.get("mot_de_passe") if isinstance(data.get("mot_de_passe"), str) else ""
    compte = Compte.objects.filter(email=email).first() if email else None
    if compte is None or not correspond(mot, compte.secret):
        return erreur("Email ou mot de passe incorrect.", status=401)
    if not compte.jeton:
        compte.jeton = nouveau_jeton()
        compte.save(update_fields=["jeton"])
    journal("comptes", "compte.login", request_id=request_id(request), compte_id=compte.id)
    return reponse({"compte": presenter(compte), "jeton": compte.jeton})


@protege("comptes")
@require_http_methods(["GET"])
def moi(request):
    compte, refus = _exiger(request)
    if refus:
        return refus
    return reponse({"compte": presenter(compte)})


@protege("comptes")
@require_http_methods(["POST"])
def premium(request):
    compte, refus = _exiger(request)
    if refus:
        return refus
    if not compte.premium:
        compte.premium = True
        compte.save(update_fields=["premium"])
        journal("comptes", "premium.activated", request_id=request_id(request), compte_id=compte.id)
    return reponse({"compte": presenter(compte)})


@protege("comptes")
@require_http_methods(["GET", "POST"])
def listes(request):
    compte, refus = _exiger(request)
    if refus:
        return refus
    if request.method == "GET":
        return reponse({"listes": presenter(compte)["listes"]})
    if not compte.premium:
        return erreur("Premium est nécessaire pour suivre des lieux.", status=402)
    if compte.listes.count() >= _LISTES_MAX:
        return erreur(f"{_LISTES_MAX} listes maximum.")
    data, message = lire_json(request)
    if message:
        return erreur(message)
    nom = texte_propre(data.get("nom"))
    if not 2 <= len(nom) <= 40:
        return erreur("Donnez un nom de 2 à 40 caractères.", champs={"nom": "Nom trop court ou trop long."})
    liste = Liste.objects.create(compte=compte, nom=nom)
    journal("comptes", "liste.created", request_id=request_id(request), compte_id=compte.id, liste_id=liste.id)
    return reponse({"compte": presenter(compte)}, status=201)


@protege("comptes")
@require_http_methods(["DELETE"])
def liste_detail(request, pk):
    compte, refus = _exiger(request)
    if refus:
        return refus
    liste = compte.listes.filter(pk=pk).first()
    if liste is None:
        return erreur("Liste introuvable.", status=404)
    liste.delete()
    return reponse({"compte": presenter(compte)})


@protege("comptes")
@require_http_methods(["POST"])
def ajouter_lieu(request, pk):
    compte, refus = _exiger(request)
    if refus:
        return refus
    if not compte.premium:
        return erreur("Premium est nécessaire pour suivre des lieux.", status=402)
    liste = compte.listes.filter(pk=pk).first()
    if liste is None:
        return erreur("Liste introuvable.", status=404)
    if liste.suivis.count() >= _LIEUX_MAX:
        return erreur(f"{_LIEUX_MAX} lieux maximum par liste.")
    data, message = lire_json(request)
    if message:
        return erreur(message)
    lieu_id = texte_propre(data.get("lieu_id"))
    if lieu_id not in _LIEUX:
        return erreur("Ce lieu n'est pas un quartier connu.", champs={"lieu_id": "Lieu inconnu."})
    Suivi.objects.get_or_create(liste=liste, lieu_id=lieu_id)
    return reponse({"compte": presenter(compte)})


@protege("comptes")
@require_http_methods(["DELETE"])
def retirer_lieu(request, pk, lieu_id):
    compte, refus = _exiger(request)
    if refus:
        return refus
    liste = compte.listes.filter(pk=pk).first()
    if liste is None:
        return erreur("Liste introuvable.", status=404)
    liste.suivis.filter(lieu_id=lieu_id).delete()
    return reponse({"compte": presenter(compte)})
