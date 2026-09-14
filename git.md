# Guide des Procédures Git (GitHub & GitLab)

Ce document récapitule les étapes exactes pour effectuer les mises à jour et pousser votre code sur vos dépôts **GitHub** et **GitLab** en toute sécurité.

---

## 📂 Architecture des Dépôts

| Composant | Dossier local | Dépôt Remote |
| :--- | :--- | :--- |
| **Backend (API Django)** | `c:\PROJETS\antigravity\covoiturage1\backend` | **GitLab** : `https://gitlab.com/sinustic1/zemy_backend.git`<br>**GitHub** : `https://github.com/josuefox123/zemy_backend.git` |
| **Frontend (App Mobile)** | `c:\PROJETS\antigravity\covoiturage1\frontend` | **GitHub** : `https://github.com/josuefox123/zemy_mobile_frontend.git` |
| **Dashboard (Nuxt Admin)** | `c:\PROJETS\antigravity\covoiturage1\dashboard` | **GitHub** : `https://github.com/josuefox123/zemy_dashbord.git` |
| **Projet Global** | `c:\PROJETS\antigravity\covoiturage1` | **GitHub** : `https://github.com/josuefox123/covoiturage.git` |

---

## 🚀 1. Procédure Backend (GitLab & GitHub)

> [!IMPORTANT]
> **Règle de sécurité pour le Backend :**
> Nous utilisons désormais la branche **`develop`** comme branche d'intégration principale (au lieu de `main`).
> Pour tester vos modifications sans risquer d'impacter le serveur, **poussez toujours d'abord sur la branche `testeur`**, puis une fois validé, poussez de `testeur` vers `develop`.

### 🔹 Étape 1 : Récupérer les nouveautés de `develop` (avant de travailler/pousser)
```bash
cd c:\PROJETS\antigravity\covoiturage1\backend

# Récupérer les derniers commits depuis GitLab
git fetch gitlab

# Fusionner la branche develop de GitLab dans votre branche locale
git merge gitlab/develop
```

### 🔹 Étape 2 : Commiter vos modifications locales
```bash
git add .
git commit -m "description explicite de vos modifications"
```

### 🔹 Étape 3 : Pousser sur la branche de test (`testeur`)
```bash
# Envoie vos modifications sur la branche testeur de GitLab
git push gitlab josue:testeur

# (Optionnel) Sauvegarder aussi sur votre branche testeur GitHub
git push origin josue:testeur
```

### 🔹 Étape 4 : Pousser de `testeur` vers `develop` (une fois validé)
```bash
# Pousse vos modifications validées sur la branche develop de GitLab
git push gitlab josue:develop

# Pousse également sur la branche develop de GitHub
git push origin josue:develop
```

---

## 📱 2. Procédure Frontend (Application Mobile)

```bash
cd c:\PROJETS\antigravity\covoiturage1\frontend

# 1. Vérifier l'état
git status

# 2. Ajouter et commiter
git add .
git commit -m "update frontend: description des changements"

# 3. Pousser vers GitHub
git push origin main
```

---

## 🖥️ 3. Procédure Dashboard (Interface Administration)

```bash
cd c:\PROJETS\antigravity\covoiturage1\dashboard

# 1. Ajouter et commiter
git add .
git commit -m "update dashboard: description des changements"

# 2. Pousser vers GitHub
git push origin main
```

---

## 🌐 4. Procédure du Dépôt Global (`covoiturage1`)

> [!NOTE]
> À effectuer après avoir mis à jour les sous-dossiers spécifiques pour garder le dépôt global synchronisé.

```bash
cd c:\PROJETS\antigravity\covoiturage1

# 1. Ajouter et commiter
git add .
git commit -m "update global: récapitulatif des mises à jour"

# 2. Pousser vers GitHub
git push origin josue:master
```
