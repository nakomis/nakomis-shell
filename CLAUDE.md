# nakomis-shell

Module Federation host for `app.nakomis.com` / `app.sandbox.nakomis.com`. Remotes plug in via `contract/shell-contract.ts`.

## AWS credentials

- Sandbox: `AWS_PROFILE=nakom.is-sandbox`
- Production: `AWS_PROFILE=nakom.is-admin` (or `nakom.is-prod`)

## Repository layout

- `web/` — host app (pnpm, Vite 8, Vitest, Biome, MUI 7)
- `infra/` — CDK (pnpm, Jest)
- `contract/` — host/remote contract, copied into each remote. Bump `CONTRACT_VERSION` on breaking changes.

## Conventions

- Only `react`/`react-dom` are MF-shared. Don't add MUI or react-router to `shared`: remotes are on different majors.
- Remote list per env lives in `infra/lib/env-config.ts` (`REMOTES`). The Sandbox remote must never appear in prod.
- Lockfiles are pnpm; never commit a `package-lock.json` (the home Nexus proxy URL would leak into it).

## Testing

```bash
cd web && pnpm lint && pnpm test      # Vitest, ≥70% lines
cd infra && pnpm test                 # Jest, ≥70% lines
```

## Architecture diagrams

Source: `docs/architecture/nakomis-shell.drawio` — SVG auto-regenerated on commit by `.githooks/pre-commit`.

```bash
git config core.hooksPath .githooks
```
