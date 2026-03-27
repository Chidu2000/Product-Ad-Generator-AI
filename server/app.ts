import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import OpenAI from "openai";
import type { ResponseInputItem } from "openai/resources/responses/responses";

dotenv.config();

const upload = multer({ storage: multer.memoryStorage() });
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../dist");

const creativePlanSchema = {
  name: "creative_plan",
  type: "json_schema",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      productType: { type: "string" },
      visualStrategy: { type: "string" },
      scenePrompt: { type: "string" },
      headline: { type: "string" },
      subheadline: { type: "string" },
      designNotes: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 3
      },
      suggestedEdits: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 3
      }
    },
    required: [
      "productType",
      "visualStrategy",
      "scenePrompt",
      "headline",
      "subheadline",
      "designNotes",
      "suggestedEdits"
    ]
  }
} as const;

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

type GenerationResult = {
  imageDataUrl: string;
  responseId: string;
  imageGenerationId: string;
  revisedPrompt: string;
  action: string;
  size: string;
  quality: string;
  plan: CreativePlan;
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

export function createApp(options?: { serveStatic?: boolean }) {
  const app = express();
  const serveStatic = options?.serveStatic ?? false;

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

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

        const result = await generateAdCreative({
          prompt,
          conversation,
          previousResponseId,
          baseImageDataUrl
        });

        res.json(result);
      } catch (error) {
        console.error(error);
        res.status(500).json({
          error:
            error instanceof Error ? error.message : "Something went wrong while generating the ad."
        });
      }
    }
  );

  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ error: "API route not found." });
  });

  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith("/api/")) {
      next(error);
      return;
    }

    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unexpected API error."
    });
  });

  if (serveStatic) {
    app.use(express.static(distDir));
    app.get("*", (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith("/api/")) {
        next();
        return;
      }

      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  return app;
}

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
          Boolean(entry) &&
          (entry.role === "user" || entry.role === "assistant") &&
          typeof entry.content === "string"
      )
      .slice(-8);
  } catch {
    return [];
  }
}

async function generateAdCreative(input: {
  prompt: string;
  conversation: ChatTurn[];
  previousResponseId: string | null;
  baseImageDataUrl: string | null;
}): Promise<GenerationResult> {
  const chatContext = input.conversation
    .map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`)
    .join("\n");

  const creativeInstruction = `
You are a creative director generating a polished product ad.
Return structured plan metadata in the requested JSON schema and also generate the final ad image in the same response.

Rules:
- Preserve the core product identity and packaging details.
- Produce a finished ad-style composition, not a plain cutout or raw background swap.
- Be specific about lighting, styling, lens feel, composition, and ad intent.
- If the user asks for typography, account for it in the scene and plan metadata.
- Keep headlines concise and commercially believable.
- Suggested edits should be concrete follow-up prompts.

Conversation context:
${chatContext || "No prior conversation."}

Latest user request:
${input.prompt}
`.trim();

  const initialInput: ResponseInputItem[] = [
    {
      role: "user",
      content: [
        { type: "input_text", text: creativeInstruction },
        ...(input.baseImageDataUrl
          ? [{ type: "input_image" as const, image_url: input.baseImageDataUrl, detail: "high" as const }]
          : [])
      ]
    }
  ];

  const response = input.previousResponseId
    ? await openai.responses.parse({
        model: "gpt-5",
        previous_response_id: input.previousResponseId,
        input: creativeInstruction,
        text: {
          format: creativePlanSchema
        },
        tools: [
          {
            type: "image_generation",
            background: "auto",
            size: "auto",
            quality: "high",
            output_format: "jpeg"
          }
        ]
      })
    : await openai.responses.parse({
        model: "gpt-5",
        input: initialInput,
        text: {
          format: creativePlanSchema
        },
        tools: [
          {
            type: "image_generation",
            input_fidelity: "high",
            background: "auto",
            size: "auto",
            quality: "high",
            output_format: "jpeg"
          }
        ]
      });

  const generationCall = findImageGenerationCall(response);
  if (!generationCall?.result) {
    throw new Error("OpenAI did not return an image.");
  }

  const plan = normalizeCreativePlan(response.output_parsed as CreativePlan | null);
  const format = generationCall.output_format ?? "jpeg";
  const mimeType = format === "png" ? "image/png" : "image/jpeg";

  return {
    imageDataUrl: `data:${mimeType};base64,${generationCall.result}`,
    responseId: response.id,
    imageGenerationId: generationCall.id,
    revisedPrompt: generationCall.revised_prompt ?? plan.scenePrompt,
    action: generationCall.action ?? (input.previousResponseId ? "edit" : "generate"),
    size: generationCall.size ?? "auto",
    quality: generationCall.quality ?? "high",
    plan
  };
}

function normalizeCreativePlan(value: CreativePlan | null): CreativePlan {
  if (!value) {
    return {
      productType: "Consumer product",
      visualStrategy:
        "Create a polished ad composition that keeps the product recognizable and premium.",
      scenePrompt: "Create a premium advertising image of the uploaded product.",
      headline: "Made To Stand Out",
      subheadline: "Turn a simple packshot into a polished campaign visual.",
      designNotes: [
        "Keep the product sharply lit and clearly legible.",
        "Use an intentional ad composition instead of a plain background swap.",
        "Make the scene feel commercially believable."
      ],
      suggestedEdits: [
        "Make the background warmer and more sunlit.",
        "Push the headline larger and bolder.",
        "Introduce stronger lifestyle props around the product."
      ]
    };
  }

  return {
    productType: value.productType,
    visualStrategy: value.visualStrategy,
    scenePrompt: value.scenePrompt,
    headline: value.headline,
    subheadline: value.subheadline,
    designNotes: value.designNotes.slice(0, 3),
    suggestedEdits: value.suggestedEdits.slice(0, 3)
  };
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

