---
description: "Source-owned brand images, scoped backgrounds, and compact navigation."
---
# HuiGong brand appearance implementation plan

English | [中文](2026-11-05-huigong-brand-appearance.zh.md)

> For agentic workers: use superpowers:executing-plans for continuous inline implementation.

**Goal:** Ship a locally installed ARM64 test app with a compact browser action, a visible IM launcher, opaque standalone pages, rotating local backgrounds, and fixed photographic brand icons.

**Architecture:** Reuse the existing General settings plugin for appearance configuration, an authenticated Connection Fetch gallery, and a disposable browser controller. The Conversation header owns a root-scoped action slot; existing sidebar and Conversation containers expose scoped image hooks. Desktop branding stages artwork before integrity sealing and initializes application-owned defaults without replacing user choices.

**Tech stack:** Existing TypeScript, Cordis, React, Schemastery, Connection Fetch routes, Sharp, Electron, and electron-builder; no new external dependency.

**Spec:** The owner approved the recommended implementation and delegated details on 2026-11-05: icon-only upper-right browser action with “跳转网页版” tooltip, IM shown by default, original standalone-page surfaces, independently rotating backgrounds every random 5–15 minutes, external `Desktop/213` testing before curated bundled assets, and one fixed test picture for both brand icons.

## Constraints and decisions

- Continue the related dirty feature checkout; preserve every prior brand change. No commits, pushes, deletion, secret edits, public publication, or production deployment.
- Keep original photographs unchanged. Test-gallery copies stay in ignored build resources; curated source images are a later owner selection.
- Use authenticated, owner-only `/api/brand-appearance/catalog`, `/api/brand-appearance/image`, and `/api/brand-appearance/logo`; never expose arbitrary local paths or unauthenticated files.
- Limit image input to bounded regular PNG/JPEG/WebP files inside the selected folder, reject links and traversal, and keep the last display on transient failures.
- Restore ordinary global theme tokens; apply photographic fills only to the Conversation and sidebar containers. Standalone panels and portalled settings retain existing surfaces.
- Read source-owned brand defaults, preserve explicit saved IM visibility, and disable the superseded local theme without deleting it.
- Reference: [vscode-background](https://github.com/shalldie/vscode-background) (MIT), its folder expansion, regional backgrounds, and random carousel. Reuse the design principles; its VS Code HTML patching and protocol are unsuitable for Harness. Existing Harness Connection and slot services supply those operations.

## Review focus

- A blank Conversation still exposes the browser icon and never displays a launch token or address.
- A moved, empty, malformed, linked, or unreadable image source does not expose arbitrary files or blank an accepted background.
- Folder edits, client reconnects, late fetch completion, timer teardown, and repeated registration retain one live controller and no stale images.
- Existing theme, credentials, IM accounts, and explicit visibility choices remain recoverable across installation.
- The actual packaged logo and gallery survive ASAR materialization; original modal colors remain opaque in light and dark modes.

## Task 1: Compact browser action and IM defaults

**Files:** Conversation contract/header/assembly, General browser entry/locales, Desktop brand profile and tests.

- [ ] Add and observe failing component/assembly tests for the header action, including no selected Session, exact tooltip, and absent address text.
- [ ] Declare `conversation.header.actions` as a root list and move the existing browser source there; reuse its main-owned open operation and toast.
- [ ] Add and observe failing brand tests for first-run IM `show`, retained explicit `hide`, and retained malformed preference errors; initialize only the isolated integration preference.
- [ ] Run the related header, browser-entry, and brand-profile suites; expect all pass.

## Task 2: Authenticated gallery and source assets

**Files:** General Host appearance module/schema/tests; Desktop brand parser/build preparation/profile and tests.

- [ ] Add failing tests for bounded raster inventory, stable opaque ids, selected-folder confinement, malformed files, unavailable folders, logo serving, and owner-only routes.
- [ ] Add `brandAppearance`, `brandAssetsDirectory`, live `backgroundFolder`, `backgroundMinSeconds`, and `backgroundMaxSeconds` configuration; validate interval ordering at the consumer.
- [ ] Stage a fixed PNG logo and optional build-only background directory into `dsh/brand-assets` before the existing integrity seal. Public `logo` metadata uses the owned API route; private source paths stay build-only.
- [ ] Run gallery/configuration/packaging tests; expect all pass.

## Task 3: Scoped presentation and live appearance controls

**Files:** General client appearance controller/editor/locales/tests; sidebar and Conversation image hooks; branding logo props/build environment.

- [ ] Add failing controller tests for independent non-repeating image selection, bounded random deadlines, folder changes, errors, stale completions, and disposal; add component tests for accepted configuration.
- [ ] Use the existing ConfigForm and app-wide toast patterns for folder and interval edits; expose manual next-picture and pause controls.
- [ ] Add scoped photographic fills, preserve global colors and standalone pages, preload each next image before swapping, and restore all document mutations on disposal.
- [ ] Render the fixed brand image through existing sidebar mark support and the packaged application icon; keep text fallback for other builds.
- [ ] Verify light/dark/narrow browser rendering, unchanged modal backgrounds, and no profile/test-data overwrite.

## Task 4: Delivery

- [ ] Update owning bilingual documentation and generated catalogs; run focused tests, GUI checks, lint, documentation gates, and a complete build.
- [ ] Perform one independent final review; fix material findings with reproducing tests.
- [ ] Build the next numbered local ARM64 DMG, verify archive/runtime, test the actual installed desktop action/icon/IM/theme, and preserve a previous-app backup.
- [ ] Reveal the final installer in Finder and report the absolute artifact path and validation limits.

## Evidence

Progress, command logs, and temporary pictures belong in `.dsh-build/huigong/appearance/`. No Git publication or external message submission is part of this plan.
