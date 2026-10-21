---
name: sunlike-erp-report
description: >
  查询 Sunlike ERP 报表数据（SunReport 站点）的技能。当用户要查询、分析、导出或核对
  Sunlike ERP 的报表数据时使用：受订单（invso）、成本分析（mrppu）、总分类账（accgl）、
  账簿清单（AccBook）等。用户提到 ERP 查数、受订单、订单查询、成本、总账、账簿、Sunlike、
  SUNFUSION 等，即使没有明说「报表」或「技能」，也应使用本技能。
---

# Sunlike ERP 报表查询

建设进度：阶段 5 已完成——双写两路全部实测通过：路径②脚本兜底（VSCode 会话常态）+ 路径① MCP 工具（CLI 会话大写启动：5 工具加载、invso 出 9 行，2026-10-20 实测）。阶段 6（回填升级 sunlike-erp-api）已 2026-10-20 完成——本技能自身建设收官于阶段 5。

## 选路规则（双写：优先 MCP 工具，降级自带脚本）

每次查询先看**当前会话可用工具**，按下面顺序选路：

**路径① 优先**：可用工具里有 `erp_` 开头的 MCP 工具 → 直接调它们（erp-mcp 已注册到本项目，工具在**会话启动时**加载；⚠️ 但项目作用域按**路径字符串精确匹配**注册键——Windows 上会话目录写法大小写对不上注册键时（实测 `d:\vibecoding\skills` 对不上 `D:/VibeCoding/skills`，2026-10-20），新会话同样没有工具，属正常环境现象，走路径②兜底即可）。MCP 工具返回的是已加工好的 markdown 文本（含「✅ 共 N 行」头、空结果建议、截断提示），直接用或轻调格式即可。**路径①已实测通过**（2026-10-20：PowerShell 起 CLI 会话，大写启动 → 5 个 erp_ 工具加载 → 自然语言查受订单出 9 行，与路径②基线一致——「换路不换结论」）。

**路径② 降级**：没有 `erp_` 工具，或调用失败 → 用自带脚本 `scripts/erp-client.mjs`（JSON 输出，按下方「结果加工」渲染）。技能脚本是完整保底——没有 MCP 服务也能出数。

| 需求 | 路径① MCP 工具（参数） | 路径② 脚本命令 |
|------|----------------------|---------------|
| 登录 | `erp_login`（参数全可选，用服务配置） | `login`（--compno/--usr/--pwd 可选） |
| 受订单 | `erp_report_invso`（dateFrom/dateTo/cusNo/prdNo） | `report invso --date-from … --date-to … --cusno … --prdno …` |
| 成本分析 | `erp_report_mrppu`（dateCst/dep/prdNo） | `report mrppu --date-cst … --dep … --prdno …` |
| 总分类账 | `erp_report_accgl_stream`（bookNo/dateCst；不传 bookNo 自动用清单第一本） | `report accgl --book-no … --date-cst …` |
| 账簿清单 | `erp_list_books`（无参数） | `report accbook` |

两路的**口径一致**：同一套后端铁律（code===0、空结果≠错误、列名自适应、时间默认口径），换路不换结论。

## 查询流程总览

1. **确保登录**：先运行 `node scripts/erp-client.mjs status` 看 Token 缓存；无效则运行 `node scripts/erp-client.mjs login` 登录
2. **执行报表查询**：运行 `node scripts/erp-client.mjs report invso ...`（用法见下）
3. **结果加工**：把 JSON 结果渲染成用户易读的 markdown 表格

## 脚本用法

```
node scripts/erp-client.mjs login  [--compno X] [--usr Y] [--pwd Z] [--force]
node scripts/erp-client.mjs status
node scripts/erp-client.mjs report invso [--date-from YYYY-MM-DD] [--date-to YYYY-MM-DD] [--cusno X] [--prdno X]
node scripts/erp-client.mjs report accgl [--book-no X] [--date-cst YYYY-MM]
node scripts/erp-client.mjs report mrppu [--date-cst YYYY-MM] [--dep X] [--prdno X]
node scripts/erp-client.mjs report accbook
```

- 账号优先级：`--参数` > 环境变量（`ERP_COMPNO` / `ERP_USR` / `ERP_PWD`）。都缺 → CONFIG_MISSING
- **学习环境演示账号**：COMPNO=AT01 / USR=SAN / 密码为空（用户公开的演示账号，无脱敏要求）。正式账号必须走环境变量，绝不写进任何文件
- Token 自动落盘缓存（`~/.sunlike-erp-report/`），有效期内复用、不重复登录——ERP 后端对登录敏感，能少登录就少登录
- 脚本输出单行 JSON，`{ok:true, ...}` 成功 / `{ok:false, code, message}` 失败；失败时退出码为 1
- accgl 是 SSE 流式：进度日志走 stderr、结果仍是单行 JSON——不用管过程，只读结果
- 运行位置：技能目录下（`scripts/` 相对路径）

## 报表查询结果加工

脚本只输出机器可读 JSON（`{ok, action:"report", report, count, truncated, columns, rows}`）。把结果变成用户看得懂的东西是你的职责：

- **渲染 markdown 表格**：表头用返回的 `columns`（ERP 实际返回的列名，不自造列名）；`rows` 是数据行数组。列多时（受订单 29 列、总账 27 列）可全渲染或挑与用户问题相关的关键列，其余说明可展开
- **空结果不是错误**：`count: 0` 是真没数据 → 告诉用户没查到，并给出放宽建议（放宽日期范围、清空客户/货品筛选——脚本不传日期参数默认只查今年 1/1~12/31）
- **截断提示**：`truncated: true` 说明达到 5000 行上限、可能未取全 → 提示用户缩小筛选范围
- **参数翻译**：用户话术 → 脚本参数。例：「特斯拉的订单」→ `--cusno C001`；「8 月的」→ `--date-from 2026-08-01 --date-to 2026-08-31`；「查总账」→ `report accgl`（不传 bookNo 会自动用账簿清单第一本；要指定账簿先查清单再传 `--book-no`）；「某月的账」→ `--date-cst YYYY-MM`（总账默认当月）。客户/货品代号拿不准时先不加筛选查全量，从结果里找代号再收窄
- **时间口径提醒**：用户问「全部订单/历史订单」时，提醒默认只查今年，问要不要指定日期范围
- **总账口径**：`NO_BOOK` 错误 = 账簿清单没返回，让用户直接指定 `--book-no`；总账行里 REM_TYPE 1/2/3 是同一科目的期初/期末/发生三种视图，展示时按 ACC_NO 分组更易读
- **成本口径（mrppu）**：学习库当前无成本数据 → `count: 0` 属正常，如实说「ERP 返回 0 行」+ 给放宽建议（清空年月/部门/货品筛选），**不说系统坏了**
- **账簿口径（accbook）**：返回账簿清单（BOOK_NO + 名称），用户问「有哪些账簿」或「指定账簿查总账」时先查它；清单行里的 BOOK_NO 可直接喂给 accgl 的 `--book-no`

## 错误处理

- `NETWORK`：ERP 可能冷启动预热中（首个请求 >10s 属正常），稍后重试即可
- `10001`：通用业务错，message 仅供参考不可靠
- `20001/20004`：认证失效 → 脚本会自动清缓存重登重试一次；仍失败再手动 `login`
- `CONFIG_MISSING` / `LOGIN_BUSY`：脚本自身防护，按 message 行动
- **写任何 ERP 调用代码前，先读 `references/erp-rules.md`**（铁律表 + 后端怪癖 + 恢复手段）
- **排查报表查询问题（请求体结构、实操坑、失败对照表）读 `references/pitfalls.md`**

## 建设路线图

- ✅ 阶段 1：最小技能（触发验证）
- ✅ 阶段 2：ERP 登录直连
- ✅ 阶段 3：受订单查询 + 坑清单沉淀
- ✅ 阶段 4：mrppu / accgl / AccBook（4 种调用模式）——四只报表全部建成并验证
- ✅ 阶段 5：双写——优先调 erp-mcp 工具，降级用自带脚本（两路全部实测通过：路径②兜底 + 路径① CLI 大写启动 5 工具出数）
- ✅ 阶段 6：回填升级 sunlike-erp-api（2026-10-20）
