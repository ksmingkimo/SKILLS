# 技能发布目录

本目录是 SKILLS 学习项目产出两个技能的**发布副本**（母本在制作者的 `~/.claude/skills/`）。

## 安装

把对应目录复制到本机的个人技能目录即可：

- Windows：`C:\Users\<用户名>\.claude\skills\`
- macOS / Linux：`~/.claude/skills/`

安装后重启 Claude Code 会话，技能通过 SKILL.md 的 description 自动触发。

## 清单

| 技能 | 职责 | 说明 |
|------|------|------|
| `sunlike-erp-report` | 查询 Sunlike ERP 报表数据（SunReport 站点） | 受订单 / 成本分析 / 总分类账 / 账簿清单；双写选路：erp-mcp 工具优先、自带脚本（`scripts/erp-client.mjs`）兜底 |
| `sunlike-erp-api` | 单据 API 对接 + 报表 API 参考 | 登录 / Token 缓存模板、订单查询与录入、报表 4 种调用模式参考、16 坑清单 |

## 账号口径

- 学习环境演示账号（COMPNO=AT01 / USR=SAN / 密码为空）为公开演示账号，无脱敏要求
- 正式账号必须走环境变量（`ERP_COMPNO` / `ERP_USR` / `ERP_PWD`），绝不写进任何文件

## 说明

- 两个技能面向内网 Sunlike ERP（SunReport 站点）实测制作，接口细节见各自 `references/` 目录
- 完整学习过程见仓库根目录：`SKILLS概念讲义.md`（教材）、`对话记录.md`（全程流水账）、`SKILLS学习心得.md`（收官心得）
