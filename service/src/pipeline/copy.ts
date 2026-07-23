import { config } from "../config.js";

/**
 * Geração de copy dos slides via OpenRouter (chat/completions).
 * Segue o best-practice de carrossel do opensquad: duas camadas de texto por
 * slide (headline forte + supporting text), capa que "para o scroll" e último
 * slide com CTA.
 */

export type SlideCopy = {
  number: number;
  headline: string;
  text: string;
  cta: string;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const COPY_MODEL = process.env.OPENROUTER_MODEL_COPY ?? "anthropic/claude-sonnet-5";

const ANGLE_HINTS: Record<string, string> = {
  educacional: "tom didático, ensina algo útil e acionável",
  medo: "alerta sobre um risco ou perda iminente, sem sensacionalismo barato",
  entusiasmo: "energia positiva, celebra uma novidade ou oportunidade",
  curiosidade: "abre um gap de curiosidade que só fecha ao avançar os slides",
  polemica: "toma uma posição contraintuitiva e a defende com argumento",
  empatia: "fala com a dor/realidade do público e acolhe",
};

function buildPrompt(input: {
  news: string;
  angle: string;
  slideCount: number;
  brandName?: string;
  instagramHandle: string;
}): string {
  const { news, angle, slideCount, brandName, instagramHandle } = input;
  const angleHint = ANGLE_HINTS[angle] ?? angle;
  return [
    `Você é redator de carrosséis de Instagram para a marca ${brandName ?? instagramHandle} (${instagramHandle}).`,
    `Crie a copy de um carrossel de EXATAMENTE ${slideCount} slides sobre o conteúdo abaixo.`,
    `Ângulo editorial: ${angle} — ${angleHint}.`,
    "",
    "Regras:",
    "- Slide 1 é a CAPA: headline curta e magnética que para o scroll; text vazio ou muito curto.",
    "- Slides do meio: cada um traz UM ponto. Headline = a afirmação principal (curta, impactante);",
    "  text = 1-2 frases de apoio (dado, exemplo ou contexto), 20-60 palavras.",
    `- Último slide: CTA claro convidando a seguir ${instagramHandle} ou salvar/compartilhar.`,
    "- Português do Brasil. Sem hashtags. Sem emojis em excesso (no máximo 1 por slide).",
    "",
    "CONTEÚDO:",
    news,
    "",
    "Responda APENAS com um JSON no formato:",
    '{"slides":[{"number":1,"headline":"...","text":"...","cta":"..."}, ...]}',
    "Sem texto fora do JSON. `cta` só no último slide (vazio nos demais).",
  ].join("\n");
}

/** Extrai o primeiro objeto JSON de uma string (tolerante a cercas de código). */
function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : raw).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Resposta do modelo sem JSON.");
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function generateCopy(input: {
  news: string;
  angle: string;
  slideCount: number;
  brandName?: string;
  instagramHandle: string;
}): Promise<SlideCopy[]> {
  if (!config.openrouterApiKey) {
    throw new Error("OPENROUTER_API_KEY não configurado.");
  }

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openrouterApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: COPY_MODEL,
      messages: [{ role: "user", content: buildPrompt(input) }],
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter (copy) status ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content) as { slides?: unknown };

  if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    throw new Error("Modelo não retornou slides válidos.");
  }

  return parsed.slides.map((s, i): SlideCopy => {
    const slide = s as Partial<SlideCopy>;
    return {
      number: typeof slide.number === "number" ? slide.number : i + 1,
      headline: String(slide.headline ?? "").trim(),
      text: String(slide.text ?? "").trim(),
      cta: String(slide.cta ?? "").trim(),
    };
  });
}
