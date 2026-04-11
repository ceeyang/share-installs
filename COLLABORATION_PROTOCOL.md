# Shared File Maintenance Protocol v2.1

> 适用于所有参与此项目的 AI 代理（Claude、Gemini/Antigravity 等）。

---

## 1. 核心原则

- **最小读取**：启动时只读 `AI_COLLAB_STATUS.md`，按需读 knowledge_base。
- **无损写入**：已有条目只增不减，除非用户明确指示删除。
- **强制留痕**：任何文件写入后必须在 `AI_WORK_LOG.md` 追加记录。

---

## 2. 文件职责与写入规则

| 文件 | 职责 | 写入方式 |
|------|------|---------|
| `AI_COLLAB_STATUS.md` | 当前阶段、Gotchas、TODO、交接 | Phase/TODO 可重写；`Persistent Technical Notes` 区块仅追加 |
| `AI_WORK_LOG.md` | 每次文件操作的流水账 | **仅追加**，绝不修改已有行 |
| `.agent/changelog.md` | 里程碑记录 | **仅追加** |
| `.agent/knowledge_base/*.md` | 跨会话可复用的技术规律 | 可新建/更新，不得删除已有条目 |
| `.agent/project_context.md` | 项目架构与技术栈概览 | 仅架构级变更时更新 |
| `CLAUDE.md` | Claude 专用启动指令 | 仅用户确认后修改 |
| `COLLABORATION_PROTOCOL.md` | 本协议 | 仅用户确认后修改，版本号递增 |

---

## 3. 职责边界（减少文件冲突）

各 AI 各自负责的代码区域，优先在自己的区域内操作：

| AI | 主要负责区域 |
|----|------------|
| Claude | `backend/`、`sdk/js/`、`.github/` |
| Antigravity (Gemini) | `sdk/ios/`、`sdk/android/`、基础设施 |
| 共同维护 | `AI_COLLAB_STATUS.md`、`AI_WORK_LOG.md`、`docs/` |

> 跨区域操作时，必须在 `AI_WORK_LOG.md` 中说明原因。

---

## 4. AI_WORK_LOG.md 格式

```markdown
## [YYYY-MM-DD HH:mm] [AI_NAME]
**任务ID**：TASK-XXX
**操作**：[新增/修复/重构/文档]
**描述**：本次改动的核心逻辑（1-2 句）
**影响文件**：文件A, 文件B
**状态**：已完成
---
```

---

## 5. knowledge_base 文件格式

```markdown
# [领域] 知识标题

## 背景
为什么需要记录这个。

## 规则
具体的技术结论或约束。

## 反例
会出错的写法或场景。

## 更新历史
- [YYYY-MM-DD] [AI_NAME] 初始记录
```

---

## 6. 冲突处理

- 检测到他人记录被删除时，立即停止操作并警告用户回滚。
- 协议修改须以 "协议修改提案 vX.X" 为题，经用户确认后更新本文件并递增版本号。

---

## 7. 版本历史

- **v1.0 (2026-04-10)** 基础协作版本
- **v2.0 (2026-04-10)** 新增详细维护规范、日志触发条件、知识库强制要求
- **v2.1 (2026-04-10)** 简化启动流程（2 文件 → 按需）；加入职责边界；明确 append-only 范围；统一 knowledge_base 格式
