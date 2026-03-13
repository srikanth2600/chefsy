# Gharka Chef (Phase 1 Local Setup)

## Backend (FastAPI)
1. Open a terminal in `backend`.
2. Create and activate a virtual environment.
3. Install dependencies:
   - `pip install -r requirements.txt`
4. Run the API:
   - `uvicorn app.main:app --reload --port 8005`
5. Health check:
   - `http://localhost:8005/health`

## Frontend (Next.js)
1. Open a terminal in `frontend`.
2. Install dependencies:
   - `npm install`
3. Run the dev server on port 3005:
   - `npm run dev`
4. Open:
   - `http://localhost:3005`

## Notes
- Frontend calls the API at `http://localhost:8005` by default.
- To override the API URL, set `NEXT_PUBLIC_API_URL` in `frontend/.env.local`.

## Docker (Recommended to avoid port conflicts)
1. From the project root (`gharka-chef`), create a `.env` file for Docker:
   - `OPENAI_API_KEY=your_api_key_here`
2. Start everything:
   - `docker compose up --build`
3. Open:
   - Frontend: `http://localhost:3005`
   - Backend health: `http://localhost:8005/health`
