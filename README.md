# PatchPilot AI
## Setup
### Backend
```bash
cd backend
pip install -r requirements.txt
```
### Configuration
- Copy `.env.example` to `.env` and set values as needed. Never commit `.env`.
- Key variables: `GEMINI_API_KEY`, `MODEL_NAME`, `CORS_ORIGINS`, timeouts/limits. See `.env.example` for details.
- Configuration is centralized in `backend/app/config.py` with validation.

### Security & Execution
- **Docker required for test execution.** The runner uses `docker run` with `--network none`, `--read-only` filesystem where practical, `--tmpfs /tmp`, non-root user, memory/cpu/pids limits, and disposable containers. No host credentials or Docker socket are mounted.
- If Docker is unavailable or isolation cannot be established, the API/workflow returns `INCONCLUSIVE` with `runner_error`/execution failure details. Untrusted tests are **never** executed directly on the host.
- Patches are validated (no absolute paths, no `..`, unified diff required). Applied only to disposable copies.
- Gemini API key from `GEMINI_API_KEY` env var; never committed.
- API errors are returned in a safe format without leaking internal details; diagnostics are logged server-side.
### Run
```bash
# Backend
cd backend
uvicorn app.main:app --reload
# Frontend
cd frontend
npm install && npm run dev
```
### Health
- `GET /health` - liveness (does not require Docker/Gemini)
- `GET /ready` - readiness (reports Docker availability and samples dir presence; does not expose secrets)

### Tests
```bash
cd backend
pytest
```
### Reproduce scenarios
**Successful fix (example):** Use sample project with a patch that fixes failing tests without regressions; API returns `IMPROVED` or `NO_IMPROVEMENT` per classification rules.
**Regression:** Patch that breaks a previously passing test returns `REGRESSION_DETECTED`.
**Partial fix:** Some fixed, some remain failing → `PARTIAL_FIX`.
**Inconclusive:** Missing/incomparable results, timeouts, Docker unavailable, or invalid patches → `INCONCLUSIVE`.
## Architecture
- FastAPI backend, deterministic comparison engine
- Docker-isolated test execution with strict controls
- Gemini integration via google-genai (mocked in tests)
- React + Vite + Tailwind frontend
- Sample registry: `GET /api/samples` lists the sample projects in `samples/`; the UI dropdown is populated from it
## Limitations
- Docker must be installed and accessible
- Network disabled in containers
- No GitHub/n8n integrations in this milestone
