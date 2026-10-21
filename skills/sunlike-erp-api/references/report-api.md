# SUNLIKE ERP 报表 API 接口参数完整参考

> 本文档是报表 API（invso / mrppu / accGeneralLedger / AccBook）的字段级精确参考，对接时逐字段对照使用。
> 来源：SKILLS 学习项目实测（2026-10）。认证（登录/Token）与单据 API 共用，见 `api-reference.md` 第 1 节。
> ⚠️ 端点拼写以实测为准（文档不可信）——如总账是 `accGeneralLedger` 不是 `accgl`。

---

## 0. 与单据 API 的区别（先读）

单据 API（GETDATA/ADDDATA）与报表 API 是**两套请求体**：

| | 单据 API | 报表 API |
|---|---------|---------|
| 端点 | `{站点}/SunReport/{PGM}/{ACTION}` | `{站点}/SunReport/api/{相对路径}`（相对路径不带 `api/` 前缀） |
| 请求体 | `{ PGM, OS_ID, MF_POS, TF_POS, ... }` | `{ PGM, SEARCH_INFO: [...], DISPLAY_FIELDS }` |
| 响应 | `data.MF_POS[]` / `data.TF_POS[]` | 按模式：`REPORT__TAB` / `TRANS` / `ACC_BOOK_BS` |

## 1. 通用请求体

```json
{
  "PGM": "报表程序代号",
  "SEARCH_INFO": [ /* 位置敏感数组，按索引固定顺序 */ ],
  "DISPLAY_FIELDS": [ /* 请求显示的列（仅供参考——响应列以实际返回为准） */ ]
}
```

- **SEARCH_INFO 按索引固定顺序**：每只报表的「格」不同（getReport 十格 / getList 八格 / 流式三格），照实测配置抄
- **空筛选传 `""` 不传 null**：传 null 后端报 10001「Value cannot be null」
- **分页**：getReport 家族在 [0] 格 `offset: [0, 5000]`（服务端无视 start，一刀切取全量）；getList 家族在顶层 `PAGE_INFO: { PAGE_SIZE: -1, CURRENT_PAGE: 1 }`（-1 取全量，无 5000 截断）

## 2. getReport 模式：受订单 invso

```
POST {站点}/SunReport/api/invso/getReport   ← 端点全小写（实测）
```

- `PGM` = `REP_SOLIST`；取数键：`REPORT__TAB`
- 日期默认口径：不传日期参数 → 查今年 1/1 ~ 12/31（不是全部历史）

SEARCH_INFO 十格解剖（实测配置）：

| 格 | 内容 | 说明 |
|----|------|------|
| [0] | `{ offset: [0, 5000], temp: true }` | 分页：服务端无视 offset 的 start → 取全量 |
| [1] | `{ showLadder: "F", displayFields, sumFields: [] }` | 展示配置：28 个显示字段 |
| [2] | `{ fixCondition: { REPORT_DD_FIELD: "OS_DD", SUB_CUS: "" } }` | 固定条件：日期字段是 OS_DD |
| [3] | 日期格（OS_DD） | `need:true, fieldDisabled:true`；传日期 → `range`，不传 → `this_year` |
| [4] | 客户格（CUS_NO） | `checkUnder:"T"` |
| [5] | 货品格（PRD_NO） | — |
| [6][7] | 部门/仓库格 | 不开放 → 恒空（`value:""`） |
| [8] | 审核状态格 | `operator:"equal"`，不限制审核状态 |
| [9] | `{ orderBy: { OS_DD: "asc" } }` | 按受订日期升序 |

## 3. getList 模式：产品成本分析 mrppu

```
POST {站点}/SunReport/api/mrppu/getList   ← 端点全小写（实测）
```

- 与 getReport 的差异：SEARCH_INFO **八格、无 orderBy 格**；[0] 无 offset（分页在顶层）；取数键 **`TRANS`**（不是 REPORT__TAB）
- 顶层 `OTHERINFO: { DEP_GROUP: "00000000", INCLUDESON: "F" }` + `PAGE_INFO: { PAGE_SIZE: -1, CURRENT_PAGE: 1 }`
- 八格布局：[2]~[5] 固定禁用格（DEP_GROUP/BIL_ID/DATE_CST/CLOSE_ID），其中 DATE_CST 格的 value 由期间参数注入；[6][7] 筛选格（DEP/PRD_NO）。完整八格以实测配置为准（参考 sunlike-erp-report 技能 `scripts/erp-client.mjs` 的 buildMrppuBody）

## 4. SSE 流式模式：总分类账 accGeneralLedger

```
POST {站点}/SunReport/api/accGeneralLedger/GetReportStream   ← 端点拼写实测（不是 accgl）
```

- SEARCH_INFO **三格**：[0] 展示配置（`showBody:"T"`）、[1] fixCondition、[2] orderBy
- **占位符模板**：fixCondition 里写 `@BOOK_NO`/`@PERIOD`/`@YEARS`/`@IPERIOD`/`@DATE_B`/`@DATE_E`/`@START_DD`，由期间参数（YYYY-MM，默认当月）派生整族字段替换——一个会计期间派生整族，总账家族加报表零改动复用；非法期间（如 9999-99）不回错、回退当月
- **依赖链**：BOOK_NO 必填（空值 ERP 回 406）→ 不传时先调 AccBook/GetList 取清单第一本；清单空 → 可读错误（行动：直接指定 BOOK_NO）
- **SSE 判别三路**（响应 Content-Type）：
  1. HTTP 错（如 406）→ HTTP 级错误
  2. `application/json` → 失败不走流，按普通 JSON 业务码处理（20001/20004 照常清缓存重试一次）
  3. `text/event-stream` → 逐 chunk 读、**行缓冲**（chunk 边界切断行 → 不完整行留待下一 chunk）、`data: {JSON}` 事件切分、`ERR` 字段转可读错误
- **进度不是结果**：流里 PERCENT/TITLE 只进 stderr 日志；数据在 `DATA.REPORT__TAB`，可能分多条消息，全部拼起来才是最终行集合

## 5. 依赖清单模式：账簿清单 AccBook

```
POST {站点}/SunReport/api/AccBook/GetList   ← 端点大小写混合（实测）
```

- 取数键：`ACC_BOOK_BS`
- 请求 18 列、实测返回 35 列（列名自适应再次生效）
- 2026-10-14 后端升级后恢复返回（此前 2026-10-12 曾返回空 data）——「清单空」口径：报「ERP 未返回数据」，不断言「未启用总账」
- 清单行里的 BOOK_NO 可直接喂给总账（第 4 节依赖链）

## 6. 错误码

| 错误码 | 含义 | 行动 |
|--------|------|------|
| `10001` | 通用业务错（message 仅供参考不可靠） | 对照请求体检查（常见：SEARCH_INFO 顺序错 / 空值传了 null） |
| `20001` / `20004` | 认证失效 | 清 Token 缓存重登重试一次；仍失败再手动登录 |

## 7. 响应列自适应（铁律）

`REPORT__TAB` 列名以 ERP **实际返回**为准，不以请求的 DISPLAY_FIELDS 为准（实测：请求 28 列返回 29 列且不同名）→ 结果加工用 `Object.keys(rows[0])` 自适应表头，绝不自造列名。

## 8. 后端行为怪癖

冷启动、并发登录炸池、PowerShell + curl 搅坏引号等，见 `pitfalls-and-lessons.md` 第二部分（后端行为怪癖）。

## 附录：基线数据（回归对照）

- invso 零参（今年）：**9 行特斯拉订单**（2026-10 三次实测一致）
- accgl（BOOK_NO=00000000，当月）：**12 行**（4 科目 × 期初/期末/发生三种视图）
- mrppu：**0 行**（学习库无成本数据，空属正常）
- accbook：**1 本账簿**（00000000「First Department」）
