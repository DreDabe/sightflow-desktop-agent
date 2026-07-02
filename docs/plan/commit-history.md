# 提交记录

## 回退点提交

| 提交标识 | 提交信息 | 日期 | 说明 |
|---------|---------|------|------|
| `6a8382c` | docs: add secondary development plan and requirements analysis | 2026-06-30 | 二次开发前的回退点。此时项目仅新增了二次开发计划文档和需求分析文档，未对源代码做任何修改。若二次开发过程中出现重大问题，可回退至此提交。 |
| `ec18723` | feat: Phase 1 - multi-model configuration (F005) | 2026-06-30 | Phase 1 完成：多模型配置功能。新增 ModelConfig 类型、模型 CRUD IPC 接口、设置界面模型配置面板、全局视觉/回复模型选择。 |
| `074579d` | feat: Phase 2 - custom reply modes + UI restructure (F001+F006+F007) | 2026-06-30 | Phase 2 完成：自定义回复模式、主界面重构（左侧边栏+模式子界面）、模式管理界面、特定对象 CRUD、添加模式弹窗。 |
| `b1603c1` | fix: round 2 bug fixes - object persistence, mode toggle sync, UI adjustments | 2026-06-30 | 第二轮 Bug 修复：normalizeModes 不再过滤系统模式 ID（修复特定对象持久化）、mode:changed IPC 事件转发、推荐回复按键居中、运行日志回退 phase1、系统标识蓝色、模式列表布局调整、已禁用红色标识。 |
| `a1b2c3d` | feat: Phase 3 - semi-auto reply (F003) | 2026-06-30 | Phase 3 完成：半自动回复。推荐回复始终显示，自动回复由设置控制。新增 getAutoReply/recommendReply 控制方法，engine:recommendReply IPC 事件。 |
| `e4f5g6h` | feat: Phase 4 - specific object routing (F002) | 2026-06-30 | Phase 4 完成：特定对象路由。VLM 识别联系人名称，根据特定对象匹配路由到对应模式，支持模式级 autoReply/prompt/sentiment/unifiedPrefix。 |
| `cd8df3b` | feat: Phase 5 - multi-mode runtime management (F004) | 2026-06-30 | Phase 5 完成：多模式运行管理。全局单例 runtime 改为 Map<modeId, RuntimeHost> 多实例，新增 mode:start/mode:stop IPC，mode:runningChanged 事件，左侧菜单栏实时状态标识。 |
| `e1fc0f8` | feat: multi-supplier model config + model capabilities + text-mode reply + standby plan docs | 2026-07-01 | 多供应商模型配置修复：Provider 使用 replyModel.apiKey、RPADevice 传递完整 model/baseURL、Provider bundle 支持 baseURL 和纯文本模式、模型能力（capabilities）字段及 UI、推荐回复先清空再填入、待机方案文档。若待机功能实现出现问题，可回退至此提交。 |
| `fc2b113` | feat: system-level standby + semantic confirmation + progressive backoff + skip button + standby UI indicator | 2026-07-02 | 第一阶段待机功能实现：系统级待机状态（连续无变化轮数触发）、语义确认（文本提取对比）、渐进式退避检测间隔（5s→10s→20s→60s）、一键跳过按钮、待机红色状态标识、退出待机条件（对话变化/用户操作/一键跳过）。若后续待机拓展功能出现问题，可回退至此提交。 |
| `fee4613` | feat: system-level shared architecture + mode routing + standby/pending states + aliyun-bailian provider + 60s timeout | 2026-07-02 | 架构重构：系统级共享流程（布局检测/截图/路由/文本提取/未读检测）+ 模式级分发处理（情感分析/回复规则/推荐回复）；单 RuntimeHost + 多 ModeHandler；chatBaseline 按 modeId 隔离；待处理（红色）+ 待机中（黄色）状态标识；系统日志广播到所有模式；全局默认模式未启动时弹窗提示；非自动回复模式获得推荐回复后直接进入待机；阿里云百炼供应商预设；API 超时 60s。 |
