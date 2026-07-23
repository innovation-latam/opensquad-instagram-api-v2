/**
 * Store de runs em memória (Map + TTL).
 *
 * NOTA: single-instance apenas. Não sobrevive a restart/redeploy do Railway nem
 * a múltiplas réplicas. É aceitável porque a persistência durável dos slides é
 * responsabilidade da Supercorps (que copia os PNGs para o Supabase Storage).
 * Migrar para Redis/Postgres se escalar.
 */

export type RunStatus = "running" | "completed" | "uploaded" | "failed";

export type Slide = {
  /** 1-indexed; 1 = capa. */
  number: number;
  headline: string;
  text: string;
  cta: string;
  brandColor: string;
  /** Nome do arquivo servido em /api/v1/files/{squad}/{runId}/slides/v1/{file}. */
  file: string;
  /** Bytes do PNG renderizado. */
  png: Buffer;
};

export type Brand = {
  instagramHandle: string;
  name?: string;
  logoUrl?: string;
};

export type Run = {
  runId: string;
  squad: string;
  orgId: string;
  status: RunStatus;
  news: string;
  angle: string;
  slideCount: number;
  brand: Brand;
  slides: Slide[];
  error?: string;
  createdAt: number;
  updatedAt: number;
};

const TTL_MS = 2 * 60 * 60 * 1000; // 2h, alinhado ao job-store da Supercorps
const runs = new Map<string, Run>();

function sweep(): void {
  const now = Date.now();
  for (const [id, run] of runs) {
    if (now - run.updatedAt > TTL_MS) runs.delete(id);
  }
}

export function createRun(input: {
  runId: string;
  squad: string;
  orgId: string;
  news: string;
  angle: string;
  slideCount: number;
  brand: Brand;
}): Run {
  sweep();
  const now = Date.now();
  const run: Run = {
    ...input,
    status: "running",
    slides: [],
    createdAt: now,
    updatedAt: now,
  };
  runs.set(run.runId, run);
  return run;
}

export function getRun(runId: string): Run | undefined {
  return runs.get(runId);
}

export function updateRun(runId: string, patch: Partial<Run>): Run | undefined {
  const run = runs.get(runId);
  if (!run) return undefined;
  Object.assign(run, patch, { updatedAt: Date.now() });
  return run;
}

/** Nomes de arquivo dos slides, na ordem — é o formato de slideImages[] que a Supercorps consome. */
export function slideFileNames(run: Run): string[] {
  return [...run.slides].sort((a, b) => a.number - b.number).map((s) => s.file);
}
