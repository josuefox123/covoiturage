"""
========================================================

Fichier :
scrubbing.py

Description :

Masquage des donnees sensibles avant envoi vers Slack.
Aucun mot de passe, token JWT, OTP, secret FeexPay ou numero de carte
ne doit sortir du backend vers un canal tiers.

Projet :
Zemy

========================================================
"""

import re

REDACTED = '***REDACTE***'

# Cles dont la valeur est systematiquement masquee (comparaison insensible a la casse).
SENSITIVE_KEYS = (
    'password', 'passwd', 'mot_de_passe', 'new_password', 'old_password',
    'token', 'access', 'refresh', 'authorization', 'auth', 'jwt',
    'secret', 'api_key', 'apikey', 'private_key', 'signature',
    'otp', 'code_otp', 'verification_code', 'pin',
    'card', 'carte', 'cvv', 'cvc', 'card_number', 'iban',
    'sessionid', 'csrftoken', 'cookie', 'set-cookie',
)

# Motifs a neutraliser directement dans les chaines de texte (messages, tracebacks).
_PATTERNS = (
    # JWT (header.payload.signature)
    (re.compile(r'\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}'), REDACTED),
    # En-tete Bearer
    (re.compile(r'(?i)\bBearer\s+[A-Za-z0-9._\-]{8,}'), 'Bearer ' + REDACTED),
    # Webhook Slack (ne jamais reafficher notre propre secret)
    (re.compile(r'https://hooks\.slack\.com/services/[A-Za-z0-9/]+'), REDACTED),
    # Cle=valeur sensible dans une chaine libre
    (re.compile(r'(?i)\b(password|token|secret|api[_-]?key|otp)\b\s*[:=]\s*[^\s,;)\'"]+'), r'\1=' + REDACTED),
    # Numero de carte (13 a 19 chiffres, avec ou sans separateurs)
    (re.compile(r'\b(?:\d[ -]?){13,19}\b'), REDACTED),
)


def scrub_text(value):
    """Neutralise les secrets reperables dans une chaine libre."""
    if not isinstance(value, str) or not value:
        return value
    for pattern, replacement in _PATTERNS:
        try:
            value = pattern.sub(replacement, value)
        except Exception:
            continue
    return value


def _is_sensitive_key(key):
    lowered = str(key).lower()
    return any(marker in lowered for marker in SENSITIVE_KEYS)


def scrub_data(data, _depth=0):
    """Parcourt recursivement dict/list/tuple et masque les valeurs sensibles."""
    if _depth > 6:
        return '...'

    if isinstance(data, dict):
        cleaned = {}
        for key, value in data.items():
            if _is_sensitive_key(key):
                cleaned[key] = REDACTED
            else:
                cleaned[key] = scrub_data(value, _depth + 1)
        return cleaned

    if isinstance(data, (list, tuple)):
        return [scrub_data(item, _depth + 1) for item in data[:20]]

    if isinstance(data, str):
        return scrub_text(data)

    return data


def truncate(text, limit):
    """Tronque proprement une chaine pour respecter les limites Slack."""
    if not isinstance(text, str):
        text = str(text)
    if len(text) <= limit:
        return text
    return text[:max(limit - 20, 0)] + '\n... [tronque]'
