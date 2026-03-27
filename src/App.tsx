import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type ChatMessage = {
  id: string;
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

type HistoryItem = {
  id: string;
  label: string;
  imageDataUrl: string;
  result: GenerationResult;
};

const starterPrompts = [
  "Hero motorcycle ad at golden hour on an open desert highway, cinematic lighting, premium editorial look.",
  "Bold summer Instagram ad with orange accents, energetic composition, and clean headline placement.",
  "Luxury studio campaign with black backdrop, glossy reflections, and sharp rim lighting."
];

const loadingSteps = ["Analyzing product", "Planning scene", "Rendering creative"];
const maxUploadBytes = 4 * 1024 * 1024;

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalPreview, setOriginalPreview] = useState<string>("");
  const [prompt, setPrompt] = useState<string>(starterPrompts[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [comparePosition, setComparePosition] = useState(54);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>("");
  const [loadingIndex, setLoadingIndex] = useState(0);

  useEffect(() => {
    if (!selectedFile) {
      setOriginalPreview("");
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setOriginalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  useEffect(() => {
    if (!isGenerating) {
      return;
    }

    const timer = window.setInterval(() => {
      setLoadingIndex((current) => (current + 1) % loadingSteps.length);
    }, 1300);

    return () => window.clearInterval(timer);
  }, [isGenerating]);

  const displayImage = result?.imageDataUrl || originalPreview;
  const canGenerate = Boolean(prompt.trim()) && Boolean(selectedFile || result);
  const conversationPayload = useMemo(
    () => messages.map(({ role, content }) => ({ role, content })),
    [messages]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canGenerate || isGenerating) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt.trim()
    };

    const nextMessages = [...conversationPayload, userMessage];
    setMessages((current) => [...current, userMessage]);
    setIsGenerating(true);
    setLoadingIndex(0);
    setError("");

    try {
      const formData = new FormData();
      formData.append("prompt", userMessage.content);
      formData.append(
        "conversation",
        JSON.stringify(nextMessages.slice(-8).map(({ role, content }) => ({ role, content })))
      );
      if (result?.responseId) {
        formData.append("previousResponseId", result.responseId);
      }
      if (!result && selectedFile) {
        formData.append("image", selectedFile);
      }

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData
      });

      const rawPayload = await response.text();
      let payload: GenerationResult | { error: string } | null = null;

      try {
        payload = rawPayload ? (JSON.parse(rawPayload) as GenerationResult | { error: string }) : null;
      } catch {
        if (!response.ok) {
          throw new Error(rawPayload || "Generation failed.");
        }

        throw new Error("Server returned a non-JSON response.");
      }

      if (!payload) {
        throw new Error("Empty response from server.");
      }

      if (!response.ok || "error" in payload) {
        throw new Error("error" in payload ? payload.error : "Generation failed.");
      }

      setResult(payload);
      setHistory((current) => [
        {
          id: payload.imageGenerationId,
          label: current.length === 0 ? "First version" : `Version ${current.length + 1}`,
          imageDataUrl: payload.imageDataUrl,
          result: payload
        },
        ...current
      ]);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `${payload.plan.visualStrategy} Try asking for one specific change next.`
        }
      ]);
      setPrompt("");
    } catch (submissionError) {
      setMessages((current) => current.filter((entry) => entry.id !== userMessage.id));
      setError(
        submissionError instanceof Error ? submissionError.message : "Generation failed unexpectedly."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (file && file.size > maxUploadBytes) {
      setSelectedFile(null);
      setResult(null);
      setMessages([]);
      setHistory([]);
      setComparePosition(54);
      setError("Image is too large for Vercel upload limits. Use a file under 4 MB.");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    setResult(null);
    setMessages([]);
    setHistory([]);
    setError("");
    setComparePosition(54);
  }

  function downloadCurrent() {
    if (!result) {
      return;
    }

    const link = document.createElement("a");
    link.href = result.imageDataUrl;
    link.download = `studio-ad-lab-${Date.now()}.jpg`;
    link.click();
  }

  return (
    <div className="app-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">AI Product Ad Generator</p>
          <h1>Turn one product image into a campaign-ready ad.</h1>
          <p className="hero-text">
            Upload the product, describe the look you want, and refine it naturally with follow-up prompts.
          </p>
          <div className="hero-badges">
            <span>Simple workflow</span>
            <span>Iterative editing</span>
            <span>OpenAI-powered</span>
          </div>
        </div>
        <div className="hero-orb" aria-hidden="true" />
      </section>

      <div className="workspace-grid">
        <aside className="control-panel panel">
          <label className="upload-card">
            <input type="file" accept="image/*" onChange={handleFileChange} />
            <span>{selectedFile ? selectedFile.name : "Upload a product image"}</span>
            <strong>{selectedFile ? "Image ready" : "PNG, JPG, WebP"}</strong>
          </label>

          <form className="prompt-form" onSubmit={handleSubmit}>
            <label className="input-group">
              <span>{result ? "Refine the current result" : "Describe the ad you want"}</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Example: cinematic motorcycle ad at golden hour with premium editorial lighting"
                rows={6}
              />
            </label>

            <div className="chip-grid">
              {(result?.plan.suggestedEdits ?? starterPrompts).map((idea) => (
                <button key={idea} type="button" className="chip" onClick={() => setPrompt(idea)}>
                  {idea}
                </button>
              ))}
            </div>

            <button className="primary-button" type="submit" disabled={!canGenerate || isGenerating}>
              {isGenerating ? loadingSteps[loadingIndex] : result ? "Update Ad" : "Generate Ad"}
            </button>
          </form>

          {messages.length > 0 && (
            <section className="conversation-card subtle-card">
              <div className="section-head">
                <span>Latest guidance</span>
              </div>
              <div className="conversation-list">
                {messages.slice(-2).map((message) => (
                  <article key={message.id} className={`message-bubble ${message.role}`}>
                    <span>{message.role === "user" ? "You" : "Studio"}</span>
                    <p>{message.content}</p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {error && <p className="error-banner">{error}</p>}
        </aside>

        <main className="preview-column">
          <section className="canvas-card panel">
            <div className="canvas-topbar">
              <div>
                <p className="eyebrow">Preview</p>
                <h2>{result?.plan.headline ?? "Your ad preview appears here"}</h2>
                <p>{result?.plan.subheadline ?? "Keep the first prompt simple. Refine after the first render."}</p>
              </div>
              <div className="canvas-actions">
                {result && <button type="button" className="secondary-button" onClick={downloadCurrent}>Download</button>}
              </div>
            </div>

            <div className="canvas-frame">
              {displayImage ? (
                result && originalPreview ? (
                  <div className="compare-stage">
                    <img src={result.imageDataUrl} alt="Generated ad" className="compare-image" />
                    <img
                      src={originalPreview}
                      alt="Original upload"
                      className="compare-image clipped"
                      style={{ clipPath: `inset(0 ${100 - comparePosition}% 0 0)` }}
                    />
                    <div className="compare-line" style={{ left: `${comparePosition}%` }} />
                    <input
                      className="compare-slider"
                      type="range"
                      min="0"
                      max="100"
                      value={comparePosition}
                      onChange={(event) => setComparePosition(Number(event.target.value))}
                      aria-label="Compare original and generated image"
                    />
                    <div className="canvas-caption before">Original</div>
                    <div className="canvas-caption after">Ad</div>
                  </div>
                ) : (
                  <img src={displayImage} alt="Product preview" className="single-preview" />
                )
              ) : (
                <div className="empty-state">
                  <p>Upload a product image to begin.</p>
                  <span>A clean source image gives the strongest result.</span>
                </div>
              )}
            </div>
          </section>

          {result && (
            <section className="summary-row">
              <article className="summary-card subtle-card">
                <p className="eyebrow">Direction</p>
                <h3>{result.plan.productType}</h3>
                <p>{result.plan.visualStrategy}</p>
              </article>
              <article className="summary-card subtle-card">
                <p className="eyebrow">Next Prompt</p>
                <h3>Suggested refinement</h3>
                <p>{result.plan.suggestedEdits[0] ?? "Ask for one focused change to refine the result."}</p>
              </article>
            </section>
          )}

          {history.length > 0 && (
            <section className="history-card panel">
              <div className="section-head">
                <span>Versions</span>
              </div>
              <div className="history-list">
                {history.map((item) => (
                  <button key={item.id} type="button" className="history-item" onClick={() => setResult(item.result)}>
                    <img src={item.imageDataUrl} alt={item.label} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}


