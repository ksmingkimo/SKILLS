// ==================== SUNLIKE ERP API 客户端模板 ====================
// 使用方式：复制到新项目，修改 getConfig() 中的配置来源即可
// 依赖：Node.js 18+（内置 fetch），数据库模块提供 config 读取
//
// ⚠️ 站点迁移（2026-09-30）：API 站点 ERPAPI → SunReport（仅前缀变化），本模板已更新
// 本模板覆盖三个核心 API：
//   1. login()    — 登录获取 Token（带缓存）
//   2. getOrder() — 查询订单（GETDATA）
//   3. addOrder() — 录入订单（ADDDATA）
//
// 文档参考：
//   登录: http://api.amtxts.com/?p=150
//   查询: http://api.amtxts.com/?p=635
//   录入: http://api.amtxts.com/?p=637

// ==================== 依赖（按你的项目调整） ====================
// const db = require('./database')  // 或任何提供 config.getMap() 的模块

// ==================== 内部状态 ====================
let cachedToken = null
let cachedSiteUrl = null

// ==================== 配置读取 ====================
// ⚠️ 按你的项目实际情况修改此函数
function getConfig() {
  // 方式 A：从数据库 config 表读取（推荐）
  // const map = db.config.getMap()
  // return {
  //   siteUrl: (map.erp_site_url || '').replace(/\/+$/, ''),
  //   compNo: map.erp_compno || '',
  //   username: map.erp_username || '',
  //   password: map.erp_password || ''
  // }

  // 方式 B：从环境变量读取
  return {
    siteUrl: (process.env.ERP_SITE_URL || '').replace(/\/+$/, ''),
    compNo: process.env.ERP_COMPNO || '',
    username: process.env.ERP_USERNAME || '',
    password: process.env.ERP_PASSWORD || ''
  }
}

// ==================== 1. 登录认证（带 Token 缓存） ====================
async function login() {
  const { siteUrl, compNo, username, password } = getConfig()
  if (!siteUrl || !compNo || !username) {
    throw new Error('ERP 连接信息未配置，请先设置站点地址、公司代号和用户名')
  }

  // Token 复用：同一站点不重复登录
  if (cachedToken && cachedSiteUrl === siteUrl) {
    return cachedToken
  }

  const resp = await fetch(`${siteUrl}/SunReport/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ COMPNO: compNo, USR: username, PWD: password, LANG_ID: 'zh-cn', SYS_TYPE: 'ERP' })
  })

  if (!resp.ok) {
    throw new Error(`ERP 登录失败：HTTP ${resp.status}`)
  }

  const data = await resp.json()

  // ⚠️ 关键：必须用 code === 0 && TOKEN 判断，不能用 HTTP 200
  if (data.code === 0 && data.data && data.data.TOKEN) {
    cachedToken = data.data.TOKEN
    cachedSiteUrl = siteUrl
    return data.data.TOKEN
  }

  throw new Error('ERP 登录失败：' + (data.message || '未知错误'))
}

// ==================== 2. 查询订单（GETDATA） ====================
// orderNo: ERP 系统中的订单号（如 "SO68030001"）
async function getOrder(orderNo) {
  const token = await login()
  const { siteUrl } = getConfig()

  const resp = await fetch(`${siteUrl}/SunReport/DRPSO/GETDATA`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      PGM: 'DRPSO',      // ⚠️ 必填：程序代号
      OS_ID: 'SO',       // ⚠️ 必填：单据类别
      OS_NO: orderNo     // ⚠️ 必填：订单号
    })
  })

  const data = await resp.json()

  if (data.code !== 0) {
    throw new Error('ERP 查询失败：' + (data.message || '未知错误'))
  }

  // 解析主表和明细
  const header = data.data?.MF_POS?.[0] || null
  const details = data.data?.TF_POS || []

  return {
    success: true,
    data,
    header,      // 主表信息（客户、日期等）
    details      // 明细信息（产品、数量、金额等）
  }
}

// ==================== 3. 录入订单（ADDDATA） ====================
// orderData: { customerCode, customerName, productCode, productName,
//              quantity, unit, unitPrice, deliveryDate, remark, salesNo }
// uploadId:   唯一标识（用于生成 REF_NO）
async function addOrder(orderData, uploadId) {
  const token = await login()
  const { siteUrl, username } = getConfig()

  // 生成唯一第三方单号
  const refNo = `UP${String(uploadId).padStart(6, '0')}`
  const today = new Date().toISOString().split('T')[0]

  // ⚠️ 金额必须在客户端计算
  const qty = parseFloat(orderData.quantity) || 0
  const up = parseFloat(orderData.unitPrice) || 0
  const amt = qty * up

  // ⚠️ 核心：嵌套 MF_POS(主表) + TF_POS(明细) 结构
  const payload = {
    REF_NO: refNo,
    PGM: 'DRPSO',
    MF_POS: [{
      OS_ID: 'SO',
      OS_NO: refNo,                           // 自动编码时 ERP 会替换
      OS_DD: today,
      CUS_NO: orderData.customerCode || '',
      CUS_NAME: orderData.customerName || '',
      TAX_ID: '1',                            // 1=不计税 2=应税内含 3=应税外加
      USR: username,
      PO_DEP: '001',                          // 默认部门
      SAL_NO: orderData.salesNo || '',
      PAY_MTH: '1',
      PAY_DAYS: 1,
      CHK_DAYS: 30,
      SEND_MTH: '1',
      ZHANG_ID: '1',                          // 1=单张立帐
      EST_DD: orderData.deliveryDate || today,
      REM: orderData.remark || ''
    }],
    TF_POS: [{
      OS_ID: 'SO',
      OS_NO: refNo,
      ITM: 1,
      PRD_NO: orderData.productCode || '',
      PRD_NAME: orderData.productName || '',
      WH: '0000',
      UNIT: orderData.unit || '1',
      QTY: qty,
      UP: up,
      AMT: amt,                               // ⚠️ 金额 = 数量 × 单价
      AMTN: amt,                              // ⚠️ 本位币金额（通常等于 AMT）
      TAX_RTO: 13,                            // 默认税率 13%
      OS_DD: today
    }]
  }

  const resp = await fetch(`${siteUrl}/SunReport/DRPSO/ADDDATA`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify(payload)
  })

  const data = await resp.json()

  if (data.code !== 0) {
    throw new Error('ERP 录入失败：' + (data.message || '未知错误'))
  }

  // 提取 ERP 返回的正式单号
  let erpOrderNo = null
  if (data.data) {
    if (Array.isArray(data.data.MF_POS) && data.data.MF_POS.length > 0) {
      erpOrderNo = data.data.MF_POS[0].OS_NO
    } else if (data.data.OS_NO) {
      erpOrderNo = data.data.OS_NO
    }
  }

  return {
    success: true,
    response: data,
    orderNo: erpOrderNo || refNo,
    refNo
  }
}

// ==================== 4. 清除缓存 ====================
// 配置变更后必须调用，否则会用旧站点的 Token
function clearCache() {
  cachedToken = null
  cachedSiteUrl = null
}

// ==================== 导出 ====================
module.exports = { login, getOrder, addOrder, clearCache }

// ==================== 扩展指南 ====================
// 对接其他 SUNLIKE 模块（如采购 DRPPC）时：
//   1. 复用 login() 和 getConfig() 不变
//   2. 新增 getPurchaseOrder() / addPurchaseOrder() 函数
//   3. PGM 改为对应模块代号
//   4. OS_ID 改为对应单据类别
//   5. MF_POS/TF_POS 字段按该模块的文档调整
//   6. 同步更新 clearCache() 或直接复用
