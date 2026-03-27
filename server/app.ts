import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import cors from "cors";
import dotenv from "dotenv";
import express, { type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import OpenAI, { toFile } from "openai";

dotenv.config();

const upload = multer({ storage: multer.memoryStorage() });
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../dist");

const fallbackNotes = [
  "Keep the product sharply lit and clearly legible.",
  "Use an intentional ad composition instead of a plain background swap.",
  "Make the scene feel commercially believable."
];

const fallbackEdits = [
  "Make the background warmer and more sunlit.",
  "Push the headline larger and bolder.",
  "Introduce stronger lifestyle props around the product."
];

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
        const conversation = parseConversation(req.body.conversation);
        const uploadedImage = req.file;

        if (!prompt) {
          res.status(400).json({ error: "Prompt is required." });
          return;
        }

        if (!uploadedImage) {
          res.status(400).json({ error: "An image is required for every generation request." });
          return;
        }

        const result = await generateAdCreative({
          prompt,
          conversation,
          uploadedImage
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
  uploadedImage: Express.Multer.File;
}): Promise<GenerationResult> {
  const editPrompt = buildEditPrompt(input.prompt, input.conversation);
  const imageFile = await toFile(
    input.uploadedImage.buffer,
    input.uploadedImage.originalname || "product.jpg",
    { type: input.uploadedImage.mimetype }
  );

  const response = await openai.images.edit({
    model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1-mini",
    image: imageFile,
    prompt: editPrompt,
    input_fidelity: "high",
    size: "auto",
    quality: "medium",
    output_format: "jpeg"
  });

  const image = response.data?.[0];
  if (!image?.b64_json) {
    throw new Error("OpenAI did not return an image.");
  }

  const plan = buildCreativePlan(input.prompt, input.conversation, image.revised_prompt);

  return {
    imageDataUrl: `data:image/jpeg;base64,${image.b64_json}`,
    responseId: randomUUID(),
    imageGenerationId: randomUUID(),
    revisedPrompt: image.revised_prompt ?? plan.scenePrompt,
    action: input.conversation.length > 0 ? "edit" : "generate",
    size: "auto",
    quality: "medium",
    plan
  };
}

function buildEditPrompt(prompt: string, conversation: ChatTurn[]) {
  const recentContext = conversation
    .slice(-4)
    .map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`)
    .join("\n");

  const combinedText = `${conversation
    .slice(-4)
    .map((entry) => entry.content)
    .join(" ")} ${prompt}`.toLowerCase();

  const lighting = pickFirstMatch(
    combinedText,
    [
      { keywords: ["golden hour", "sunset", "warm light"], value: "golden-hour lighting with warm highlights and long soft shadows" },
      { keywords: ["studio", "glossy", "rim light"], value: "controlled studio lighting with glossy highlights and crisp rim light" },
      { keywords: ["moody", "dark", "dramatic"], value: "dramatic low-key lighting with sculpted highlights and deep contrast" },
      { keywords: ["bright", "clean", "minimal"], value: "bright clean commercial lighting with soft diffused shadows" }
    ],
    "premium advertising lighting with dimensional highlights and clear product separation"
  );

  const composition = pickFirstMatch(
    combinedText,
    [
      { keywords: ["instagram", "social", "poster"], value: "graphic ad composition with a strong focal point and clean negative space" },
      { keywords: ["editorial", "magazine", "luxury"], value: "editorial composition with premium spacing and elevated visual hierarchy" },
      { keywords: ["cinematic", "hero", "campaign"], value: "hero composition with cinematic depth, confident framing, and a premium campaign feel" },
      { keywords: ["minimal", "clean"], value: "minimal composition with restrained props and intentional negative space" }
    ],
    "polished commercial composition with clear focal hierarchy and usable negative space"
  );

  const background = pickFirstMatch(
    combinedText,
    [
      { keywords: ["desert", "road", "highway"], value: "a believable environmental backdrop that supports motion and scale" },
      { keywords: ["summer", "tropical", "beach"], value: "a vibrant seasonal backdrop with warm atmosphere and fresh color contrast" },
      { keywords: ["black", "studio", "backdrop"], value: "a refined studio backdrop with subtle gradients and reflective surfaces" },
      { keywords: ["lifestyle", "home", "kitchen"], value: "a lifestyle setting with selective props that make the product feel naturally placed" }
    ],
    "an ad-ready background that feels intentional, premium, and commercially believable"
  );

  const styling = pickFirstMatch(
    combinedText,
    [
      { keywords: ["orange", "vibrant", "bold"], value: "bold color contrast, energetic styling, and clean graphic tension" },
      { keywords: ["luxury", "premium", "elegant"], value: "luxury styling, refined materials, and restrained premium detailing" },
      { keywords: ["sport", "performance", "speed"], value: "performance-oriented styling with dynamic energy and sharper visual lines" },
      { keywords: ["soft", "beauty", "skincare"], value: "soft premium styling with smooth gradients and clean tactile surfaces" }
    ],
    "premium ad styling with cohesive color, texture, and atmosphere"
  );

  const textRendering = combinedText.includes("headline") || combinedText.includes("text") || combinedText.includes("typography")
    ? "If text is included, render it cleanly, legibly, and in a way that feels integrated into the ad design."
    : "Do not force extra text into the image unless it supports the requested concept.";

  return [
    "Create a polished, aesthetically strong product advertisement from the uploaded image.",
    "Preserve the product identity, packaging, proportions, colors, branding, and recognizable details.",
    `Lighting: ${lighting}.`,
    `Composition: ${composition}.`,
    `Background: ${background}.`,
    `Styling: ${styling}.`,
    "Keep the product as the unmistakable hero subject and avoid clutter.",
    "Make the result commercially realistic, high-end, and intentionally art directed.",
    textRendering,
    recentContext ? `Recent conversation context:\n${recentContext}` : "",
    `Latest request: ${prompt}`
  ]
    .filter(Boolean)
    .join("\n\n");
}

function pickFirstMatch(
  text: string,
  options: Array<{ keywords: string[]; value: string }>,
  fallback: string
) {
  for (const option of options) {
    if (option.keywords.some((keyword) => text.includes(keyword))) {
      return option.value;
    }
  }

  return fallback;
}

function buildCreativePlan(prompt: string, conversation: ChatTurn[], revisedPrompt?: string): CreativePlan {
  const latestContext = conversation
    .filter((entry) => entry.role === "user")
    .slice(-2)
    .map((entry) => entry.content)
    .join("; ");

  const productType = inferProductType(prompt, latestContext);
  const visualStrategy = revisedPrompt
    ? `Generated from the uploaded product image with direction focused on ${prompt.toLowerCase()}.`
    : `Generated from the uploaded product image with direction focused on ${prompt.toLowerCase()}.`;

  return {
    productType,
    visualStrategy,
    scenePrompt: revisedPrompt || prompt,
    headline: buildHeadline(prompt),
    subheadline: "Refine with one focused visual change at a time.",
    designNotes: fallbackNotes,
    suggestedEdits: buildSuggestedEdits(prompt)
  };
}

function inferProductType(prompt: string, context: string) {
  const text = `${prompt} ${context}`.toLowerCase();
  if (text.includes("drink") || text.includes("beverage") || text.includes("bottle") || text.includes("can")) {
    return "Packaged beverage";
  }
  if (text.includes("shoe") || text.includes("sneaker") || text.includes("fashion")) {
    return "Fashion product";
  }
  if (text.includes("cream") || text.includes("serum") || text.includes("cosmetic") || text.includes("skincare")) {
    return "Beauty product";
  }
  if (text.includes("bike") || text.includes("motorcycle") || text.includes("helmet")) {
    return "Automotive product";
  }
  return "Consumer product";
}

function buildHeadline(prompt: string) {
  const cleaned = prompt.replace(/[^a-z0-9\s]/gi, " ").trim();
  if (!cleaned) {
    return "Made To Stand Out";
  }

  const words = cleaned.split(/\s+/).slice(0, 4).map(capitalizeWord);
  return words.join(" ");
}

function buildSuggestedEdits(prompt: string) {
  const base = prompt.toLowerCase();
  const suggestions = [
    base.includes("warm") ? "Make the lighting more directional and cinematic." : "Warm the lighting and add stronger contrast.",
    base.includes("bold") ? "Simplify the composition and increase negative space." : "Make the composition bolder and more graphic.",
    "Add one supporting prop or background element to strengthen the scene."
  ];

  return suggestions.slice(0, 3);
}

function capitalizeWord(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

