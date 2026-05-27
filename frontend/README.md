# Frontend Covoiturage (React Native & Expo)

Ce dossier contient l'application mobile de covoiturage, développée avec **React Native** et le framework **Expo** (incluant Expo Router pour la navigation).

## Prérequis

- **Node.js** (version 18 ou supérieure recommandée) installé sur votre machine.
- L'application **Expo Go** installée sur votre smartphone (disponible sur l'App Store iOS et le Google Play Store Android).

## Instructions de Démarrage Rapide

Suivez ces étapes pour lancer l'application en développement sur votre téléphone.

### 1. Installer les dépendances

Ouvrez un terminal dans le dossier `frontend` et exécutez la commande suivante pour installer toutes les bibliothèques requises (React Navigation, icônes, etc.) :

```bash
npm install
```

### 2. Démarrer le serveur Expo (Metro Bundler)

Une fois l'installation terminée, lancez le serveur de développement :

```bash
npx expo start
```
ou simplement :
```bash
npm start
```

### 3. Tester sur votre téléphone

1. Après avoir lancé la commande ci-dessus, un **QR code** va s'afficher dans votre terminal.
2. Assurez-vous que votre téléphone et votre ordinateur sont connectés au **même réseau Wi-Fi**.
3. **Sur iPhone** : Ouvrez l'application *Appareil photo* standard et scannez le QR code. Une notification vous proposera d'ouvrir Expo Go.
4. **Sur Android** : Ouvrez l'application *Expo Go* et appuyez sur **Scan QR code**.
5. L'application va compiler (le premier chargement prend quelques secondes) et s'afficher directement sur votre écran !

---

## Architecture Principale

Nous utilisons **Expo Router** (la navigation basée sur les fichiers) avec une structure claire :

- `app/` : Contient toutes les routes et écrans de l'application.
  - `_layout.tsx` : Le layout principal de l'application.
  - `index.tsx` : L'écran d'accueil / onboarding.
  - `(auth)/` : Les écrans de connexion et d'inscription.
  - `(tabs)/` : Les écrans principaux accessibles via la barre d'onglets (Accueil, Publier, Messages, Profil).
- `src/` : Contient la logique métier, les styles globaux et les composants réutilisables.
  - `styles/theme.ts` : La palette de couleurs et la typographie de l'application.
- `assets/` : Les images statiques (icônes, splash screen).
