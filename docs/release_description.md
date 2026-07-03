# AutoReply Release Description

---

## v1.0.1

**发布日期**：2026-07-03

### 🐛 Bug 修复

- **修复情感分析模块启动失败**：`torch`（来自 `sentpredict-libs`）与 `torchvision`（来自 Anaconda 系统路径）版本不兼容，导致 `RuntimeError: operator torchvision::nms does not exist`。将 `torchvision` 添加到依赖列表，确保与 `torch` 版本一致。
- **增强 Python 依赖检查逻辑**：`isDepsInstalled` 不再仅依赖标记文件，而是逐一检查每个必需包目录是否实际存在于 `sentpredict-libs` 中，避免标记文件存在但实际缺少包的情况。
- **修复项目重命名后遗留的路径引用**：`package-lock.json` 中的 `name` 字段、`electronApp.setAppUserModelId`（`com.electron` → `com.autoreply.desktop`）、`skills/` 目录名称、`docs/provider.md` 和 `docs/provider.en.md` 中的名称和路径引用。
- **增强错误日志输出**：情感分析模块启动失败时，完整错误堆栈和错误消息会输出到终端和 UI 日志中，便于定位问题。

### 🔧 其他改进

- 添加 `docs/change_build_version.md`：打包版本修改教程
- 添加 `docs/release_description.md`：版本发布描述文档
