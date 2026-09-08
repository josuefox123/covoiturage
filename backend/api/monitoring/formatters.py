"""
========================================================

Fichier :
formatters.py

Description :

Construction du payload Slack (Block Kit) a partir d'une alerte Zemy.
Le rendu est concu pour etre lisible en un coup d'oeil sur mobile :
bandeau colore par severite, faits essentiels en colonnes, puis
message / payload / traceback en blocs de code repliables.

Projet :
Zemy

========================================================
"""

from datetime import datetime, timezone

from . import config
from .scrubbing import scrub_text, truncate

# Limites imposees par l'API Slack.
SECTION_TEXT_LIMIT = 2900
HEADER_TEXT_LIMIT = 150
FIELD_TEXT_LIMIT = 1900

LEVEL_STYLES = {
    'CRITICAL': {'emoji': ':rotating_light:', 'color': '#8B0000', 'label': 'CRITIQUE'},
    'ERROR': {'emoji': ':x:', 'color': '#E01E5A', 'label': 'ERREUR'},
    'WARNING': {'emoji': ':warning:', 'color': '#ECB22E', 'label': 'AVERTISSEMENT'},
    'INFO': {'emoji': ':information_source:', 'color': '#2EB67D', 'label': 'INFO'},
    'SLOW': {'emoji': ':hourglass_flowing_sand:', 'color': '#ECB22E', 'label': 'LENTEUR'},
}

SOURCE_LABELS = {
    'http': 'Requete HTTP',
    'drf': 'API (DRF)',
    'celery': 'Tache Celery',
    'log': 'Journal applicatif',
    'websocket': 'WebSocket',
    'thread': 'Tache de fond',
    'manual': 'Signalement manuel',
    'test': 'Test de configuration',
}


def _style(level):
    return LEVEL_STYLES.get(str(level).upper(), LEVEL_STYLES['ERROR'])


def _section(text):
    return {'type': 'section', 'text': {'type': 'mrkdwn', 'text': truncate(text, SECTION_TEXT_LIMIT)}}


def _code_section(title, body, limit=SECTION_TEXT_LIMIT):
    if not body:
        return None
    body = truncate(str(body), max(limit - len(title) - 20, 200))
    return _section(f'*{title}*\n```{body}```')


def _fields_block(pairs):
    fields = []
    for label, value in pairs:
        if value in (None, '', 'None'):
            continue
        fields.append({
            'type': 'mrkdwn',
            'text': truncate(f'*{label}*\n{value}', FIELD_TEXT_LIMIT),
        })
    if not fields:
        return None
    # Slack n'accepte que 10 champs par section.
    return {'type': 'section', 'fields': fields[:10]}


def _format_payload(payload):
    if not payload:
        return None
    try:
        import json
        return json.dumps(payload, ensure_ascii=False, indent=2, default=str)
    except Exception:
        return str(payload)


def _location(alert):
    """Resume l'origine de l'alerte : endpoint, tache ou module."""
    ctx = alert.get('context') or {}
    source = alert.get('source', 'log')

    if source in ('http', 'drf') and ctx.get('method'):
        return f"`{ctx['method']} {ctx.get('path', '?')}`"
    if alert.get('location'):
        return f"`{alert['location']}`"
    if alert.get('logger'):
        return f"`{alert['logger']}`"
    return SOURCE_LABELS.get(source, source)


def build_payload(alert):
    """Transforme une alerte normalisee en corps de requete pour le webhook Slack."""
    level = str(alert.get('level', 'ERROR')).upper()
    style = _style(level)
    ctx = alert.get('context') or {}

    env = config.environment()
    service = config.service_name()
    title = scrub_text(alert.get('title') or 'Erreur non identifiee')

    header = truncate(f"{style['emoji']} {style['label']} — {title}", HEADER_TEXT_LIMIT)
    stamp = datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M:%S UTC')

    blocks = [
        {'type': 'header', 'text': {'type': 'plain_text', 'text': header, 'emoji': True}},
    ]

    facts = _fields_block([
        ('Environnement', f'`{env}`'),
        ('Service', f'`{service}`'),
        ('Origine', _location(alert)),
        ('Type', f"`{alert.get('exception_type')}`" if alert.get('exception_type') else None),
        ('Statut HTTP', alert.get('status_code')),
        ('Utilisateur', ctx.get('user')),
        ('Adresse IP', ctx.get('ip')),
        ('Horodatage', stamp),
    ])
    if facts:
        blocks.append(facts)

    message = scrub_text(alert.get('message') or '')
    if message:
        blocks.append(_code_section('Message', message, limit=1200))

    extra = alert.get('extra') or {}
    if extra:
        formatted = _format_payload(extra)
        block = _code_section('Details', formatted, limit=1200)
        if block:
            blocks.append(block)

    payload_preview = _format_payload(ctx.get('payload'))
    if payload_preview:
        block = _code_section('Donnees recues', payload_preview, limit=1000)
        if block:
            blocks.append(block)

    traceback_text = scrub_text(alert.get('traceback') or '')
    if traceback_text:
        block = _code_section('Traceback', truncate(traceback_text, config.traceback_limit()))
        if block:
            blocks.append(block)

    footer_bits = [f"empreinte `{alert.get('fingerprint', 'n/a')}`"]
    count = alert.get('count') or 1
    if count > 1:
        footer_bits.append(f'{count} occurrences regroupees')
    if ctx.get('user_agent'):
        footer_bits.append(truncate(ctx['user_agent'], 120))
    blocks.append({
        'type': 'context',
        'elements': [{'type': 'mrkdwn', 'text': ' · '.join(footer_bits)}],
    })

    fallback = truncate(f"[{env}] {style['label']} — {title}", 250)

    return {
        'text': fallback,
        'attachments': [{
            'color': style['color'],
            'blocks': blocks,
            'fallback': fallback,
        }],
    }
