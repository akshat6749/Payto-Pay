# Project Architecture: PlayTo-Pay

## 1. Executive Summary
PlayTo-Pay utilizes a highly decoupled, event-driven microservice architecture. The system is designed to handle long-running, resource-intensive backend processes (such as payment processing) without causing HTTP timeouts, UI freezing, or cloud server memory limits. 

By separating the synchronous REST API from the asynchronous background worker, and implementing intelligent frontend polling via TanStack Query, the application achieves a seamless, non-blocking user experience comparable to enterprise production systems.

---

## 2. Technology Stack & Infrastructure

### 🖥️ Frontend Client (Vercel Edge Network)
*   **Core:** React.js initialized via Vite for lightning-fast HMR and optimized production builds.
*   **Server State Management:** **TanStack Query (React Query)**. Used exclusively to manage asynchronous data fetching, caching, and background polling.
*   **Routing:** React Router DOM for SPA navigation.

### ⚙️ Primary Web API (Render Web Service)
*   **Core:** Django + Django REST Framework (DRF).
*   **Role:** The synchronous gateway. It receives incoming HTTPS requests, validates the payload, updates database states, and offloads heavy computation to the background queue. It is designed to return a `20x` HTTP response almost instantly.
*   **Security:** Configured with strict `CORS_ALLOWED_ORIGINS` to only accept requests from the Vercel production domain.

### 🗄️ Central Database (Render PostgreSQL)
*   **Role:** The single source of truth. It stores all application models and houses the `django-q` queue tables (`orm_q` and `orm_tasks`).
*   **Networking:** Configured to accept high-speed internal connections from the Render Web Service, and secure external connections from the remote background worker.

### 🏗️ Asynchronous Task Worker (Railway Container)
*   **Core:** Python + `django-q` (`qcluster`).
*   **Role:** The asynchronous engine. This isolated container runs 24/7, polling the central database for queued tasks. It executes the heavy payment processing logic and updates the database records independently of the web traffic.

---

## 3. The Asynchronous Polling Engine

A core feature of this architecture is how it handles the "waiting" period during a payout. Because HTTP requests should not hang open while a payment processes, the system uses a **Polling & State Machine** strategy.

1.  **The Initiation:** The user requests a payout. The Django API instantly creates a record with a `PROCESSING` state, pushes the job to the task queue, and returns the `PROCESSING` status to the frontend.
2.  **Smart Polling (TanStack Query):** The frontend receives the `PROCESSING` status. TanStack Query automatically engages its `refetchInterval` feature. It begins pinging the backend API (e.g., every 3 seconds) asking, *"Is it done yet?"*
3.  **Background Execution:** Meanwhile, the Railway worker picks up the task, processes the payment, and silently changes the database record to `SUCCESS` or `FAILED`.
4.  **The Resolution:** On the next frontend poll, the API returns the new `SUCCESS` state. TanStack Query intelligently detects that the state has resolved, terminates the polling loop, and triggers the UI to show a success animation or notification.

---

## 4. System Architecture Diagram

```mermaid
graph TD
    subgraph Client Tier [Frontend - Vercel]
        UI[React UI Components] 
        TanStack[TanStack Query / Cache]
        UI <--> TanStack
    end

    subgraph API Tier [Web Service - Render]
        DRF[Django REST API]
        QueueManager[Django-Q Broker]
        DRF --> QueueManager
    end

    subgraph Database Tier [PostgreSQL - Render]
        Tables[(Core App Tables)]
        Q_Tables[(Django-Q Tables)]
    end

    subgraph Worker Tier [Background Node - Railway]
        Worker[QCluster Python Worker]
    end

    %% Connections
    TanStack -->|1. POST Request| DRF
    TanStack -.->|4. GET Polling Request| DRF
    
    QueueManager -->|2. Push Task| Q_Tables
    DRF -->|Update Status| Tables

    Worker -->|3. Poll for Jobs| Q_Tables
    Worker -->|5. Update Final Status| Tables

    classDef frontend fill:#171717,stroke:#ffffff,color:#ffffff;
    classDef api fill:#4682b4,stroke:#ffffff,color:#ffffff;
    classDef db fill:#336791,stroke:#ffffff,color:#ffffff;
    classDef worker fill:#4b0082,stroke:#ffffff,color:#ffffff;

    class UI,TanStack frontend;
    class DRF,QueueManager api;
    class Tables,Q_Tables db;
    class Worker worker;
```

---

## 5. Data Flow: TanStack Polling Sequence

This sequence diagram illustrates the exact lifecycle of a payment task, highlighting the interaction between the frontend polling mechanism and the decoupled backend worker.

```mermaid
sequenceDiagram
    autonumber
    participant Client as React + TanStack (Vercel)
    participant API as Django API (Render)
    participant DB as PostgreSQL (Render)
    participant Worker as Background Worker (Railway)

    Note over Client, Worker: Phase 1: Initiation
    Client->>API: POST /api/payout/
    API->>DB: Create Payout (Status: PROCESSING)
    API->>DB: Enqueue Task
    API-->>Client: 200 OK (Status: PROCESSING)
    
    Note over Client, DB: Phase 2: TanStack Query Polling Loop
    loop Every 3 Seconds
        Client->>API: GET /api/payout/{id}/
        API->>DB: Read Status
        DB-->>API: Status: PROCESSING
        API-->>Client: 200 OK (Status: PROCESSING)
    end
    
    Note over DB, Worker: Phase 3: Asynchronous Resolution
    Worker->>DB: Claim Task from Queue
    Note over Worker: Execute heavy 3rd-party API logic
    Worker->>DB: Update Payout (Status: SUCCESS)
    
    Note over Client, DB: Phase 4: Final Poll & Resolution
    Client->>API: GET /api/payout/{id}/
    API->>DB: Read Status
    DB-->>API: Status: SUCCESS
    API-->>Client: 200 OK (Status: SUCCESS)
    
    Note over Client: TanStack detects resolution state.<br/>Stops polling loop.<br/>Triggers UI success re-render.
```

---

## 6. Environment & Network Strategy

To facilitate secure cross-cloud communication without exposing internal services, the environment configuration is strictly segregated.

### Vercel (Frontend) Variables
*   `VITE_API_URL`: `[https://playto-pay.onrender.com](https://playto-pay.onrender.com)` (Directs all Axios/Fetch calls to the live API gateway).

### Render (Web API) Variables
*   `DATABASE_URL`: `postgresql://user:pass@dpg-internal-host/db_name` (Uses Render's internal network gateway for high-speed, zero-egress-cost queries).
*   `CORS_ALLOWED_ORIGINS`: `[https://playto-pay.vercel.app](https://playto-pay.vercel.app)` (Prevents unauthorized domains from querying the API).
*   `ALLOWED_HOSTS`: `playto-pay.onrender.com`

### Railway (Background Worker) Variables
*   `DATABASE_URL`: `postgresql://user:pass@external-db-url.render.com/db_name` (Crucial: Uses Render's external public gateway, allowing the Railway container to securely authenticate and access the database across the public internet).
*   `DEBUG`: `False` (Prevents memory leaks in the background worker by disabling SQL query logging).