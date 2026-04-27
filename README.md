# Playto Pay

**Playto Pay** is a robust B2B payment engine designed to simulate asynchronous financial payouts with strict concurrency, mathematical precision, and idempotency controls. It leverages PostgreSQL row-level locks and an immutable ledger system to prevent double-spend vulnerabilities during simultaneously processed transactions.

## Prerequisites
Before you begin, ensure you have the following installed on your machine:
- **Python** (3.11 or higher)
- **Node.js** (v18 or higher)
- **PostgreSQL** (14 or higher)

## Backend Setup

1. **Create and Activate a Virtual Environment**
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure the Environment**
   Create a `.env` file in the root of the project to securely provide your PostgreSQL credentials:
   ```ini
   DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/playtopay_db
   ```

4. **Run Migrations**
   Initialize the database schema:
   ```bash
   python manage.py migrate
   ```

## Data Seeding (Crucial)

To test the application properly, the database must be pre-populated with mathematical constraints in place. Run the seed command to generate 3 test merchants and inject their initial ₹1,00,000 ledger balances:
```bash
python manage.py seed_data
```

## Running the Services

To run the full stack locally, you will need three terminal windows running simultaneously.

1. **Start the Django Development Server:**
   ```bash
   python manage.py runserver
   ```

2. **Start the Django-Q2 Background Worker:**
   ```bash
   python manage.py qcluster
   ```

3. **Start the React Frontend:**
   Open a new terminal, navigate to the frontend directory, and start Vite:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Running the Test Suite

We've written a comprehensive test suite to validate our concurrency controls mathematically. To execute the tests, run:
```bash
python -m pytest payout_engine/core/tests/test_core_engine.py -v
```
This suite actively proves that our `Idempotency-Key` tracking perfectly intercepts duplicate network requests, and that our PostgreSQL Row-Level Locking (`select_for_update()`) completely eliminates double-spend race condition vulnerabilities.
