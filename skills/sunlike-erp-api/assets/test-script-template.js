// ==================== SUNLIKE ERP 环境检测脚本模板 ====================
// 使用方式：复制到新项目，修改以下三处即可：
//   1. expectedTables —— 你的数据库表名
//   2. configKeys    —— 你的 ERP 配置项
//   3. erpClient 路径 —— 你的 ERP 客户端模块路径
//
// 检测层次：数据库 → DAL → 配置 → ERP 客户端 → 文件/依赖
// 每层通过才进入下一层，避免级联失败

const fs = require('fs')
const results = []
let passed = 0, failed = 0, skipped = 0

function addResult(name, ok, err) {
  if (ok === 'skip') { skipped++; results.push({ name, status: 'SKIP', error: err }); return }
  if (ok) { passed++; results.push({ name, status: 'PASS' }) }
  else { failed++; results.push({ name, status: 'FAIL', error: err }) }
}

function assert(condition, msg) { if (!condition) throw new Error(msg || '断言失败') }

async function runAll() {

  // ==================== 一、数据库层 ====================
  console.log('\n=== 一、数据库层 ===')
  const db = require('./database')
  db.initDatabase()

  addResult('数据库连接建立', !!db.getDB())

  // ⚠️ 修改为你的表名
  const expectedTables = ['upload_records', 'ocr_results', 'config', 'validation_rules', 'erp_logs']
  const tables = db.getDB().prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ).all().map(r => r.name)
  const missing = expectedTables.filter(t => !tables.includes(t))
  addResult(`${expectedTables.length} 张表存在`, missing.length === 0,
    missing.length ? `缺少: ${missing.join(', ')}` : null)

  // ⚠️ 修改为你的表结构校验
  function checkCols(table, expected) {
    const cols = db.getDB().prepare(`PRAGMA table_info(${table})`).all().map(c => c.name)
    return expected.filter(c => !cols.includes(c))
  }
  addResult('config 表结构', checkCols('config', ['key', 'value', 'description', 'updated_at']).length === 0)

  console.log('数据库层完成')

  // ==================== 二、DAL 层 ====================
  console.log('\n=== 二、DAL 层 ===')
  const map = db.config.getMap()
  addResult('config.getMap() 返回对象', typeof map === 'object' && map !== null)

  // Config 读写验证
  try {
    db.config.set('_test_key', '_test_value', '自动化检测')
    const v = db.config.get('_test_key')
    db.config.set('_test_key', '', '')  // 清理
    addResult('config 读写', v === '_test_value', `期望 _test_value，实际 ${v}`)
  } catch (e) { addResult('config 读写', false, e.message) }

  console.log('DAL 层完成')

  // ==================== 三、配置层 ====================
  console.log('\n=== 三、配置层 ===')

  // ⚠️ 修改为你的配置项
  const configKeys = [
    ['erp_site_url', 'ERP 站点地址'],
    ['erp_compno', 'ERP 公司代号'],
    ['erp_username', 'ERP 用户名']
  ]
  configKeys.forEach(([key, label]) => {
    addResult(`${label} 已配置`, !!map[key])
  })

  const erpReady = !!(map.erp_site_url && map.erp_compno && map.erp_username)
  if (!erpReady) {
    console.log('⚠️  ERP 未完整配置，跳过 API 测试')
  }

  console.log('配置层完成')

  // ==================== 四、ERP 客户端层 ====================
  console.log('\n=== 四、ERP 客户端层 ===')

  if (!erpReady) {
    addResult('ERP 登录', 'skip', 'ERP 未完整配置')
    addResult('ERP 查询', 'skip', 'ERP 未完整配置')
    addResult('ERP 录入', 'skip', 'ERP 未完整配置')
  } else {
    // ⚠️ 修改为你的 ERP 客户端路径
    delete require.cache[require.resolve('./erp-client')]
    const erpClient = require('./erp-client')

    // 4.1 登录测试
    try {
      const token = await erpClient.login()
      addResult('ERP 登录获取 Token', typeof token === 'string' && token.length > 0)
    } catch (e) { addResult('ERP 登录获取 Token', false, e.message) }

    // 4.2 查询测试
    // ⚠️ 修改为你的测试订单号
    const TEST_ORDER_NO = 'SO68030001'
    try {
      const result = await erpClient.getOrder(TEST_ORDER_NO)
      const ok = result.success && result.header && result.details.length > 0
      addResult(`ERP 查询 ${TEST_ORDER_NO}`, ok,
        !result.success ? '查询返回失败' : !result.header ? '主表为空' : '明细为空')
      if (ok) {
        console.log(`  客户: ${result.header.CUS_NAME} | 品名: ${result.details[0]?.PRD_NAME} | 金额: ${result.details[0]?.AMT}`)
      }
    } catch (e) { addResult(`ERP 查询 ${TEST_ORDER_NO}`, false, e.message) }

    // 4.3 录入测试（用时间戳避免 REF_NO 重复）
    try {
      const testId = Date.now() % 1000000
      const r = await erpClient.addOrder({
        customerCode: 'C001', customerName: '测试客户',
        productCode: 'M0001', productName: '测试产品',
        quantity: '1', unit: '1', unitPrice: '100',
        deliveryDate: new Date().toISOString().split('T')[0],
        remark: '自动化检测 - ' + new Date().toISOString()
      }, testId)
      addResult('ERP 录入测试订单', r.success && !!r.orderNo,
        !r.success ? '录入失败' : '未返回订单号')
      if (r.success) console.log(`  录入成功，ERP 单号: ${r.orderNo}`)
    } catch (e) { addResult('ERP 录入测试订单', false, e.message) }
  }

  console.log('ERP 客户端层完成')

  // ==================== 五、文件与依赖检查 ====================
  console.log('\n=== 五、文件与依赖检查 ===')

  // ⚠️ 修改为你的关键文件列表
  const keyFiles = [
    ['server.js', '后端主入口'],
    ['erp-client.js', 'ERP 客户端模块'],
    ['database/index.js', '数据库入口'],
    ['package.json', '项目配置']
  ]
  keyFiles.forEach(([f, desc]) => {
    addResult(`${desc} (${f})`, fs.existsSync('./' + f), '文件不存在')
  })

  // ⚠️ 修改为你的关键依赖
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'))
  const keyDeps = ['express', 'better-sqlite3']
  keyDeps.forEach(dep => {
    const inDeps = (pkg.dependencies && pkg.dependencies[dep])
      || (pkg.devDependencies && pkg.devDependencies[dep])
    addResult(`依赖 ${dep}`, !!inDeps, '未找到')
  })

  console.log('文件与依赖检查完成')

  // ==================== 输出报告 ====================
  console.log('\n' + '='.repeat(60))
  console.log('检测结果汇总')
  console.log('='.repeat(60) + '\n')

  results.forEach(r => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️'
    console.log(`${icon} ${r.name}${r.error ? ' — ' + r.error : ''}`)
  })

  console.log('\n' + '-'.repeat(60))
  console.log(`总计: ${results.length} 项 | 通过: ${passed} | 失败: ${failed} | 跳过: ${skipped}`)

  const allPassed = failed === 0

  // 生成 Markdown 报告
  const md = `# ERP 系统综合检测报告

> 检测时间：${new Date().toLocaleString('zh-CN')}
> 检测结果：${allPassed ? '全部通过' : '存在失败项'}

## 汇总

| 项目 | 数量 |
|------|------|
| 总检测项 | ${results.length} |
| 通过 | ${passed} |
| 失败 | ${failed} |
| 跳过 | ${skipped} |

## 详细结果

| 状态 | 检测项 | 备注 |
|------|--------|------|
${results.map(r => `| ${r.status} | ${r.name} | ${r.error || '—'} |`).join('\n')}

## ERP 配置状态

| 配置项 | 状态 |
|--------|------|
${configKeys.map(([key, label]) => `| ${label} | ${map[key] ? '✅ 已配置' : '❌ 未配置'} |`).join('\n')}
| 密码 | ${map.erp_password ? '✅ 已设置' : '⚠️ 未设置（可为空）'} |
`

  fs.writeFileSync('./ERP检测报告.md', md)
  console.log('\n📄 检测报告已保存到 ERP检测报告.md')

  if (allPassed) {
    console.log('\n🎉 所有检测项通过！')
  } else {
    console.log(`\n⚠️  ${failed} 项检测失败，请查看报告。`)
  }
}

runAll().catch(err => {
  console.error('\n💥 检测脚本异常:', err)
  process.exit(1)
})
