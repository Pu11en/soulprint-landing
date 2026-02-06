# SoulPrint Landing - Architecture Diagram

```mermaid
graph TB
    subgraph "Frontend Pages"
        HOME["/"]
        LOGIN["/login"]
        SIGNUP["/signup"]
        IMPORT["/import"]
        CHAT["/chat"]
        DASHBOARD["/dashboard"]
        MEMORY["/memory"]
        ACHIEVEMENTS["/achievements"]
        ADMIN["/admin"]
        WHITEPAPER["/whitepaper"]
    end

    subgraph "Auth Flow"
        LOGIN --> SUPABASE_AUTH
        SIGNUP --> SUPABASE_AUTH
        SUPABASE_AUTH[Supabase Auth]
    end

    subgraph "Core Features"
        IMPORT --> IMPORT_API["/api/import/*"]
        CHAT --> CHAT_API["/api/chat"]
        MEMORY --> MEMORY_API["/api/memory/*"]
        ACHIEVEMENTS --> GAMIFICATION_API["/api/gamification/*"]
    end

    subgraph "API Routes"
        IMPORT_API --> |"Process ZIP"| EMBEDDINGS["/api/embeddings/process"]
        CHAT_API --> |"Query Memory"| RLM_SERVICE[RLM Service]
        CHAT_API --> |"Generate"| ANTHROPIC[Claude API]
        MEMORY_API --> RLM_SERVICE
        
        subgraph "Admin APIs"
            ADMIN_HEALTH["/api/admin/health"]
            ADMIN_METRICS["/api/admin/metrics"]
            ADMIN_MIGRATE["/api/admin/migrate"]
        end
    end

    subgraph "External Services"
        SUPABASE[(Supabase DB)]
        RLM_SERVICE[RLM Service<br/>soulprint-landing.onrender.com]
        ANTHROPIC[Claude API]
        R2[Cloudflare R2<br/>File Storage]
    end

    subgraph "Components"
        NAVBAR[Navbar]
        AUTH_MODAL[Auth Modal]
        CHAT_UI[Chat Interface]
        HALFTONE[Halftone Background]
    end

    subgraph "Libraries"
        LIB_SUPABASE[lib/supabase]
        LIB_MEMORY[lib/memory]
        LIB_RLM[lib/rlm]
        LIB_GAMIFICATION[lib/gamification]
        LIB_EMAIL[lib/email]
    end

    IMPORT_API --> SUPABASE
    IMPORT_API --> R2
    EMBEDDINGS --> SUPABASE
    CHAT_API --> SUPABASE
    GAMIFICATION_API --> SUPABASE

    style HOME fill:#EA580C
    style CHAT fill:#EA580C
    style IMPORT fill:#EA580C
    style RLM_SERVICE fill:#10B981
    style SUPABASE fill:#3FCF8E
    style ANTHROPIC fill:#D4A574
```

## Data Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as API Routes
    participant RLM as RLM Service
    participant DB as Supabase
    participant AI as Claude

    Note over U,AI: Import Flow
    U->>FE: Upload ChatGPT ZIP
    FE->>API: POST /api/import/*
    API->>DB: Store conversations
    API->>RLM: Generate embeddings
    RLM-->>DB: Store vectors

    Note over U,AI: Chat Flow
    U->>FE: Send message
    FE->>API: POST /api/chat
    API->>RLM: Query similar memories
    RLM-->>API: Return context
    API->>AI: Generate with context
    AI-->>API: Response
    API-->>FE: Stream response
    FE-->>U: Display
```

## Key Directories

| Path | Purpose |
|------|---------|
| `/app` | Next.js app router pages & API routes |
| `/components` | React components (chat, auth, UI) |
| `/lib` | Business logic (supabase, memory, gamification) |
| `/supabase` | Database migrations & config |
| `/rlm-service` | Memory/embedding service code |
| `/public` | Static assets |

## External Dependencies

| Service | Purpose | URL |
|---------|---------|-----|
| Supabase | Auth + Database | swvljsixpvvcirjmflze.supabase.co |
| RLM Service | Memory embeddings | soulprint-landing.onrender.com |
| Claude API | AI responses | api.anthropic.com |
| Cloudflare R2 | File storage | - |
| Vercel | Hosting | soulprintengine.ai |
