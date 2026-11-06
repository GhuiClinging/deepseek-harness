---
description: "Local branded macOS test installer and shared-code customer packaging."
---
# Branded desktop installation design

English | [中文](2026-11-05-desktop-branding-design.zh.md)

## Summary

The approved implementation and first local macOS ARM64 test package are complete. The application launched from a copied directory outside the source tree with no existing brand data. The selected product name is 辉总后宫智囊团, the wordmark is 辉总 · 后宫智囊团, and the default maid persona is 彤答应. The package uses a temporary text icon pending owner-supplied artwork. Developer ID signing, notarization, publication and acceptance on other computers or platforms remain separate work.

## Contents

- [Goal and scope](#goal-and-scope)
- [First brand and persona](#first-brand-and-persona)
- [Current implementation](#current-implementation)
- [Proposed implementation](#proposed-implementation)
- [Alternatives](#alternatives)
- [Delivery and verification](#delivery-and-verification)
- [Open decisions](#open-decisions)

<a id="goal-and-scope"></a>

## Goal and scope

Produce an application that installs and opens from Finder without a terminal or the source checkout. Give the owner's product its own name, artwork, application identity, storage, and editable default persona. Preserve a shared implementation for later customer packages. New business tools, customer accounts, concurrent multi-persona orchestration, Windows or Intel Mac installers, and download publication are separate phases.

<a id="first-brand-and-persona"></a>

## First brand and persona

| Item | Selected or proposed value |
|---|---|
| Product name, owner-selected | 辉总后宫智囊团 |
| Wordmark, owner-selected | 辉总 · 后宫智囊团 |
| Internal identifier, proposed | `huigong` |
| Application ID, proposed | `com.guohui.huigong` |
| External URL scheme, proposed | `huigong` |
| Default persona, owner-selected | 彤答应; maid lead; addresses the user as 主人 |
| Welcome, owner-selected | 欢迎回来，主人。今天有什么事务交给我？ |
| Completion expression, owner-selected | 主人，结果已经整理好了，请过目。 |
| Artwork | Owner-supplied later; temporary 辉 text icon first |
| First target and signing | `mac-arm64`; local unsigned test installer |
| First build version, proposed | `0.2.2-alpha.3.20261105.1` |

The proposed version extends the current repository version without rewriting workspace manifests. No retained local release artifacts were found for macOS ARM64 during preparation. Confirm the exact version before packaging; this draft does not reserve or publish it.

The persona is part of this brand's defaults, not a global change for other deployments. Use the existing system-prompt persona configuration and recorded prompt assembly so model-visible instructions remain reconstructable. Persona name, user address, and sample expressions remain editable through the brand's user profile configuration. A dedicated role editor and selectable maid roster are later work.

Render the fixed welcome in the interface. Apply persona style to model replies rather than appending a success sentence to every response. Use completion wording only after the actual task outcome supports it; failures, pending approval, and requests for information keep their own accurate states. Persona customization does not change tool permissions or approval policy. A maid lead is the first role; do not present additional maids as active parallel agents until orchestration is implemented.

<a id="current-implementation"></a>

## Current implementation

The [packaging entry](../../../apps/desktop/scripts/package-target.ts) selects macOS ARM64, macOS x64, or Windows x64 and runs a complete build before preparing target-specific resources. The [packaging reference](../../../apps/desktop/packaging/README.md) owns host requirements, release versions, signing, and local test limitations.

The current [builder configuration](../../../apps/desktop/scripts/electron-builder-config.mjs) fixes the product name, artifact prefix, and external URL scheme. [Local macOS configuration](../../../apps/desktop/scripts/desktop-package-environment.mjs) fixes the application ID. [Client build profiles](../../../scripts/client-build-environment.ts) discard inherited title overrides. [Production updates](../../../apps/desktop/scripts/desktop-auto-update-environment.mjs) use the upstream download origin. Brand selection must reach these owners explicitly; changing one filename is insufficient.

The unpackaged launcher requires a runtime-directory variable that the generated development application does not export for a Finder launch. The installed application's resource lookup uses packaged runtime resources instead. Fixing the development launcher is separate from the first installer.

<a id="proposed-implementation"></a>

## Proposed implementation

Use an explicitly selected public brand descriptor as the common input to packaging and embedded product metadata. This descriptor is a new project-owned format, not an existing Harness or electron-builder option. Validate it before expensive build work. Keep signing secrets and user model credentials outside it. Preserve existing behavior when no brand is selected.

The descriptor supplies a stable brand identifier, display name, application ID, external URL scheme, artifact prefix, storage namespace, artwork paths, and persona defaults. Exact field names and the selection command will be defined in the implementation plan. Resolve every asset path before building; incomplete or invalid selected descriptors fail visibly. Use the neutral temporary text icon until the owner supplies replacement artwork; changing distribution artwork requires a new package.

Apply selected values to the installed application name and icon, welcome page, native menus, window and sidebar product labels, and installer metadata. Keep locale-owned sentence templates and inject the product name as a value. Keep model-provider names, third-party copyright, and notices accurate rather than replacing every occurrence of DeepSeek.

Give each brand separate Electron data and Harness home directories, including sessions, settings, credentials, installed plugins, and logs. Do not import the existing development or upstream profile automatically. External links and optional command registration must not take another brand's identity. The first package does not require installing a global terminal command.

The first local validation artifact uses explicit manual updates, with no upstream update or mandatory-policy service. Signed distribution is a subsequent completion stage after identity and signing inputs are confirmed. Signed packaging for a custom brand must explicitly select the product's update mode; it must not inherit upstream production destinations. Automatic updates and a new update service are outside this first phase.

Proposed first-brand defaults use the existing API-key model configuration and omit upstream product-account sign-in, balance, recharge, and usage surfaces. Disable upstream product analytics and feedback-session uploads for this composition. Preserve provider names and the selected provider's model-request behavior; a model call is distinct from product telemetry. Apply these choices through the branded composition without changing unselected upstream deployments. The design approval includes these product choices.

Keep packaging outputs and completion metadata distinguishable by brand, target, and version. Persist the selected public identity alongside the packaged application so a later run cannot silently substitute another customer's identity. Customer business differences can use profile composition and plugins in later phases; this phase does not add a general customer management platform.

<a id="alternatives"></a>

## Alternatives

- Selected: shared core with brand descriptors and optional customer plugins. This supports independent installers while keeping fixes in one codebase.
- One product with account-based customization uses fewer installers but does not provide the independent identities the owner requested.
- Separate customer forks permit arbitrary divergence but multiply updates, signing, and compatibility maintenance. Reserve that approach for requirements that cannot share the core.

<a id="delivery-and-verification"></a>

## Delivery and verification

1. Confirm the brand inputs and approve the design. Confirm the exact build version separately before any packaging run, following the repository's release rules.
2. Add focused tests for descriptor validation, identity propagation, brand-specific output and storage, unchanged unselected defaults, and rejection of unintended upstream update settings. Use a second test identity to check coexistence without delivering a second customer product.
3. Update affected README/JSDoc contracts and locale-owned UI evidence. Add keyless recorded-session coverage for the default persona and its reconstructable prompt, plus owning UI evidence for branded copy. Reuse existing Session events; no new event types or persisted-format changes are proposed.
4. Run focused checks and a complete build before creating the macOS ARM64 artifact. Run the existing packaged-runtime integrity and smoke checks; retain the resulting build and package evidence.
5. Open the installed application from an external location through Finder. Verify product identity, Host startup, isolated storage, and runtime resource lookup. A model task requires an owner-configured credential and explicit test scope; do not claim it passed from build evidence.
6. With signing inputs available, sign and notarize the distribution artifact and verify installation and launch. Record another-machine compatibility separately from acceptance on the packaging Mac. Download publication remains a separate authorized action.

Observed preparation: the current checkout's `pnpm run package:desktop:mac:arm64:unsigned --check` completed successfully on the owner's Mac. It reported valid local configuration and toolchain, and did not attempt signing or notarization. This is prerequisite evidence for the unchanged packaging path, not evidence that the proposed brand implementation or an installer works.

<a id="open-decisions"></a>

## Open decisions

- The owner approved the complete first-phase design, API-key-only product surfaces, upstream analytics and feedback defaults, and internal identity.
- The owner approved first test version `0.2.2-alpha.3.20261105.1`. Reconfirm numbering if the date or available versions change before packaging.
- Owner-supplied artwork and Apple signing credentials can follow later. Do not alter certificates, secret files, CI configuration, or publish artifacts in this phase.

## Dev note

Acceptance claims are scoped to the checks and observations recorded in the execution ledger.
