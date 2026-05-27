# Backend Covoiturage (Django REST Framework)

Ce dossier contient l'API backend de l'application de covoiturage, construite avec Django et Django REST Framework. Il utilise une base de données locale **SQLite** (`db.sqlite3`) par défaut pour le développement.

## Prérequis

- Python 3.8+ installé sur votre machine.

## Instructions de Démarrage Rapide

Suivez ces étapes pour démarrer le serveur backend en local sur votre machine Windows.

### 1. Activer l'environnement virtuel

Un environnement virtuel (`venv`) est déjà présent. Pour l'activer, ouvrez un terminal (PowerShell ou Invite de commandes) dans le dossier `backend` et exécutez :

**Sur Windows (PowerShell / CMD) :**
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
