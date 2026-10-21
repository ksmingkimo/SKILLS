# SKILLS 制作计划

> SKILLS（Claude Code Skills）学习项目：素材沿用 Sunlike ERP 报表 API（与 MCP 项目相同）。
> 原则：每个阶段先讲概念（为什么 + 目的），用户确认听懂才动手；每阶段验证通过才进下一阶段。
> 状态标记：⬜ 未开始 / 🔵 进行中 / ✅ 完成

## 总览

| 阶段 | 主题 | 状态 |
|------|------|------|
| 0 | SKILLS 概念扫盲 + 项目骨架 | ✅ 完成（2026-10-15） |
| 1 | 最小技能（Hello World）——SKILL.md 写作 + 触发验证 | ✅ 完成（2026-10-15） |
| 2 | 技能自带直连能力：ERP 登录（scripts/ + Token 缓存） | ✅ 完成（2026-10-15） |
| 3 | 报表查询：受订单 invso + 坑清单沉淀 | ✅ 完成（2026-10-15） |
| 4 | 多报表扩展：mrppu / accgl / AccBook（4 种调用模式） | ✅ 完成（2026-10-16） |
| 5 | Skill × MCP 配合：双写落定（注册 erp-mcp + 降级路径） | ✅ 完成（2026-10-20） |
| 6 | 回填升级 sunlike-erp-api（技能维护/演进） | ✅ 完成（2026-10-20） |
| 7 | 收尾与沉淀 | ✅ 完成（2026-10-21） |

## 关键技术决策（2026-10-15 用户拍板）

| 决策 | 选择 |
|------|------|
| 项目形态 | **方案 C**：A（全新制作 ERP 技能）为主轴 + 收尾回填升级 sunlike-erp-api |
| 技能连 ERP 方式 | **双写**：优先调 erp-mcp 的 MCP 工具，没工具时降级用技能自带脚本直连 |
| 报表范围 | **复刻全部 5 个教学代表**：登录 + invso（getReport）+ mrppu（getList）+ accgl（SSE 流式）+ AccBook（依赖链）——覆盖 4 种调用模式 |
| 技能位置 | **个人级** `~/.claude/skills/`（与 sunlike-erp-api 同级，全机可用） |
| 脚本语言 | Node.js（沿用 MCP 项目素材：erp-client.js 已实测） |
| 技能名 | **sunlike-erp-report**（2026-10-15 阶段 1 定，与 sunlike-erp-api 同族） |

---

## 阶段 0：SKILLS 概念扫盲 + 项目骨架

- **目标**：把 SKILLS 是什么讲清楚，立规矩、搭骨架、完成拍板
- **概念讲解点**：
  - 一句话定义：SKILL.md 为核心的「专家指南包」，被读进去的知识
  - 解决什么问题：把踩出来的经验变成每次都在场的专家
  - 解剖（标本 sunlike-erp-api）：frontmatter（name/description）/ 正文铁律 / references / assets / scripts
  - 位置（个人级/项目级/插件）与触发（自动描述匹配 / 显式 /技能名）
  - 渐进披露：正文精简、细节按需
  - Skill vs MCP 对照（厨房 vs 菜谱）；技能/记忆/文档/MCP 四者分工
- **交付物**：`CLAUDE.md`（复刻适配）、`SKILLS概念讲义.md`（10 节）、`SKILLS制作计划.md`（本文件）、`对话记录.md`
- **验证方式**：用户能复述 SKILLS 是什么、与 MCP 的区别
- **完成记录（2026-10-15）**：
  - Round 1 复刻 MCP 项目规矩：CLAUDE.md（教学铁律/文档纪律/API 铁律表全保留）、三份 API 参考文档、.gitignore
  - Round 2 概念精华讲解 + 讲义落盘（10 节：定义/解决问题/解剖/位置触发/渐进披露/对比 MCP/四者分工/判断标准/本机盘点/术语表）
  - 三项拍板：形态方案 C + 双写 + 复刻 5 报表 + 个人级
  - ⚠️ 盘点发现：本机当前项目路径无 MCP 服务器注册（erp-mcp 当时 `-s local` 只对 MCP 项目生效）——阶段 5 需重新注册

## 阶段 1：最小技能（Hello World）

- **目标**：在个人级建一个最小技能，跑通「写 SKILL.md → 被加载 → 生效」最小闭环
- **概念讲解点**：SKILL.md 写作（frontmatter/正文/渐进披露）；description 触发词怎么写；自动触发 vs /显式调用；新技能何时生效（实测：本环境会话中途即被重扫加载，无需新开会话）
- **交付物**：`~/.claude/skills/sunlike-erp-report/SKILL.md` 最小版（固定验证回复 + 建设路线图）
- **验证方式**：相关任务自动加载该技能（本会话实测即可）；`/sunlike-erp-report` 显式调用可用
- **进度记录（2026-10-15）**：
  - 概念讲解三点 + 加载官方 `skill-creator` 技能提炼写作规矩（description 要「推一把」防少触发 / 三层加载 / 只对实质任务触发）
  - 技能名拍板 sunlike-erp-report；SKILL.md 已创建（description 按「推一把」风格：能力范围 + 触发场景 + 明列触发词；正文 = 固定验证回复 + 路线图）
  - ⚠️ 观察：description 触发词与 sunlike-erp-api 重叠（受订单等），两技能可能竞争——阶段 6 处理
  - ⚠️ 实测反转：「需新开会话」预测被推翻——本环境会话中途重扫技能目录，创建后几分钟技能即出现在本会话清单；frontmatter 解析合法
  - **待验证**：用户在本会话实测自动触发与显式调用
- **完成记录（2026-10-15）**：
  - 测试 A 自动触发 ✅：用户发「帮我查一下 ERP 的受订单」→ 技能触发加载并回复固定验证文字。与 sunlike-erp-api 同场竞争（「受订单」双命中触发词），sunlike-erp-report 胜出——描述更贴合「查报表数据」场景（触发词重叠 ≠ 平分秋色，描述精确度分出胜负）
  - 测试 B 显式调用 ✅：`/sunlike-erp-report` 正常加载技能内容
  - 最小闭环「写 SKILL.md → 被加载 → 生效」跑通
- **状态**：✅ 完成（2026-10-15）

## 阶段 2：技能自带直连能力（ERP 登录）

- **目标**：技能带可执行脚本直连 ERP：登录 + Token 缓存，铁律表迁入技能
- **概念讲解点**：技能带 scripts/（Claude 能运行它们）；配置外部化（账号走环境变量/参数，不进技能文件）；Token 缓存落盘（CLI 每次新进程 vs MCP 常驻内存——本阶段核心差异）；单飞防并发登录（ERP 后端敏感性）；错误报告口径
- **交付物**：`scripts/erp-client.mjs`（登录/Token 缓存/重试，迁移 MCP 项目 erp-client.js）+ `references/erp-rules.md`（铁律表）
- **验证方式**：让 Claude 用技能登录真实 ERP 拿 Token（本会话实测即可）；错密码返回可读错误
- **进度记录（2026-10-15）**：
  - 先读 MCP 项目已实测 erp-client.js 作参照（三步验证法）
  - 交付三文件：erp-client.mjs（login/status、参数>env 双层配置、文件缓存提前 1 分钟过期判定、锁文件单飞 30s 残留判定+10s 等待+双检锁、10s 超时、错误带码单行 JSON）+ erp-rules.md（铁律表 11 条 + 后端怪癖 5 条 + 恢复手段——渐进披露第二层落地）+ SKILL.md 更新（流程/用法/错误处理/references 指引；**description 不变**——描述技能目标而非建设进度）
  - 冒烟四路全过 ✅：无缓存 status / 真实登录拿 Token（54a22d76…，EXPIRES 与 60000s 吻合）/ 缓存复用（fresh:false 跨进程复用实锤）/ 错密码 10001 可读错误
- **状态**：✅ 完成（2026-10-15）
- **完成记录（2026-10-15）**：
  - 用户实测触发链路 ✅：「帮我登录一下 ERP」→ 技能自动触发 → status 查缓存（cached:true, valid:true）→ login 命中缓存返回 Token（fresh:false）
  - 教学现场：fresh:false = 未发新登录请求、ERP 后端零打扰——「能少登录就少登录」防护在真实链路生效

## 阶段 3：报表查询（受订单 invso）

- **目标**：技能会查报表——正文教「查报表流程」，脚本支持 getReport 模式
- **概念讲解点**：技能正文=工作流程（构造请求→调用→结果加工成易读格式）；坑清单沉淀（code===0、REPORT__TAB 列名自适应、冷启动、空结果建议）；references/ 渐进披露的实战用法
- **交付物**：SKILL.md 补报表章节 + scripts 支持 getReport + `references/pitfalls.md`（MCP 项目坑清单迁移）
- **验证方式**：自然语言问「查受订单」→ 技能触发 → 直连出真实数据（invso 9 行特斯拉）；空结果路径
- **状态**：🔵 进行中（待用户实测）
- **进度记录（2026-10-15）**：
  - 先读 MCP 项目 report-registry.js + report-engine.js 作参照（三步验证法），拿到 invso 全量配置：端点 `invso/getReport`（全小写）、PGM=REP_SOLIST、SEARCH_INFO 十格布局、28 个 displayFields、dateCell 默认 this_year、orderBy OS_DD
  - 交付三件：erp-client.mjs 扩展 report 命令（ensureLogin 重构供 login/report 共用；erpPost 带 20001/20004 清缓存重登重试一次；buildInvsoBody 照抄注册表配置；输出 `{ok, action, count, truncated, columns, rows}` 机器可读 JSON）+ references/pitfalls.md（十格解剖表 + 实操坑 6 条 + 失败对照表 + 基线数据）+ SKILL.md 报表章节（结果加工职责：渲染表格/空结果给建议/截断提示/参数翻译/时间口径提醒；**description 不变**）
  - 冒烟 9 路全过 ✅（真实 ERP）：
    - 零参 → 9 行特斯拉（请求 28 列返 29 列，**Object.keys 自适应表头铁律现场生效**）
    - 日期区间 2020 → 0 行（空结果路径）；USAGE 错误路径正常
    - ⚠️ **冒烟揪出真 bug**：`--cusno`/`--prdno` 筛选静默失效（parseArgs 键小写 vs 构造时读 camelCase → undefined → 空筛选 → 返回全量）。用「不存在的客户 ZZZZ」才暴露——教训：验筛选必须用**不存在值**（期望 0 行），用真实值会误判「看似筛了」。修复后重测：ZZZZ→0 / C001→9 / M0001→9 / 不存在货品→0，筛选真实生效（此为新知识，MCP 项目未验过）
  - 坑已回填 pitfalls.md 第五节（参数大小写 + 不存在值验证法）
- **状态**：✅ 完成（2026-10-15）
- **完成记录（2026-10-15）**：
  - 用户实测「查一下受订单」✅：技能自动触发（未提技能名）→ status 命中有效缓存（**未发登录请求**，落盘 Token 直接复用）→ report invso 出真实 9 行特斯拉 → 渲染 markdown 表格（29 列自适应表头，挑关键列展示）
  - 教学现场：技能触发（description）→ 脚本执行（机器可读 JSON）→ LLM 结果加工（渲染表格）三段链路各司其职，一次跑通

## 阶段 4：多报表扩展（mrppu / accgl / AccBook）

- **目标**：覆盖全部 4 种调用模式——getReport / getList（TRANS 取数）/ SSE 流式 / 依赖清单链
- **概念讲解点**：配置驱动思路迁移（一条配置一只报表）；SSE 解析是脚本内部事（Claude 只见最终结果）；依赖链（账簿→总账）；「清单空 ≠ 未启用」口径
- **交付物**：scripts 支持 4 种模式 + 4 只报表配置；SKILL.md 各报表用法说明
- **验证方式**：四只报表各实测（invso 9 行 / mrppu 空数据不报错 / accgl 12 行 / AccBook 空 data 口径）；accgl 后端已升级，可正常补测
- **进度记录（2026-10-15）**：
  - 概念讲解三点：4 种调用模式（getReport 十格 / getList PAGE_INFO / SSE 流式 / 依赖链两步）、配置驱动思路（加报表=加配置不写逻辑）、口径（空 ≠ 错）
  - 先读 MCP 项目参照（三步验证法）：report-engine.js 的 buildStreamBody（三格 + 占位符派生）、erp-client.js 的 erpPostStream（SSE 三路判别 + 行缓冲解析）、buildBookListBody（依赖链第一步）
  - 交付 accgl：erp-client.mjs 加流式通道——buildStreamCtx（dateCst 校验非法回退当月）/ buildAccglBody（三格 + @占位符模板）/ resolveBookNo（依赖链兜底，清单空 → NO_BOOK 可读错误）/ erpPostStream（60s 超时 + Content-Type 三路判别 + 20001/20004 重试）/ parseSseStream（行缓冲 + ERR→STREAM_ERR + 进度只进 stderr）；cmdReport 重构为报表分发 + shapeRows 统一结果形状
  - SKILL.md 补 accgl 用法与结果加工口径（总账按 ACC_NO 分组展示、NO_BOOK 行动建议）；pitfalls.md 新增「accgl 流式专题」（三格/占位符/依赖链/SSE 判别/进度≠结果）
  - 冒烟四路全过 ✅（真实 ERP）：`--book-no 00000000` → 12 行（与 MCP 基线一致）；**不带 bookNo 依赖链兜底成功**（AccBook 清单已恢复——2026-10-14 后端升级复核翻篇，CLAUDE.md 已更新）；`--date-cst 2026-08` → 12 行；非法期间 9999-99 → 回退当月 12 行（自检三问之「超大」落地）
  - **待验证**：用户实测「查总账」→ 12 行总账数据
- **用户实测记录（2026-10-16）**：「查一下 8 月的总账」✅——参数翻译 `--date-cst 2026-08` 生效出 12 行；实战首撞 Token 过期（约 16.7 天有效期恰到期）→ 补演示账号参数 → 自动真登录 + 续缓存 + 依赖链 + SSE 一条命令全通，坑已回填 pitfalls.md
  - mrppu + accbook 建成（2026-10-16）：buildMrppuBody（getList 八格照抄注册表：顶层 OTHERINFO/PAGE_INFO、[2]~[5] 固定禁用格 DATE_CST 注入参数、[6][7] 筛选格、取数键 TRANS）+ accbook 报表（buildBookListBody 复用，取数键 ACC_BOOK_BS，依赖链第一步独立报表化）
  - 冒烟四路全过 ✅：mrppu 零参/指定期间 → 0 行如实（空结果口径）；accbook → 1 本账簿 00000000「First Department」（请求 18 列返 35 列，列名自适应再证）；未知报表 USAGE 错误
  - SKILL.md（用法/成本口径/账簿口径）、pitfalls.md（八格+清单专题、基线）、CLAUDE.md 无新变化
  - **待验证**：用户实测「查成本」/「查账簿」→ 如实空口径 + 1 本账簿
- **状态**：✅ 完成（2026-10-16）
- **完成记录（2026-10-16）**：
  - 用户实测「查一下成本」✅：mrppu 返回 code 0 + 0 行——如实口径「ERP 未返回成本数据，不说系统坏」落地（空 ≠ 错教学点验证通过）
  - 用户实测「有哪些账簿」✅：accbook 出 1 本账簿 00000000「First Department」真实表格；并现场讲清它与 accgl 依赖链的关系（清单第一步 → BOOK_NO 喂给 --book-no）
  - 阶段 4 全交付：四报表 × 四调用模式（getReport / getList / SSE / 依赖链）建成、冒烟、用户验证全过

## 阶段 5：Skill × MCP 配合（双写落定）

- **目标**：技能同时会两条路：优先调 erp-mcp 工具，降级用自带脚本直连
- **概念讲解点**：技能正文指导调 MCP 工具；双写降级逻辑（何时走哪条）；MCP 注册作用域（-s local 按项目路径归档——本轮已亲眼验证）；注册后需新开会话才加载工具
- **交付物**：SKILL.md 写路径①（erp-mcp 工具清单与用法）+ 路径②（降级）；本机注册 erp-mcp（env 指向 D:\VibeCoding\mcp\server）
- **验证方式**：路径①＝目录写法正确的新会话自然语言查 ERP——工具路径成功；路径②＝MCP 工具缺席（目录写法不匹配/停服）时脚本兜底成功（已实测多次）
- **状态**：✅ 完成（2026-10-20）
- **进度记录（2026-10-16）**：
  - 概念讲解三点：选路规则（Claude 一眼可见「有没有 erp_ 工具」→ 有就用、没有就降级）、双写价值（MCP 常驻快腿 vs 脚本冷启动保底——组合拳）、注册两坑（-s local 按项目路径归档；注册后需新会话加载工具——MCP 冷加载 vs 技能热加载）
  - 盘点现状：本项目 `claude mcp list` 空（作用域坑现场）；~/.claude.json 里 MCP 项目的 erp-mcp 注册已清空（仅 Claude Desktop 还注册着）→ 按标准姿势重新注册
  - 注册：`claude mcp add -s local erp-mcp --env ERP_BASE_URL/ERP_COMPNO=AT01/ERP_USR=SAN/ERP_PWD= -- node D:\VibeCoding\mcp\server\index.js` → 写入 ~/.claude.json [project: D:\VibeCoding\skills]，`mcp mcp list` 健康检查 ✔ Connected
  - SKILL.md 写双写选路规则：选路顺序说明 + 五需求映射表（登录/受订单/成本/总账/账簿 × MCP 工具 ↔ 脚本命令）+ 两路口径一致；MCP 工具返回已加工 markdown（直接用），脚本返回 JSON（按结果加工渲染）
  - 服务进程级冒烟 ✅：用 MCP 项目 smoke-test.mjs（假客户端走真实 JSON-RPC）带 env 拉真服务——erp_login ✅ / erp_list_books 1 本 ✅ / mrppu 0 行如实 ✅ / invso 9 行 ✅ / accgl 12 行 ✅（无 env 时 CONFIG_MISSING 属预期——冒烟脚本不带账号，注册的 env 才带）
  - **待验证**：① 路径② **已验 ✅（Round 16 用户实测）**：本会话无 erp_ 工具 → 「查一下受订单」自动走脚本，9 行出数与 MCP 冒烟完全一致——「换路不换结论」实锤 ② 路径① 需**新开会话**（工具会话启动时加载）问「查一下受订单」→ 应走 MCP 工具出 ✅ 共 9 行
  - Round 17 审查 + 根因定位（2026-10-20）：用户新会话（10-20）仍走路径②（9 行基线一致，顺带实战 Token 过期→重登→续缓存链路）→ 审查结论「文档合格、定性待修正」；实测**项目作用域 MCP 匹配对路径大小写敏感**（同注册：`D:\VibeCoding\skills` 与 `d:\VibeCoding\skills` → ✔ Connected；`d:\vibecoding\skills` → No servers；本会话 cwd 亦曾 D:\ ↔ d:\ 漂移）→ 用户新会话极可能目录写法未对上注册键 → 路径①未触发、双写降级按设计兜底；**用户拍板方案 B（保持项目级、接受降级）**：注册不动，SKILL.md 选路规则与 CLAUDE.md 技术备注按实测修正
- **完成记录（2026-10-20）**：
  - Round 21 自检第三次 + CLI 对照实验收官：VSCode 会话（启动 cwd 小写 `d:\`）erp_ 工具仍 0 个（连续第三次）；对照实验——PowerShell 起一次性 CLI 会话（盘符规范化为大写 `D:\`，Get-Location 佐证）→ **5 个 erp_ 工具全部加载** → 根因坐实：会话启动时目录写法对不上注册键即不加载、中途不补载
  - 路径①全链路验证 ✅：同一 CLI 会话自然语言查受订单 → `erp_report_invso` 真实出数 **9 行**（C001 特斯拉 / M0001 Model 3）——与路径②脚本、Round 16 冒烟三方基线一致，「换路不换结论」再实锤
  - 双写两路全部实测通过；环境结论：VSCode 扩展会话固定小写启动 → 常态走路径②兜底；CLI 会话（PowerShell 启动，盘符规范化）→ 路径①可用。方案 B 口径最终成立

## 阶段 6：回填升级 sunlike-erp-api

- **目标**：学「技能维护/演进」——把新技能攒的报表 API 知识回填进旧技能
- **概念讲解点**：解剖旧技能结构；增量升级（保留原订单模块内容，新增报表章节）；references 坑清单 18 坑 → 18+N
- **交付物**：sunlike-erp-api 的 SKILL.md / references 更新（SunReport 迁移、报表端点、SSE、错误码）
- **验证方式**：升级后旧技能仍能指导订单对接，且能指导报表查询；不破坏原内容
- **状态**：✅ 完成（2026-10-20）
- **完成记录（2026-10-20）**：
  - Round 23 概念讲解（技能会过时/增量升级三纪律/回填知识≠扩大职责）+ 原材料研读——用旧技能自己的三步验证法升级旧技能；发现过时点④ Bearer 缺失；回填口径「18 坑 → 18+N」修正为「8 → 8+N」（pitfalls 文件实记 8 坑）
  - Round 24 动手：SKILL.md（迁移注记 + Bearer + LANG_ID/SYS_TYPE + Token「以返回值为准」+ 新增 3.6 报表章节 + 报表侧速查表 + 检查清单）、api-reference.md（登录/订单端点与字段修正）、新建 report-api.md（4 模式字段级参考 + 错误码 + 基线数据附录）、pitfalls-and-lessons.md 8 → 16 坑 + 后端行为怪癖、erp-client-template.js（3 URL + 登录字段 + 2 Bearer）；description 按概念③不动
  - 通读自查揪出 5 处漏网（3.3/3.4 Header、4.3 配置界面 URL、五速查表第 1 行、八检查清单、开头「18 坑」口径）+ grep 复查揪出 assets 模板 3 处 ERPAPI——全部修正（test-script-template.js 干净）
  - 验证：① 订单对接指导完好（三步验证法/订单章节结构未动，只改事实）② 能指导报表查询（新章节 + report-api.md + 坑 9-16）③ 不破坏原内容（结构/风格/description 未动）；自检三问（空/超大→`""`+截断；断网/Token 过期→NETWORK 口径+20001/20004 重试；另一条路径→4 模式+依赖链）全覆盖

## 阶段 7：收尾与沉淀

- **目标**：整理学习成果
- **交付物**：`SKILLS学习心得.md`（SKILLS 是什么/与 MCP 分工/什么时候用）；三份管理文档与代码一致核对
- **验证方式**：用户能自己向别人讲清 SKILL 是什么、与 MCP 的区别
- **状态**：✅ 完成（2026-10-21）
- **完成记录**：Round 26 一致性核对，清掉 5 处残留矛盾（CLAUDE.md 讲义描述/迁移文档描述、讲义 18 坑旧口径、erp-rules 怪癖翻篇口径、sunlike-erp-report 路线图阶段 6）；Round 27 三问三答（菜谱 / 服务员 / 场景分工）落盘 SKILLS学习心得.md——验证方式达成：用户能用自己的话向别人讲清 SKILL 是什么、与 MCP 的区别

---

## 可复用素材清单

- MCP 项目 `D:\VibeCoding\mcp\`：server/ 已实测代码（erp-client.js / report-engine.js / report-registry.js）、CLAUDE.md 技术环境备注、对话记录全量踩坑史
- `sunlike-erp-api` 技能（`C:\Users\Administrator\.claude\skills\sunlike-erp-api\`）：技能标本 + 登录/Token 模板 + 16 坑清单（单据侧 8 + 报表侧 8）
- AsCoding 项目 `D:\VibeCoding\AsCoding\js\`：请求构造、SSE 解析实战参考
- 三份参考文档：`API调整说明文档.md` / `API服务调用说明文档.md` / `项目经验总结.md`
- 做技能的方法论：`skill-creator` / `qiuzhi-skill-creator` 技能（阶段 1 起参考）
