---
description: "Implementation of approved browser access, bundled persona, IM plugin, and local profile."
---
# HuiGong desktop extensions implementation plan

English | [中文](2026-11-05-huigong-desktop-extensions.zh.md)

> For agentic workers: use superpowers:executing-plans for continuous inline implementation.

**Goal:** Deliver a local macOS ARM64 test installer with visible browser access, source-owned persona, bundled IM integration, and a local avatar and nickname.

**Architecture:** Electron owns the current authenticated browser launch URL. The existing settings plugin contributes its sidebar action and local profile editor through registered slots and persists profile fields through Host settings. The brand descriptor selects packaged persona and exact third-party plugin versions; the package runtime carries their dependency closure.

**Tech stack:** Existing Electron, TypeScript, Cordis, React, Schemastery, pnpm, and electron-builder.

**Spec:** The owner approved browser access in the sidebar, source-authoritative persona, and bundled `@xmanrui/dsh-im@5.10.0`; the subsequent owner selection approved local avatar and nickname before remote login.

## Global constraints

- Preserve existing profiles, credentials, chats, user-installed plugins, and the retained persona file.
- Keep upstream account, telemetry, and update policies unchanged; remote login, SMS, and WeChat OAuth are outside this implementation.
- Keep all new product copy in typed dictionaries and use existing slots and primitives.
- Do not publish, push, commit, edit secrets or certificates, or replace the running installed app without safe task shutdown.
- Continue in `feat/huigong-desktop`, whose existing uncommitted branding implementation is required by these changes.

## Review focus

- A Host restart retires the old browser link; UI never receives authentication tokens.
- Packaged persona ignores stale or invalid local persona bytes without overwriting them.
- Bundled IM dependencies load offline on an empty home and activate once on an existing installation.
- An explicitly disabled bundled plugin remains disabled on later launches and recovery.
- Local avatar input is bounded and image-only; desktop and browser observe persisted profile changes.

## Task 1: Source-owned persona

- [x] Add failing tests for bundled persona with existing and invalid local files and for explicit local mode.
- [x] Add validated persona-source selection, update HuiGong completion wording, and preserve local file bytes.
- [x] Update the owning brand reference and run the focused brand suites.

## Task 2: Bundled IM plugin

- [x] Add failing tests for exact package metadata, first activation, upgrade adoption, deduplication, and retained disabling.
- [x] Extend the descriptor and runtime staging with exact plugin dependencies and initialization history; keep profile-owned packages untouched.
- [x] Verify packaged dependency bytes, license files, host activation, and client assets without submitting IM messages.

## Task 3: Browser access

- [x] Add failing tests for token-free status, current-URL opening, restart invalidation, preload authority, and sidebar rendering.
- [x] Add main-owned browser access and constrained preload operations; register a localized footer entry through the existing settings plugin.
- [x] Run focused desktop/client checks and verify the real browser opens the same Host.

## Task 4: Local profile

- [x] Add failing tests for persisted live nickname/avatar settings, invalid input, sidebar fallback, and edit/save outcomes.
- [x] Extend the existing settings schema and forms with a brand-only profile editor and identity trigger; normalize uploaded raster images.
- [x] Verify that updates survive reload and are observed by two clients of one Host; do not represent this as remote sign-in.

## Task 5: Delivery

- [x] Update paired owning documentation and record pairing; run focused tests, GUI tests, lint, doc-sync, and a complete build.
- [x] Perform one fresh implementation review and address material findings.
- [x] Generate the next locally numbered ARM64 DMG and verify its packaged runtime in an isolated home.
- [x] Preserve installation and live tasks until the owner can review the new package and safely replace the app.

## Dev note

Progress and command evidence belong in `.dsh-build/huigong/extensions-progress.md`; no Git publication is part of this work.
