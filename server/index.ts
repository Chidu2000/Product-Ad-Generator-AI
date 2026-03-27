import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import OpenAI from "openai";

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../dist");

app.use(cors());
app.use(express.json({ limit: "10mb" }));

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

type CreativePlan = {
  productType: string;
  visualStrategy: string;
  scenePrompt: string;
  headline: string;
  subheadline: string;
  designNotes: string[];
  suggestedEdits: string[];
};

type GenerateRequestBody = {
  prompt?: unknown;
  previousResponseId?: unknown;
  conversation?: unknown;
};

type ImageGenerationCall = {
  type: "image_generation_call";
  id: string;
  result?: string;
  revised_prompt?: string;
  action?: string;
  output_format?: string;
  size?: string;
  quality?: string;
};

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.post(
  "/api/generate",
  upload.single("image"),
  async (req: Request<Record<string, never>, unknown, GenerateRequestBody>, res: Response) => {
    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: "OPENAI_API_KEY is missing." });
      return;
    }

    try {
      const prompt = String(req.body.prompt ?? "").trim();
      const previousResponseId = String(req.body.previousResponseId ?? "").trim() || null;
      const conversation = parseConversation(req.body.conversation);
      const uploadedImage = req.file;
      const baseImageDataUrl = uploadedImage
        ? toDataUrl(uploadedImage.buffer, uploadedImage.mimetype)
        : null;

      if (!prompt) {
        res.status(400).json({ error: "Prompt is required." });
        return;
      }

      if (!previousResponseId && !baseImageDataUrl) {
        res.status(400).json({ error: "An image is required for the first generation." });
        return;
      }

      const planner = await createCreativePlan({
        prompt,
        conversation,
        baseImageDataUrl
      });

      const generationResponse = await generateAdCreative({
        prompt,
        conversation,
        previousResponseId,
        baseImageDataUrl,
        planner
      });

      const generationCall = findImageGenerationCall(generationResponse);

      if (!generationCall?.result) {
        res.status(502).json({ error: "OpenAI did not return an image." });
        return;
      }

      const format = generationCall.output_format ?? "jpeg";
      const mimeType = format === "png" ? "image/png" : "image/jpeg";

      res.json({
        imageDataUrl: `data:${mimeType};base64,${generationCall.result}`,
        responseId: getResponseId(generationResponse),
        imageGenerationId: generationCall.id,
        revisedPrompt: generationCall.revised_prompt ?? planner.scenePrompt,
        action: generationCall.action ?? (previousResponseId ? "edit" : "generate"),
        plan: planner,
        size: generationCall.size ?? "auto",
        quality: generationCall.quality ?? "high"
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        error:
          error instanceof Error ? error.message : "Something went wrong while generating the ad."
      });
    }
  }
);

app.use(express.static(distDir));
app.get("*", (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }

  res.sendFile(path.join(distDir, "index.html"));
});

const port = Number(process.env.PORT ?? 8787);

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

function toDataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function parseConversation(value: unknown): ChatTurn[] {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as ChatTurn[];
    return parsed
      .filter(
        (entry): entry is ChatTurn =>
          Boolean(entry) && (entry.role === "user" || entry.role === "assistant") && typeof entry.content === "string"
      )
      .slice(-8);
  } catch {
    return [];
  }
}

async function createCreativePlan(input: {
  prompt: string;
  conversation: ChatTurn[];
  baseImageDataUrl: string | null;
}): Promise<CreativePlan> {
  const conversationSummary = input.conversation
    .map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`)
    .join("\n");

  const plannerInstruction = `
You are a creative director for performance marketing.
Analyze the product image and user request, then return JSON only with this exact shape:
{
  "productType": "short label",
  "visualStrategy": "1-2 sentence summary",
  "scenePrompt": "detailed prompt for image generation",
  "headline": "short ad headline",
  "subheadline": "one sentence supporting line",
  "designNotes": ["note 1", "note 2", "note 3"],
  "suggestedEdits": ["edit idea 1", "edit idea 2", "edit idea 3"]
}

Rules:
- Preserve the product identity and packaging details.
- Be specific about lighting, styling, lens feel, composition, and ad intent.
- If the user asks for typography, call that out clearly.
- Keep headlines concise and tasteful.
- Avoid markdown fences.

User prompt: ${input.prompt}
Conversation context:
${conversationSummary || "No prior conversation."}
`.trim();

  const plannerResponse = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: plannerInstruction },
          ...(input.baseImageDataUrl
            ? [{ type: "input_image", image_url: input.baseImageDataUrl }]
            : [])
        ]
      }
    ]
  } as Parameters<typeof openai.responses.create>[0]);

  const parsed = safeJsonParse<Partial<CreativePlan>>(extractText(plannerResponse));

  return {
    productType: parsed.productType || "Consumer product",
    visualStrategy:
      parsed.visualStrategy ||
      "Create a polished ad composition that keeps the product recognizable and premium.",
    scenePrompt:
      parsed.scenePrompt ||
      `Create a premium advertising image of the uploaded product. User request: ${input.prompt}`,
    headline: parsed.headline || "Made To Stand Out",
    subheadline: parsed.subheadline || "Turn a simple packshot into a polished campaign visual.",
    designNotes: normalizeStringArray(parsed.designNotes, [
      "Keep the product sharply lit and clearly legible.",
      "Use an intentional ad composition instead of a plain background swap.",
      "Make the scene feel commercially believable."
    ]),
    suggestedEdits: normalizeStringArray(parsed.suggestedEdits, [
      "Make the background warmer and more sunlit.",
      "Push the headline larger and bolder.",
      "Introduce stronger lifestyle props around the product."
    ])
  };
}

async function generateAdCreative(input: {
  prompt: string;
  conversation: ChatTurn[];
  previousResponseId: string | null;
  baseImageDataUrl: string | null;
  planner: CreativePlan;
}) {
  const chatContext = input.conversation
    .map((entry) => `${entry.role}: ${entry.content}`)
    .join("\n");

  const generationInstruction = `
Create a high-end product ad creative based on the user's request.

Creative direction:
${input.planner.visualStrategy}

Generation prompt:
${input.planner.scenePrompt}

Suggested headline to visually support the concept:
${input.planner.headline}

Supporting line:
${input.planner.subheadline}

Conversation so far:
${chatContext || "No prior conversation."}

Latest user request:
${input.prompt}

Requirements:
- Preserve the core product identity from the source image.
- Produce a finished ad-style composition, not a raw cutout.
- Make the scene visually intentional with premium styling.
- If the user asks for text in the creative, render it cleanly and legibly when possible.
`.trim();

  if (input.previousResponseId) {
    return openai.responses.create({
      model: "gpt-5",
      previous_response_id: input.previousResponseId,
      input: generationInstruction,
      tools: [
        {
          type: "image_generation",
          action: "auto",
          background: "auto",
          size: "auto",
          quality: "high",
          output_format: "jpeg"
        }
      ]
    } as Parameters<typeof openai.responses.create>[0]);
  }

  return openai.responses.create({
    model: "gpt-5",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: generationInstruction },
          ...(input.baseImageDataUrl
            ? [{ type: "input_image", image_url: input.baseImageDataUrl }]
            : [])
        ]
      }
    ],
    tools: [
      {
        type: "image_generation",
        action: "edit",
        input_fidelity: "high",
        background: "auto",
        size: "auto",
        quality: "high",
        output_format: "jpeg"
      }
    ]
  } as Parameters<typeof openai.responses.create>[0]);
}

function findImageGenerationCall(response: unknown): ImageGenerationCall | null {
  const output = (response as { output?: unknown[] } | null)?.output;
  if (!Array.isArray(output)) {
    return null;
  }

  const match = output.find(
    (item): item is ImageGenerationCall =>
      Boolean(item) &&
      typeof item === "object" &&
      (item as { type?: unknown }).type === "image_generation_call" &&
      typeof (item as { id?: unknown }).id === "string"
  );

  return match ?? null;
}

function getResponseId(response: unknown): string {
  const id = (response as { id?: unknown } | null)?.id;
  return typeof id === "string" ? id : "";
}

function extractText(response: unknown): string {
  const outputText = (response as { output_text?: unknown } | null)?.output_text;
  if (typeof outputText === "string" && outputText.trim()) {
    return outputText;
  }

  const output = (response as { output?: unknown[] } | null)?.output;
  if (!Array.isArray(output)) {
    return "";
  }

  const fragments: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = (item as { content?: unknown[] }).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const piece of content) {
      if (
        piece &&
        typeof piece === "object" &&
        "text" in piece &&
        typeof (piece as { text?: unknown }).text === "string"
      ) {
        fragments.push((piece as { text: string }).text);
      }
    }
  }

  return fragments.join("\n");
}

function safeJsonParse<T>(text: string): T {
  const cleaned = text.trim().replace(/^```json\s*|\s*```$/g, "");

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error("Could not parse creative plan JSON.");
  }
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const cleaned = value.filter((item): item is string => typeof item === "string" && item.trim());
  return cleaned.length ? cleaned.slice(0, 3) : fallback;
}
