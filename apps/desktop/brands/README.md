---
description: "Select public identity and artwork for local unsigned macOS Desktop builds."
---

# Desktop brand descriptors

English | [中文](README.zh.md)

## Summary

Select a public JSON descriptor with `--brand <descriptor-file>` for a local unsigned macOS package. Unselected packaging keeps the upstream identity. Signed and Windows brand packaging fail with an actionable error.

## Table of Contents

- [Descriptor](#descriptor)
- [Preflight](#preflight)
- [Build integration](#build-integration)
- [Installed runtime and role editing](#installed-runtime)

<a id="descriptor"></a>

## Descriptor

[The HuiZong descriptor](huigong/brand.json) supplies `id`, `name`, `wordmark`, `appId`, `protocol`, `storageNamespace`, `mark`, and `persona` (`name`, `address`, `greeting`, `instructions`, `completion`). Its build-only `icons.mac` is required; `icons.windows` is optional. Paths resolve beside the selected descriptor and must name readable files before a build starts. HuiZong uses `material/icon/hui_maid_team_icon_no_black_border.png` for both the application icon and fixed logo. Its `backgrounds` selects `material/background`: `vertical` supplies the sidebar and `horizontal` supplies the home and Conversation. The local `huigong/material/` directory is ignored by Git; provide the referenced files before packaging. Selected resources ship inside the application, so this source directory is not required at runtime.

The shared [parser](../src/brand.ts) rejects missing or unknown metadata fields, unsafe identifiers, and empty text. Application names use letters, numbers, combining marks, spaces, internal dots, underscores, and hyphens; they start with a letter or number, exclude reserved filenames, and fit within 251 UTF-8 bytes to leave room for `.app`. Accepted names remain unchanged by the installed builder's filename handling. Descriptors contain public defaults only. Never put signing credentials, model keys, or customer secrets in them.

<a id="preflight"></a>

## Preflight

From the repository root, this command validates the selected descriptor, local configuration, version, and toolchain without building an installer or contacting signing/notarization services:

```sh
pnpm --dir apps/desktop run package:mac:arm64:unsigned --brand brands/huigong/brand.json --build-version 0.2.2-alpha.3.20261105.1 --check
```

Confirm the complete version before a packaging run, following [Desktop packaging](../packaging/README.md#release-versions). A passed preflight does not establish installer launch or runtime behavior.

<a id="build-integration"></a>

## Build integration

The internal `DSH_DESKTOP_BRAND` carrier serializes `{ brand, icons }`; it is a project-owned subprocess interface. Packaging selects it explicitly and discards ambient brand carriers. Only public `brand` metadata becomes packaged `dshDesktopBrand`; absolute artwork paths stay outside the application manifest.

Each selected brand owns `.desktop-build/brands/<id>/targets/<target>/` and its packaging records. Downloads and the pnpm cache remain shared. Artifact filenames use the brand ID and version. Brand `--build-version auto` scans that brand's local artifacts only, without consulting upstream upload destinations. Local brand builds select the `brand` client profile, which replaces inherited title overrides and records the title, wordmark, mark, and greeting with the exact client artifact digest. This packaging mode is unsigned and publishes no automatic-update feed.

<a id="installed-runtime"></a>

## Installed runtime and role editing

A selected installation sets Electron userData and Chromium sessionData to `<appData>/<storageNamespace>`, logs to its `logs` child, and Harness home to `~/.<storageNamespace>` before reading Desktop caches or profiles. HuiGong therefore uses `~/.huigong` instead of the upstream shared home. The external open URL uses the descriptor protocol (`huigong://open`); upstream global CLI management is omitted.

`personaSource` selects `bundled` or `local` (the default when omitted). HuiGong selects `bundled`: the five `persona` fields in `brands/huigong/brand.json` are packaged and used on every launch. Rebuild, install, fully quit, and reopen after source edits. An existing `~/.huigong/persona.json` remains untouched and is ignored in this mode. Local mode exclusively creates a missing role file, reads edits after restart, and rejects invalid JSON or missing/empty fields without replacing the file.

The application regenerates only its owned `desktop-brand.patch.json` and runtime persona input. It leaves the profile patch, plugin dependencies, settings, credentials, and workspace instructions intact. The internal absolute `DSH_DESKTOP_BRAND_PATCH` selects the Host overlay; `DSH_DESKTOP_PERSONA_PREFIX` supplies the validated current role to the four shipped preset persona rows through their existing `prefix` setting. The parent discards inherited values, and the Host rejects a selected overlay without a nonempty prefix. A prefix alone does not select a brand. The Host receives `DSH_BRAND_ASSETS_DIRECTORY` for a selected photographed brand, outside the user-editable `ui-settings-general` configuration. Unselected Host launches clear private brand inputs and retain every shipped default. The overlay never replaces preset child lists or the global system-prompt configuration; explicit user-authored preset persona configurations remain user-owned.

The scoped persona follows existing logged prompt assembly, including the minimal preset's complete persona. Its role instructions do not change permissions or approvals. Brand composition keeps the existing DeepSeek account provider, account model route/controller/settings page, and disables product analytics and its exporter plus feedback-authorized Session uploads. Local feedback records remain available. Native onboarding offers browser account sign-in and a separate DeepSeek API-key path; users can skip both and configure other providers in Models settings. Upgrades are manual; upstream update checks and mandatory-update policy are disabled for this installation.

The isolated application preload publishes one immutable `window.dshDesktopBrand` snapshot to the owned main document: `name`, `wordmark`, `mark`, `authenticationMode: 'account'`, `updates: 'manual'`, and `persona.name/address/greeting`. It contains no instructions, keys, or mutable application context. Native Welcome receives the same authentication mode through its existing isolated preload. Renderer components own presentation of these values.

HuiGong ships 彤答应 as maid lead, addressing 主人. Models, MCP, and user instructions use their existing settings/profile mechanisms. Package identity, icons, and source-owned role changes require repackaging. Local profile editing and browser access are described by the [settings plugin](../../../packages/client/ui-settings-general/README.md#use-this-package).

Optional `bundledPlugins` entries contain exact `name` and `version` fields. HuiGong carries `@xmanrui/dsh-im@5.10.0` and its runtime dependencies inside the package, retaining its license notices. A clean profile activates each packaged bundle without downloading it. `profiles/desktop/desktop-bundled-plugins.json` records initial activation, so later launches preserve explicit disabling; existing user packages, lockfiles, patches, bot credentials, and linked themes remain user-owned. The application runtime supplies the packaged version before profile-local copies. Channel login and remote message delivery still require each user’s configuration and network access.

The bundled `@tencent-connect/qqbot-connector@1.2.0` declares `UNLICENSED` in its published package metadata, as recorded in the plugin's [third-party notices](https://github.com/xmanrui/dsh-im/blob/main/THIRD_PARTY_NOTICES.md). Confirm redistribution permission for this dependency before distributing customized installers.

Optional public `logo` selects `/api/brand-appearance/logo`. A build-only `backgrounds` directory may supply curated images; its path is excluded from public metadata. Packaging copies the PNG app icon and bounded raster images into integrity-recorded `brand-assets`, unpacked beside ASAR for ordinary file reads. The Host reads that immutable directory from `DSH_BRAND_ASSETS_DIRECTORY`; it does not override the user’s General settings entry. The photographed brand initializes a missing IM sidebar preference to `show`, preserves existing choices, and disables the superseded `theme-seabreeze` row without deleting its files. External folders and rotation controls remain local General preferences.
