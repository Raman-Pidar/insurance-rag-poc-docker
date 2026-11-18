# Insurance RAG POC

React + TypeScript frontend, Express + TypeScript API, and ChromaDB vector store.

## Prerequisites
- Docker Desktop installed and running
- An API key for an OpenAI-compatible chat + embeddings provider

## Run the whole application

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Add your provider API key and model settings to `.env`.
3. Start the stack:
   ```bash
   docker compose up --build
   ```
4. Open the UI at http://localhost:5173

Services:
- Web: http://localhost:5173
- API health: http://localhost:4000/api/health
- ChromaDB: http://localhost:8000

Stop the stack with `Ctrl+C`, or run `docker compose down` in another terminal.

Persistent data is stored in Docker volumes for ChromaDB, SQLite, and uploaded files.
To remove all POC data too, run `docker compose down -v` (this is destructive).

## Notes
- This is a local proof of concept, not production-ready.
- Admin and customer views are demo screens; authentication and authorization are not implemented.
- Keep API keys in `.env`, never commit them.
- The LLM provider must support the configured chat and embedding API endpoints/models.
