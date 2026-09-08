"""
========================================================

Fichier :
context.py

Description :

Capture du contexte de la requete HTTP en cours.
Le middleware depose la requete dans un ContextVar (compatible sync et
async/Channels) pour que n'importe quel log emis plus bas dans la pile
soit enrichi automatiquement : endpoint, methode, utilisateur, IP.

Projet :
Zemy

========================================================
"""

import contextvars

from .scrubbing import scrub_data, scrub_text

_current_request = contextvars.ContextVar('zemy_monitoring_request', default=None)


def set_current_request(request):
    """Memorise la requete en cours et retourne le token de restauration."""
    return _current_request.set(request)


def reset_current_request(token):
    try:
        _current_request.reset(token)
    except (ValueError, LookupError):
        # Le token appartient a un autre contexte (worker async) : sans gravite.
        _current_request.set(None)


def get_current_request():
    return _current_request.get()


def client_ip(request):
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('HTTP_X_REAL_IP') or request.META.get('REMOTE_ADDR') or 'inconnu'


def describe_user(request):
    """Identifie l'utilisateur sans jamais exposer d'information sensible."""
    user = getattr(request, 'user', None)
    if user is None:
        return 'inconnu'
    try:
        if not getattr(user, 'is_authenticated', False):
            return 'anonyme'
        label = getattr(user, 'email', None) or getattr(user, 'phone', None) or str(user)
        return f'#{user.pk} ({label})'
    except Exception:
        return 'indeterminable'


def _request_payload(request):
    """Extrait un apercu du corps de la requete, systematiquement masque."""
    try:
        data = getattr(request, 'data', None)
        if data is None:
            if request.method in ('POST', 'PUT', 'PATCH'):
                data = request.POST.dict()
            else:
                data = request.GET.dict()
        if hasattr(data, 'dict'):
            data = data.dict()
        if not data:
            return None
        return scrub_data(dict(data))
    except Exception:
        return None


def build_request_context(request=None):
    """Construit le dictionnaire de contexte joint a chaque alerte."""
    request = request or get_current_request()
    if request is None:
        return {}

    try:
        return {
            'method': getattr(request, 'method', '?'),
            'path': scrub_text(getattr(request, 'path', '?')),
            'query': scrub_text(request.META.get('QUERY_STRING', '')) or None,
            'user': describe_user(request),
            'ip': client_ip(request),
            'user_agent': (request.META.get('HTTP_USER_AGENT', '') or '')[:180] or None,
            'payload': _request_payload(request),
        }
    except Exception:
        return {}


REQUEST_REPORTED_FLAG = '_zemy_monitoring_reported_request'


def mark_request_reported(request):
    """Marque la requete comme deja signalee, pour ne pas doubler l'alerte
    entre le handler DRF, le middleware et le controle des reponses 5xx."""
    try:
        setattr(request, REQUEST_REPORTED_FLAG, True)
    except Exception:
        pass


def request_already_reported(request):
    return bool(getattr(request, REQUEST_REPORTED_FLAG, False))
