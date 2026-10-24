# Northstar landing page lab

Northstar is a polished, standalone SaaS landing page used to exercise
PatchPilot against a realistic React + TypeScript project. It has no backend,
paid API, database, authentication service, or environment secrets.

## Run locally

```powershell
cd C:\Users\Asus\patchai\landing-page-lab
npm install
npm run dev
```

Open the local Vite URL shown in the terminal.

## Validate

```powershell
npm test
npm run build
```

The signup form is intentionally a local demo: successful validation shows a
local preview message and does not subscribe an address anywhere.

## Project structure

- `src/App.tsx` — composed page sections and local interaction state.
- `src/lib/validation.ts` — pure email and signup validation logic.
- `src/lib/pricing.ts` — pure billing and annual discount calculations.
- `src/styles.css` — responsive visual system and dashboard illustration.
- `docs/PATCHPILOT_TEST.md` — isolated controlled-bug workflow.

See [docs/PATCHPILOT_TEST.md](docs/PATCHPILOT_TEST.md) before introducing the
intentional validation bug.
