# Operator UX and automatic deployment implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Independent component and workflow tasks may run in parallel under superpowers:dispatching-parallel-agents.

**Goal:** Fix all six operator walkthrough findings and deploy verified main pushes automatically to the existing Cloudflare Pages URL.

**Architecture:** Keep financial rules and persisted formats unchanged. Presentation owns stable rows, draft undo, common dialogs and receipt details. GitHub Actions validates and builds once, then deploys the tested artifact on main with a dedicated Cloudflare token.

**Tech Stack:** React, TypeScript, Dexie, Playwright, Vitest, GitHub Actions, Wrangler Pages.

**Spec:** `docs/superpowers/specs/2026-10-31-operator-ux.md`, approved in the user's request to implement all findings. Automatic deployment extends that scope.

## Global constraints

- No real business data, browser reset, DB schema or stored command changes.
- Preserve price snapshots, atomic saves, operation identity and ticket reuse restrictions.
- Shared 40px controls, paper/ink/yellow palette; text for financial decisions.
- Keep preview 4173 running; browser tests use 4273 and isolated data.
- Logical Conventional Commits; integrate and push main as explicitly requested.

## Review focus

- Double clicks and held Enter must never complete a different order.
- Same ticket, minute, contents and total must still offer distinguishable details.
- Old drafts and legacy prices must survive mode changes and clear/undo.
- At 1280×640, primary cash actions remain accessible without overlapping inputs.
- Fork PRs and failed checks cannot deploy; missing credentials cannot appear successful.

## Tasks

### 1. Stable handoff and identifiable order details

Files: `Waiting.tsx`, `History.tsx`, `RefundDialog.tsx`, new receipt/presentation CSS, `tests/e2e/handoff-details.spec.ts`.
Consumes Snapshot/Order and Shared; produces presentation-only UI; no storage mutation outside Cashier commands.

- [x] Add failing regression tests for two clicks/held Enter, reuse restriction explanation and matching details in history/refund.
- [x] Run tests and verify expected failures.
- [x] Retain completed row position; suppress unintended repeat input, maintain safe undo, improve queue density/search; share receipt details across dialogs.
- [x] Run affected tests and commit `fix: make cashier workflows stable and recoverable`.

### 2. Applied selling price and unsaved menu edits

Files: `MenuSettings.tsx`, dedicated CSS, `tests/e2e/menu-mode.spec.ts`, relevant existing E2E expectations.
Consumes active Price and Shared; writes existing price command; separates active selling mode from unsaved catalog draft.

- [x] Add failing tests for immediate explicit mode apply, retained unsaved edits, save preserving latest mode and old order price.
- [x] Run tests and verify expected failures.
- [x] Place applied mode controls at top, show unsaved edits, keep save visible; never implicitly save draft catalog while switching mode.
- [x] Run affected tests and commit `fix: make cashier workflows stable and recoverable`.

### 3. Cashier correction, undo and adaptive height

Files: `Checkout.tsx`, `controls.tsx` if necessary, `styles.css`/dedicated CSS, `tests/e2e/cashier-corrections.spec.ts`.
Consumes Draft and Cashier; restores only local draft, uses existing discard/cancel commands after explicit cash confirmation.

- [x] Add failing tests for draft clear/undo with frozen price, common correction dialog and visible stable primary buttons at 1280×640.
- [x] Run tests and verify expected failures.
- [x] Implement reversible clear, consistent correction dialog, adaptive product scroll and primary action layout; remove product selection background.
- [x] Run affected tests and commit `fix: make cashier workflows stable and recoverable`.

### 4. Validated push deployment

Files: `.github/workflows/*`, `.github/dependabot.yml`, `docs/deployment.md`, formatting configuration/scripts if required.
Consumes main push/PR; produces checks and a build artifact; deploy consumes only a successful trusted-main build.

- [x] Check current official GitHub/Cloudflare instructions and exact action versions.
- [x] Add check/unit/format/build/E2E workflow, failure traces, minimal permissions, deployment concurrency and Cloudflare secrets preflight.
- [x] Validate workflow syntax and security; document restricted Pages API token and repository variable.
- [x] Configure available credentials without logging values; request only missing account authorization from user if required.
- [x] Commit `ci: deploy verified main builds to Cloudflare Pages`.

### 5. Integrated verification and release

- [x] Update requirements/frontend/operations/acceptance and concise README as appropriate.
- [x] Run `npm run check`, `npm test`, `npm run format:check`, `npm run build`, `npm run test:e2e`; inspect real screenshots and keyboard interaction.
- [x] Fresh whole-branch review and fix material findings; rerun affected checks.
- [x] Integrate logical commits into main; push; watch GitHub checks/deploy and verify production response and isolated cashier flow.
- [x] Report actual outcome, including any outstanding credential prerequisite.

## Execution notes

- Baseline: 92 unit tests passing before implementation; no existing `.github` workflows.
- Work on `codex/operator-ux-autodeploy` in the existing clean checkout, retaining the user's running preview.
- Dedicated Cloudflare API token is required for CI; Wrangler's local OAuth session is not a suitable CI credential.
- Verification: 92 unit tests and 52 browser tests passed; type, formatting, actionlint and diff checks passed. Independent review found two many-product layout issues, both reproduced in failing tests and fixed; reviewer confirmed resolution.
- Ruling: Group the connected UI changes in one commit, because shared adaptive-height rules and cross-feature operator tests exercise handoff, price mode and correction together. Keep CI and operational documentation in separate commits.
- Token creation explicitly approved by user: Pages Edit for the selected account, expiry 2027-10-31. GitHub repository variable and encrypted repository secret configured; automatic deployment succeeded in run 41171116833, attempt 2. No token value is written to source, logs or chat.

- Release: main contains 9f37014 (operator UX), 2cdda80 (CI), 9e9fa0e (documentation). The initial main push passed all verification; after secret registration, the failed deployment job was rerun successfully using its original verified artifact. Production uses the same Pages URL.
