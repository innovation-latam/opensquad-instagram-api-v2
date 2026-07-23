import type { Brand, Slide } from "../runs.js";

/**
 * Motor de geração de carrossel. Abstração plugável:
 *  - StubEngine (fase contrato-primeiro): slides mock com PNG sintético.
 *  - PipelineEngine (fase 2): OpenRouter para copy + Playwright para render + overlay de marca.
 *
 * A camada HTTP não conhece a implementação — só este contrato.
 */
export interface Engine {
  /** Gera os slides de um novo carrossel. */
  generate(input: {
    runId: string;
    squad: string;
    news: string;
    angle: string;
    slideCount: number;
    brand: Brand;
  }): Promise<Slide[]>;

  /** Regenera UM slide aplicando o patch (mantém os demais). */
  editSlide(input: {
    runId: string;
    squad: string;
    slides: Slide[];
    number: number;
    patch: {
      headline?: string;
      text?: string;
      cta?: string;
      brandColor?: string;
    };
    brand: Brand;
  }): Promise<Slide>;
}
