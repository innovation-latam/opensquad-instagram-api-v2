import { config } from "../config.js";
import type { Engine } from "./types.js";
import { StubEngine } from "./stub.js";
import { PipelineEngine } from "../pipeline/index.js";

/**
 * Seletor de motor.
 *  - "stub": copy previsível + PNG sintético (contrato-primeiro, sem deps externas).
 *  - "pipeline": OpenRouter (copy) + Playwright (render) + branding embutido.
 */
export function getEngine(): Engine {
  switch (config.engine) {
    case "pipeline":
      return new PipelineEngine();
    case "stub":
    default:
      return new StubEngine();
  }
}

/** True quando a geração é longa (minutos) e deve rodar em background com polling. */
export function isAsyncEngine(): boolean {
  return config.engine === "pipeline";
}

export type { Engine } from "./types.js";
