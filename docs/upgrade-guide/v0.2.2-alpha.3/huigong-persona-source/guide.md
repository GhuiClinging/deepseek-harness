---
kind: upgrade-guide
description: "HuiGong uses its packaged persona instead of automatically applying persona.json edits."
---
# HuiGong uses its packaged persona

English | [中文](guide.zh.md)

## Change

The HuiGong brand descriptor selects `personaSource: bundled`. Its packaged `persona` controls the character, address, greeting, instructions, and completion example. Existing `~/.huigong/persona.json` files remain untouched but no longer override this brand. Other descriptors that omit `personaSource` retain local-file behavior.

## Migration

1. Put the intended five persona fields in `apps/desktop/brands/huigong/brand.json` before rebuilding and installing the brand package.
2. Fully quit and reopen the application. Confirm the greeting in a new conversation; existing messages remain unchanged.
3. To deliberately restore installation-local role editing for another package, select `personaSource: local` in its descriptor and rebuild. Local mode exclusively creates a missing `persona.json`, retains existing files, and rejects malformed roles. See the [brand reference](../../../../apps/desktop/brands/README.md#installed-runtime).
