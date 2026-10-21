# SUNLIKE ERP API 接口参数完整参考

> 本文档是三个核心 API 的字段级精确参考，对接时逐字段对照使用。
>
> ⚠️ **站点迁移（2026-09-30）**：API 站点由 `ERPAPI` 迁至 `SunReport`，**仅前缀变化**，路径其余部分不变。本文档端点均已按 SunReport 更新；单据端点（DRPSO）按迁移规则推导、本学习项目未实测，以实际返回为准。

---

## 1. 登录认证

```
POST {站点}/SunReport/auth/login
Content-Type: application/json
```

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `COMPNO` | string | ✅ | 公司代号（不带 `/########` 后缀） |
| `USR` | string | ✅ | 登录用户名 |
| `PWD` | string | — | 密码，可为空字符串（内网部署常见） |
| `LANG_ID` | string | — | 语言，`"zh-cn"` |
| `SYS_TYPE` | string | — | 系统类型，`"ERP"` |

### 成功响应

```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "TOKEN": "xxxxxxxxxxxxxxxxxxxxx",
    "EXPIRES_IN": 60000,
    "EXPIRES_TIMESTAMP": 1792000000
  }
}
```

### 失败响应

```json
{
  "code": -1,
  "message": "用户名或密码错误"
}
```

### 关键约束

- HTTP 状态码无论成功失败均为 200
- 成功必须同时满足：`code === 0` 且 `data.TOKEN` 存在
- Token 有效期以返回的 `EXPIRES_IN` 为准（单位秒；本机实测 60000，2026-10）；`EXPIRES_TIMESTAMP` 为 Unix 秒
- 密码可以为空（内网部署常见）

---

## 2. 查询订单（GETDATA）

```
POST {站点}/SunReport/DRPSO/GETDATA
Authorization: Bearer <TOKEN>
Content-Type: application/json
```

### 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| `PGM` | string | ✅ | 程序代号，固定值 `"DRPSO"` |
| `OS_ID` | string | ✅ | 单据类别，固定值 `"SO"` |
| `OS_NO` | string | ✅ | 订单号 |

> ⚠️ **PGM 和 OS_ID 均为必填**，缺少任何一个会返回"PGM 不能为空"或"OS_ID 不能为空"。

### 成功响应结构

```json
{
  "code": 0,
  "data": {
    "MF_POS": [
      {
        "OS_NO": "SO68030001",
        "OS_DD": "2026-08-01",
        "CUS_NO": "C001",
        "CUS_NAME": "特斯拉",
        "BILL_STATE": "0",
        ...
      }
    ],
    "TF_POS": [
      {
        "OS_NO": "SO68030001",
        "ITM": 1,
        "PRD_NO": "M0001",
        "PRD_NAME": "Model 3",
        "QTY": 1,
        "UP": 230000,
        "AMT": 230000,
        ...
      }
    ]
  }
}
```

### 关键约束

- 成功：`code === 0`
- `MF_POS` 是主表数组（通常 1 条）
- `TF_POS` 是明细数组（可能多条）
- 确保两个数组都存在且非空才算查询成功

---

## 3. 录入订单（ADDDATA）

```
POST {站点}/SunReport/DRPSO/ADDDATA
Authorization: Bearer <TOKEN>
Content-Type: application/json
```

### 请求体结构

```json
{
  "REF_NO": "第三方单号",
  "PGM": "DRPSO",
  "MF_POS": [{ ... }],
  "TF_POS": [{ ... }]
}
```

### MF_POS（主表/表头）字段清单

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:---:|--------|------|
| `OS_ID` | string | ✅ | `"SO"` | 单据类别 |
| `OS_NO` | string | ✅ | 与 REF_NO 一致 | 订单号（自动编码时 ERP 会覆盖） |
| `OS_DD` | string | ✅ | 当天日期 | 单据日期，格式 `YYYY-MM-DD` |
| `CUS_NO` | string | ✅ | — | 客户编号 |
| `CUS_NAME` | string | ✅ | — | 客户名称 |
| `TAX_ID` | string | ✅ | `"1"` | 税别：1=不计税，2=应税内含，3=应税外加 |
| `USR` | string | — | 当前用户名 | 制单人 |
| `PO_DEP` | string | ✅ | `"001"` | 部门代号 |
| `SAL_NO` | string | — | `""` | 业务员代号 |
| `PAY_MTH` | string | — | `"1"` | 交易类别 |
| `PAY_DAYS` | number | — | `1` | 起算日 |
| `CHK_DAYS` | number | — | `30` | 票据天数 |
| `SEND_MTH` | string | — | `"1"` | 送货方式 |
| `ZHANG_ID` | string | ✅ | `"1"` | 立帐方式：1=单张立帐 |
| `EST_DD` | string | — | 当天日期 | 预交货日期，格式 `YYYY-MM-DD` |
| `REM` | string | — | `""` | 备注 |

### TF_POS（明细/表身）字段清单

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:---:|--------|------|
| `OS_ID` | string | ✅ | `"SO"` | 单据类别 |
| `OS_NO` | string | ✅ | 与主表一致 | 订单号 |
| `ITM` | number | ✅ | `1` | 项次（从 1 开始递增） |
| `PRD_NO` | string | ✅ | — | 产品编号 |
| `PRD_NAME` | string | ✅ | — | 产品名称 |
| `WH` | string | — | `"0000"` | 仓库代号 |
| `UNIT` | string | — | `"1"` | 单位 |
| `QTY` | number | ✅ | — | 数量 |
| `UP` | number | — | — | 单价 |
| `AMT` | number | ✅ | QTY × UP | 金额（必须由客户端计算） |
| `AMTN` | number | ✅ | 同 AMT | 本位币金额 |
| `TAX_RTO` | number | — | `13` | 税率（百分比） |
| `OS_DD` | string | — | 当天日期 | 预交货日期 |

### 成功响应

```json
{
  "code": 0,
  "message": "录入成功",
  "data": {
    "MF_POS": [
      { "OS_NO": "SO68030002", ... }
    ],
    "TF_POS": [
      { "OS_NO": "SO68030002", ... }
    ]
  }
}
```

### 关键约束

- **AMT 必须手动计算**：`AMT = QTY × UP`，ERP 不会自动计算
- **AMTN 通常等于 AMT**（本位币金额）
- **REF_NO 必须唯一**：可用时间戳或自增 ID + 前缀（如 `UP000001`）
- **OS_NO 在自动编码模式下会被 ERP 覆盖**，但仍需传一个值
- **TAX_ID 三个值**：1=不计税（最常用），2=应税内含，3=应税外加
- **ZHANG_ID 固定为 "1"**（单张立帐）

---

## 4. 其他 SUNLIKE 模块的通用模式

所有 SUNLIKE ERP API 遵循相同的模式：

```
认证：POST {站点}/SunReport/auth/login
业务：POST {站点}/SunReport/{PGM}/{ACTION}
```

| 动作 | ACTION | 说明 |
|------|--------|------|
| 查询 | `GETDATA` | 按主键查询单据 |
| 录入 | `ADDDATA` | 新增单据 |

不同模块（采购、库存、发货等）的主要差异：
- `PGM` 值不同（如 `DRPPC` 采购、`DRPINV` 库存）
- `OS_ID` 值不同（如 `PO` 采购、`IN` 入库）
- MF_POS/TF_POS 中的业务字段不同

但认证方式、Token 缓存、成功判断逻辑完全相同，可直接复用。

---

## 参考文档来源

| 接口 | 文档 |
|------|------|
| 登录 | http://api.amtxts.com/?p=150 |
| 查询 | http://api.amtxts.com/?p=635 |
| 录入 | http://api.amtxts.com/?p=637 |
