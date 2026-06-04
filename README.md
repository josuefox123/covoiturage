# Guide de Démarrage - Projet de Covoiturage

Ce document explique comment récupérer le code, ouvrir et lancer les 3 parties de l'application (Backend, Frontend Mobile, et Dashboard Web).

## 📥 1. Récupérer les dernières modifications (Git)

Avant de lancer quoi que ce soit, assure-toi d'avoir le code le plus récent.
Ouvre un terminal à la racine du projet (`c:\PROJETS\antigravity\covoiturage1`) et tape :

```bash
git pull origin main
```

*(Si tu as fait des modifications locales que tu veux écraser pour forcer la récupération du code en ligne, utilise `git reset --hard origin/main`)*

---

## ⚙️ 2. Lancer le Backend (Django API)

Le backend gère la base de données et l'API pour les applications.

1. Ouvre un terminal et navigue dans le dossier backend :
   ```bash
   cd backend
   ```
2. *(Si applicable)* Active ton environnement virtuel (souvent `env\Scripts\activate` sur Windows).
3. Installe les nouvelles dépendances s'il y en a eu :
   ```bash
   pip install -r requirements.txt
   ```
4. Applique les éventuelles nouvelles migrations de base de données :
   ```bash
   python manage.py migrate
   ```
5. **Lance le serveur :**
   ```bash
   python manage.py runserver 0.0.0.0:8000
   ```
> Le backend sera accessible sur `http://localhost:8000`. Laisse ce terminal ouvert.

---

## 📱 3. Lancer le Frontend (Application Mobile Expo)

C'est l'application mobile principale pour les conducteurs et passagers.

1. Ouvre un **nouveau** terminal et navigue dans le dossier frontend :
   ```bash
   cd frontend
   ```
2. Installe les packages (seulement si de nouvelles bibliothèques ont été ajoutées) :
   ```bash
   npm install
   ```
3. **Lance l'application :**
   ```bash
   npx expo start -c
   ```
> Le paramètre `-c` permet de vider le cache pour éviter les bugs. Scanne le QR Code avec l'application Expo Go sur ton téléphone pour la tester. Laisse ce terminal ouvert.

---

## 💻 4. Lancer le Dashboard Admin (Nuxt 3 Web)

C'est le tableau de bord web d'administration pour gérer les utilisateurs et les trajets.

1. Ouvre un **troisième** terminal et navigue dans le dossier du dashboard :
   ```bash
   cd dashboard
   ```
2. Installe les packages (seulement la première fois ou s'il y a eu des mises à jour) :
   ```bash
   npm install
   ```
3. **Lance le site d'administration :**
   ```bash
   npm run dev
   ```
> Le Dashboard sera accessible depuis ton navigateur web à l'adresse `http://localhost:3000`.

---

## 📌 Résumé rapide pour un lancement quotidien
Si tu n'as rien installé de nouveau, voici les 3 commandes à lancer dans 3 terminaux différents :
1. `cd backend` ➔ `python manage.py runserver 0.0.0.0:8000`
2. `cd frontend` ➔ `npx expo start -c`
3. `cd dashboard` ➔ `npm run dev`
