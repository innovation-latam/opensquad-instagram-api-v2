import type { Brand, Slide } from "../runs.js";
import type { Engine } from "../engine/types.js";
import { generateCopy, type SlideCopy } from "./copy.js";
import { renderHtmlToPng } from "./render.js";
import { slideHtml } from "./template.js";

/**
 * PipelineEngine — motor real (fase 2).
 * Fluxo: OpenRouter gera a copy → template HTML (com logo topo-esq + @ rodapé-esq)
 * → Playwright renderiza cada slide em PNG.
 */

const DEFAULT_BRAND_COLOR = "#E1306C";

function fileName(n: number): string {
  return `slide-${String(n).padStart(2, "0")}.png`;
}

async function renderSlide(
  copy: SlideCopy,
  brandColor: string,
  brand: Brand,
  isCover: boolean,
): Promise<Slide> {
  const html = slideHtml({ copy, brandColor, brand, isCover });
  const png = await renderHtmlToPng(html);
  return {
    number: copy.number,
    headline: copy.headline,
    text: copy.text,
    cta: copy.cta,
    brandColor,
    file: fileName(copy.number),
    png,
  };
}

export class PipelineEngine implements Engine {
  async generate(input: {
    runId: string;
    squad: string;
    news: string;
    angle: string;
    slideCount: number;
    brand: Brand;
  }): Promise<Slide[]> {
    const total = input.slideCount || 8;
    const copies = await generateCopy({
      news: input.news,
      angle: input.angle,
      slideCount: total,
      brandName: input.brand.name,
      instagramHandle: input.brand.instagramHandle,
    });

    // Renderiza sequencialmente para não saturar o Chromium num container pequeno.
    const slides: Slide[] = [];
    for (const copy of copies) {
      slides.push(
        await renderSlide(copy, DEFAULT_BRAND_COLOR, input.brand, copy.number === 1),
      );
    }
    return slides;
  }

  async editSlide(input: {
    runId: string;
    squad: string;
    slides: Slide[];
    number: number;
    patch: { headline?: string; text?: string; cta?: string; brandColor?: string };
    brand: Brand;
  }): Promise<Slide> {
    const current = input.slides.find((s) => s.number === input.number);
    if (!current) {
      throw new Error(`Slide ${input.number} não existe neste carrossel.`);
    }
    const copy: SlideCopy = {
      number: current.number,
      headline: input.patch.headline ?? current.headline,
      text: input.patch.text ?? current.text,
      cta: input.patch.cta ?? current.cta,
    };
    const brandColor = input.patch.brandColor ?? current.brandColor;
    return renderSlide(copy, brandColor, input.brand, current.number === 1);
  }
}
