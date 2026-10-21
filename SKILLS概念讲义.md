# SKILLS 概念讲义

> 学习项目：SKILLS（Claude Code Skills）。本讲义是阶段 0 概念扫盲内容，可反复阅读；后续阶段讲义追加到本文件（与 MCP 项目 `MCP概念讲义.md` 同惯例）。
> 建立时间：2026-10-15（Round 2）

## 第一节：一句话定义

**Skill（技能）= 一个以 SKILL.md 为核心的「专家指南包」**：把「某一类活该怎么干」的成套知识——流程、规矩、坑、模板——打包成一个目录。Claude 判断任务相关时自动加载进上下文，按里面的方法干活。

要点：
- 技能不运行、不驻留，它是**被读进去的知识**
- 一次沉淀，处处复用：写一次，以后所有相关任务自动带上

## 第二节：它解决什么问题

Claude 是通才，但具体领域有具体规矩，这些规矩只有干过才知道：
- 你们 ERP：成功判断是 `code === 0` 不是 HTTP 200；并发登录会撞坏后端（.NET 集合并发损坏）；冷启动首请求 >10s……
- 这些「踩出来的经验」散在对话里会丢，写进技能就常在

技能的价值 = **把经验变成每次都在场的专家**。

## 第三节：一个技能的解剖（标本：sunlike-erp-api）

以本机 `C:\Users\Administrator\.claude\skills\sunlike-erp-api\` 为标本（2026-08-05 制作，订单模块 DRPSO 直连版）：

```
sunlike-erp-api/
├── SKILL.md      ← 入口：frontmatter（name + description）+ 正文指令
├── references/   ← 深度资料（用到才读）
└── assets/       ← 静态素材
```

1. **SKILL.md 的 frontmatter**：`name`（技能名）+ `description`（一段话写清「这技能管什么、何时用」）。**description 就是触发器**——Claude 把任务和所有技能的 description 做匹配，中了就加载。标本的 description 里写了「提到 SUNLIKE、ERP 对接、订单 API、受订单、DRPSO、ERP 配置测试时触发」——这就是触发词
2. **正文指令**：教 Claude 怎么干。标本正文第一条铁律是「三步验证法」（① 读原始文档 ② 拿可工作的示例 ③ 逐字段对照；违反它是它 40% 问题的根因）——技能正文里的铁律
3. **references/**：细节放这里，用到才读（渐进披露，见第五节）。标本的 `references/pitfalls-and-lessons.md` 记录了 16 个坑（单据侧 8 + 报表侧 8，2026-10 阶段 6 回填后口径）——阶段 0 写本节时的「18 个生产事故」旧口径已在阶段 6 修正
4. **assets/**：模板、图片等静态素材
5. 技能还可以带 **scripts/**：可执行脚本，Claude 可以运行它们

## 第四节：技能放在哪 + 怎么触发

| 位置 | 作用域 | 场景 |
|------|--------|------|
| `~/.claude/skills/`（个人级） | 本机所有项目 | 你的通用手艺（sunlike-erp-api 就在这） |
| `.claude/skills/`（项目级） | 当前项目 | 随项目走的团队规矩 |
| 插件技能 | 随插件 | 如 `frontend-design:frontend-design` |

触发两种方式：
1. **自动**：任务与 description 匹配 → 自动加载
2. **显式**：用户输入 `/技能名` → 立即加载

## 第五节：渐进披露（Progressive Disclosure）

技能的核心设计：**正文精简、细节按需**。
- SKILL.md 只写主干（几 KB 级别）
- references/ 里的深度资料用到才读
- 目的：上下文窗口宝贵，全量加载几十个技能会挤爆窗口——需要多少读多少

## 第六节：Skill vs MCP（对照表）

| | MCP | Skill |
|---|---|---|
| 本质 | 协议标准（JSON-RPC + 工具契约 + 传输） | 知识包（Markdown 指令 + 资料 + 脚本） |
| 回答的问题 | 「能力怎么接」 | 「活怎么干」 |
| 生效方式 | 运行时：客户端经传输调工具 | 加载时：指令进上下文 |
| 类比 | **厨房**：有锅有灶，能做出菜 | **菜谱 + 老师傅手记**：教按这家店的规矩做 |
| 产物 | 工具（name/description/inputSchema） | SKILL.md + references/ + assets/（可带 scripts/） |
| 「选哪个」的机制 | 工具 description 管模型选工具 | 技能 description 管何时加载技能 |

**互补不互斥**（本项目最重要的认知）：
- 技能里可以写「去调 erp-mcp 的工具」
- MCP 项目 9 阶段攒下的 API 知识（铁律表、坑清单、模板）正是技能的天然素材
- 同一家 ERP 两条路：sunlike-erp-api 教「直连 API」；erp-mcp 给「工具化能力」

## 第七节：技能 vs 记忆 vs 文档 vs MCP（四者分工）

| 载体 | 装什么 | 什么时候用 |
|------|--------|-----------|
| 技能 | 「怎么做」的方法论 + 配套资料 | 任务匹配时自动加载 |
| 记忆 | 关于你和项目的偏好/事实 | 每次会话自动带 |
| 文档 | 事实来源（API 文档等） | 需要时查阅 |
| MCP | 可执行的业务能力 | 运行时调用 |

一句话：文档是字典，记忆是便签，技能是工作手册，MCP 是工具房。

## 第八节：什么适合做成技能（判断标准）

适合：
- 重复出现的专业任务（做 PPT、画图表、对接某 API、走某流程）
- 有明确坑和规矩的领域（ERP 对接就是典型）
- 团队共享的做事方式

不适合：
- 一次性小事（对话里直接做）
- 纯数据/事实（记忆或文档的活）

## 第九节：本机现状盘点

- 个人级技能目录 `C:\Users\Administrator\.claude\skills\`：已装 sunlike-erp-api（2026-08-05，订单模块 DRPSO 直连版）
- 本会话可用技能（部分）：pptx、dataviz、project-progress-report、skill-creator、qiuzhi-skill-creator、sunlike-erp-api、frontend-design（插件）等
- 做技能的方法论参考：`skill-creator`（官方做技能指南）、`qiuzhi-skill-creator`
- MCP 侧对应物：erp-mcp（已注册本机 + Claude Desktop，stdio 子进程）
- 素材库：MCP 项目 server/ 已实测代码 + 三份 API 文档 + 对话记录全量踩坑史

## 第十节：术语速查

| 术语 | 含义 |
|------|------|
| Skill | 技能包，SKILL.md 为核心的目录 |
| SKILL.md | 技能入口文件：frontmatter + 正文 |
| frontmatter | 文件头部的 YAML 元数据（name/description） |
| description | 触发描述，决定技能何时被加载 |
| 渐进披露 | 正文精简、细节按需加载的设计 |
| 个人级/项目级 | ~/.claude/skills/ vs .claude/skills/ |
| 触发 | 自动（描述匹配）/ 显式（/技能名） |

---

（后续阶段讲义追加在文末）
