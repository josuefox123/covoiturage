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

---

## Historique des Mises à Jour Récentes

### 📅 Mise à jour du 5 Août 2026
- **Messagerie et Résolution des Doublons :**
  - Ajout d'une déduplication en mémoire dans la liste des discussions (`ConversationViewSet.get_queryset()`) pour n'afficher que la boîte de discussion la plus récente par trajet/participants.
  - Résolution des créations de doublons de discussions lors des annulations et notifications en remplaçant les `get_or_create` ordonnés par des filtres croisés `Q()`.
  - Intégration d'un indicateur de présence (`En ligne` / `Hors ligne`) dynamique et textuel dans l'en-tête de la discussion mobile.
- **Documents PDF Officiels (Reçus et Billets) :**
  - Création du service de génération de PDF (`pdf_service.py` utilisant `fpdf2` sur le serveur) avec le logo Zemy, bandeau de marque et fiches descriptives.
  - Ajout d'un bouton de téléchargement de reçu de paiement PDF sur l'écran mobile de succès de paiement (passager).
  - Ajout d'un bouton de téléchargement de reconnaissance de réservation PDF sous la liste des passagers confirmés (conducteur).
  - Résolution du crash de téléchargement sous Android/Expo en migrant l'API vers le module `expo-file-system/legacy` (Expo SDK 54).
- **Suppression des Emojis :**
  - Retrait intégral des émojis et stickers dans le code backend et frontend (notifications push, météo, administration Django, notes étoiles).
- **Géolocalisation Globale :**
  - Récupération automatique de la position utilisateur au démarrage de l'application et partage global dans `AuthContext` via `useAuth().userLocation`.

---

### 📅 Mise à jour du 6 Août 2026
- **Page de Paiement / Checkout (`payment_checkout.html`) :**
  - Ajout d'une vérification stricte du paiement avant l'affichage des billets et QR codes (les passagers non-payés ne peuvent plus accéder au ticket directement).
  - Pré-remplissage automatique des champs éditables dans le formulaire de checkout (nom, téléphone, montant).
  - Intégration des logos Mobile Money et Zemy dans la page de checkout pour un rendu plus professionnel.
- **Migration vers 100% Google Maps API :**
  - Suppression totale des dépendances open-source (Nominatim / OSRM) dans le frontend et le backend.
  - Toutes les fonctionnalités de géocodage, de calcul d'itinéraire et d'affichage de carte utilisent désormais exclusivement l'API Google Maps.
- **Corrections Formulaire de Publication de Trajet :**
  - Résolution de l'erreur `Maximum update depth exceeded` dans le formulaire de publication en protégeant les mises à jour d'état et l'injection de waypoints dans la WebView.
- **Correction Type Checker Pyright (Backend) :**
  - Correction du warning Pyright dans la déduplication du queryset `Conversation` en utilisant la représentation string pour la comparaison des UUID participants.

---

### 📅 Etat au 7 Août 2026 (Modifications en cours — non commitées)
> Ces modifications sont présentes dans le répertoire de travail mais n'ont pas encore été committées.

- **Backend :**
  - `directions.py` (cartographie Google) — ajustements mineurs.
  - `connections.py` et `moteur.py` (matching) — refactoring/optimisations du moteur de correspondances.
  - `moteur_recherche.py` (recherche) — mises à jour du service de recherche.
  - `bookings.py` (réservations) — ajustements dans les vues de réservation.
  - `chat.py` (messagerie) — modifications dans la vue de chat.
- **Frontend (Application Mobile) :**
  - `trips.tsx` — mise à jour de l'onglet Trajets.
  - `payment/success.tsx` — modifications de l'écran de succès de paiement.
  - `ride-management/[id].tsx` — refactoring majeur de l'écran de gestion de trajet conducteur (1598 insertions / suppressions).
  - `ride/[id].tsx` — refactoring majeur de l'écran de détail trajet passager (1436 insertions / suppressions).
  - `search-results.tsx` — corrections mineures de l'écran de résultats de recherche.
  - `LiveRideModal.tsx` — refactoring du modal de trajet en direct (1384 insertions / suppressions).
  - `RideMap.tsx` — refactoring de la carte de trajet (479 insertions / suppressions).
  - `MissionResolver.ts` et `MissionCard.tsx` / `MissionTypes.ts` — mises à jour de la logique de résolution et d'affichage des missions.
  - `useRideDetails.ts` — mise à jour du hook de chargement des détails de trajet.
  - `AuthContext.tsx` — évolution du contexte d'authentification.
  - `AnimatedSplash.tsx` — ajustements de l'écran de démarrage animé.
  - `RideSearchCard.tsx`, `UserCard.tsx`, `DriverCard.tsx`, `RecommendedDrivers.tsx`, `TodayTrips.tsx` — retouches sur les composants de liste et de carte.
  - `ProfileScreen/index.tsx` — mises à jour de l'écran de profil.
  - `BookingConfirmModal.tsx` — ajustements du modal de confirmation de réservation.
  - `booking.ts` — ajout de nouveaux champs dans le type TypeScript Booking.
  - `package.json` / `package-lock.json` — ajout d'une nouvelle dépendance npm.
