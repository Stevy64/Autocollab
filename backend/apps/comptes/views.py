import re

from django.conf import settings
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from apps.http import erreur, lire_json, protege, reponse, texte_propre
from apps.pilotage.reglages import lire as lire_reglages
from apps.journal import journal, request_id
from apps.lieux.catalogue import plier
from apps.lieux.models import Lieu
from apps.signalements.geo import LIEUX

from .courriel import envoyer
from .models import Compte, JetonCourriel, Liste, Suivi
from .present import presenter
from .secrets import correspond, chiffrer, email_propre, jeton_entete, mot_valide, nouveau_jeton

_PSEUDO = re.compile(r"^[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9' -]{1,19}$")

_LIEUX = {lieu["id"] for lieu in LIEUX}
_LISTES_MAX = 6
_LIEUX_MAX = 15
_MESSAGE_COURRIEL = "Si un compte correspond à cette adresse, un message vient de partir."


def lieu_connu(identifiant):
    if not identifiant or len(identifiant) > 80:
        return False
    if identifiant in _LIEUX:
        return True
    return Lieu.objects.filter(slug=identifiant).exists()


def _reponse_lien(message, url, status=200, **reste):
    corps = {"message": message, **reste}
    if settings.DEBUG:
        corps["lien"] = url
    return reponse(corps, status=status)


def _pseudo(valeur, compte=None):
    texte = texte_propre(valeur)
    if not texte:
        return "", None, None
    if not _PSEUDO.match(texte):
        return None, None, "2 à 20 caractères : lettres, chiffres, espace, apostrophe ou trait d'union."
    cle = plier(texte)[:24]
    pris = Compte.objects.filter(pseudo_cle=cle)
    if compte is not None:
        pris = pris.exclude(pk=compte.pk)
    if pris.exists():
        return None, None, "Ce pseudo est déjà pris."
    return texte, cle, None


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
    if not lire_reglages()["inscriptions_ouvertes"]:
        return erreur("Les inscriptions sont fermées pour le moment.", status=403)
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
    pseudo, cle, plainte = _pseudo(data.get("pseudo"))
    if plainte:
        return erreur(plainte, champs={"pseudo": plainte})
    compte = Compte.objects.create(
        email=email,
        secret=chiffrer(mot),
        jeton=nouveau_jeton(),
        pseudo=pseudo,
        pseudo_cle=cle,
    )
    url = envoyer(compte, JetonCourriel.CONFIRMATION, request_id(request))
    journal("comptes", "compte.created", request_id=request_id(request), compte_id=compte.id)
    return _reponse_lien(
        "Confirmez votre adresse pour ouvrir le compte.",
        url,
        status=201,
        email=email,
    )


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
    if not compte.confirme_le:
        return erreur("Confirmez votre adresse email avant de vous connecter.", status=403)
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
    if not lieu_connu(lieu_id):
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


def _ouvrir(compte):
    if not compte.confirme_le:
        compte.confirme_le = timezone.now()
    if not compte.jeton:
        compte.jeton = nouveau_jeton()
    compte.save(update_fields=["confirme_le", "jeton"])
    return reponse({"compte": presenter(compte), "jeton": compte.jeton})


@protege("comptes")
@require_http_methods(["POST"])
def confirmer(request):
    data, message = lire_json(request)
    if message:
        return erreur(message)
    clair = data.get("jeton") if isinstance(data.get("jeton"), str) else ""
    from .courriel import consommer

    compte = consommer(JetonCourriel.CONFIRMATION, clair)
    if compte is None:
        return erreur("Ce lien de confirmation n'est plus valable.", status=400)
    journal("comptes", "compte.confirmed", request_id=request_id(request), compte_id=compte.id)
    return _ouvrir(compte)


@protege("comptes")
@require_http_methods(["POST"])
def renvoyer(request):
    data, message = lire_json(request)
    if message:
        return erreur(message)
    email = email_propre(data.get("email"))
    compte = Compte.objects.filter(email=email, confirme_le__isnull=True).first() if email else None
    url = ""
    if compte is not None:
        url = envoyer(compte, JetonCourriel.CONFIRMATION, request_id(request))
    if url and settings.DEBUG:
        return _reponse_lien(_MESSAGE_COURRIEL, url)
    return reponse({"message": _MESSAGE_COURRIEL})


@protege("comptes")
@require_http_methods(["POST"])
def mot_oublie(request):
    data, message = lire_json(request)
    if message:
        return erreur(message)
    email = email_propre(data.get("email"))
    compte = Compte.objects.filter(email=email).first() if email else None
    url = ""
    if compte is not None:
        url = envoyer(compte, JetonCourriel.REINITIALISATION, request_id(request))
        journal("comptes", "mot.requested", request_id=request_id(request), compte_id=compte.id)
    if url and settings.DEBUG:
        return _reponse_lien(_MESSAGE_COURRIEL, url)
    return reponse({"message": _MESSAGE_COURRIEL})


@protege("comptes")
@require_http_methods(["POST"])
def mot_nouveau(request):
    data, message = lire_json(request)
    if message:
        return erreur(message)
    mot = data.get("mot_de_passe")
    if not mot_valide(mot):
        return erreur("8 caractères minimum, 72 maximum.", champs={"mot_de_passe": "8 caractères minimum, 72 maximum."})
    clair = data.get("jeton") if isinstance(data.get("jeton"), str) else ""
    from .courriel import consommer

    compte = consommer(JetonCourriel.REINITIALISATION, clair)
    if compte is None:
        return erreur("Ce lien n'est plus valable. Demandez-en un nouveau.", status=400)
    compte.secret = chiffrer(mot)
    compte.jeton = nouveau_jeton()
    if not compte.confirme_le:
        compte.confirme_le = timezone.now()
    compte.save(update_fields=["secret", "jeton", "confirme_le"])
    journal("comptes", "mot.changed", request_id=request_id(request), compte_id=compte.id)
    return reponse({"compte": presenter(compte), "jeton": compte.jeton})


@protege("comptes")
@require_http_methods(["POST"])
def profil(request):
    compte, refus = _exiger(request)
    if refus:
        return refus
    data, message = lire_json(request)
    if message:
        return erreur(message)
    champs = []
    if "pseudo" in data:
        pseudo, cle, plainte = _pseudo(data.get("pseudo"), compte)
        if plainte:
            return erreur(plainte, champs={"pseudo": plainte})
        compte.pseudo = pseudo
        compte.pseudo_cle = cle
        champs.extend(["pseudo", "pseudo_cle"])
    if "anonyme" in data:
        compte.anonyme = data.get("anonyme") is True
        champs.append("anonyme")
    for cle_lieu in ("domicile_id", "travail_id"):
        if cle_lieu not in data:
            continue
        valeur = texte_propre(data.get(cle_lieu))
        if valeur and not lieu_connu(valeur):
            return erreur("Ce lieu n'est pas un quartier connu.", champs={cle_lieu: "Lieu inconnu."})
        setattr(compte, cle_lieu, valeur)
        champs.append(cle_lieu)
    if champs:
        compte.save(update_fields=champs)
    return reponse({"compte": presenter(compte)})
