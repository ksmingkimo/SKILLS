---
name: sunlike-erp-api
description: >
  SUNLIKE ERP API 对接专家。用于对接 SUNLIKE ERP 系统的订单 API（DRPSO 模块），
  包括登录认证、订单查询(GETDATA)、订单录入(ADDDATA)，以及前置配置界面、连接测试、
  环境运行检测。当用户提到 SUNLIKE、ERP 对接、订单 API、受订单、DRPSO、
  ERP 配置测试、ERP 环境检测时触发。也适用于对接其他 SUNLIKE 模块（采购、库存等），
  因为认证和配置模式是通用的。
---

# SUNLIKE ERP API 对接 Skill

对接 SUNLIKE ERP 系统的完整指南——覆盖订单模块（DRPSO）的 API 调用、前置配置、连接测试与环境检测。

---

## 一、使用本 Skill 的时机

当你要做以下事情时，参考本 skill 的指导和模板：

- 在新项目中对接 SUNLIKE ERP 的订单 API
- 搭建 ERP 连接配置界面（站点地址 + 账号 + 测试按钮）
- 编写 ERP 客户端模块
- 排查 ERP API 调用失败的问题
- 为 ERP 对接编写自动化检测脚本
- 扩展到 SUNLIKE 的其他单据模块（采购、库存、发货等）

---

## 二、核心原则：API 对接三步验证法

> ⚠️ **这是整个 skill 最重要的部分。违反此规则是本项目 40% 问题的根因。**

在写任何一行 API 调用代码之前，必须执行三步：

```
Step 1：打开文档 → 阅读原始 API 文档（不是用户的口头描述）
Step 2：拿到示例 → 获取可工作的 curl/Postman 请求
Step 3：逐字段对照 → 文档定义 vs 代码实现，一一对应
```

**铁律：**
- 用户提供的 API 信息是**线索**，不是规范 — 必须主动查阅原始文档交叉验证
- 对接企业级系统（ERP/MES/WMS），字段名必须以文档或实际 API 返回为准，**禁止自行命名**
- 表单字段的约束条件（必填/可选/格式）必须来自实际 API 文档，不能凭常识设定

详见 `references/pitfalls-and-lessons.md` 中记录的全部坑（单据侧 8 + 报表侧 8）。

---

## 三、SUNLIKE ERP API 快速参考

> ⚠️ **站点迁移（2026-09-30）**：API 站点由 `ERPAPI` 迁至 `SunReport`，**仅前缀变化**（`{站点}/ERPAPI/...` → `{站点}/SunReport/...`），路径其余部分不变。本文件端点均已按 SunReport 更新；单据端点（DRPSO）按迁移规则推导、本学习项目未实测，以实际返回为准。

### 3.1 通用认证

所有业务 API（GETDATA/ADDDATA）需要在 Header 中携带 Token：

```
Authorization: Bearer <TOKEN>
```

Token 通过登录接口获取。**有效期以登录返回的 `EXPIRES_IN` 为准（单位秒；本机实测 60000，2026-10），不要写死**。同一站点地址的 Token 应缓存复用（提前 1 分钟过期判定），避免每次调用都重新登录。

### 3.2 登录认证

```
POST {站点}/SunReport/auth/login
Content-Type: application/json

Body:
{
  "COMPNO":   "公司代号（不带 /######## 后缀）",
  "USR":      "用户名",
  "PWD":      "密码（可为空字符串，内网部署常见）",
  "LANG_ID":  "zh-cn",
  "SYS_TYPE": "ERP"
}

成功判断: data.code === 0 && data.data.TOKEN 存在
返回: data 只有 TOKEN / EXPIRES_IN（有效期，秒）/ EXPIRES_TIMESTAMP（Unix 秒）三个字段
```

> ⚠️ **关键：** SUNLIKE ERP API 无论成功或失败都返回 HTTP 200。不能用 `resp.ok` 判断成功！必须检查 body 中的 `code` 字段。

### 3.3 查询订单（GETDATA）

```
POST {站点}/SunReport/DRPSO/GETDATA
Authorization: Bearer <TOKEN>
Content-Type: application/json

Body:
{
  "PGM":   "DRPSO",
  "OS_ID": "SO",
  "OS_NO": "SO68030001"      // 要查询的订单号
}

成功判断: data.code === 0
返回结构: data.data.MF_POS[] (主表), data.data.TF_POS[] (明细)
```

### 3.4 录入订单（ADDDATA）

```
POST {站点}/SunReport/DRPSO/ADDDATA
Authorization: Bearer <TOKEN>
Content-Type: application/json

Body:
{
  "REF_NO": "UP000001",      // 第三方单号
  "PGM":    "DRPSO",
  "MF_POS": [{               // 主表（表头信息）
    "OS_ID":    "SO",
    "OS_NO":    "UP000001",   // 自动编码时 ERP 会替换
    "OS_DD":    "2026-08-04", // 单据日期
    "CUS_NO":   "C001",       // 客户编号
    "CUS_NAME": "客户名称",
    "TAX_ID":   "1",          // 1=不计税 2=应税内含 3=应税外加
    "USR":      "用户名",
    "PO_DEP":   "001",        // 默认部门
    "SAL_NO":   "",           // 业务员
    "PAY_MTH":  "1",          // 交易类别
    "PAY_DAYS": 1,            // 起算日
    "CHK_DAYS": 30,           // 票据天数
    "SEND_MTH": "1",          // 送货方式
    "ZHANG_ID": "1",          // 立帐方式：1=单张立帐
    "EST_DD":   "2026-08-04", // 预交货日期
    "REM":      "备注"
  }],
  "TF_POS": [{               // 明细表（品项信息）
    "OS_ID":    "SO",
    "OS_NO":    "UP000001",
    "ITM":      1,
    "PRD_NO":   "M0001",      // 产品编号
    "PRD_NAME": "产品名称",
    "WH":       "0000",       // 仓库
    "UNIT":     "1",          // 单位
    "QTY":      1,            // 数量
    "UP":       230000,       // 单价
    "AMT":      230000,       // 金额 = QTY × UP（必须计算）
    "AMTN":     230000,       // 本位币金额
    "TAX_RTO":  13,           // 默认税率 13%
    "OS_DD":    "2026-08-04"
  }]
}

成功判断: data.code === 0
返回: data.data.MF_POS[0].OS_NO (ERP 生成的 online 单号)
```

### 3.5 错误返回模式

SUNLIKE API 在业务失败时依然返回 HTTP 200，错误信息在 body 中：

```json
{
  "code": -1,
  "message": "PGM 不能为空"
}
```

报表 API 的错误码体系：`10001` 通用业务错（message 仅供参考不可靠）、`20001`/`20004` 认证失效（应清 Token 缓存重登重试一次）。

---

### 3.6 报表查询 API（getReport / getList / SSE / 依赖链）

SUNLIKE 报表 API 与单据 API（GETDATA/ADDDATA）是**两套请求体**，写报表调用前先读 `references/report-api.md`：

- 端点：`POST {站点}/SunReport/api/{相对路径}`（相对路径不带 `api/` 前缀；端点拼写以实测为准，如总账是 `accGeneralLedger` 不是 `accgl`）
- 请求体：`{ PGM, SEARCH_INFO: [...], DISPLAY_FIELDS }`——SEARCH_INFO 按索引固定顺序，空筛选传 `""` 不传 null
- 成功判断：`code === 0`；错误码 `10001` 通用业务错（message 不可靠）、`20001`/`20004` 认证失效（清缓存重登重试一次）
- 分页：服务端无视 offset → 取全量 `[0, 5000]`
- 响应列：`REPORT__TAB` 列名以 ERP **实际返回**为准（不以请求的 DISPLAY_FIELDS 为准）→ 用 `Object.keys(rows[0])` 自适应

四种调用模式（本学习项目实测过的教学代表）：

| 模式 | 报表 | 端点（相对路径，实测拼写） | 取数键 |
|------|------|--------------------------|--------|
| getReport（十格 SEARCH_INFO） | 受订单 invso | `invso/getReport` | REPORT__TAB |
| getList（顶层 OTHERINFO/PAGE_INFO） | 成本分析 mrppu | `mrppu/getList` | TRANS |
| SSE 流式（三格 + @占位符） | 总分类账 | `accGeneralLedger/GetReportStream` | 流式逐行 |
| 依赖链（先查清单再查询） | 账簿清单 AccBook | `AccBook/GetList` | ACC_BOOK_BS |

---

## 四、实现模式

### 4.1 配置存储

SUNLIKE ERP 连接需要以下配置项（存储在数据库中）：

| 配置键 | 说明 | 必填 |
|--------|------|:---:|
| `erp_site_url` | ERP 站点地址（如 `http://192.168.1.100:8080`） | ✅ |
| `erp_compno` | 公司代号（COMPNO） | ✅ |
| `erp_username` | 登录用户名（USR） | ✅ |
| `erp_password` | 登录密码（PWD，可为空） | — |

使用 SQLite `config` 表的 key-value 模式存储。完整 DAL 模板见 `assets/erp-client-template.js`。

### 4.2 ERP 客户端模块

关键设计要点：

1. **Token 缓存**：同一站点地址的 Token 在有效期内复用，配置变更后清除缓存
2. **站点 URL 处理**：自动去除末尾斜杠（`replace(/\/+$/, '')`）
3. **成功判断**：必须 `code === 0` + 业务数据校验
4. **金额计算**：AMT = QTY × UP（必须在客户端计算好再发送）
5. **REF_NO 生成**：使用有意义的业务前缀（如 `UP` + 补齐位数）

完整代码模板见 `assets/erp-client-template.js`。

### 4.3 配置界面 + 连接测试

标准模式：设置面板包含以下要素：

- **表单字段**：站点地址、公司代号、用户名、密码
- **测试按钮**：实时调用登录 API 验证（不保存，仅验证）
- **反馈区域**：显示测试结果（成功/失败 + 具体原因）
- **保存按钮**：验证通过后再保存

连接测试后端端点：
```
POST /api/config/test-erp
Body: { siteUrl, compNo, username, password }
→ 调用 {siteUrl}/SunReport/auth/login
→ 返回 { success: true/false, message/error }
```

### 4.4 环境运行检测脚本

检测应分层递进，每层依赖下层通过：

1. **数据库层**：表存在性 → 表结构校验
2. **DAL 层**：配置读写 → CRUD 操作验证
3. **配置层**：ERP 四项配置完整性
4. **ERP 客户端层**：登录 → 查询（GETDATA）→ 录入（ADDDATA）全流程

完整检测脚本模板见 `assets/test-script-template.js`。

---

## 五、关键陷阱速查

以下是本项目实际踩过的坑，每个都有对应的纠正措施：

| # | 陷阱 | 错误做法 | 正确做法 |
|---|------|---------|---------|
| 1 | API 路径 | `/auth/login` | `/SunReport/auth/login` |
| 2 | 参数字段名 | `username/password` | `USR/PWD`（大写） |
| 3 | 登录成功判断 | `resp.ok` | `data.code === 0 && data.data.TOKEN` |
| 4 | 录入数据格式 | 扁平结构 | MF_POS(主表) + TF_POS(明细) 嵌套 |
| 5 | 密码必填 | 前端拦截空密码 | 密码可为空（内网部署） |
| 6 | 查询参数 | `{ OS_NO: "xxx" }` | `{ PGM:"DRPSO", OS_ID:"SO", OS_NO:"xxx" }` |
| 7 | Token 管理 | 每次调用都登录 | 同站点 Token 缓存复用 |
| 8 | 金额字段 | 不传或传 0 | AMT = QTY × UP（必须算好） |

完整教训清单见 `references/pitfalls-and-lessons.md`。

### 报表侧陷阱速查（2026-10 回填）

| # | 陷阱 | 错误做法 | 正确做法 |
|---|------|---------|---------|
| 1 | 报表成功判断 | 看 HTTP 200 | `code === 0` |
| 2 | 报表请求体 | SEARCH_INFO 随意排序 | 按索引固定顺序；空筛选传 `""` |
| 3 | 响应列名 | 按请求的 DISPLAY_FIELDS 取名 | 用实际返回列名 `Object.keys(rows[0])` 自适应 |
| 4 | 分页 | 传 offset 翻页 | 取全量 `[0, 5000]`，超限给截断提示 |
| 5 | 筛选参数 | 键名大小写写错 → 静默失效 | 用「不存在的值」验证筛选真的生效 |
| 6 | SSE 流式 | 把进度日志当结果 | 进度走 stderr，只读最终结果 |
| 7 | 并发登录 | 多路同时登录 | 必须单飞保护（后端炸池后只能回收应用池） |
| 8 | Token 过期 | 直接报错放弃 | `20001`/`20004` → 清缓存重登重试一次 |

---

## 六、模块扩展指南

本 skill 当前覆盖 **DRPSO（受订单/销售订单）** 模块。SUNLIKE ERP 的其他单据模块遵循相同的认证和配置模式，只是 PGM 值和 MF_POS/TF_POS 字段有所不同。

### 扩展到其他模块的步骤：

1. **查阅该模块的 API 文档**（三步验证法 Step 1）
2. **确定 PGM 值**（如采购单可能是 `DRPPC`）
3. **确定 MF_POS/TF_POS 字段差异**（业务字段不同，结构层次相同）
4. **复用** erp-client-template.js 中的登录逻辑、Token 缓存、配置读取
5. **新增**该模块的 add/query 函数，按文档调整字段

### 已知的 SUNLIKE API 文档入口：

| 模块 | 文档链接 |
|------|---------|
| 登录认证 | http://api.amtxts.com/?p=150 |
| 受订单查询 | http://api.amtxts.com/?p=635 |
| 受订单录入 | http://api.amtxts.com/?p=637 |

> 其他模块文档以 `http://api.amtxts.com/?p=<编号>` 格式获取，编号向 SUNLIKE 厂商索取。

---

## 七、参考资源

- `references/api-reference.md` — 单据接口（登录/查询/录入）的完整字段清单与约束
- `references/report-api.md` — 报表接口（4 种调用模式）的字段级参考（2026-10 回填）
- `references/pitfalls-and-lessons.md` — 单据侧 8 坑 + 报表侧 8 坑的详细分析与纠正
- `assets/erp-client-template.js` — 可直接复制的 Node.js ERP 客户端模板
- `assets/test-script-template.js` — 可直接复制的环境检测脚本模板

---

## 八、工作检查清单

每次对接 SUNLIKE ERP API 时，逐项确认：

- [ ] 已打开原始 API 文档阅读（非用户描述）
- [ ] 已有可工作的 curl/Postman 示例
- [ ] API 路径包含 `/SunReport/` 前缀（2026-09-30 已迁移，原 `/ERPAPI/` 作废）
- [ ] 字段名与文档完全一致（大小写、缩写）
- [ ] 登录用 `code === 0 && TOKEN` 双重判断（非 HTTP 200）
- [ ] 录入用嵌套结构：MF_POS[] + TF_POS[]
- [ ] 金额字段 AMT = QTY × UP 已计算
- [ ] Token 有缓存机制（同站点复用）
- [ ] 配置项（站点/公司/用户名/密码）可动态修改
- [ ] 连接测试按钮可用
- [ ] 环境检测脚本覆盖登录→查询→录入全链路

**报表查询时补充确认：**
- [ ] 报表端点前缀是 `/SunReport/api/`（非 ERPAPI），端点拼写以实测为准
- [ ] 请求体 `{PGM, SEARCH_INFO, DISPLAY_FIELDS}`，空筛选 `""`、SEARCH_INFO 按索引顺序
- [ ] 成功判断 `code === 0`；列名用实际返回自适应
- [ ] 分页取全量 `[0, 5000]`，超上限给截断提示
