---
description: "为本地未签名 macOS Desktop 构建选择公开产品身份与图标。"
---

# Desktop 品牌描述文件

[English](README.md) | 中文

## 概述

通过 `--brand <descriptor-file>` 为本地未签名 macOS 安装包选择公开 JSON 描述文件。未选择时保留上游身份。签名或 Windows 品牌打包会返回明确的操作提示。

## 目录

- [描述文件](#descriptor)
- [预检](#preflight)
- [构建集成](#build-integration)
- [安装后运行与角色编辑](#installed-runtime)

<a id="descriptor"></a>

## 描述文件

[辉总后宫智囊团描述文件](huigong/brand.json) 提供 `id`、`name`、`wordmark`、`appId`、`protocol`、`storageNamespace`、`mark` 和 `persona`（`name`、`address`、`greeting`、`instructions`、`completion`）。仅供构建使用的 `icons.mac` 为必填项，`icons.windows` 可选。相对路径以描述文件所在目录为基准，构建开始前必须指向可读文件。辉总品牌的应用图标和固定标志均使用 `material/icon/hui_maid_team_icon_no_black_border.png`。`backgrounds` 指向 `material/background`：`vertical` 用于侧边栏，`horizontal` 用于主页与 Conversation。本地 `huigong/material/` 目录由 Git 忽略，打包前需自行准备引用的文件。所选素材会复制进应用，运行时无需这份源码素材目录。

共用[解析器](../src/brand.ts) 拒绝缺失或未知的元数据字段、不安全的标识符和空文本。应用名称允许字母、数字、组合附加符、空格、内部点号、下划线和连字符；必须以字母或数字开头，排除保留文件名，且最多使用 251 个 UTF-8 字节，为 `.app` 留出空间。已接受名称不会被当前安装的 builder 文件名处理改写。描述文件只包含公开默认值，不得填写签名凭据、模型密钥或客户秘密。

<a id="preflight"></a>

## 预检

在仓库根目录运行以下命令，验证所选描述文件、本地配置、版本和工具链，不生成安装包，也不联系签名或公证服务：

```sh
pnpm --dir apps/desktop run package:mac:arm64:unsigned --brand brands/huigong/brand.json --build-version 0.2.2-alpha.3.20261105.1 --check
```

按照 [Desktop 打包](../packaging/README.zh.md#release-versions) 的要求，在打包前确认完整版本。预检通过不代表安装包启动或运行时行为已通过验收。

<a id="build-integration"></a>

## 构建集成

内部 `DSH_DESKTOP_BRAND` 载体序列化 `{ brand, icons }`，属于项目自定义的子进程接口。打包显式选择品牌并丢弃环境中继承的品牌载体。只有公开 `brand` 元数据写入安装包的 `dshDesktopBrand`；图标绝对路径不会进入应用清单。

每个所选品牌独立拥有 `.desktop-build/brands/<id>/targets/<target>/` 及其打包记录。下载与 pnpm 缓存保持共享。产物文件名包含品牌 ID 和版本。品牌 `--build-version auto` 只扫描该品牌的本地产物，不查询上游上传目标。本地品牌构建选择 `brand` 客户端配置，替换继承的标题覆盖值，并将标题、字标、文字标记和欢迎语与精确的客户端产物摘要一同记录。此打包模式未签名，也不发布自动更新源。

<a id="installed-runtime"></a>

## 安装后运行与角色编辑

所选安装包在读取 Desktop 缓存或配置前，将 Electron userData 和 Chromium sessionData 设为 `<appData>/<storageNamespace>`，日志设为其 `logs` 子目录，Harness 主目录设为 `~/.<storageNamespace>`。因此，辉总后宫智囊团使用 `~/.huigong`，与上游共用主目录隔离。外部打开链接采用描述文件协议（`huigong://open`），且不提供上游全局 CLI 管理入口。

`personaSource` 可选择 `bundled` 或 `local`（省略时默认）。辉总品牌选择 `bundled`：`brands/huigong/brand.json` 的五个 `persona` 字段随包分发，每次启动使用包内值。编辑源码后重新构建、安装、完全退出并重开应用。现有 `~/.huigong/persona.json` 保持原样，此模式下不读取。本地模式仅在角色文件缺失时排他创建，重启后读取编辑，并拒绝无效 JSON 或缺失、为空的字段，不覆盖原文件。

应用只重新生成自有的 `desktop-brand.patch.json` 和运行时角色输入，保留用户的配置补丁、插件依赖、设置、凭据与工作区指示。内部绝对路径 `DSH_DESKTOP_BRAND_PATCH` 选择 Host 叠加层；`DSH_DESKTOP_PERSONA_PREFIX` 通过四个内置预设既有的 `prefix` 配置提供经过验证的当前角色。父进程丢弃继承的变量值；选择叠加层但缺少非空 prefix 时，Host 拒绝启动。仅提供 prefix 不会选择品牌。选中带图片的品牌时，Host 通过 `DSH_BRAND_ASSETS_DIRECTORY` 接收素材目录，该目录不会覆盖用户可编辑的 `ui-settings-general` 配置。未选择品牌的 Host 启动会清理私有品牌输入并保留所有内置默认值。叠加层不替换预设子插件列表，也不覆盖全局 system-prompt 配置；用户显式编写的预设 persona 配置仍由用户拥有。

作用域角色沿用既有的已记录提示词装配，包括 minimal 预设的完整角色模式。角色指示不改变权限或审批。品牌组合保留现有 DeepSeek 账号服务、账号模型路由／控制器／设置页面，并继续禁用产品分析及其导出器和反馈授权的 Session 上传。本地反馈记录仍可使用。原生欢迎流程提供浏览器账号登录和独立的 DeepSeek API Key 路径；用户也可以跳过两者，进入 Models 设置配置其他模型服务。此安装包手动升级，禁用上游更新检查与强制更新策略。

隔离的应用 preload 向所属主文档发布唯一不可变的 `window.dshDesktopBrand` 快照：`name`、`wordmark`、`mark`、`authenticationMode: 'account'`、`updates: 'manual'` 及 `persona.name/address/greeting`。其中不含指示文本、密钥或可变应用上下文。原生 Welcome 通过既有隔离 preload 获取同一认证模式。具体显示方式由渲染组件负责。

辉总品牌内置彤答应作为女仆长，称呼用户为主人。模型、MCP 和用户指令沿用现有设置与 profile 机制。安装包身份、图标及源码角色变更需要重新打包。本机资料与浏览器入口详见[设置插件](../../../packages/client/ui-settings-general/README.zh.md#use-this-package)。

可选 `bundledPlugins` 的每项包含确切的 `name` 与 `version`。辉总品牌在包内携带 `@xmanrui/dsh-im@5.10.0` 及其运行时依赖，保留许可证声明。全新 profile 无需下载即可激活各内置 bundle。`profiles/desktop/desktop-bundled-plugins.json` 记录初次激活，后续启动保留显式禁用选择；现有用户包、锁文件、补丁、机器人凭据和链接主题仍由用户拥有。应用运行时优先使用包内版本，再考虑 profile 本地副本。渠道登录与远程消息收发仍需要各用户配置和网络访问。

包内的 `@tencent-connect/qqbot-connector@1.2.0` 在发布包元数据中声明 `UNLICENSED`，插件的[第三方声明](https://github.com/xmanrui/dsh-im/blob/main/THIRD_PARTY_NOTICES.md)也记录了这一点。对外分发定制安装包前，需要确认该依赖的再分发授权。

可选公开字段 `logo` 选择 `/api/brand-appearance/logo`。仅参与构建的 `backgrounds` 目录可提供精选图片，其路径不进入公开元数据。打包将 PNG 应用图标和有大小限制的位图复制到参与完整性校验的 `brand-assets`，在 ASAR 旁解包，以便普通文件读取。Host 通过 `DSH_BRAND_ASSETS_DIRECTORY` 读取该不可变目录，不覆盖用户的通用设置条目。照片品牌将缺失的 IM 侧栏偏好初始化为 `show`，保留已有选择，并停用被替代的 `theme-seabreeze` 行但不删除文件。外置目录和轮换控制仍属于本机通用设置偏好。
