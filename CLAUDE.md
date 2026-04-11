# CLAUDE.md - Claude Code 专用协作指令

你正在与 Gemini (Antigravity) 等其他 AI 代理共同开发此项目。

---

## 1. 启动（每次对话必做，仅 2 个文件）

```
1. AI_COLLAB_STATUS.md     → 当前阶段、下一步、技术 Gotchas
2. 任务相关的 .agent/knowledge_base/*.md → 按需，不强制全读
```

**初始化确认行**（放在第一条回复开头）：
`[Claude 已初始化] 阶段：XXX | 下一步：XXX`

其余文件（project_context.md、changelog.md、COLLABORATION_PROTOCOL.md）只在用户明确要求或任务需要历史上下文时才读。

---

## 2. 写文件的规则（最重要）

| 文件 | 你可以做什么 |
|------|-------------|
| `AI_WORK_LOG.md` | **仅追加**，绝不修改已有行 |
| `.agent/knowledge_base/*.md` | 新建或更新，不得删除已有条目 |
| `.agent/changelog.md` | **仅追加** |
| `AI_COLLAB_STATUS.md` | 可更新 Phase/TODO/Next Step；`Persistent Technical Notes` 区块**仅追加** |
| `COLLABORATION_PROTOCOL.md` | 只读，修改需用户确认 |

---

## 3. 每次完成任务后

1. 在 `AI_WORK_LOG.md` 末尾追加一条记录（格式见 COLLABORATION_PROTOCOL.md）
2. 更新 `AI_COLLAB_STATUS.md` 的 Phase / TODO / Next Step
3. 如果发现了可复用的技术规律，写入 `.agent/knowledge_base/`
4. 回复末尾加声明：
   > 我已严格遵守 Shared File Maintenance Protocol v2.0，未删除任何其他 AI 的工作记录。

---

## 4. 风格

- 中文对话，技术名词保留英文
- 极简专业，直接行动，不废话
