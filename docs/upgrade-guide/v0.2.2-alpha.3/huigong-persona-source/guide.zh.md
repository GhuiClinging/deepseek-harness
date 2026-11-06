---
kind: upgrade-guide
description: "辉总品牌使用包内角色，不再自动应用 persona.json 的编辑。"
---
# 辉总品牌使用包内角色

English | [中文](guide.md)

## 变更

辉总品牌描述文件选择 `personaSource: bundled`。包内 `persona` 控制角色、称呼、欢迎语、指令及完成用语示例。现有 `~/.huigong/persona.json` 文件保持原样，但不再覆盖此品牌。其他未指定 `personaSource` 的描述文件保留本地文件行为。

## 迁移

1. 将需要的五个角色字段写入 `apps/desktop/brands/huigong/brand.json`，再重新构建并安装品牌包。
2. 完全退出并重新打开应用，在新会话中确认欢迎语；现有消息保持不变。
3. 如需为另一个安装包明确恢复安装后的本地角色编辑，在其描述文件中选择 `personaSource: local` 并重新构建。本地模式仅在 `persona.json` 缺失时排他创建，保留现有文件，并拒绝格式无效的角色。详见[品牌参考](../../../../apps/desktop/brands/README.zh.md#installed-runtime)。
