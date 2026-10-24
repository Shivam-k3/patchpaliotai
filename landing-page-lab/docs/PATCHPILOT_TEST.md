# Testing Northstar with PatchPilot

Northstar is a standalone React + TypeScript + Vite project. Keep the main
copy passing and introduce the controlled bug only in a disposable worktree or
copy.

## Establish a clean baseline

From PowerShell:

```powershell
cd C:\Users\Asus\patchai\landing-page-lab
npm install
npm test
npm run build
```

To use a Git worktree when this project is tracked:

```powershell
cd C:\Users\Asus\patchai
git worktree add ..\northstar-bug-demo HEAD -- landing-page-lab
cd ..\northstar-bug-demo\landing-page-lab
```

If it is not tracked, copy the directory to a disposable location instead.

## Introduce the controlled bug

In the isolated copy, edit `src/lib/validation.ts` and change the final
success branch of `validateEmail` so it rejects valid addresses:

```ts
return { valid: false, message: "Enter a valid email address." };
```

Do not make this edit in the main `landing-page-lab` directory.

Run:

```powershell
npm test
npm run build
```

The email-validation tests and signup interaction test should fail because
`alex@example.com` is incorrectly rejected. The build should still compile;
the behavioral failure is the evidence for this bug.

## Ask PatchPilot to repair it

Use this exact bug report:

> Valid email addresses such as `alex@example.com` are rejected by the Northstar
> signup form. Restore the validation behavior while preserving whitespace
> trimming, malformed-address rejection, accessible error feedback, and the
> local demo success message.

Project-relative files in scope:

- `src/lib/validation.ts`
- `src/App.tsx`
- `src/lib/validation.test.ts`
- `src/App.test.tsx`

Review PatchPilot's generated unified diff before applying it. Apply it only
inside the isolated copy. Never apply it to the original working tree.

After applying the reviewed patch:

```powershell
npm test
npm run build
```

Compare the isolated baseline and patched results. Confirm the validation and
signup tests pass, the build succeeds, and no unrelated tests regress.

## Current PatchPilot limitation

PatchPilot currently discovers predefined directories directly under its own
`samples` directory. It does not accept an arbitrary project root or arbitrary
test command through the existing UI/API. This project is therefore a realistic
external test repository, but it cannot be selected directly by the current
PatchPilot workflow without a separately reviewed backend enhancement for safe
project-root registration and command allowlisting.
