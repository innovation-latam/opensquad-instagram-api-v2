import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { config } from "./config.js";
import { getEngine, isAsyncEngine } from "./engine/index.js";
import { fail, ok, requireBearer } from "./http.js";
import {
  createRun,
  getRun,
  slideFileNames,
  updateRun,
  type Run,
} from "./runs.js";
import {
  carouselSchema,
  editSlideSchema,
  generateSchema,
  legacyGenerateSchema,
} from "./schemas.js";

function newRunId(): string {
  // ISO curto + uuid parcial: legível e único.
  return `run_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/** Roda a geração e marca o run como completed/failed. Assíncrono do ponto de vista do contrato. */
async function runGeneration(run: Run): Promise<void> {
  try {
    const engine = getEngine();
    const slides = await engine.generate({
      runId: run.runId,
      squad: run.squad,
      news: run.news,
      angle: run.angle,
      slideCount: run.slideCount,
      brand: run.brand,
    });
    updateRun(run.runId, { slides, status: "completed" });
  } catch (err) {
    updateRun(run.runId, {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Health check para o Railway (sem auth).
  app.get("/health", async () => ok({ status: "up", engine: config.engine }));

  // Dispatcher principal estilo MCP.
  app.post("/api/v1/carousel", async (req, reply) => {
    if (!requireBearer(req, reply)) return;

    const parsed = carouselSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send(fail(zodMessage(parsed.error)));
    }
    const input = parsed.data;

    if (input.action === "generate") {
      return handleGenerate(reply, {
        squad: input.squad || config.defaultSquad,
        news: input.news,
        angle: input.angle,
        slideCount: input.slideCount ?? 0,
        orgId: input.orgId,
        brand: input.brand,
      });
    }

    if (input.action === "status" || input.action === "read_slides") {
      const run = getRun(input.runId);
      if (!run) return reply.code(404).send(fail("runId não encontrado."));
      return reply.send(
        ok({
          runId: run.runId,
          squad: run.squad,
          status: run.status,
          slideImages: slideFileNames(run),
          ...(input.action === "read_slides" && { slides: publicSlides(run) }),
          ...(run.error && { error: run.error }),
        }),
      );
    }

    if (input.action === "edit_slide") {
      return handleEditSlide(reply, input);
    }

    return reply.code(400).send(fail("Ação desconhecida."));
  });

  // Rota legada equivalente ao generate.
  app.post("/api/v1/generate", async (req, reply) => {
    if (!requireBearer(req, reply)) return;
    const parsed = legacyGenerateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send(fail(zodMessage(parsed.error)));
    }
    const input = parsed.data;
    return handleGenerate(reply, {
      squad: config.defaultSquad,
      news: input.news,
      angle: input.angle,
      slideCount: input.slideCount ?? 0,
      orgId: input.orgId,
      brand: input.brand,
    });
  });

  // GET status.
  app.get<{ Params: { squad: string; runId: string } }>(
    "/api/v1/status/:squad/:runId",
    async (req, reply) => {
      if (!requireBearer(req, reply)) return;
      const run = getRun(req.params.runId);
      if (!run) return reply.code(404).send(fail("runId não encontrado."));
      return reply.send(
        ok({
          runId: run.runId,
          squad: run.squad,
          status: run.status,
          slideImages: slideFileNames(run),
          ...(run.error && { error: run.error }),
        }),
      );
    },
  );

  // GET output completo.
  app.get<{ Params: { squad: string; runId: string } }>(
    "/api/v1/output/:squad/:runId",
    async (req, reply) => {
      if (!requireBearer(req, reply)) return;
      const run = getRun(req.params.runId);
      if (!run) return reply.code(404).send(fail("runId não encontrado."));
      return reply.send(
        ok({
          runId: run.runId,
          squad: run.squad,
          status: run.status,
          news: run.news,
          angle: run.angle,
          brand: run.brand,
          slideImages: slideFileNames(run),
          slides: publicSlides(run),
          ...(run.error && { error: run.error }),
        }),
      );
    },
  );

  // GET bytes do PNG de um slide. Path fixo /slides/v1/{file} espelha o contrato.
  app.get<{ Params: { squad: string; runId: string; file: string } }>(
    "/api/v1/files/:squad/:runId/slides/v1/:file",
    async (req, reply) => {
      if (!requireBearer(req, reply)) return;
      const { runId, file } = req.params;

      // Anti path-traversal: só aceitamos nomes de slide conhecidos.
      if (!/^slide-\d{2}\.png$/.test(file)) {
        return reply.code(400).send(fail("Nome de arquivo inválido."));
      }
      const run = getRun(runId);
      if (!run) return reply.code(404).send(fail("runId não encontrado."));
      const slide = run.slides.find((s) => s.file === file);
      if (!slide) return reply.code(404).send(fail("Slide não encontrado."));

      reply.header("Content-Type", "image/png");
      reply.header("Cache-Control", "public, max-age=3600");
      return reply.send(slide.png);
    },
  );
}

// ---- helpers de handler ----

async function handleGenerate(
  reply: FastifyReply,
  input: {
    squad: string;
    news: string;
    angle: string;
    slideCount: number;
    orgId: string;
    brand: z.infer<typeof generateSchema>["brand"];
  },
) {
  const runId = newRunId();
  const run = createRun({
    runId,
    squad: input.squad,
    orgId: input.orgId,
    news: input.news,
    angle: input.angle,
    slideCount: input.slideCount,
    brand: input.brand,
  });

  if (isAsyncEngine()) {
    // Pipeline real leva minutos: dispara em background e responde já com
    // status "running". A Supercorps faz polling via /status até "completed".
    void runGeneration(run);
  } else {
    // Stub é instantâneo — aguarda e já responde "completed".
    await runGeneration(run);
  }

  return reply.send(
    ok({
      runId: run.runId,
      squad: run.squad,
      status: run.status,
      slideImages: slideFileNames(run),
    }),
  );
}

async function handleEditSlide(
  reply: FastifyReply,
  input: z.infer<typeof editSlideSchema>,
) {
  const run = getRun(input.runId);
  if (!run) return reply.code(404).send(fail("runId não encontrado."));

  try {
    const engine = getEngine();
    const updated = await engine.editSlide({
      runId: run.runId,
      squad: run.squad,
      slides: run.slides,
      number: input.number,
      patch: input.patch,
      brand: run.brand,
    });
    const slides = run.slides.map((s) => (s.number === updated.number ? updated : s));
    updateRun(run.runId, { slides });

    return reply.send(
      ok({
        runId: run.runId,
        squad: run.squad,
        status: run.status,
        editedSlide: updated.number,
        slideImages: slideFileNames({ ...run, slides }),
      }),
    );
  } catch (err) {
    return reply.code(400).send(fail(err instanceof Error ? err.message : String(err)));
  }
}

/** Versão pública dos slides (sem os bytes do PNG). */
function publicSlides(run: Run) {
  return [...run.slides]
    .sort((a, b) => a.number - b.number)
    .map(({ png: _png, ...rest }) => rest);
}

function zodMessage(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
}
