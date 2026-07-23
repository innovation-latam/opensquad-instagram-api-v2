import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.js";

/** Envelope de sucesso esperado pela Supercorps: o proxy desembrulha `data`. */
export function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

/** Envelope de erro: a Supercorps propaga `error` ao agente. */
export function fail(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

/**
 * Auth Supercorps → Railway: header Authorization: Bearer <token>.
 * O token deve constar em API_TOKENS. Retorna true se autorizado; caso
 * contrário responde 401 e retorna false.
 */
export function requireBearer(req: FastifyRequest, reply: FastifyReply): boolean {
  // Se nenhum token está configurado, recusa tudo (fail-closed) — evita expor o
  // serviço por engano num deploy sem API_TOKENS.
  if (config.apiTokens.length === 0) {
    reply.code(503).send(fail("Serviço sem API_TOKENS configurado."));
    return false;
  }
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !config.apiTokens.includes(token)) {
    reply.code(401).send(fail("Não autorizado."));
    return false;
  }
  return true;
}
