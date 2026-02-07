# Estimate Genie

Estimate Genie is a self-hosted web app that:
- uploads up to 10 historical estimate PDFs,
- analyzes style signals (font usage, size, punctuation, emphasis, and hex color palette),
- installs and verifies fonts directly from the internet (Google Fonts source),
- generates a new estimate from a client prompt,
- returns both HTML and PDF output with logo support.

## Core features implemented
- PDF style extraction from uploaded documents.
- Hex color parser (`#RRGGBB`) + PDF color operator parsing (`rg`, `RG`).
- Font search endpoint (`/api/fonts/search`).
- Font install + verification endpoint (`/api/fonts/install`).
- CLI commands for font search/install.
- OpenAI-compatible self-hosted LLM support (Ollama, vLLM, llama.cpp server).
- PDF generation server-side via `pdfkit`.

## API endpoints
- `GET /health`
- `GET /api/fonts/search?q=<text>`
- `POST /api/fonts/install` JSON body: `{ "family": "Montserrat" }`
- `POST /api/analyze` form-data: `pdfs[]` (1-10 PDFs)
- `POST /api/generate` form-data: `pdfs[]`, `logo` (optional), `prompt`

`/api/generate` response includes:
- `styleProfile`
- `html`
- `pdfBase64`
- `pdfFileName`
- `pdfFont`

## Local setup
1. Install Node.js 20+.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment:
   ```bash
   cp .env.example .env
   ```
4. Start app:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000)

## Font commands
Search:
```bash
npm run font:search -- montserrat
```

Install + verify:
```bash
npm run font:install -- "Montserrat"
```

Copy verified files to OS fonts directory:
```bash
npm run font:install-system -- "Montserrat"
```

Installed font files are stored under `assets/fonts/` and tracked in `assets/fonts/registry.json`.

## LLM config (self-hosted, no token billing)
Set in `.env`:
- `LLM_BASE_URL` (example: `http://localhost:11434/v1`)
- `LLM_MODEL` (example: `llama3.1:8b`)
- `LLM_API_KEY` (optional)

If unset, generation still works using a deterministic fallback.

## Docker deployment
Run app + Ollama:
```bash
docker compose up --build
```

Pull the model once container is up:
```bash
docker exec -it estimate-genie-ollama ollama pull llama3.1:8b
```

Open [http://localhost:3000](http://localhost:3000)

## Functional verification checklist
1. `GET /health` returns `{ "ok": true }`.
2. Font search returns families:
   ```bash
   curl "http://localhost:3000/api/fonts/search?q=montserrat"
   ```
3. Font install succeeds and shows verified family:
   ```bash
   curl -X POST http://localhost:3000/api/fonts/install -H "Content-Type: application/json" -d '{"family":"Montserrat"}'
   ```
4. Upload PDFs + prompt in UI and generate output.
5. Download HTML and PDF from UI and confirm PDF opens correctly.

## Production notes
- No per-token fees when using self-hosted models.
- You still pay for server resources (CPU/GPU/RAM/storage/network).
- For public traffic, add: auth, rate limiting, abuse prevention, file malware scanning, and object storage.
