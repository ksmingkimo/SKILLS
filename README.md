# SKILLS：Claude Code Skills 学习项目

沿 MCP 学习项目之后，用同一套 Sunlike ERP 报表 API 当素材，学习 Claude Code **Skills（技能）** 的制作与使用。

**学习优先于速度**：8 个阶段（0~7），每阶段先讲概念、听懂再动手，2026-10-15 ~ 2026-10-21 全部完成。

## 仓库内容

| 文件 / 目录 | 说明 |
|-------------|------|
| `SKILLS制作计划.md` | 分阶段路线图：目标 / 概念 / 交付物 / 验证方式 / 状态 |
| `SKILLS概念讲义.md` | 教材（10 节）：SKILL 是什么、渐进披露、触发机制、与 MCP 配合 |
| `SKILLS学习心得.md` | 收官心得：三问三答（SKILL 是什么 / 与 MCP 关系 / 何时用哪个） |
| `对话记录.md` | 全程流水账：每个决策、每次踩坑 |
| `skills/` | 两个成品技能（安装方法见 `skills/README.md`） |
| API 文档与经验 | Sunlike ERP 报表 API 实测文档 + 63 轮对接经验总结（只读参考） |

## 两个成品技能

- **`sunlike-erp-report`** —— 查询 Sunlike ERP 报表数据（受订单 / 成本分析 / 总分类账 / 账簿清单），双写选路：erp-mcp 工具优先、自带脚本兜底
- **`sunlike-erp-api`** —— 单据 API 对接 + 报表 API 参考：登录 / Token 缓存模板、报表 4 种调用模式、16 坑清单

安装：把 `skills/` 下对应目录复制到 `~/.claude/skills/`（Windows：`C:\Users\<用户名>\.claude\skills\`），详见 `skills/README.md`。

## 环境说明

- 素材为内网 Sunlike ERP（SunReport 站点），接口细节以仓库内 API 文档为准
- 学习环境演示账号公开、无脱敏要求；正式账号走环境变量，不写进任何文件
