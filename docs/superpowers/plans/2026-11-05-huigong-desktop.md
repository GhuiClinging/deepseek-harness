# Huigong desktop implementation plan

English | [中文](2026-11-05-huigong-desktop.zh.md)

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task by task. Track completed checks and decisions in the execution ledger.

**Goal:** Deliver a locally installable macOS ARM64 application named 辉总后宫智囊团 with independent storage, configurable 彤答应 persona, and reusable customer branding.

**Architecture:** An opt-in brand descriptor feeds the existing packaging pipeline and packaged application metadata. Runtime persona settings live outside the application bundle and use existing profile and prompt mechanisms. Unselected upstream builds retain their behavior.

**Tech stack:** TypeScript, Node.js, Electron, React, Cordis, existing electron-builder and Vitest.

**Spec:** [Approved design](../specs/2026-11-05-desktop-branding-design.md).

## Global constraints

- Owner-approved name: 辉总后宫智囊团; wordmark: 辉总 · 后宫智囊团; internal brand ID: `huigong`; application ID: `com.guohui.huigong`; external protocol: `huigong`.
- Default persona: 彤答应, 女仆长, addresses the user as 主人. Welcome: 欢迎回来，主人。今天有什么事务交给我？ Completion style example: 主人，结果已经整理好了，请过目。
- First artifact: `mac-arm64`, unsigned local test build `0.2.2-alpha.3.20261105.1`. No signing credentials, publication, push, CI edits, or automatic commits.
- Keep model-provider names and legal notices accurate. Product identity is configurable; upstream SDK/package names are unchanged.
- Keep existing model logging, permissions, approvals, and Session formats. New persona inputs need keyless logged-request evidence.
- First branded composition uses API keys and manual upgrades; omit upstream account/billing surfaces and product analytics/feedback uploads.
- Execute in the existing checkout on the dedicated local branch `feat/huigong-desktop`, preserving its installed dependencies and the owner's processes. Existing uncommitted files are the design documents produced for this task.

## Review focus

- Two brand identities must never share sessions, credentials, profile locks, protocol handlers, or output directories.
- A package moved away from the source tree must resolve its own runtime resources.
- Invalid descriptors or runtime persona files must report the specific error before dependent work; do not silently use upstream defaults.
- Branded builds must not acquire upstream updater, account, or analytics behavior through a missing optional value.
- Editing a role after installation must affect the model instructions without changing or resigning the application bundle.

## Task 1: Brand descriptor and packaging

**Files:** Create `apps/desktop/src/brand.ts`, `apps/desktop/brands/huigong/brand.json`, temporary icon assets and focused brand tests; modify `apps/desktop/scripts/package-target.ts`, `desktop-package-environment.mjs`, `desktop-build-paths.mjs`, `electron-builder-config.mjs`, `package-macos.ts`, required declarations, and `scripts/client-build-environment.ts` with its focused tests.

**Interfaces:** Produce `DesktopBrand`, `parseDesktopBrand(value: unknown): DesktopBrand`, and a build descriptor loader with resolved icon files. `DesktopBrand` contains `id`, `name`, `wordmark`, `appId`, `protocol`, `storageNamespace`, `mark`, and `persona` (`name`, `address`, `greeting`, `instructions`, `completion`). Put validated public metadata under packaged manifest `dshDesktopBrand`. The internal serialized environment carrier is `DSH_DESKTOP_BRAND`; the new project-owned package option is `--brand <descriptor-file>`. Client public values include `DSH_CLIENT_BUILD_PROFILE=brand`, `DSH_CLIENT_TITLE`, `DSH_CLIENT_BRAND_WORDMARK`, `DSH_CLIENT_BRAND_MARK`, and `DSH_CLIENT_GREETING`.

- [x] Write descriptor, CLI selection, builder identity, output separation, and client-environment behavior tests first; run them and retain the expected RED evidence.
- [x] Implement the shared descriptor parser and explicit file loader; validate file/JSON inputs and preserve typed internal callers. Fail missing selected icons before a full build.
- [x] Thread one selected descriptor through local unsigned packaging, embedded metadata, icon resources, app/artifact names, target-owned directories, and client build-record validation. Find fixed-name consumers in macOS packaging rather than changing only electron-builder.
- [x] Provide the owner's public descriptor and an original temporary text icon. Do not edit `.env` files, certificates, CI, package names, or workspace product versions.
- [x] Run the focused brand, package-target, builder, build-path and client-environment suites. Preserve unselected behavior and note remaining integration work; do not create an installer yet.

## Task 2: Runtime isolation and editable persona

**Files:** Create `apps/desktop/src/brand-profile.ts` and tests; modify `apps/desktop/src/main.ts`, `paths.ts` if needed, `welcome-backend.ts`, `apps/desktop-host/src/index.ts`, and relevant native welcome operations/tests.

**Interfaces:** Read validated `dshDesktopBrand` metadata. Store editable `persona.json` under the brand's isolated Harness home; its fields match `DesktopBrand.persona`. Produce an owned runtime patch file from the current persona and brand composition. Pass its absolute path through the new internal `DSH_DESKTOP_BRAND_PATCH` variable to the existing Host `runProfile.patchFiles`. Preserve the user's ordinary profile patch, installed packages and credentials. If needed, expose immutable public presentation metadata through the existing isolated preload, under project-owned `window.dshDesktopBrand`.

- [x] Write isolation, first-run initialization, repeat-launch preservation, persona edits, invalid JSON, profile-patch generation, and Host selection tests first; retain RED evidence.
- [x] Initialize separate Electron userData, logs and Harness home before any cache/profile read. Read existing user role settings rather than replacing them on upgrade.
- [x] Generate explicit brand composition overrides and persona instructions using the existing prompt configuration. Keep role prompts reconstructable from logged assembly; do not change the Agent loop.
- [x] Omit upstream account/billing UI and analytics/feedback exporters only for the brand. Keep the API-key welcome and Models settings usable and avoid missing-service startup failures.
- [x] Thread the external protocol and disable upstream global CLI registration for branded packages. Supply a single runtime public presentation snapshot if the UI needs it.
- [x] Run focused runtime/profile, Host, welcome and keyless persona tests. Verify edited instructions and failure states before moving on.

## Task 3: Native and browser presentation

**Files:** Modify desktop locale/welcome/presentation files, `preload-app.ts` and its types only if needed, `packages/client/ui-layout` and `packages/client/ui-conversation` presentation owners, plus affected owner-local tests and README pairs.

**Interfaces:** Consume `DesktopBrand` and runtime public presentation from Task 2; use the explicit client build values from Task 1 as startup defaults. Presentation components receive plain props from their registration owner. The runtime role file owns editable name/address/greeting/style; identity and distributed icons remain build inputs.

- [x] Write tests for default upstream copy, branded product labels, placeholder mark, greeting and no-account onboarding before implementation; retain RED evidence.
- [x] Route brand names through typed locale-owned templates and literal user configuration values. Preserve provider labels and copyright.
- [x] Display 辉总 · 后宫智囊团 and the configured greeting in the owned workspace/welcome presentation. Replace the upstream product mark with the selected temporary mark for this brand.
- [x] Document exactly which fields can change after installation and whether a restart, new session, or new package is required. New layouts, business tools and dedicated role-management UI remain later work.
- [x] Run focused presentation tests and required GUI/static gates for the actual diff, then request an independent review before packaging.

## Task 4: Integration, installer and acceptance

**Files:** Update the existing packaging README pair and add owner-facing brand instructions beside the descriptor. Record actual verification and unresolved limits in the execution ledger, not product prose.

- [x] Run affected focused tests, relevant lint/localization/documentation checks, and a complete build. Use the narrowest necessary host escalation only after sandbox evidence.
- [x] Review the complete working-tree diff with a fresh reviewer and address material findings with regression tests.
- [x] Recheck the approved version and run the existing unsigned macOS ARM64 packaging command with the new explicit descriptor. If packaging would overwrite or delete retained user artifacts, obtain confirmation first.
- [x] Retain runtime integrity and smoke results, exact DMG path and size, brand/target/version metadata, and hashes.
- [x] Obtain GUI launch permission when required by the host sandbox. Install or copy only this task's new artifact into an isolated test location, then open via Launch Services and verify Host readiness and branded UI.
- [x] Verify model-visible persona through a keyless recorded request. Real Provider calls, another-machine acceptance, signing, notarization, publication and Git commits remain separate claims.

## Execution decisions

The owner approved the design and first build version in the conversation. No further confirmation is needed for reversible implementation and ordinary checks. The working checkout's installed dependencies and build cache are reused; the local feature branch separates the work from `master`. Automated temporary-test cleanup is limited to the test's own newly created fixtures. User files, existing applications, retained releases and Git history are not deleted.
