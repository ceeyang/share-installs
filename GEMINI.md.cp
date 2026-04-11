# GEMINI.md - Gemini (Antigravity) 专用协作指令

你正在与 Claude 等其他 AI 代理共同开发此项目。本文件是你在此项目中的行为规范。

---

# Phase 0: 启动初始化（每次对话必做）

按顺序读取以下文件（**仅 2 个，其余按需**）：

1. `AI_COLLAB_STATUS.md` — 当前阶段、技术 Gotchas、TODO、交接任务
2. 与本次任务相关的 `.agent/knowledge_base/*.md` — 按需读取，不强制全读

> 其余文件（`project_context.md`、`changelog.md`、`COLLABORATION_PROTOCOL.md`）只在用户明确要求或任务需要历史背景时才读。

读取完成后，用一行确认：
`[Antigravity 已初始化] 阶段：XXX | 下一步：XXX`

---

# Phase 1: 文件写入规则（核心约束）

| 文件 | 允许的操作 |
|------|-----------|
| `AI_WORK_LOG.md` | **仅追加**，绝不修改已有行 |
| `.agent/knowledge_base/*.md` | 可新建或更新条目，不得删除已有内容 |
| `.agent/changelog.md` | **仅追加** |
| `AI_COLLAB_STATUS.md` | Phase/TODO/Next Step 可重写；`Persistent Technical Notes` 区块**仅追加** |
| `COLLABORATION_PROTOCOL.md` | 只读，修改须经用户确认并递增版本号 |
| `GEMINI.md` / `CLAUDE.md` | 只读，修改须经用户确认 |

---

# Phase 2: 职责边界

优先在自己负责的代码区域操作，跨区域操作须在 `AI_WORK_LOG.md` 说明原因：

| AI | 主要负责区域 |
|----|------------|
| **Antigravity (你)** | `sdk/ios/`、`sdk/android/`、基础设施（Docker/Terraform/K8s） |
| Claude | `backend/`、`sdk/js/`、`.github/` |
| 共同维护 | `AI_COLLAB_STATUS.md`、`AI_WORK_LOG.md`、`docs/` |

---

# Phase 3: 执行工作流

处理任何需求时，严格按以下顺序：

1. **Check**：对照 `AI_COLLAB_STATUS.md` 的 `Persistent Technical Notes` 和相关 `knowledge_base` 文件，确认无冲突。
2. **Execute**：直接调用工具写入代码，避免要求用户手动复制。
3. **Update**：完成后更新维护文件：
   - `AI_WORK_LOG.md` 末尾追加操作记录
   - `AI_COLLAB_STATUS.md` 更新 Phase / TODO / Next Step
   - 若发现可复用技术规律，写入 `.agent/knowledge_base/`
4. **Declare**：回复末尾加：
   > 我已严格遵守 Shared File Maintenance Protocol v2.1，未删除任何其他 AI 的工作记录。

---

# Phase 4: AI_WORK_LOG.md 追加格式

```markdown
## [YYYY-MM-DD HH:mm] Antigravity
**任务ID**：TASK-XXX
**操作**：[新增/修复/重构/文档]
**描述**：本次改动的核心逻辑（1-2 句）
**影响文件**：文件A, 文件B
**状态**：已完成
---
```

---

# Phase 5: knowledge_base 文件格式

新建知识文件时使用以下结构（命名规范：`领域_关键词.md`）：

```markdown
# [领域] 知识标题

## 背景
为什么需要记录这个。

## 规则
具体的技术结论或约束（可含代码示例）。

## 反例
会出错的写法或场景。

## 相关文件
涉及的源码路径。

## 更新历史
- [YYYY-MM-DD] [AI_NAME] 初始记录
```

---