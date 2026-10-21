# 报表查询专题：invso 解剖与实操坑

> 渐进披露第二层：通用铁律看 erp-rules.md，本文件是报表查询（invso）的实战细节。
> 来源：MCP 学习项目阶段 3 实测（2026-10-09 起，9 行特斯拉订单为基线数据）。

## 一、invso 请求体解剖（getReport 十格标准布局）

`POST {站点}/api/invso/getReport`（⚠️ 端点全小写，实测为准），PGM=`REP_SOLIST`。

SEARCH_INFO 十个格子，**按索引固定顺序**：

| 格 | 内容 | 说明 |
|----|------|------|
| [0] | `{ offset: [0, 5000], temp: true }` | 分页：服务端无视 offset 的 start → 一刀切取全量 |
| [1] | `{ showLadder: "F", displayFields, sumFields: [] }` | 展示配置：28 个显示字段 |
| [2] | `{ fixCondition: { REPORT_DD_FIELD: "OS_DD", SUB_CUS: "" } }` | 固定条件：日期字段是 OS_DD |
| [3] | 日期格（OS_DD） | `need:true, fieldDisabled:true`；传日期 → `range`，不传 → `this_year`（默认今年） |
| [4] | 客户格（CUS_NO） | `checkUnder:"T"`，值来自 cusNo 参数 |
| [5] | 货品格（PRD_NO） | 值来自 prdNo 参数 |
| [6][7] | 部门/仓库格 | 本技能不开放 → 恒空（`value:""`） |
| [8] | 审核状态格 | `operator:"equal"`，不限制审核状态 |
| [9] | `{ orderBy: { OS_DD: "asc" } }` | 按受订日期升序 |

**ERP 规矩：空筛选传 `""` 不传 null**——传 null 后端报 10001「Value cannot be null」。

## 二、查询实操坑（都是实测踩出来的）

1. **列名以 ERP 实际返回为准**：请求 28 列、返回 29 列且名字不同 → 结果加工用 `Object.keys(rows[0])` 自适应表头，绝不自造列名
2. **空结果是有效信息不是错误**：code 0 + 0 行 = 真没数据 → 给用户「放宽筛选」建议（放宽日期/清空客户货品），不谎称系统异常
3. **日期默认今年**：不传日期参数查的是今年 1/1 ~ 12/31，不是全部历史——用户问「全部订单」时要提醒这个默认
4. **5000 截断**：`[0, 5000]` 全量上限，达到 5000 行提示可能未取全、建议缩小筛选
5. **冷启动**：闲置后首个报表请求可能 >10s → NETWORK 属正常，稍后重试（详见 erp-rules.md）
6. **认证失效**：20001/20004 → 脚本自动清缓存重登重试一次——用户侧表现为「第一次慢/报错后第二次成功」属正常

## 三、accgl 流式专题（SSE 长连接）

**三格 SEARCH_INFO**（与 getReport 十格不同）：[0] 展示配置（showBody:"T"）、[1] fixCondition、[2] orderBy。

**占位符模板**：fixCondition 里写 `@BOOK_NO/@PERIOD/@YEARS/@IPERIOD/@DATE_B/@DATE_E/@START_DD`，由 `dateCst`（YYYY-MM，默认当月）派生整族字段替换——「一个会计期间派生整族」只写一次，总账家族加报表零改动复用。非法期间（如 9999-99）不回错，回退当月。

**依赖链**：BOOK_NO 必填（空值 ERP 回 406）→ 不传 bookNo 时脚本自动调 AccBook/GetList 取清单第一本；清单空 → `NO_BOOK` 可读错误（行动：直接 `--book-no` 指定）。

**SSE 判别三路**（响应 Content-Type）：
1. HTTP 错（如 406）→ HTTP 级错误
2. `application/json` → 失败不走流，按普通 JSON 业务码处理（20001/20004 照常清缓存重试一次）
3. `text/event-stream` → 逐 chunk 读、**行缓冲**（chunk 边界切断行 → 不完整行留待下一 chunk）、`data: {JSON}` 事件切分、`ERR` 字段转 STREAM_ERR 可读错误

**进度不是结果**：流里 PERCENT/TITLE 只进 stderr 日志，不进 JSON 协议——Claude 只见最终拼好的行集合（数据在 `DATA.REPORT__TAB`，可能分多条消息）。

## 四、mrppu 八格 + accbook 清单（getList 家族）

**getList 与 getReport 的差异**（mrppu 为例）：
- SEARCH_INFO 八格、**无 orderBy 格**；[0] 无 offset（分页在顶层）；[2]~[5] 固定禁用格（DEP_GROUP/BIL_ID/DATE_CST/CLOSE_ID），DATE_CST 格的 value 从 `--date-cst` 注入；[6][7] 筛选格（DEP/PRD_NO）
- 顶层 `OTHERINFO: {DEP_GROUP:"00000000", INCLUDESON:"F"}` + `PAGE_INFO: {PAGE_SIZE:-1, CURRENT_PAGE:1}`（-1 取全量，**无 5000 截断**）
- **取数键 TRANS**（不是 REPORT__TAB）；本学习库无成本数据 → 0 行属正常口径

**accbook 清单**：`AccBook/GetList` 返回 `data.ACC_BOOK_BS`；请求 18 列、实测返 35 列（列名自适应再次生效）。2026-10-14 后端升级后恢复返回（此前 2026-10-12 曾空 data）；BOOK_NO 可直接喂 accgl `--book-no`。

## 五、失败对照表

| 现象 | 原因 | 行动 |
|------|------|------|
| `NETWORK` | ERP 冷启动预热中 | 稍后重试即可 |
| `10001` 通用业务错 | message 不可靠 | 对照本文件检查请求体（常见：SEARCH_INFO 顺序/空值传了 null） |
| `20001/20004` | 认证失效 | 脚本已自动重试；仍失败 → 手动 login 再查 |
| `CONFIG_MISSING` | 账号没传（缓存过期后重登需要） | 补 --compno/--usr 或环境变量（学习环境 AT01/SAN）——脚本会自动真登录 + 续缓存，无需手动 login |
| Token 到期（缓存失效 + 无账号） | 演示 Token 有效期约 16.7 天（2026-10-16 实战首撞） | 同上：补账号参数即自动重登续期 |

## 六、基线数据（回归对照用）

- invso 零参（今年）：**9 行特斯拉订单**（含文档示例 SO68030001，2026-10-09/10-12/10-14 三次实测一致）
- 筛选实测（2026-10-15 技能版验证，**筛选真实生效**）：`--cusno C001`→9 行 / `--cusno ZZZZ`→0 行 / `--prdno M0001`→9 行 / 不存在货品→0 行
- 2020 年区间：0 行（空结果路径）
- accgl（`--book-no 00000000`，当月）：**12 行**——4 个科目（库存现金/银行存款/实收资本/生产成本）× REM_TYPE 1/2/3（期初/期末/发生）三种视图；`--date-cst 2026-08` 同 12 行；2026-10-15 实测与 MCP 基线一致
- mrppu 零参 / 指定期间：**0 行**（学习库无成本数据，空属正常；2026-10-16 实测）
- accbook：**1 本账簿**（00000000「First Department」RMB；2026-10-16 实测，后端升级后恢复）

## 七、本技能踩过的坑（技能版特有）

- **参数大小写**：parseArgs 产出的键是小写（`cusno`/`prdno`），构造请求体时读 `args.cusNo` 会恒为 undefined → 筛选悄悄失效（返回全量）。冒烟时用「不存在的客户代号」才暴露——验筛选必须用**不存在值**（期望 0 行），用真实值（C001→9 行）会误判「看似筛了」
