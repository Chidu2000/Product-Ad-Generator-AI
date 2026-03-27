# Studio Ad Lab

AI-powered product ad generator built with React, TypeScript, Express, and OpenAI.

## Stack

- Frontend: React 19, Vite, TypeScript
- Backend: Express, TypeScript, Multer
- AI: OpenAI Responses API

## Local Setup

### Prerequisites

- Node.js 20+
- `OPENAI_API_KEY`

### Install

```bash
npm install
```

### Env

Create `.env` in the project root:

```env
OPENAI_API_KEY=your_api_key_here
```

### Run

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:8787`

## Build

```bash
npm run build
npm start
```

Production serves the built frontend through the Express server.

## Architecture

![Architecture overview](./docs/architecture-overview.svg)

Request flow:

1. React client uploads an image and prompt to `POST /api/generate`
2. Express parses multipart form data and keeps recent conversation context
3. OpenAI creates a creative plan and generates the ad image
4. API returns image data plus plan metadata for refinement/history in the UI

## Notes

- First generation uses the uploaded source image.
- Follow-up prompts reuse the last result via `previousResponseId`.
- Generated output is returned as a data URL and rendered directly in the client.
