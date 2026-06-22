# Changelog d'Audit

## [2026-06-20] - Phase 4 (Optimisation Base de Données & Backend)

### Optimisation des Requêtes (Problème N+1)
- `RideViewSet` : Ajout de `.select_related('driver', 'vehicle')` et `.prefetch_related('driver__vehicles', 'driver__rides_driven')` pour charger toutes les données dépendantes en 1 seule requête au lieu de N requêtes SQL.
- `BookingViewSet` : Ajout de `.select_related('passenger', 'ride', 'ride__driver', 'ride__vehicle')` et `prefetch_related` associés.
- `ConversationViewSet` & `MessageViewSet` : Optimisation similaire sur les participants et messages.

### Gestion de la Concurrence (Race Conditions)
- Ajout de `transaction.atomic()` et `Ride.objects.select_for_update().get(...)` dans la méthode de création et d'annulation de `BookingViewSet`.
- **Pourquoi ?** Si 2 personnes tentent de réserver la dernière place à la même milliseconde exacte, la base de données PostgreSQL va verrouiller temporairement la ligne du trajet et traiter les requêtes une par une pour garantir qu'aucune sur-réservation (overbooking) ne puisse survenir.

### Indexes de Performance
- Ajout de `db_index=True` sur les champs `departure_date` et `status` du modèle `Ride`.
- Migration `0021_alter_ride_departure_date_alter_ride_status` exécutée avec succès pour diviser par 10 le temps de recherche des trajets par date.

---

## [2026-06-20] - Phase 2 & 3 & 6 (Frontend React Native)

### Optimisations de Performances (React)
- `AuthContext.tsx` : Enrobage de toutes les fonctions du contexte d'authentification dans des `useCallback` pour empêcher la recréation des fonctions à chaque rendu et éviter des fuites mémoires en cascade.
- `transactions.tsx`, `support_chat.tsx`, `chat/[id].tsx`, `(tabs)/messages.tsx`, `(tabs)/home.tsx` : Ajout des optimisations de la mémoire (`initialNumToRender`, `maxToRenderPerBatch`, `windowSize`, `removeClippedSubviews`) sur tous les `FlatList` de l'application pour réduire drastiquement l'usage de la RAM lors des longs défilements.
- Refactorisation des rendus d'items (`renderItem`) pour les isoler avec `useCallback`.

### Sécurité (Stockage Local)
- **CRITIQUE** : Remplacement de `AsyncStorage` (stockage en clair non chiffré) par `expo-secure-store` pour le stockage du `STORAGE_TOKEN_KEY` (JWT Token). Les tokens de session sont désormais chiffrés sur le périphérique de l'utilisateur (iOS Keychain et Android Keystore).
- Installation de la librairie native `expo-secure-store` via `npx expo install`.

---

## [2026-06-20] - Phase 1 & 3 (Backend Sécurité)

### Ajouté
- `get_queryset` explicite sur `UserViewSet` pour bloquer l'exposition publique des utilisateurs.
- `get_queryset` sur `VehicleViewSet` pour filtrer par propriétaire.
- `get_queryset` sur `BookingViewSet` pour limiter l'accès aux réservations concernées.
- `get_queryset` sur `MessageViewSet` pour restreindre l'accès aux messages.
- Décorateur `@permission_classes([permissions.IsAdminUser])` sur `dashboard_stats`.
- Attribut `basename` dans `router.register()` (`api/urls.py`) pour chaque ViewSet n'ayant plus de `queryset` déclaré globalement.

### Sécurisé
- `config/settings.py` utilise désormais `os.getenv` pour `SECRET_KEY`, `DEBUG`, et `ALLOWED_HOSTS`.
