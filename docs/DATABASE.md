# Modèle de données - Zemy

```mermaid
erDiagram
    USER ||--o{ RIDE : creates
    USER ||--o{ BOOKING : makes
    RIDE ||--o{ BOOKING : contains
    VEHICLE ||--|{ USER : belongs_to
```
