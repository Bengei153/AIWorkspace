import { NextResponse } from "next/server";
import type { StudySection } from "@/lib/workspace";

type Provider = "openai" | "gemini" | "claude" | "kimi" | "qwen";
type Action = "path" | "question" | "design";

const providerKeys: Record<Provider, string> = {
  openai: "OPENAI_API_KEY",
  gemini: "GEMINI_API_KEY",
  claude: "ANTHROPIC_API_KEY",
  kimi: "MOONSHOT_API_KEY",
  qwen: "DASHSCOPE_API_KEY",
};

function responseText(payload: Record<string, unknown>, provider: Provider) {
  if (provider === "gemini") {
    const steps = payload.steps as Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> | undefined;
    return steps?.filter((step) => step.type === "model_output").flatMap((step) => step.content ?? []).map((part) => part.text ?? "").join("") ?? "";
  }
  if (provider === "claude") {
    const content = payload.content as Array<{ text?: string }> | undefined;
    return content?.map((part) => part.text ?? "").join("") ?? "";
  }
  const choices = payload.choices as Array<{ message?: { content?: string | Array<{ text?: string }> } }> | undefined;
  const content = choices?.[0]?.message?.content;
  return Array.isArray(content) ? content.map((part) => part.text ?? "").join("") : content ?? "";
}

async function callModel(provider: Provider, model: string, prompt: string) {
  const key = process.env[providerKeys[provider]];
  if (!key) throw new Error(`Add ${providerKeys[provider]} to .env.local to use ${provider}.`);

  let url = "";
  let headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: Record<string, unknown>;

  if (provider === "gemini") {
    url = "https://generativelanguage.googleapis.com/v1beta/interactions";
    headers["x-goog-api-key"] = key;
    const currentModel = ["models/gemini-3-pro-preview", "gemini-3-pro-preview"].includes(model)
      ? "gemini-3.1-pro-preview"
      : model.replace(/^models\//, "");
    body = { model: currentModel, input: prompt, store: false };
  } else if (provider === "claude") {
    url = "https://api.anthropic.com/v1/messages";
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
    body = { model, max_tokens: 4096, messages: [{ role: "user", content: prompt }] };
  } else {
    const base = provider === "kimi"
      ? (process.env.MOONSHOT_BASE_URL ?? "https://api.moonshot.ai/v1")
      : provider === "qwen"
        ? (process.env.DASHSCOPE_BASE_URL ?? "https://dashscope-intl.aliyuncs.com/compatible-mode/v1")
        : "https://api.openai.com/v1";
    url = `${base.replace(/\/$/, "")}/chat/completions`;
    headers.Authorization = `Bearer ${key}`;
    body = { model, messages: [{ role: "user", content: prompt }] };
  }

  const result = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000),
    cache: "no-store",
  });
  const payload = await result.json().catch(() => ({})) as Record<string, unknown>;
  if (!result.ok) {
    const detail = (payload.error as { message?: string } | undefined)?.message;
    throw new Error(detail || `${provider} returned ${result.status}. Check the model name and API key.`);
  }
  return responseText(payload, provider).trim();
}

function parseJson(text: string) {
  const clean = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? clean.slice(start, end + 1) : clean);
}

function htmlDocument(html: string, css: string) {
  const safeCss = css.replace(/<\/style/gi, "<\\/style").slice(0, 16000);
  const safeHtml = html.slice(0, 24000);
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src 'none'; form-action 'none'; base-uri 'none'"><style>body{font-family:Arial,sans-serif;color:#17202a;margin:0;padding:24px;line-height:1.65}a{color:#2563eb}${safeCss}</style></head><body><main class="lesson-content">${safeHtml}</main></body></html>`;
}

const LESSON_STYLE_GUIDE = `Create a polished, self-contained interactive field-note lesson, with the art direction and teaching depth of a carefully designed university study guide. Make the topic itself the visual subject: teach through labeled models, relationships, examples, comparisons, and diagrams. Do not return a generic article dressed up with repeated boxes.

VISUAL SYSTEM
- Use a deep ink/navy background (#0A1220 to #152238), near-white headings, and muted blue-gray body text. Assign consistent meaning to a varied accent palette: clear blue for concepts/processes, amber for entities/examples, green for data/results/correct answers, coral for flows/warnings, and violet for checks. Maintain readable contrast.
- Use a compact bold display face, calm body type, and monospace sparingly for labels and notation. Establish clear hierarchy, generous section spacing, thin tinted dividers, and restrained corners. No gradients, decorative blobs, external fonts, remote images, or generic card grids.
- Open with a distinctive header: small uppercase mono eyebrow, topic-specific H1, useful lead, and compact lesson marker. Use semantic main/section/header elements, topic-specific headings, and an editorial mix of unboxed sections, callouts, numbered steps, comparisons, definitions, notation/code, and analogies where helpful.
- Make abstract ideas visible with a topic-specific diagram built from semantic HTML and CSS: labeled nodes and arrows, a relationship map, tree, timeline, process lanes, or other meaningful model. Explain the diagram nearby and make wide diagrams horizontally scrollable on small screens.

TEACHING AND INTERACTION
- Build 5-8 coherent, named sections. Explain intuition before formal terms; then give a worked example, a realistic application, common misconception, recap, and retrieval practice. Write enough to study from without reopening the source. Ground claims in the source; do not invent details or attribute outside facts to it.
- Include at least two useful native <details>/<summary> disclosures.
- Include one small, working multiple-choice activity with 3-5 questions, selectable answers, clear correct/incorrect feedback, explanations, a score, and a retry/reset control. Also add one topic-appropriate interaction such as a tabbed comparison, reveal card, glossary term, or diagram level explorer. Interactions must have accessible names, visible keyboard focus, keyboard usability, and reduced-motion support.
- Finish with a compact takeaway or quick-reference section that aids recall.
- Design with intentional visual variation. Use CSS-built graphic structure to teach rather than decoration. Keep each lesson coherent and comfortably scannable.

OUTPUT AND SAFETY
- Return only the requested JSON. Put markup in html, styles in css, and small DOM-only interaction code in js. CSS can style body and :root: each lesson has its own document. Use a distinctive lesson root class for lesson-specific selectors.
- The JavaScript runs inside an opaque-origin sandboxed iframe. Use addEventListener and textContent for dynamic text. Never use external scripts, fetch/network, storage, cookies, forms, iframes, navigation, popups, document.write, eval, or inline event attributes. No external assets or font URLs. Escape quotes and newlines correctly for valid JSON.`;

export async function POST(request: Request) {
  try {
    const input = await request.json() as {
      provider?: Provider;
      model?: string;
      action?: Action;
      topic?: string;
      materials?: Array<{ name: string; content: string }>;
      question?: string;
      lesson?: StudySection;
      styleNotes?: string;
      courseName?: string;
    };
    const provider = input.provider;
    const model = input.model?.trim().slice(0, 120);
    if (!provider || !(provider in providerKeys) || !model) {
      return NextResponse.json({ error: "Choose a provider and enter a model name." }, { status: 400 });
    }

    const materials = Array.isArray(input.materials)
      ? input.materials.slice(0, 12).map((item) => `${item.name.slice(0, 120)}:\n${item.content.slice(0, 12000)}`).join("\n\n")
      : "";
    let prompt = "";
    if (input.action === "path") {
      if (!input.topic?.trim() && !materials.trim()) return NextResponse.json({ error: "Add a topic or at least one material." }, { status: 400 });
      prompt = `Create a practical learning path grounded in the student's topic and source materials. Return only JSON: {"name":"short course name","description":"one sentence","sections":[{"title":"lesson title","html":"complete lesson markup","css":"complete CSS","js":"working interaction code"}]}. Create 4-6 sequenced lessons. Each lesson is a complete, focused study guide with the depth, visual specificity, diagrams, and functional interactions described below. Keep each lesson self-contained; progression between lesson titles should build understanding.\n${LESSON_STYLE_GUIDE}\nTopic: ${input.topic ?? "(derive from source materials)"}\nSource materials:\n${materials}`;
    } else if (input.action === "question") {
      prompt = `You are a patient study tutor. Return only JSON: {"replyHtml":"short answer markup","updatedHtml":"complete revised lesson markup","updatedCss":"complete lesson CSS","updatedJs":"complete lesson JS"}. Answer using the source and lesson. Add a concise, clearly labeled explanation/example that directly addresses the question. Preserve the existing visual system and all working interactions. Do not rewrite or shorten unrelated teaching content.\n${LESSON_STYLE_GUIDE}\nCourse: ${input.courseName ?? ""}\nLesson: ${input.lesson?.title ?? ""}\nCurrent HTML:\n${input.lesson?.html ?? ""}\nCurrent CSS:\n${input.lesson?.css ?? ""}\nCurrent JS:\n${input.lesson?.js ?? ""}\nSource material:\n${materials}\nStudent question: ${input.question ?? ""}`;
    } else if (input.action === "design") {
      prompt = `Revise the lesson HTML, CSS, and JS to follow the student's design request. Keep all educational meaning, reading content, and working activities. Return only JSON: {"html":"complete updated lesson markup","css":"complete updated CSS","js":"complete updated interaction code","note":"short summary"}.\n${LESSON_STYLE_GUIDE}\nCurrent HTML:\n${input.lesson?.html ?? ""}\nCurrent CSS:\n${input.lesson?.css ?? ""}\nCurrent JS:\n${input.lesson?.js ?? ""}\nStudent design request: ${input.styleNotes ?? ""}`;
    } else {
      return NextResponse.json({ error: "Choose a valid AI action." }, { status: 400 });
    }

    const text = await callModel(provider, model, prompt);
    const data = parseJson(text) as Record<string, unknown>;
    if (input.action === "path") {
      const sections = (Array.isArray(data.sections) ? data.sections : []).slice(0, 10).map((section, index) => {
        const item = section as Record<string, unknown>;
        return {
          id: `lesson-${index + 1}`,
          title: String(item.title ?? `Lesson ${index + 1}`).slice(0, 160),
          html: String(item.html ?? "<p>Lesson content was empty.</p>").slice(0, 24000),
          css: String(item.css ?? "").slice(0, 16000),
          js: String(item.js ?? "").slice(0, 12000),
        } satisfies StudySection;
      });
      if (!sections.length) throw new Error("The model did not return a learning path. Try again.");
      return NextResponse.json({ name: String(data.name ?? input.topic ?? "New course").slice(0, 120), description: String(data.description ?? "").slice(0, 500), sections });
    }
    if (input.action === "question") {
      return NextResponse.json({ replyHtml: String(data.replyHtml ?? "").slice(0, 12000), updatedHtml: String(data.updatedHtml ?? input.lesson?.html ?? "").slice(0, 24000), updatedCss: String(data.updatedCss ?? input.lesson?.css ?? "").slice(0, 16000), updatedJs: String(data.updatedJs ?? input.lesson?.js ?? "").slice(0, 12000) });
    }
    return NextResponse.json({ html: String(data.html ?? input.lesson?.html ?? "").slice(0, 24000), css: String(data.css ?? input.lesson?.css ?? "").slice(0, 16000), js: String(data.js ?? input.lesson?.js ?? "").slice(0, 12000), note: String(data.note ?? "Lesson updated.").slice(0, 300) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Something went wrong while contacting the model.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
