# AI Build Log

## Summary
I used an AI coding assistant as a development partner while building this project. The assistant helped accelerate scaffolding, implementation, debugging, and UI iteration, while I remained responsible for product direction, technical tradeoffs, and the final user experience.

This document is intentionally written as a concise build record for review rather than a raw chat transcript.

## Project Objective
Build a small web application where a user can:

- upload a product image
- describe the kind of ad they want in natural language
- generate a more polished creative using OpenAI
- refine the output through follow-up prompts

Technical constraints:

- TypeScript
- React
- Node

## How AI Was Used
I used AI in the same way I would use a strong implementation partner during a rapid product build.

Primary use cases:

- accelerate initial project setup
- translate product requirements into working code quickly
- help structure the OpenAI integration
- debug TypeScript and configuration issues
- explore multiple UI directions quickly
- simplify the interface when it became too dense

The AI was useful for speed, but the important product decisions still required judgment. In particular, the final simplification of the UI came from recognizing that a more feature-rich version was actually worse for a live demo.

## Representative Prompts Used During Development
Below are representative examples of the prompts I used while building. They are lightly cleaned up for readability, but reflect the actual style of interaction.

### Initial product setup
"Build an AI-powered product ad generator. The app should let a user upload a product image, describe the style of ad they want in plain English, and generate a new creative using OpenAI. Use TypeScript, React, and Node."

### Repo and architecture
"Inspect the repo first, then scaffold the smallest practical full-stack structure. I want a React frontend, a Node backend, and a solution that is solid but not overengineered."

### OpenAI integration
"Wire the backend so the app accepts an uploaded image and prompt, then generates a more polished ad-style result rather than just displaying the original image."

### Iterative editing
"Add a way for the user to refine the output with follow-up instructions like 'make the background warmer' or 'add a stronger headline'. Keep the interaction natural."

### UX correction
"This interface is becoming too busy. Simplify it so the experience feels more intuitive for a first-time user and stronger for a live demo."

### Final polish
"Make the UI feel more productized and demo-ready, but do not add extra complexity that makes the app harder to understand."

## Major Development Iterations

### 1. Full-stack foundation
The first step was setting up a clean baseline:

- Vite + React + TypeScript frontend
- Express + TypeScript backend
- environment variable setup for the OpenAI key
- upload and generation route structure

This established a workable end-to-end foundation quickly.

### 2. OpenAI-powered generation flow
The next step was implementing the core AI behavior:

- receive a product image upload
- receive a natural language prompt
- create a creative plan from the image + prompt
- generate an ad-style output image
- preserve conversational context for iterative refinement

This converted the app from a static UI into a functional product prototype.

### 3. Product interaction layer
I then used AI to help implement a more interactive workflow:

- before/after preview
- prompt suggestions
- version history
- conversational refinements

This improved the product experience, but also surfaced an important issue: the interface started to become more complex than necessary.

### 4. Simplification and product focus
One of the most important iterations was reducing complexity.

I intentionally moved away from a more “tool-heavy” interface and returned to a simpler product flow:

- upload image
- enter prompt
- generate result
- refine result

This was a better decision for usability and a stronger choice for a live demo.

### 5. Final UI refinement
The final iteration focused on presentation quality:

- cleaner hierarchy
- better spacing and typography
- stronger preview experience
- fewer competing UI panels
- a more polished first impression

The goal was to make the app feel closer to a real product rather than a technical prototype.

## Technical Decisions

### Frontend
- React + TypeScript
- Vite for speed and simplicity
- single-page workflow to keep the interaction easy to follow

### Backend
- Express + TypeScript
- image upload handling
- OpenAI-backed generation route

### AI behavior
The AI flow does more than pass the user prompt through directly. It also helps:

- infer product context from the uploaded image
- strengthen the visual prompt before generation
- suggest useful next refinements after the first output
- preserve context between iterations

## Challenges Encountered
The main issues during development were:

- TypeScript and JSX setup issues during initial configuration
- dependency/type mismatches during setup
- UI complexity growing beyond what was good for the product
- balancing feature richness against clarity for a live demo

The most meaningful challenge was product-focused rather than technical: deciding what to remove.

## What AI Contributed Most
AI contributed most in areas where speed and iteration matter:

- fast scaffolding
- code generation for standard full-stack patterns
- API integration support
- debugging assistance
- rapid UI iteration

## What I Still Drove Directly
The following parts remained my responsibility:

- selecting the final product direction
- deciding what to simplify or cut
- judging whether the interface was demo-friendly
- shaping the final experience for clarity rather than feature count

## Final Outcome
The result is a demo-ready AI product ad generator that:

- accepts a product image upload
- accepts a natural language creative prompt
- uses OpenAI to generate a more polished ad-style output
- supports iterative refinement through follow-up prompts
- presents the workflow in a cleaner, more approachable UI

## What I Would Improve Next
Given more time, the next improvements would be:

- public deployment with a stable production URL
- export presets for common ad aspect ratios
- improved version comparison and history management
- stronger handling of in-image text rendering
- more explicit progress feedback during generation

## Closing Note
This document is provided as a structured record of AI-assisted development. I chose this format because it is more useful for review than a raw, unedited conversation log, while still making the workflow and decision-making process transparent.
