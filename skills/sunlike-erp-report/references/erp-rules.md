# ERP 调用铁律与坑

> 本文件是「渐进披露」的第二层：SKILL.md 只写流程，这里放细节。写任何 ERP 调用代码前逐条对照。
> 来源：MCP 学习项目 9 阶段实测（2026-09-24 ~ 10-15）+ 三份 API 文档（项目目录 D:\VibeCoding\skills\ 下）。

## 三步验证法

① 打开原始文档阅读 ② 拿到可工作的 curl/Postman 示例 ③ 逐字段对照代码实现。

用户提供的 API 信息是线索不是规范；字段名以文档/实际返回为准，禁止自行命名。

## 铁律表

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

## 后端行为怪癖（都是实测踩出来的）

1. **冷启动**：重启/闲置后首个请求预热可能 >10s → 首次调用报 NETWORK 错误属正常，稍后重试即可；**并发打冷后端 = 全员超时**——遇「全炸」先对照实验（单发 curl 捂热），别急着怀疑代码
2. **并发登录炸池**：并发登录请求会撞坏 .NET 内部非并发集合 → 10001「concurrent update … corrupted its state」，且**进程内状态持久损坏**（此后单发请求也全炸）→ 恢复只能回收应用池。**所有调用方必须内置单飞保护**（本技能脚本已用锁文件实现）
3. **AccBook/GetList 曾返回空数据（已翻篇，2026-10-15 实测复核）**：后端 2026-10-14 升级后恢复返回账簿清单（总账「依赖链兜底」实测成功）。历史口径保留：`code 0 + data:{}` 是「ERP 未返回数据」，不是「未启用总账」——总账模块健康（GetReportStream 用 `BOOK_NO=00000000` 直查正常出数）。文案按此口径
4. **后端升级（2026-10-14）**：此前 accgl 流式报错、AccBook 空 data 两条怪象已翻篇（2026-10-15 实测复核：accgl 流式健康出数、当月 12 行与 2026-08 基线一致）——旧结论遇新现象时，仍以当前实测为准
5. **PowerShell 5.1 + curl.exe 传 JSON 会搅坏引号**（实测报 10001「Value cannot be null」，同请求 Git Bash curl / Node fetch 成功）→ 发 JSON 请求用 Git Bash 的 curl、Node fetch 或 Invoke-RestMethod

## 恢复手段

- **应用池回收**（并发登录炸池后的唯一恢复手段）：本机站点在 Default Web Site 下，池名 `AppPool_SunReport`：
  `Restart-WebAppPool -Name 'AppPool_SunReport'`
- **冷启动捂热**：单发一次登录/查询即可
