# Frontend Mobile - Zemy

L'application mobile est construite avec React Native et Expo.

```mermaid
graph TD
    App --> AuthContext
    AuthContext --> Navigation(Tab Navigation)
    Navigation --> Home(Recherche & Trajets)
    Navigation --> Messages(Conversations)
    Navigation --> Profile(Compte)
```
