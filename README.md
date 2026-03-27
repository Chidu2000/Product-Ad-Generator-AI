# Studio Ad Lab

AI-powered product ad generator built with React, TypeScript, Node, and OpenAI.

Studio Ad Lab turns a single product image plus a natural-language prompt into a polished ad-style creative. The app is designed around a simple demo-friendly workflow: upload, describe, generate, refine.

## Highlights

- Product image upload with prompt-driven ad generation
- OpenAI-backed creative planning plus image transformation
- Iterative refinement through follow-up prompts
- Before/after comparison for source vs generated creative
- Clean, presentation-friendly UI for live demos

## Demo Flow

1. Upload a product image
2. Enter a prompt such as `hero motorcycle ad at golden hour` or `summer Instagram ad with bold text`
3. Generate a first concept
4. Refine with a follow-up like `make the lighting warmer` or `add a stronger headline`
5. Compare the original image against the generated ad

## Screens / UX Figures

### Primary user flow

```text
Upload image -> Enter prompt -> Generate ad -> Review result -> Refine with follow-up prompt
```

### App layout

```text
+----------------------+-------------------------------------------+
| Left panel           | Main canvas                               |
|                      |                                           |
| - Upload image       | - Large generated preview                 |
| - Prompt textarea    | - Before/after compare slider             |
| - Starter prompts    | - Headline / subheadline                  |
| - Recent guidance    | - Result summary / version history        |
+----------------------+-------------------------------------------+
```

## Architecture

```text
React + Vite frontend
        |
        |  multipart/form-data
        v
Express + TypeScript API
        |
        |  OpenAI Responses API
        v
Creative planning + image generation
```

### Request path

```text
Browser
  -> POST /api/generate
  -> Express upload handler
  -> OpenAI creative planning step
  -> OpenAI image generation/edit step
  -> JSON response with generated image + plan metadata
  -> React UI renders preview, comparison, and refinement flow
```

## Tech Stack

### Frontend
- React
- TypeScript
- Vite
- CSS

### Backend
- Node.js
- Express
- Multer
- TypeScript

### AI
- OpenAI API
- Responses API flow for creative planning and image generation

## How OpenAI Is Used

The app uses OpenAI in two stages:

1. Creative planning
The uploaded product image and user prompt are analyzed to produce a stronger creative direction, headline suggestion, and refinement ideas.

2. Image generation / transformation
That creative direction is then used to generate a more polished ad-style visual while preserving the product identity.

This allows the app to feel more agentic than a simple prompt passthrough.

## Project Structure

```text
product-ad-generator/
|-- server/
|   `-- index.ts          # Express API and OpenAI integration
|-- src/
|   |-- App.tsx           # Main product UI
|   |-- main.tsx          # React entry point
|   |-- styles.css        # App styling
|   `-- vite-env.d.ts
|-- .env.example
|-- package.json
|-- tsconfig*.json
`-- vite.config.ts
```

## Local Setup

### Prerequisites
- Node.js 20+
- OpenAI API key

### Install

```bash
npm install
```

### Environment

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

### Run in development

```bash
npm run dev
```

Frontend:
- `http://localhost:5173`

Backend:
- `http://localhost:8787`

## Build

```bash
npm run build
npm start
```

The Express server serves the built frontend from `dist/` in production mode.

## Current Scope

This project is optimized for a live demo and interview setting:

- focused workflow over feature sprawl
- fast time-to-first-result
- simple refinement loop
- strong visual presentation

## Next Improvements

- Public deployment with a stable production URL
- Export presets for common ad aspect ratios
- Better version management and restore flow
- Improved handling for generated text overlays
- Stronger loading/progress feedback during generation
