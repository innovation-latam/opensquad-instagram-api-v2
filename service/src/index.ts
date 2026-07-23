import Fastify from "fastify";
import { config } from "./config.js";
import { registerRoutes } from "./routes.js";

async function main(): Promise<void> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      // Não logar o corpo (pode conter news longa / dados de marca).
      redact: ["req.headers.authorization"],
    },
    bodyLimit: 2 * 1024 * 1024, // 2 MB (news até 10k chars + patch)
  });

  await registerRoutes(app);

  try {
    await app.listen({ port: config.port, host: config.host });
    app.log.info(
      `opensquad-instagram-api ouvindo em ${config.host}:${config.port} (engine=${config.engine})`,
    );
    if (config.apiTokens.length === 0) {
      app.log.warn("API_TOKENS vazio — todas as chamadas serão recusadas (fail-closed).");
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
