# 360 Relance Prefecture - Google Cloud Run / Vertex AI

Secure Google-only AI relay for `360 Relance Prefecture`.

## Architecture

Browser / Firebase Hosting -> Firebase Auth + App Check -> Cloud Run -> Vertex AI Gemini.

The Cloud Run runtime service account authenticates to Vertex AI through Application Default Credentials. **There is no Gemini API key in the browser, repository, Docker image, or Cloud Run environment.**

The deterministic application layer remains responsible for addresses, administrative courts, deadlines, derived dates, numbering, complete templates, E-CONTACT strict conversion, envelopes and PDFs.

## API

`POST /api/relance/ai`

Accepted tasks only:

- `EXTRACTION`
- `CLASSIFICATION`
- `VARIABLE_TEXT`

The client cannot supply a model name, system instruction, response schema or arbitrary generation configuration. Unknown fields are rejected.

### Extraction

```json
{
  "task": "EXTRACTION",
  "files": [
    {"name":"depot.pdf","mimeType":"application/pdf","dataBase64":"..."}
  ]
}
```

For larger files, pass a `gs://...` URI instead of Base64 and grant the Cloud Run service account read access to that bucket.

### Classification

```json
{
  "task": "CLASSIFICATION",
  "text": "Je souhaite connaitre l'etat d'avancement de mon dossier et signaler ma nouvelle adresse."
}
```

### Variable text

```json
{
  "task": "VARIABLE_TEXT",
  "fragmentType": "CONTEXTE_FACTUEL",
  "text": "Demande deposee le 14 aout 2024. Aucun retour depuis le depot."
}
```

For a Chinese UI summary:

```json
{
  "task": "VARIABLE_TEXT",
  "fragmentType": "RESUME_UTILISATEUR",
  "uiLanguage": "zh",
  "text": "...facts already validated by the application..."
}
```

## Security boundary

The service verifies Firebase Auth and Firebase App Check by default. It deliberately does **not** log request bodies, uploaded document content, prompts, model outputs, names, addresses, or AGDREF numbers.

Cloud Run is deployed with `--allow-unauthenticated` only so a normal web browser can reach the endpoint. Application access is still rejected unless valid Firebase Auth and App Check tokens are present.

## Vertex AI credentials

Production uses the Cloud Run service account with `roles/aiplatform.user`. No API key is needed for Vertex AI from Cloud Run.

This follows Google's recommended Vertex AI Node flow using `@google/genai` with `vertexai: true`, project and location.

## Deploy

From this directory:

```bash
export PROJECT_ID="YOUR_GOOGLE_CLOUD_PROJECT"
export ALLOWED_ORIGINS="https://your-domain.example,https://YOUR_PROJECT.web.app"
export RUN_REGION="europe-west1"
export VERTEX_LOCATION="global"
export MODEL="gemini-2.5-flash"
./deploy.sh
```

`MODEL` is an environment setting so you can switch to another Vertex AI Gemini model without touching the browser code.

## Firebase Hosting same-origin rewrite (recommended)

If the frontend is on Firebase Hosting, proxy `/api/**` to the Cloud Run service so the browser can use `/api/relance/ai` as a same-origin URL. Add a rewrite in your existing `firebase.json` rather than creating a second frontend.

Example:

```json
{
  "hosting": {
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "relance-ai",
          "region": "europe-west1"
        }
      }
    ]
  }
}
```

Merge this with the existing hosting config; do not overwrite existing rewrites blindly.

## Frontend replacement

`frontend/appelAPI-google.mjs` is the replacement transport for the old direct Anthropic/Gemini call. It obtains Firebase Auth and App Check tokens, then calls only your Cloud Run endpoint.

Do not put `@google/genai` in the browser for this application.

## Structured output

The server owns the JSON schemas. It uses Vertex AI structured JSON output and then validates the returned object again with Zod before returning anything to the browser.

Extraction alerts are structured as:

```json
{
  "type": "contradiction",
  "champ": "adresse",
  "valeurs": ["...", "..."],
  "documents": ["document 1", "document 2"],
  "detail": "..."
}
```

The deterministic `valider()` layer in your current core remains the final authority for applying or rejecting extracted values.

## E-CONTACT versus LRAR

The system instruction bundled here preserves the required split:

- LRAR / PDF: normal French with accents and punctuation.
- E-CONTACT restrictive fields: normal semantic text first, then deterministic `modeFormulaireStrict()` in application code.

Gemini never performs the no-accent/no-punctuation transformation itself.

## Tests

```bash
npm install
npm test
```

The tests intentionally do not call Vertex AI, so they are safe to run locally without credentials.
