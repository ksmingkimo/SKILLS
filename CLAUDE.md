# CLAUDE.md

## 语言偏好

- 与本 CLI 的所有交互文字一律使用中文。

## 项目性质

本项目是 **SKILLS（Claude Code Skills）学习项目**：
沿用与 MCP 项目相同的 Sunlike ERP 报表 API 作为素材，学习 Skills 的制作与使用。
**学习优先于速度**——每个阶段先讲概念、用户听懂再动手，不追求一次做完。

## 教学铁律（本项目最重要的一条）

1. **任何动作之前**（写代码、装依赖、改文件、发请求），必须先告诉用户：
   - 这个动作的**理由**（为什么这么做）
   - 这个动作的**目的**（做完会得到什么）
2. 用户说不懂、或没有明确继续 → **停下等待**，用更简单的方式再讲，讲懂为止
3. 每个阶段开始前，先讲该阶段涉及的概念，再动手

## 文档纪律

| 文件 | 用途 | 维护纪律 |
|------|------|----------|
| `对话记录.md` | 每轮对话的流水账（不是摘要） | **每轮对话结束必须追加**，当场写不拖；格式：日期 + Round N + 主题 + 完成事项/问题/决策 |
| `SKILLS制作计划.md` | 分阶段路线图（目标/概念/交付物/验证方式/状态） | 阶段开始标记「🔵 进行中」，验证通过标记「✅ 完成」并记录结果 |
| `CLAUDE.md` | 本文件：项目性质、纪律、API 铁律 | 与用户有新约定时同步 |

参考文档（只读，本项目 API 事实来源）：
- `API调整说明文档.md` — 站点迁移规范（SUNFUSION → ERPAPI → SunReport，Round 62/66）
- `API服务调用说明文档.md` — 登录 + 报表 API 实测文档（curl + 字段 + 错误码 + SSE 解析）
- `项目经验总结.md` — 63 轮经验提炼（API 对接、AI 集成、UI、部署教训）
- `SKILLS概念讲义.md` — 学习讲义（与 MCP 项目 `MCP概念讲义.md` 同惯例：阶段 0 概念扫盲起落盘，可反复阅读；后续阶段讲义追加到本文件。已建立：2026-10-15 Round 2，10 节）

## ERP API 铁律（写调用代码前逐条对照）

沿用三步验证法：① 打开原始文档阅读 ② 拿到可工作的 curl/Postman 示例 ③ 逐字段对照代码实现。

| 项 | 值 |
|----|-----|
| API 站点 | `http://{主机}/SunReport`（⚠️ 2026-09-30 由 ERPAPI 迁至 SunReport，仅前缀变化；主机已确认 localhost） |
| 登录端点 | `POST {站点}/auth/login`，字段 `COMPNO`/`USR`/`PWD`/`LANG_ID`/`SYS_TYPE`，COMPNO 不带 `/########` 后缀；PWD 可为空字符串（内网部署） |
| Token 路径 | `response.data.TOKEN`；data 只有 TOKEN/EXPIRES_IN/EXPIRES_TIMESTAMP 三字段（EXPIRES_IN 单位秒；EXPIRES_TIMESTAMP 为 Unix 秒） |
| 认证 | `Authorization: Bearer {TOKEN}` |
| 报表端点 | `POST {站点}/api/{相对路径}`（相对路径不再带 `api/` 前缀） |
| 成功判断 | **`response.code === 0`**，不是 HTTP 200、不是 `response.ok` |
| 请求体 | `{ PGM, SEARCH_INFO: [...], DISPLAY_FIELDS }`，SEARCH_INFO 按索引固定顺序；空筛选传 `""` 不传 null |
| 错误码 | 10001 通用业务错（message 不可靠）；20001/20004 认证失效（重登重试一次） |
| 端点大小写 | 文档不可信，实测为准 |
| 分页 | 服务端无视 offset 的 start → 取全量 `[0, 5000]` |
| 响应列 | `REPORT__TAB` 列名以 ERP **实际返回**为准，不以请求的 DISPLAY_FIELDS 为准（实测：请求 28 列、返回 29 列不同名）→ 结果加工用 `Object.keys(rows[0])` 自适应 |

## 模块完成自检（每个技能/模块完成后追问）

1. 输入为空/超大/乱码 → 会怎样？
2. 网络断了/超时/Token 过期 → 会怎样？
3. 有另一条路径能到达这里吗 → 也覆盖了吗？

## 可复用素材

- 技能 `sunlike-erp-api`（`C:\Users\Administrator\.claude\skills\sunlike-erp-api\`）— 登录/Token 缓存的 Node.js 模板与陷阱清单；2026-10-20 阶段 6 回填升级后同时覆盖报表 API（`references/report-api.md` 4 模式参考 + 16 坑清单）
- MCP 项目 `D:\VibeCoding\mcp\` — 已实测的 ERP 客户端代码（`server/erp-client.js` 登录/Token 缓存/重试/流式、`server/report-engine.js` 通用引擎、`server/report-registry.js` 配置驱动注册表）与全部踩坑记录（其 CLAUDE.md 技术环境备注 + 对话记录.md）
- AsCoding 项目 `D:\VibeCoding\AsCoding\js\` — 请求构造与 SSE 解析的实战参考（reports.js / api.js）

## 技术环境备注

- Node v24.14.0
- ⚠️ PowerShell 5.1 给原生程序传含双引号的参数会搅坏引号（`curl.exe -d '{JSON}'` 实测：ERP 报 10001「Value cannot be null」，同样请求 Git Bash curl / Node fetch 成功）→ 发 JSON 请求用 Git Bash 的 curl、Node fetch 或 Invoke-RestMethod，别用 PowerShell + curl.exe（2026-10-08 实测）
- ⚠️ 本机 ERP（IIS）有冷启动习性：重启/闲置后首个请求预热可能 >10s → 首次调用报 NETWORK 错误属正常，稍后重试即可（错误信息已带行动建议）；超时兜底登录 10s / 报表 12s（2026-10-09 实测）；**并发打冷后端 = 全员超时**（2026-10-12 实测：冒烟 5 工具连发全撞预热窗口，单发 curl 捂热后同代码全过）→ 遇「全炸」先对照实验，别急着怀疑代码
- ⚠️ ~~AccBook/GetList 空数据~~ / ~~accgl 报错~~ **两条怪象已翻篇**（2026-10-15 实测复核，技能版阶段 4）：后端 2026-10-14 升级后 accgl 流式健康出数（当月 12 行，与 2026-08 基线一致）；AccBook/GetList 恢复返回账簿清单——总账「依赖链兜底」（不传 bookNo 自动取清单第一本）实测成功。历史记录：2026-10-12 曾实测 AccBook 返回 `code 0 + data:{}`、accgl 流式端点报错，当时的工具口径「清单空 ≠ 未启用总账」（报告「ERP 未返回数据」，不断言「未启用」）仍是好习惯，保留
- ⚠️ **ERP 后端对并发登录敏感**（2026-10-09 实测）：并发登录请求会撞坏 .NET 内部非并发集合 → 10001「concurrent update … corrupted its state」，且**进程内状态持久损坏**（此后单发请求也全炸）→ 恢复只能回收应用池：本机站点在 Default Web Site 下，池名 `AppPool_SunReport`，`Restart-WebAppPool -Name 'AppPool_SunReport'`。认证层必须内置单飞（single-flight）保护，同一时刻最多一个登录请求
- ⚠️ **项目作用域 MCP 注册按路径字符串精确匹配、大小写敏感**（2026-10-20 多轮实测，Round 18/20/21）：同一条 erp-mcp 注册，cwd `D:\VibeCoding\skills` → ✔ Connected，盘符或目录名小写（`d:\VibeCoding\skills` / `d:\vibecoding\skills`）→ No servers（Round 20 实测会话中途 D:\↔d:\ 漂移时 CLI 判定当场翻转；差异因 shell 而定：Bash/msys 会把小写盘符透传给子进程，PowerShell/Windows 会把盘符规范化为大写，所以同是「盘符小写」两个 shell 结果可能不同）；MCP 工具在**会话启动时**按当时 cwd 判定，会话中途目录漂移不补载（Round 20 实测：漂移后 CLI 已 Connected，会话内工具仍不出现）。本机会话工作目录曾 D:\ ↔ d:\ 漂移 → 新会话可能「有注册却没工具」，属正常环境现象（技能选路规则已按此设计：工具缺席走脚本兜底）。用户拍板：保持项目级注册、接受降级。**Round 21 收官实测**：VSCode 扩展会话固定以小写盘符启动（连续 3 个新会话 0 工具）→ 扩展会话常态走脚本兜底（路径②）；PowerShell 起 CLI 会话（盘符规范化为大写）→ 5 个 erp_ 工具全部加载 + 自然语言查受订单出 9 行（路径①全链路验证通过）——阶段 5 收官
