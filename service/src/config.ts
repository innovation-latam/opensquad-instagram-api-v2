/**
 * Configuração via variáveis de ambiente.
 * Ver docs/carrossel-conversacional-tool.md (supercorps-app) para o contrato.
 */

function parseTokens(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT ?? 8080),
  host: process.env.HOST ?? "0.0.0.0",

  /** Tokens aceitos no header Authorization: Bearer <token>. Deve bater com OPENSQUAD_API_TOKEN da Supercorps. */
  apiTokens: parseTokens(process.env.API_TOKENS),

  /** Chave do OpenRouter — usada na fase real (geração de copy + imagem). */
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",

  /** Modelo de web search para dados de marca (opcional). */
  openrouterWebsearchModel: process.env.OPENROUTER_MODEL_WEBSEARCH ?? "perplexity/sonar:online",

  /** Busca de logos reais (opcional). Sem ela, a geração cai em fallback. */
  serpapiApiKey: process.env.SERPAPI_API_KEY ?? "",

  /**
   * Motor de geração. "stub" devolve slides mock (fase contrato-primeiro);
   * "pipeline" usa OpenRouter + render real (fase 2).
   */
  engine: (process.env.ENGINE ?? "stub") as "stub" | "pipeline",

  /** Diretório de trabalho efêmero por run (autolimpo; durabilidade fica no Supabase da Supercorps). */
  runsDir: process.env.RUNS_DIR ?? "/tmp/opensquad-runs",

  /** Squad default quando não informado (alinhado ao proxy da Supercorps). */
  defaultSquad: "carousel-noticias",
} as const;

export type AppConfig = typeof config;
