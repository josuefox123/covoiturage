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
> **Règle de travail pour le Backend :**
> Travaillez sur votre branche locale **`josue`**.
> Pour déployer et tester vos modifications en toute sécurité, **récupérez les nouveautés sur `josue` et poussez votre branche `josue` vers la branche `testeur` de GitLab**.

### 🔹 Étape 1 : Récupérer les nouveautés de `josue` depuis GitLab
```bash
cd c:\PROJETS\antigravity\covoiturage1\backend

# Récupérer et fusionner les derniers commits depuis la branche josue de GitLab
git pull gitlab josue
```

### 🔹 Étape 2 : Commiter vos modifications locales
```bash
cd c:\PROJETS\antigravity\covoiturage1\backend

git add .
git commit -m "description explicite de vos modifications"
```

### 🔹 Étape 3 : Pousser sur la branche de test (`testeur`)
```bash
cd c:\PROJETS\antigravity\covoiturage1\backend

# Envoie vos modifications locales de la branche josue vers la branche testeur de GitLab
git push gitlab josue:testeur

# (Optionnel) Sauvegarder aussi sur votre branche josue sur GitHub
git push origin josue
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
