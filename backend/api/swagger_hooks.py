"""
========================================================

Fichier :
swagger_hooks.py

Description :

Module de l'application Zemy.

Projet :
Zemy

========================================================
"""
def custom_tag_hook(result, generator, request, public):
    tag_map = {
        "user": "Utilisateurs",
        "ride": "Trajets",
        "booking": "Réservations",
        "vehicle": "Conducteurs",
        "parcel": "Colis",
        "transaction": "Paiements",
        "refundrequest": "Paiements",
        "financialsettings": "Administration",
        "mobilesettings": "Administration",
        "promotion": "Administration",
        "message": "Messages",
        "conversation": "Messages",
        "notification": "Notifications",
        "verificationrequest": "Vérification des comptes",
        "login": "Authentification",
        "register": "Authentification",
        "dashboard_stats": "Statistiques"
    }
    for path, path_obj in result.get("paths", {}).items():
        for method, operation in path_obj.items():
            new_tags = []
            for tag in operation.get("tags", []):
                matched = False
                for key, val in tag_map.items():
                    if key in tag.lower() or key in path.lower() or key in operation.get("operationId", "").lower():
                        if val not in new_tags:
                            new_tags.append(val)
                        matched = True
                if not matched:
                    new_tags.append(tag)
            operation["tags"] = new_tags
    return result
