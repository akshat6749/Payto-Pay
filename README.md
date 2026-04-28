# Playto Pay

**Playto Pay** is a robust B2B payment engine designed to simulate asynchronous financial payouts with strict concurrency, mathematical precision, and idempotency controls. It leverages PostgreSQL row-level locks and an immutable ledger system to prevent double-spend vulnerabilities during simultaneously processed transactions.

## 🛠 Tech Stack

### Backend (The Payout Engine)
*   **Django & Django REST Framework (DRF):** Core application framework for the API and business logic.
*   **PostgreSQL:** Primary database, leveraging **Row-Level Locking** (`SELECT FOR UPDATE`) to handle concurrent transactions safely.
*   **Django-Q2:** Asynchronous task queue for processing payouts in the background, ensuring high availability and system responsiveness.
*   **Double-Entry Ledger:** An append-only ledger system where balances are derived from historical entries rather than mutable columns.

### Frontend (The Dashboard)
*   **React:** Component-based UI library for a dynamic, modern dashboard.
*   **Vite:** High-performance build tool and development server.
*   **TanStack Router:** Type-safe, declarative routing for seamless navigation.
*   **TanStack Query (React Query):** Synchronized server-state management for real-time transaction tracking and asynchronous polling.
*   **Tailwind CSS v4:** Modern, utility-first styling with high-performance CSS orchestration.

## 🌍 Architecture & Deployment

The Playto Pay ecosystem uses a modern, distributed architecture to ensure scalability and reliable processing. The system is split into three main operational environments:

*   **Frontend (Vercel):** The React/Vite dashboard is deployed on Vercel for fast global CDN delivery, edge-caching, and seamless SPA hosting.
*   **Backend API (Render):** The core Django REST Framework application and the managed PostgreSQL database are deployed on Render, handling all synchronous API requests, row-level concurrency locks, and ledger math.
*   **Background Worker (Railway):** The `Django-Q2` asynchronous background worker (`qcluster`) is deployed on Railway. It isolates the heavy task processing—such as hitting bank APIs for simulated payouts and handling backoff retries—without blocking the main Render web API.

> **Note:** For a deep dive into the ledger system, concurrency locks, and TanStack polling logic, see the full [**Technical Architecture Guide**](./ARCHITECTURE.md).

## 🚀 Local Setup & Installation

### Prerequisites
Before you begin, ensure you have the following installed on your machine:
*   **Python** (3.11 or higher)
*   **Node.js** (v18 or higher)
*   **PostgreSQL** (14 or higher)

### 1. Backend Setup

**Create and Activate a Virtual Environment**
```bash
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

**Install Dependencies**
```bash
pip install -r requirements.txt
```

**Configure the Environment**
Create a `.env` file in the root of the project to securely provide your PostgreSQL credentials:
```ini
DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/playtopay_db
```

**Run Migrations**
Initialize the database schema:
```bash
python manage.py migrate
```

### 2. Data Seeding (Crucial)
To test the application properly, the database must be pre-populated with mathematical constraints in place. Run the seed command to generate 3 test merchants and inject their initial ₹1,00,000 ledger balances:
```bash
python manage.py seed_data
```

## ⚙️ Running the Services

To run the full stack locally, you will need three terminal windows running simultaneously.

**1. Start the Django Development Server:**
```bash
python manage.py runserver
```

**2. Start the Django-Q2 Background Worker:**
```bash
python manage.py qcluster
```

**3. Start the React Frontend:**
Open a new terminal, navigate to the frontend directory, and start Vite:
```bash
cd frontend
npm install
npm run dev
```

## 🧪 Testing & Quality Assurance

We have written a comprehensive test suite using `pytest` to validate our concurrency controls mathematically. The test suite ensures that the core API endpoints, database state transitions, and background queue workers function as expected without regressions.

Crucially, this suite actively proves that our `Idempotency-Key` tracking perfectly intercepts duplicate network requests, and that our PostgreSQL Row-Level Locking (`select_for_update()`) completely eliminates double-spend race condition vulnerabilities.

### Prerequisites
Ensure your local virtual environment is active and testing dependencies are installed:
```bash
pip install pytest pytest-django
```

### Running the Tests
To execute the specific concurrency engine tests, run:
```bash
pytest payout_engine/core/tests/test_core_engine.py -v
```

**Additional Testing Commands:**
*   **Run the entire test suite:** `pytest`
*   **Stop on the first failure:** `pytest -x`

> **Note:** `pytest-django` is configured to create an isolated, temporary test database every time you run the suite. It will not modify your live cloud database or your local development data.