# Intégration de Firebase Phone Authentication

L'objectif de cette implémentation est de remplacer notre système d'authentification actuel (qui génère un code dans le backend et simule l'envoi de SMS) par Firebase Phone Authentication, permettant ainsi l'envoi de **vrais SMS gratuits** (jusqu'à 10 000/mois).

> [!WARNING]
> **Limitations d'Expo Go** : Pour envoyer un SMS, Firebase exige une vérification de sécurité (pour prouver que vous n'êtes pas un robot). Sur une application native compilée, cela se fait en arrière-plan. Mais sur **Expo Go**, une petite fenêtre de validation (reCAPTCHA) apparaîtra brièvement avant l'envoi du SMS.

## Actions requises de votre part (User Review Required)

Pour que je puisse configurer le code, **vous devez créer le projet Firebase de votre côté** (car je n'ai pas accès à votre compte Google).
Êtes-vous d'accord pour suivre ces étapes une fois que j'aurai préparé le code ?
1. Aller sur [Firebase Console](https://console.firebase.google.com/) et créer un projet.
2. Activer l'authentification par **Téléphone** (Authentication > Sign-in method).
3. Ajouter une application "Web" (</>) au projet pour obtenir votre configuration Firebase (les clés `apiKey`, `authDomain`, etc.).
4. Générer une clé privée pour le backend (Paramètres du projet > Comptes de service > Générer une nouvelle clé privée).

## Changements proposés

### Frontend (Expo / React Native)
- **Dépendances** : Installation de `firebase` et `expo-firebase-recaptcha`.
- **`firebaseConfig.ts`** : Création du fichier pour initialiser Firebase avec vos futures clés.
- **`AuthContext.tsx`** :
  - Suppression de `sendCode` pointant vers notre API Django.
  - Utilisation du SDK Firebase pour demander le SMS (`signInWithPhoneNumber`).
- **`login.tsx`** :
  - Ajout du composant `FirebaseRecaptchaVerifierModal` (invisible).
  - Validation du code SMS saisi par l'utilisateur via Firebase.
  - Envoi du **Firebase Token** sécurisé au backend Django.

### Backend (Django)
- **Dépendances** : Installation de `firebase-admin`.
- **`settings.py`** : Configuration pour charger le fichier JSON de la clé privée Firebase.
- **`views.py`** :
  - Suppression de la route `send_code` (gérée maintenant par le Frontend + Firebase).
  - Modification de `verify_code` : La route recevra désormais un jeton Firebase (ID Token). Django utilisera le SDK Admin pour vérifier ce jeton auprès de Google, extraire le numéro de téléphone certifié, puis créer/connecter l'utilisateur dans notre base de données et retourner le JWT Django classique.

## Plan de vérification

### Tests automatisés / manuels
- Vérifier que l'application affiche le reCAPTCHA et envoie effectivement un vrai SMS au numéro saisi.
- Vérifier que le code reçu permet bien d'obtenir le JWT de Django pour la navigation.
- S'assurer que les invités sont toujours redirigés vers l'écran de login sans erreur.
