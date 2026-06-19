# Documentation des Dépôts Git (Projet Covoiturage / Zemy)

Ce document récapitule l'organisation de vos dépôts Git pour ce projet. Le projet est organisé en plusieurs dossiers, chacun étant relié à un dépôt GitHub spécifique.

---

### 1. Projet Global (Dépôt Principal)
- **Dossier local :** `c:\PROJETS\antigravity\covoiturage1`
- **Lien GitHub :** [https://github.com/josuefox123/covoiturage.git](https://github.com/josuefox123/covoiturage.git)
- **Description :** Ce dépôt englobe l'intégralité du projet. Il contient le backend, le frontend mobile et le dashboard d'administration. C'est ici qu'on met à jour le projet de manière globale.

### 2. Dashboard (Interface d'Administration)
- **Dossier local :** `c:\PROJETS\antigravity\covoiturage1\dashboard`
- **Lien GitHub :** [https://github.com/josuefox123/zemy_dashbord.git](https://github.com/josuefox123/zemy_dashbord.git)
- **Description :** Ce dépôt est spécifique au tableau de bord d'administration (interface web Nuxt/Vue). On y effectue les commits uniquement pour le code du dashboard.

### 3. Frontend (Application Mobile)
- **Dossier local :** `c:\PROJETS\antigravity\covoiturage1\frontend`
- **Lien GitHub :** [https://github.com/josuefox123/zemy_mobile_frontend.git](https://github.com/josuefox123/zemy_mobile_frontend.git)
- **Description :** Ce dépôt est dédié à l'application mobile React Native / Expo. Les mises à jour de l'interface utilisateur, des composants et des écrans mobiles sont poussées vers ce lien.

### 4. Backend (API et Base de Données)
- **Dossier local :** `c:\PROJETS\antigravity\covoiturage1\backend`
- **Lien GitHub :** [https://github.com/josuefox123/zemy_backend.git](https://github.com/josuefox123/zemy_backend.git)
- **Description :** Ce dépôt contient le code du serveur, l'API Django, et les modèles de données. On s'en sert pour mettre à jour la logique serveur de l'application.

---

> [!TIP]
> **Rappel pour les mises à jour :**
> Si vous modifiez un élément dans l'un des sous-dossiers (`backend`, `frontend`, `dashboard`), vous devez vous placer dans le dossier correspondant pour faire un `git push` vers son dépôt dédié, puis également le faire dans le dossier principal `covoiturage1` si vous souhaitez que le dépôt global soit aussi à jour.
