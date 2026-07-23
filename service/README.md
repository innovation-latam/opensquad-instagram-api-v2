# opensquad-instagram-api (serviço HTTP)

Serviço HTTP que gera e edita carrosséis de Instagram para a integração do chat da
**supercorps-app**. É o serviço externo (deploy no Railway) que as rotas-proxy
`app/api/opensquad/*` da Supercorps já esperam.

> Contrato e configuração da tool do lado Supercorps:
> `supercorps-app/docs/carrossel-conversacional-tool.md` e
> `service/docs/integracao-supercorps.md` (neste repo).

## Arquitetura

```
Chat Supercorps → tool "Carrossel" → /api/opensquad/carousel (proxy, injeta orgId+brand)
              → ESTE serviço /api/v1/carousel (dispatcher) → generate | edit_slide | status | read
```

O serviço é **stateless do ponto de vista durável**: runs vivem em memória com TTL e o
filesystem é efêmero. A persistência durável dos slides (Supabase Storage) e o
isolamento multi-tenant (RLS por org) são responsabilidade da Supercorps. Este serviço
recebe `orgId`/`brand` já resolvidos e apenas obedece.

## Rodar localmente

```bash
cd service
npm install
API_TOKENS=um-token-forte ENGINE=stub npm run dev
# em outro terminal:
curl -s localhost:8080/health
```

Smoke test do contrato:

```bash
TOKEN=um-token-forte B=http://localhost:8080
# gerar
curl -s -X POST $B/api/v1/carousel -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"action":"generate","news":"Sua notícia","angle":"curiosidade","slideCount":4,"orgId":"org-1","brand":{"instagramHandle":"@acme"}}'
# status / editar / baixar PNG usam o runId retornado acima
```

## Contrato (`/api/v1`)

Auth: `Authorization: Bearer <token>` (token deve constar em `API_TOKENS`).
Envelope: `{ "ok": true, "data": {...} }` ou `{ "ok": false, "error": "..." }`.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | readiness (sem auth) |
| POST | `/api/v1/carousel` | dispatcher: `action` = `generate` \| `edit_slide` \| `status` \| `read_slides` |
| POST | `/api/v1/generate` | legado: equivale a `action=generate` |
| GET | `/api/v1/status/{squad}/{runId}` | `{ status, slideImages[] }` |
| GET | `/api/v1/output/{squad}/{runId}` | saída completa (inclui copy dos slides) |
| GET | `/api/v1/files/{squad}/{runId}/slides/v1/{file}` | bytes PNG do slide |

**generate** `{ action, news, angle, orgId, slideCount?, brand{instagramHandle,name?,logoUrl?} }`
→ `{ runId, squad, status, slideImages[] }`

**edit_slide** `{ action, runId, number(1-10), patch{headline?,text?,cta?,brandColor?} }`
→ regenera só aquele slide → `{ runId, editedSlide, slideImages[] }`

`status`: `running` → `completed`/`uploaded` (a Supercorps copia os PNGs pro Storage ao
ver esses) → ou `failed`.

## Variáveis de ambiente

Ver `.env.example`. Essenciais: `API_TOKENS` (auth), `PORT`, `ENGINE`.
Fase 2: `OPENROUTER_API_KEY`, `SERPAPI_API_KEY` (opcional), `OPENROUTER_MODEL_WEBSEARCH`.

## Motores (`ENGINE`)

- **`pipeline`** (produção): OpenRouter gera a copy dos slides (`src/pipeline/copy.ts`)
  → template HTML com marca embutida — logo topo-esq + `@` rodapé-esq
  (`src/pipeline/template.ts`) → render em PNG via Playwright/Chromium
  (`src/pipeline/render.ts`). A geração roda em background e a Supercorps acompanha por
  polling em `/status` (o `generate` responde `running`). Requer `OPENROUTER_API_KEY`.
- **`stub`**: copy previsível + PNG sintético válido (1080×1350), sem dependências
  externas. Útil para validar o encaixe com a Supercorps sem gastar API.

O motor é selecionado em `src/engine/index.ts` (interface `Engine` em
`src/engine/types.ts`) — a camada HTTP não conhece a implementação.

## Deploy no Railway

O `Dockerfile` usa a imagem base do Playwright (Node 20 + Chromium + libs), já pronta
para a fase 2. Configure as env vars no Railway, aponte o serviço para a pasta `service/`
e exponha a porta `$PORT`. Depois, na Supercorps, setar `OPENSQUAD_API_URL` para a URL
pública do Railway e `OPENSQUAD_API_TOKEN` = um dos valores de `API_TOKENS`.
