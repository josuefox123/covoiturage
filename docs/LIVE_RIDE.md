# Live Ride - Zemy

Suivi en temps réel des trajets.

```mermaid
sequenceDiagram
    Driver->>Backend: Met à jour sa position (WebSocket/REST)
    Backend-->>Passenger: Notifie de la nouvelle position
```
