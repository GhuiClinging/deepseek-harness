# 辉总后宫智囊团桌面版实施计划

[English](2026-11-05-huigong-desktop.md) | 中文

> **供执行 Agent 使用：**使用 superpowers:subagent-driven-development 或 superpowers:executing-plans 逐项实施，在执行记录中保存检查结果与决策。

**目标：**交付可在本机安装的 macOS ARM64 应用“辉总后宫智囊团”，具有独立存储、可配置的“彤答应”角色和可复用的客户品牌配置。

**架构：**显式选择品牌描述文件，驱动现有打包流程及包内产品信息。运行时角色配置放在应用包之外，复用现有 profile 和提示词机制。未选择品牌时保留上游构建行为。

**技术栈：**TypeScript、Node.js、Electron、React、Cordis，以及现有 electron-builder 和 Vitest。

**设计：**[已确认的设计](../specs/2026-11-05-desktop-branding-design.zh.md)。

## 全局约束

- 所有者已确认名称“辉总后宫智囊团”、品牌字样“辉总 · 后宫智囊团”、内部标识 `huigong`、应用 ID `com.guohui.huigong`、外部协议 `huigong`。
- 默认角色：彤答应，女仆长，称呼用户为“主人”。欢迎语：欢迎回来，主人。今天有什么事务交给我？完成表达示例：主人，结果已经整理好了，请过目。
- 首包：`mac-arm64`，未签名本地测试版本 `0.2.2-alpha.3.20261105.1`。不使用签名凭据，不发布或推送，不修改 CI，不自动提交代码。
- 模型供应商名称和法律声明保持准确。产品身份可配置，上游 SDK 和包名保持不变。
- 保留现有模型日志、权限、审批和 Session 格式。新增角色输入需要无密钥的已记录请求证据。
- 首品牌组合使用 API Key 和手动升级，不提供上游账号、计费、产品遥测与反馈上传。
- 在当前工作区的本地分支 `feat/huigong-desktop` 实施，保留已安装依赖和用户进程。已有未提交文件是本任务生成的设计文档。

## 审查重点

- 两个品牌不得共享会话、凭据、profile 锁、协议处理身份或产物目录。
- 安装包移出源码目录后，应从自身资源定位运行时。
- 非法描述或运行时角色文件应在依赖操作前明确报错，不静默使用上游默认值。
- 品牌包不得因可选值缺失而继承上游升级、账号或遥测行为。
- 安装后编辑角色应能影响模型指令，无需修改应用包或重新签名。

## 任务 1：品牌描述与打包

**文件：**新增 `apps/desktop/src/brand.ts`、`apps/desktop/brands/huigong/brand.json`、临时图标素材及品牌测试；修改 `apps/desktop/scripts/package-target.ts`、`desktop-package-environment.mjs`、`desktop-build-paths.mjs`、`electron-builder-config.mjs`、`package-macos.ts`、相应声明，以及 `scripts/client-build-environment.ts` 和聚焦测试。

**接口：**提供 `DesktopBrand`、`parseDesktopBrand(value: unknown): DesktopBrand` 和解析图标文件路径的构建描述加载器。`DesktopBrand` 包含 `id`、`name`、`wordmark`、`appId`、`protocol`、`storageNamespace`、`mark` 和 `persona`（`name`、`address`、`greeting`、`instructions`、`completion`）。已校验的公开信息存入包内清单 `dshDesktopBrand`。内部序列化环境载体为 `DSH_DESKTOP_BRAND`；新增项目自有打包选项为 `--brand <descriptor-file>`。客户端公开值包括 `DSH_CLIENT_BUILD_PROFILE=brand`、`DSH_CLIENT_TITLE`、`DSH_CLIENT_BRAND_WORDMARK`、`DSH_CLIENT_BRAND_MARK` 和 `DSH_CLIENT_GREETING`。

- [x] 先编写描述校验、CLI 选择、打包身份、产物隔离和客户端环境行为测试，运行并保存预期失败证据。
- [x] 实现共享描述解析器和显式文件加载器，校验文件与 JSON 输入，信任类型明确的内部调用。所选图标缺失时在完整构建前失败。
- [x] 将同一品牌贯穿本地未签名打包、内嵌信息、图标资源、应用及产物名、目标目录和客户端构建记录校验，检查 macOS 链路中的固定名称消费者。
- [x] 提供所有者的公开描述和原创临时文字图标。不修改 `.env`、证书、CI、包名或 workspace 产品版本。
- [x] 运行品牌、package-target、builder、build-path 和客户端环境的聚焦测试，保留未选择品牌时的行为并记录后续集成项，暂不生成安装包。

## 任务 2：运行时隔离与可编辑角色

**文件：**新增 `apps/desktop/src/brand-profile.ts` 及测试；修改 `apps/desktop/src/main.ts`、必要时的 `paths.ts`、`welcome-backend.ts`、`apps/desktop-host/src/index.ts` 以及相关原生欢迎操作与测试。

**接口：**读取已校验的 `dshDesktopBrand`，在品牌独立的 Harness home 中保存可编辑的 `persona.json`，字段与 `DesktopBrand.persona` 一致。依据当前角色和品牌组合生成应用拥有的运行时 patch，通过新增内部变量 `DSH_DESKTOP_BRAND_PATCH` 将绝对路径传给现有 Host 的 `runProfile.patchFiles`。保留用户普通 profile patch、已安装插件和凭据。界面需要时通过现有隔离 preload 暴露不可变的公开展示信息，使用项目自有 `window.dshDesktopBrand`。

- [x] 先测试存储隔离、首次初始化、重复启动保留、角色编辑、非法 JSON、profile patch 生成及 Host 选择，保存预期失败证据。
- [x] 在读取缓存或 profile 前建立独立的 Electron userData、日志和 Harness home。升级时读取既有用户角色，不覆盖它。
- [x] 通过现有提示词配置生成显式品牌组合和角色指令，保持角色提示词可由已记录的组装结果重建，不修改 Agent 循环。
- [x] 仅对本品牌移除上游账号、计费界面和遥测、反馈 exporter。保留 API Key 欢迎流程与模型设置，避免缺少服务导致启动失败。
- [x] 接入独立外部协议，关闭品牌包的上游全局 CLI 注册。界面需要时提供唯一的运行时公开展示快照。
- [x] 运行运行时、profile、Host、欢迎流程和无密钥角色测试，验证指令编辑及失败状态后再继续。

## 任务 3：原生与浏览器界面

**文件：**修改桌面语言字典、欢迎及展示文件，必要时修改 `preload-app.ts` 与类型，修改 `packages/client/ui-layout` 和 `packages/client/ui-conversation` 中的展示所有者，并更新所属测试与双语 README。

**接口：**消费任务 2 的 `DesktopBrand` 和运行时公开展示信息，以任务 1 的显式客户端构建值作为启动默认值。展示组件从注册所有者接收普通 props。运行时角色文件负责可编辑的名称、称呼、欢迎语和风格；应用身份与分发图标仍是构建输入。

- [x] 先测试上游默认文案、品牌标签、临时标识、欢迎语和无账号引导，再实现并保存预期失败证据。
- [x] 通过类型明确的语言模板和字面用户配置传递品牌名，保留供应商标签与版权。
- [x] 在所属工作空间和欢迎界面显示“辉总 · 后宫智囊团”及配置欢迎语，以所选临时标识替代上游产品图形。
- [x] 明确记录哪些字段可在安装后修改，以及是否需要重启、新会话或新包。新增布局、业务工具和独立角色管理界面属于后续工作。
- [x] 运行聚焦界面测试与本次差异要求的 GUI、静态检查，打包前完成独立审查。

## 任务 4：集成、安装包与验收

**文件：**更新现有打包说明双语文档，在品牌描述旁增加使用说明。真实验证结果和未验证限制放入执行记录，不混入产品说明。

- [x] 运行受影响的聚焦测试、lint、语言字典与文档检查及完整构建。仅在具有沙箱失败证据后采用最小范围的宿主机提权。
- [x] 由独立审阅者检查完整工作区差异，以回归测试修复实质问题。
- [x] 核查已确认版本，使用新增显式品牌描述执行现有 macOS ARM64 未签名打包命令。若会覆盖或删除用户留存产物，先取得确认。
- [x] 保留运行时完整性、smoke 结果、DMG 完整路径和大小、品牌平台版本信息及哈希。
- [x] 宿主机沙箱要求时取得 GUI 启动授权，仅将本任务的新产物安装或复制到隔离测试位置，通过 Launch Services 打开，验证 Host 就绪与品牌界面。
- [x] 通过无密钥录制请求验证模型可见角色。真实供应商调用、其他电脑验收、签名、公证、发布和 Git 提交分别报告。

## 执行决定

所有者已在对话中确认设计和首个构建版本，可逆实现与普通检查无需重复确认。复用当前工作区依赖和构建缓存，以本地功能分支与 `master` 分开。自动临时测试清理仅涉及测试自身新建的样本，不删除用户文件、既有应用、留存发行包或 Git 历史。
