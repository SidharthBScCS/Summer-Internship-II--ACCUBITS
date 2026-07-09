# Agent Builder Monorepo

A mono-architecture starter for building LLM-powered agents with:

- React frontend
- FastAPI backend
- Retrieval-augmented generation (RAG)
- Chat history with "new chat"
- Clean, simple UI

## Structure

```text
frontend/   React + Vite chat client
backend/    FastAPI API, RAG services, local vector store
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` by default.

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The backend runs on `http://localhost:8000`.

## Environment

Create `backend/.env` from `backend/.env.example`.

If `OPENAI_API_KEY` is set, the app will use OpenAI for embeddings and chat.
If it is not set, the app falls back to a local demo mode so the project still runs.

## Features

- Create a new chat
- Persist chat history during the session
- Ask questions against indexed documents
- Upload or drop text into `backend/data/documents/`
- Local JSON-based vector store for easy inspection

## Suggested Next Steps

- Replace the JSON vector store with Chroma, Qdrant, or pgvector
- Add user auth and persistent database storage
- Add streaming responses
- Add agent tools and workflow orchestration
