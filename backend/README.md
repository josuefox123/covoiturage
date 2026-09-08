# Backend Covoiturage (Django REST Framework)

Ce dossier contient l'API backend de l'application de covoiturage, construite avec Django et Django REST Framework. Il utilise une base de données locale **SQLite** (`db.sqlite3`) par défaut pour le développement.

## Prérequis

- Python 3.8+ installé sur votre machine.
- 
## Instructions de Démarrage Rapide

Suivez ces étapes pour démarrer le serveur backend en local sur votre machine Windows.

### 1. Activer l'environnement virtuel

Un environnement virtuel (`venv`) est déjà présent. Pour l'activer, ouvrez un terminal (PowerShell ou Invite de commandes) dans le dossier `backend` et exécutez :

**Sur Windows (PowerShell / CMD)  :**
```bash
.\venv\Scripts\activate
```

*Note : Si vous êtes sur macOS ou Linux, la commande serait `source venv/bin/activate`.*

Une fois activé, vous devriez voir `(venv)` apparaître au début de votre ligne de commande.

### 2. Installer les dépendances (si nécessaire)

Si vous ajoutez de nouvelles bibliothèques (comme Django, djangorestframework, django-cors-headers), assurez-vous qu'elles sont installées :

```bash
pip install django djangorestframework django-cors-headers
```

### 3. Préparer la base de données SQLite

La base de données interne (`db.sqlite3`) est gérée automatiquement par Django. Avant de lancer le serveur pour la première fois (ou après avoir modifié des modèles), vous devez appliquer les migrations :

```bash
python manage.py makemigrations
python manage.py migrate
```

Cette commande crée les tables nécessaires dans le fichier `db.sqlite3`.

### 4. Démarrer le serveur de développement

Pour lancer l'API en local :

```bash
python manage.py runserver
```

Le serveur démarrera, par défaut, sur `http://127.0.0.1:8000/`.

### 5. Créer un super-utilisateur (Optionnel)

Pour accéder à l'interface d'administration de Django (`http://127.0.0.1:8000/admin/`) et gérer facilement vos données (utilisateurs, trajets, etc.) :

```bash
python manage.py createsuperuser
```
Suivez ensuite les instructions à l'écran pour définir un nom d'utilisateur, un email et un mot de passe.

---

## Architecture

- `config/` : Contient les paramètres globaux du projet (settings.py, urls.py).
- `api/` : L'application principale contenant les modèles de base de données, les vues (views) et les URLs spécifiques à l'API.
- `db.sqlite3` : Le fichier de base de données local.

---

## Monitoring — Alertes Slack

Le backend remonte automatiquement vers un canal Slack les **exceptions, bugs,
erreurs et dysfonctionnements**. Aucune dépendance supplémentaire n'est requise
(le module s'appuie sur `requests`, déjà présent).

### Activation

Le webhook est un **secret** : il ne se configure que via le fichier `.env`
(non versionné). Copier `env.exemple` en `.env` et renseigner au minimum :

```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/XXX/YYY/ZZZ
MONITORING_ENABLED=True
MONITORING_ENVIRONMENT=production
```

Sans `SLACK_WEBHOOK_URL`, le monitoring reste inactif et l'application
fonctionne exactement comme avant.

### Vérifier l'installation

```bash
python manage.py test_monitoring            # message de contrôle
python manage.py test_monitoring --exception # teste le rendu d'un traceback
python manage.py test_monitoring --all       # un exemple de chaque type
```

La commande affiche d'abord la configuration effective, puis attend
la confirmation d'envoi.

### Ce qui est capté automatiquement

| Source | Mécanisme | Niveau |
|---|---|---|
| Exception non gérée dans une vue | `ErrorMonitoringMiddleware.process_exception` | CRITIQUE |
| Erreur serveur de l'API DRF (5xx) | `zemy_exception_handler` | CRITIQUE |
| Appels `logger.error()` / `logger.critical()` existants | `SlackLogHandler` sur le logger racine | ERREUR |
| Réponse 5xx renvoyée sans exception | `ErrorMonitoringMiddleware` | ERREUR |
| Échec d'une tâche Celery | signal `task_failure` | CRITIQUE |
| Arrêt d'un worker Celery | signal `worker_shutdown` | AVERTISSEMENT |
| Requête plus lente que le seuil | `ErrorMonitoringMiddleware` | LENTEUR |

Les erreurs client normales (400 validation, 401, 403, 404, 429) ne
déclenchent **aucune** alerte, sauf si `MONITORING_NOTIFY_CLIENT_ERRORS=True`.

### Signalement manuel

```python
from api.monitoring import capture_exception, capture_message

try:
    reverser(conducteur, montant)
except Exception as exc:
    capture_exception(exc, extra={'conducteur': conducteur.id, 'montant': montant})

capture_message(
    'Solde conducteur négatif',
    'Le solde calculé est inférieur à zéro après reversement.',
    level='CRITICAL',
    extra={'conducteur': conducteur.id},
)
```

### Garde-fous

- **Non bloquant** : l'envoi part dans un thread démon dédié. Une panne ou une
  lenteur de Slack n'affecte jamais le temps de réponse de l'API.
- **Sans risque** : toute erreur interne du monitoring est avalée et journalisée.
  Une alerte ratée ne casse jamais une requête.
- **Anti-spam** : une même erreur (même type, même ligne) n'est envoyée qu'une
  fois par `MONITORING_DEDUP_WINDOW` secondes, avec renotification aux paliers
  10 / 50 / 200 / 1000 occurrences. Plafond global de `MONITORING_RATE_LIMIT`
  alertes par minute.
- **Données sensibles masquées** : mots de passe, tokens JWT, OTP, numéros de
  carte, cookies et secrets sont remplacés par `***REDACTE***` avant l'envoi.
- **Aucune alerte pendant les tests** (`manage.py test`).

### Réglages disponibles

Toutes les variables sont documentées dans `env.exemple` :
`MONITORING_MIN_LEVEL`, `MONITORING_DEDUP_WINDOW`, `MONITORING_RATE_LIMIT`,
`MONITORING_SLOW_REQUEST_MS`, `MONITORING_NOTIFY_CLIENT_ERRORS`,
`MONITORING_NOTIFY_CELERY_RETRY`, `MONITORING_NOTIFY_CELERY_SHUTDOWN`,
`MONITORING_IGNORED_LOGGERS`, `MONITORING_IGNORED_PATHS`.

Pour couper les alertes sans redéployer : `MONITORING_ENABLED=False` dans
le `.env`, puis redémarrer le service.
