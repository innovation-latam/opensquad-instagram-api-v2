import type { Brand, Slide } from "../runs.js";
import type { Engine } from "./types.js";
import { hexToRgb, solidPng } from "./png.js";

/**
 * Motor STUB — fase contrato-primeiro.
 *
 * Não chama OpenRouter nem renderiza HTML. Produz copy previsível e um PNG
 * sintético válido por slide, para validar o encaixe end-to-end com a Supercorps
 * (auth, store, /files, cópia para Storage, exibição no chat, edit_slide) ANTES
 * de plugar a geração real. Substituído por PipelineEngine na fase 2.
 */

const DEFAULT_BRAND_COLOR = "#E1306C"; // rosa Instagram, placeholder

const WIDTH = 1080;
const HEIGHT = 1350; // 4:5, formato de feed

function slideFileName(runId: string, number: number): string {
  return `slide-${String(number).padStart(2, "0")}.png`;
}

function renderStubSlide(slide: Omit<Slide, "png" | "file">, runId: string): Slide {
  const png = solidPng(WIDTH, HEIGHT, hexToRgb(slide.brandColor));
  return {
    ...slide,
    file: slideFileName(runId, slide.number),
    png,
  };
}

export class StubEngine implements Engine {
  async generate(input: {
    runId: string;
    squad: string;
    news: string;
    angle: string;
    slideCount: number;
    brand: Brand;
  }): Promise<Slide[]> {
    const { runId, news, angle, slideCount, brand } = input;
    const total = slideCount || 5;
    const handle = brand.instagramHandle.startsWith("@")
      ? brand.instagramHandle
      : `@${brand.instagramHandle}`;

    const slides: Slide[] = [];
    for (let n = 1; n <= total; n++) {
      const isCover = n === 1;
      const isLast = n === total;
      slides.push(
        renderStubSlide(
          {
            number: n,
            headline: isCover
              ? `[STUB] ${news.slice(0, 48)}`
              : `Slide ${n} — ângulo: ${angle}`,
            text: isCover
              ? `Carrossel mock gerado pelo StubEngine (${handle}).`
              : `Conteúdo de exemplo do slide ${n}. Substituído pela copy real na fase 2.`,
            cta: isLast ? `Siga ${handle}` : "",
            brandColor: DEFAULT_BRAND_COLOR,
          },
          runId,
        ),
      );
    }
    return slides;
  }

  async editSlide(input: {
    runId: string;
    slides: Slide[];
    number: number;
    patch: { headline?: string; text?: string; cta?: string; brandColor?: string };
  }): Promise<Slide> {
    const { runId, slides, number, patch } = input;
    const current = slides.find((s) => s.number === number);
    if (!current) {
      throw new Error(`Slide ${number} não existe neste carrossel.`);
    }
    // Aplica só os campos presentes no patch; re-renderiza apenas este slide.
    const merged = {
      number: current.number,
      headline: patch.headline ?? current.headline,
      text: patch.text ?? current.text,
      cta: patch.cta ?? current.cta,
      brandColor: patch.brandColor ?? current.brandColor,
    };
    return renderStubSlide(merged, runId);
  }
}
