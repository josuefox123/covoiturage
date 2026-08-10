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

### 📅 Mise à jour du 10 Août 2026
- **Réorganisation et Modularisation (Zéro fichier de +300 lignes) :**
  - **Onglet Mes Trajets :** Décomposition de [trips.tsx](file:///c:/PROJETS/antigravity/covoiturage1/frontend/app/(tabs)/trips.tsx) (de 663 à ~180 lignes) en composants modulaires sous `src/features/mes-trajets/` (EnteteTrajet, SwitcherRole, FiltresStatut, EtatVide, CarteTrajet).
  - **Détails du Trajet Passager :** Réduction de [ride/[id].tsx](file:///c:/PROJETS/antigravity/covoiturage1/frontend/app/ride/[id].tsx) (de 981 à ~370 lignes) avec extraction des cartes et boutons sous `src/features/ride/composants/` (CarteConducteur, CarteItineraire, CarteBillet, CarteSecurite, BoutonReservation, PiedDePageTrajet).
  - **Gestion du Trajet Conducteur :** Réduction de [ride-management/[id].tsx](file:///c:/PROJETS/antigravity/covoiturage1/frontend/app/ride-management/[id].tsx) (de 1047 à ~470 lignes) en composants modulaires sous `src/features/ride-management/composants/` (HeroCard, StatsGrid, Timeline, PendingBookingCard, PassengerCard, VehicleCard, PremiumScanner).
  - **Résultats de recherche :** Réduction de [search-results.tsx](file:///c:/PROJETS/antigravity/covoiturage1/frontend/app/search-results.tsx) (de 1226 à ~450 lignes) sous `src/features/search/composants/` (FiltreModalRecherche, CarteTrajetCorrespondance).
- **Sécurisation de la communication Conducteur / Passagers :**
  - Masquage et blocage systématique des boutons rapides d'appel téléphonique et de chat par message pour les réservations annulées ou n'ayant pas fait l'objet d'un paiement effectif (`payment_status` différent de `'paid'` ou `'escrow'`).
  - Restriction du bouton de contact collectif pour le conducteur aux seuls passagers actifs ayant payé.
- **Rétrocompatibilité :**
  - Maintien des re-exports pour les anciens modules de `trip-mission` pour éviter toute régression.
  - Validation complète de la compilation TypeScript (0 erreur) et du fonctionnement sous Expo.
