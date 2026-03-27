# Studio Ad Lab

AI-powered product ad generator built with TypeScript, React, Node, and OpenAI.

## What it does

- Upload a product image
- Describe the ad you want in natural language
- Uses OpenAI to analyze the product, improve the creative direction, and generate an ad-style image
- Supports iterative conversation using previous response context
- Shows a canvas-style UI with before/after compare, creative strategy notes, prompt trace, and history

## Setup

1. Install Node.js 20+
2. Install dependencies:
   `npm install`
3. Copy `.env.example` to `.env` and set `OPENAI_API_KEY`
4. Start development:
   `npm run dev`

Frontend runs on `http://localhost:5173` and proxies API requests to the Node server on `http://localhost:8787`.

## Build

`npm run build`

The Express server serves the built frontend from `dist/` when started with:

`npm start`
