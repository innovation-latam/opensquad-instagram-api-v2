import { z } from "zod";

/**
 * Schemas do contrato /api/v1/carousel. Fonte: rotas-proxy da Supercorps
 * (app/api/opensquad/*) e docs/carrossel-conversacional-tool.md.
 *
 * O proxy da Supercorps monta o body a partir de um http_body_template com
 * placeholders — campos numéricos podem chegar como string. Por isso usamos
 * coerção tolerante onde o proxy pode enviar strings.
 */

export const brandSchema = z.object({
  instagramHandle: z.string().min(1, "instagramHandle é obrigatório"),
  name: z.string().optional(),
  logoUrl: z.string().url().optional(),
});

const slideCount = z.coerce.number().int().min(3).max(10).optional();
const slideNumber = z.coerce.number().int().min(1).max(10);

export const patchSchema = z
  .object({
    headline: z.string().min(1).optional(),
    text: z.string().min(1).optional(),
    cta: z.string().min(1).optional(),
    brandColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "brandColor deve ser #RRGGBB")
      .optional(),
  })
  .refine((p) => Object.keys(p).length > 0, {
    message: "patch não pode ser vazio",
  });

export const generateSchema = z.object({
  action: z.literal("generate"),
  squad: z.string().optional(),
  news: z.string().min(1).max(10000),
  angle: z.string().min(1),
  slideCount,
  orgId: z.string().min(1),
  brand: brandSchema,
});

export const statusActionSchema = z.object({
  action: z.enum(["status", "read_slides"]),
  runId: z.string().min(1),
  squad: z.string().optional(),
});

export const editSlideSchema = z.object({
  action: z.literal("edit_slide"),
  runId: z.string().min(1),
  squad: z.string().optional(),
  number: slideNumber,
  patch: patchSchema,
});

/** Discriminated union do dispatcher POST /api/v1/carousel. */
export const carouselSchema = z.discriminatedUnion("action", [
  generateSchema,
  statusActionSchema,
  editSlideSchema,
]);

export type GenerateInput = z.infer<typeof generateSchema>;
export type EditSlideInput = z.infer<typeof editSlideSchema>;
export type PatchInput = z.infer<typeof patchSchema>;

/** Rota legada POST /api/v1/generate. */
export const legacyGenerateSchema = z.object({
  news: z.string().min(1).max(10000),
  angle: z.string().min(1),
  orgId: z.string().min(1),
  slideCount,
  brand: brandSchema,
});
