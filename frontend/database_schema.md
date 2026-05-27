# Schéma de Base de Données (Déduit du Frontend)

Sur la base des écrans développés dans l'application mobile (Inscription, Profil, Trajets, Réservations, Messages), voici les tables (modèles Django) nécessaires pour le backend, ainsi que leurs attributs.

---

## 1. Utilisateur (`User` / `CustomUser`)
*Représente à la fois les conducteurs et les passagers. Gère l'authentification et le profil public.*

| Attribut | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID / Integer | Identifiant unique |
| `full_name` | String | Nom complet (ex: Jean Koffi) |
| `email` | String | Adresse e-mail (unique) |
| `phone` | String | Numéro de téléphone (unique, ex: +229 97 00 00 00) |
| `password` | String | Mot de passe (haché) |
| `avatar` | ImageField / URL | Photo de profil |
| `rating` | Float | Note globale moyenne (ex: 4.8) |
| `is_verified` | Boolean | Indique si l'identité et le téléphone sont vérifiés (`false` par défaut) |
| `created_at` | DateTime | Date de création du compte |

---

## 2. Véhicule (`Vehicle`)
*Apparaît sur l'écran Profil (Mon Véhicule) et sur l'écran Détail du Trajet.*

| Attribut | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID / Integer | Identifiant unique |
| `owner` | ForeignKey | Lien vers `User` (le conducteur) |
| `brand_model` | String | Marque et modèle (ex: Toyota Corolla) |
| `color` | String | Couleur du véhicule (ex: Grise) |
| `license_plate` | String | Plaque d'immatriculation (ex: 9876-RB-BJ) |

---

## 3. Préférences Utilisateur (`UserPreference`)
*Apparaît sur l'écran Profil et sur la fiche d'un trajet (Musique OK, Pas de cigarette, Climatisé, etc.).*

| Attribut | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID / Integer | Identifiant unique |
| `user` | OneToOneField | Lien direct vers `User` |
| `music` | Boolean / Enum | Préférence pour la musique |
| `smoking` | Boolean | Accepte les fumeurs ou non |
| `chatty` | Boolean | Aime discuter ou non |
| `air_conditioner` | Boolean | Véhicule climatisé ou non |

---

## 4. Trajet (`Ride`)
*Cœur de l'application (écrans "Rechercher", "Publier" et "Détail du trajet").*

| Attribut | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID / Integer | Identifiant unique |
| `driver` | ForeignKey | Lien vers `User` (Conducteur) |
| `vehicle` | ForeignKey | Lien vers `Vehicle` utilisé pour ce trajet |
| `departure_location`| String | Lieu de départ (ex: Cotonou Étoile Rouge) |
| `arrival_location` | String | Lieu d'arrivée (ex: Parakou) |
| `departure_date` | Date | Date du trajet |
| `departure_time` | Time | Heure de départ prévue |
| `price_per_seat` | Integer | Prix en FCFA (ex: 7500) |
| `total_seats` | Integer | Nombre de places proposées à l'origine |
| `seats_available` | Integer | Nombre de places restantes |
| `status` | Enum | Statut: `active`, `completed`, `cancelled` |
| `created_at` | DateTime | Date de publication |

---

## 5. Réservation (`Booking`)
*Créée lorsqu'un utilisateur appuie sur "Réserver une place".*

| Attribut | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID / Integer | Identifiant unique |
| `ride` | ForeignKey | Lien vers `Ride` |
| `passenger` | ForeignKey | Lien vers `User` (Passager) |
| `seats_booked` | Integer | Nombre de places réservées par cette personne |
| `status` | Enum | Statut: `pending`, `confirmed`, `cancelled` |
| `created_at` | DateTime | Date de la réservation |

---

## 6. Conversation (`Conversation`)
*Pour l'écran "Discussions" (`messages.tsx`). Contient les chats actifs.*

| Attribut | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID / Integer | Identifiant unique |
| `ride` | ForeignKey | (Optionnel) Le trajet concerné par la discussion |
| `participant_1` | ForeignKey | Lien vers `User` |
| `participant_2` | ForeignKey | Lien vers `User` |
| `created_at` | DateTime | Date de début de conversation |
| `updated_at` | DateTime | Mis à jour au dernier message (pour trier la liste) |

---

## 7. Message (`Message`)
*Pour l'écran de discussion en temps réel (`chat/[id].tsx`).*

| Attribut | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID / Integer | Identifiant unique |
| `conversation` | ForeignKey | Lien vers `Conversation` |
| `sender` | ForeignKey | Lien vers `User` (celui qui a envoyé) |
| `content` | Text | Le contenu du message |
| `is_read` | Boolean | Pour afficher le badge des messages non lus (`false` par défaut) |
| `created_at` | DateTime | Heure et date d'envoi |

---

## Relations (Relations Clés)
1. **Un Trajet (Ride)** appartient à **1 Conducteur**.
2. **Une Réservation (Booking)** relie **1 Passager** à **1 Trajet**.
3. **Une Conversation** appartient à **2 Utilisateurs** et possède de **multiples Messages**.
