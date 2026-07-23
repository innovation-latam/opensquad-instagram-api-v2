# Integração com a supercorps-app

Este documento descreve o que configurar **na supercorps-app** para plugar o serviço
`service/` (deploy no Railway) ao chat. O código do lado Supercorps **já existe** — aqui
é só configuração. Nenhuma alteração de runtime na Supercorps é necessária.

## Visão geral

```
Chat → tool "Carrossel" → app/api/opensquad/carousel (proxy, já existe)
     → OPENSQUAD_API_URL /api/v1/carousel (este serviço, no Railway)
```

O proxy da Supercorps valida o tenant, injeta `orgId` + branding (de `organizations`),
faz polling e copia os slides para o Supabase Storage. As imagens aparecem no chat via
`data.slideImages[]` (mecanismo genérico já existente).

## Parte 1 — Variáveis de ambiente (Supercorps)

Adicionar ao ambiente da supercorps-app (e ao `.env.example` dela, onde hoje faltam):

| Var | Valor |
|---|---|
| `OPENSQUAD_API_URL` | URL pública do Railway (ex.: `https://opensquad-instagram-api.up.railway.app`) |
| `OPENSQUAD_API_TOKEN` | Um dos tokens de `API_TOKENS` do Railway |
| `OPENSQUAD_INTERNAL_SECRET` | Segredo das chamadas internas da tool (header `x-internal-secret`). Se ausente, cai no `OPENSQUAD_API_TOKEN`. |

No Railway (serviço `service/`): `API_TOKENS` (== `OPENSQUAD_API_TOKEN`), `PORT`,
`ENGINE`, e (fase 2) `OPENROUTER_API_KEY`, `SERPAPI_API_KEY`.

## Parte 2 — Cadastrar a tool "Carrossel" (super_admin)

No admin de ferramentas da Supercorps, criar a tool conforme
`supercorps-app/docs/carrossel-conversacional-tool.md`:

- **http_url:** `https://SEU_APP/api/opensquad/carousel`
- **http_headers:**
  ```json
  {
    "x-internal-secret": "${env:OPENSQUAD_INTERNAL_SECRET}",
    "x-user-id": "${ctx:user_id}",
    "x-org-id": "${ctx:org_id}"
  }
  ```
- **http_body_template** e **input_schema:** exatamente como no doc citado
  (`action`/`squad`/`news`/`angle`/`slideCount`/`runId`/`number`/`patch`;
  `action` enum = `generate|edit_slide|read_slides|status`).

Habilitar a tool no agente do carrossel.

> Observação: a tool **não** está versionada em migration — é cadastro manual do
> super_admin. Ao recriar o ambiente do zero, recadastrar.

## Parte 3 — Pré-requisito por organização

Cada org precisa de `organizations.instagram_handle` preenchido (Admin → Organização).
Sem ele, o proxy retorna **422 `BRAND_NOT_CONFIGURED`**. O `logo_url` é opcional (usado
no overlay de marca na fase 2).

## Como as garantias são atendidas

- **Isolamento entre usuários/orgs:** a Supercorps injeta `x-org-id`/`x-user-id`
  (resolvidos de `user_id → organization_id`), aplica RLS em `squad_runs`, e o Railway só
  aceita chamadas com `Bearer`. O usuário nunca fala direto com o Railway.
- **Imagens por org no bucket:** a Supercorps copia os PNGs para
  `storage-generate-slides-post-instagram` em `{orgId}/carousels/{runId}/{file}`.
- **Editar carrossel de um chat antigo:** via `edit_slide(runId, number, patch)`. O
  `runId` identifica o carrossel (não o chat); o LLM reusa o `runId` da conversa.
- **Memória no Railway:** runs são efêmeros (TTL em memória, filesystem descartável). A
  durabilidade fica no Supabase.

## Roadmap (fora da v1)

- Motor `pipeline` (OpenRouter + Playwright + overlay logo/@) — ver `service/README.md`.
- Geração de **imagem única** avulsa (nova ação/tool reusando o pipeline).
- Preferências de estilo persistentes por org (cor de fundo padrão, tom) — nova
  coluna/tabela + enviar no `brand{}`.
- Publicação direta no Instagram (skill `instagram-publisher`).
