"""Lieux connus et emprise du Grand Libreville.

Les coordonnées viennent d'OpenStreetMap (Nominatim), arrondies telles quelles.
"""

SUD = 0.25
OUEST = 9.30
NORD = 0.56
EST = 9.58

CENTRE = {"latitude": 0.408, "longitude": 9.453, "zoom": 13}

LIEUX = [
    {"id": "mont-bouet", "nom": "Mont-Bouët", "latitude": 0.4017445, "longitude": 9.4493184},
    {"id": "quartier-louis", "nom": "Quartier Louis", "latitude": 0.4105973, "longitude": 9.4328279},
    {"id": "petit-paris", "nom": "Petit Paris", "latitude": 0.3966320, "longitude": 9.4501391},
    {"id": "la-peyrie", "nom": "La Peyrie", "latitude": 0.4014526, "longitude": 9.4557605},
    {"id": "nkembo", "nom": "Nkembo", "latitude": 0.4123360, "longitude": 9.4545275},
    {"id": "pk5", "nom": "PK5", "latitude": 0.4065627, "longitude": 9.4677178},
    {"id": "pk8", "nom": "PK8", "latitude": 0.4111531, "longitude": 9.4942390},
    {"id": "universite-omar-bongo", "nom": "Université Omar Bongo", "latitude": 0.4185705, "longitude": 9.4459569},
    {"id": "batterie-iv", "nom": "Batterie IV", "latitude": 0.4192309, "longitude": 9.4287895},
    {"id": "charbonnages", "nom": "Charbonnages", "latitude": 0.4361651, "longitude": 9.4462423},
    {"id": "boulevard-independance", "nom": "Boulevard de l'Indépendance", "latitude": 0.4015821, "longitude": 9.4365442},
    {"id": "chu", "nom": "CHU Jeanne Ebori", "latitude": 0.4069016, "longitude": 9.4336656},
    {"id": "glass", "nom": "Glass", "latitude": 0.3771157, "longitude": 9.4532994},
    {"id": "oloumi", "nom": "Oloumi", "latitude": 0.3709094, "longitude": 9.4574422},
    {"id": "lalala", "nom": "Lalala", "latitude": 0.3626376, "longitude": 9.4688578},
    {"id": "echangeur-iai", "nom": "Échangeur IAI", "latitude": 0.3709641, "longitude": 9.4764893},
    {"id": "mindoube", "nom": "Mindoubé", "latitude": 0.3817274, "longitude": 9.4941872},
    {"id": "nzeng-ayong", "nom": "Nzeng-Ayong", "latitude": 0.4271217, "longitude": 9.4822195},
    {"id": "aeroport", "nom": "Aéroport Léon-Mba", "latitude": 0.4620170, "longitude": 9.4113123},
    {"id": "sabliere", "nom": "Sablière", "latitude": 0.4860783, "longitude": 9.3916070},
    {"id": "akanda", "nom": "Akanda", "latitude": 0.5164243, "longitude": 9.3882201},
    {"id": "stade-angondje", "nom": "Stade d'Angondjé", "latitude": 0.5218802, "longitude": 9.3929359},
    {"id": "angondje", "nom": "Angondjé", "latitude": 0.5288199, "longitude": 9.4143906},
    {"id": "owendo", "nom": "Owendo", "latitude": 0.3208235, "longitude": 9.4952738},
    {"id": "port-owendo", "nom": "Port d'Owendo", "latitude": 0.2867913, "longitude": 9.5047402},
]


def dans_libreville(latitude, longitude):
    return SUD <= latitude <= NORD and OUEST <= longitude <= EST


def lieu_par_id(identifiant):
    for lieu in LIEUX:
        if lieu["id"] == identifiant:
            return lieu
    raise KeyError(identifiant)
