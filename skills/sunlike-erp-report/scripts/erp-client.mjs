#!/usr/bin/env node
// scripts/erp-client.mjs — ERP 直连客户端（阶段 3：登录 + Token 缓存 + 受订单报表）
//
// 技能自带脚本：Claude 用 node 运行它完成确定性任务（登录、管 Token、查报表），
// 不让 LLM 手写 HTTP 请求。零依赖：Node 24 自带 fetch。
//
// 与 MCP 项目 server/erp-client.js + report-engine.js 的同与异：
//   同：配置外部化、code===0 铁律、错误带码可读、超时兜底、认证失效重试一次
//   异：MCP 服务是常驻进程 → 内存缓存即可；本脚本每次运行是新进程 → 缓存落盘文件。
//       锁文件单飞——并发登录会撞坏 ERP 后端（见 ../references/erp-rules.md）。
//       SEARCH_INFO 构造照抄 MCP 注册表 invso 配置（2026-10 实测：9 行特斯拉）。
//
// ⚠️ 站点历史：SunFusion → ERPAPI → SunReport（2026-09-30 起）。当前以 SunReport 为准。

import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DATA_DIR = join(homedir(), ".sunlike-erp-report");
const CACHE_FILE = join(DATA_DIR, "token-cache.json");
const LOCK_FILE = join(DATA_DIR, "login.lock");

function err(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

// —— 配置外部化 ——
// 账号来源优先级：--参数 > 环境变量（ERP_COMPNO/ERP_USR/ERP_PWD）。都缺 → CONFIG_MISSING。
// 学习环境演示账号（COMPNO=AT01 / USR=SAN / 密码空）由 SKILL.md 告知 Claude 传入，
// 不写死在代码里——技能可能被共享/提交，真账号绝不能进文件。
function getConfig(args) {
  const env = process.env;
  return {
    baseUrl: (env.ERP_BASE_URL || "http://localhost/SunReport").replace(/\/+$/, ""),
    compno: args.compno ?? env.ERP_COMPNO ?? "",
    usr: args.usr ?? env.ERP_USR ?? "",
    pwd: args.pwd ?? env.ERP_PWD ?? "", // 内网部署密码可为空字符串
    langId: env.ERP_LANG_ID || "zh-cn",
    sysType: env.ERP_SYS_TYPE || "ERP",
  };
}

// —— 极简参数解析 ——
// login|status [--compno X] [--usr Y] [--pwd Z] [--force]
// report invso [--date-from YYYY-MM-DD] [--date-to YYYY-MM-DD] [--cusno X] [--prdno X]
function parseArgs(argv) {
  const args = { force: false };
  const rest = [];
  const withValue = new Set(["--compno", "--usr", "--pwd", "--date-from", "--date-to", "--cusno", "--prdno", "--book-no", "--date-cst", "--dep"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") args.force = true;
    else if (withValue.has(a)) {
      const v = argv[++i];
      if (v === undefined) throw err("USAGE", `参数 ${a} 缺值`);
      args[a.slice(2).replace("-from", "From").replace("-to", "To").replace("-no", "No").replace("-cst", "Cst")] = v; // --date-from → dateFrom, --book-no → bookNo, --date-cst → dateCst
    } else rest.push(a);
  }
  return { cmd: rest[0], sub: rest[1], args };
}

function ok(payload) {
  console.log(JSON.stringify({ ok: true, ...payload }));
}

function ensureDataDir() {
  mkdirSync(DATA_DIR, { recursive: true });
}

// —— Token 文件缓存 ——
function readCache() {
  try {
    const c = JSON.parse(readFileSync(CACHE_FILE, "utf8"));
    return c && c.token ? c : null;
  } catch {
    return null;
  }
}
function cacheValid(c) {
  const margin = 60_000; // 提前 1 分钟判过期，避免「刚好在临界点」翻车
  return !!c && Date.now() < c.expiresAt - margin;
}
function writeCache(c) {
  ensureDataDir();
  writeFileSync(CACHE_FILE, JSON.stringify(c));
}
function clearCache() {
  try {
    rmSync(CACHE_FILE);
  } catch {}
}

// —— 单飞锁：并发登录会撞坏 ERP 后端（.NET 集合 10001，需应用池回收）——
// 锁文件带时间戳：新鲜（<30s）= 有进程正在登录 → 轮询等它；过期 = 残留锁（进程崩了）→ 抢占。
// 最多等 10 秒，超时报 LOGIN_BUSY。
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
async function acquireLock() {
  ensureDataDir();
  const now = Date.now();
  for (let i = 0; i < 20; i++) {
    try {
      writeFileSync(LOCK_FILE, String(now), { flag: "wx" }); // wx：文件已存在则抛错
      return;
    } catch {
      try {
        if (now - Number(readFileSync(LOCK_FILE, "utf8")) > 30_000) {
          rmSync(LOCK_FILE); // 残留锁，清掉后下一轮抢占
          continue;
        }
      } catch {
        continue; // 读锁竞态：下一轮再看
      }
      await sleep(500);
    }
  }
  throw err("LOGIN_BUSY", "ERP 登录被占用超时（10 秒）——可能刚有并发调用。ERP 后端对并发登录敏感，请稍后重试");
}
function releaseLock() {
  try {
    rmSync(LOCK_FILE);
  } catch {}
}

// —— 真实登录（一次 HTTP 调用）——
async function doLogin(cfg) {
  if (!cfg.compno || !cfg.usr) {
    throw err("CONFIG_MISSING", "未配置 ERP 账号：请传入 --compno/--usr（或设置环境变量 ERP_COMPNO/ERP_USR）。学习环境演示账号见 SKILL.md");
  }
  let resp;
  try {
    resp = await fetch(`${cfg.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ COMPNO: cfg.compno, USR: cfg.usr, PWD: cfg.pwd, LANG_ID: cfg.langId, SYS_TYPE: cfg.sysType }),
      signal: AbortSignal.timeout(10_000), // 自检三问之「网络断了/超时」：10 秒兜底
    });
  } catch (e) {
    throw err("NETWORK", `连不上 ERP 服务器（${cfg.baseUrl}）：${e.message}。若服务刚启动可能正在预热（>10s 属正常），稍后重试即可`);
  }
  if (!resp.ok) {
    throw err("HTTP_" + resp.status, `ERP 登录失败：HTTP ${resp.status}`);
  }
  let data;
  try {
    data = await resp.json();
  } catch {
    throw err("BAD_RESPONSE", "ERP 返回了非 JSON 响应（可能是站点错误页）——检查站点地址与后端状态");
  }

  // ⚠️ 铁律：成功 = code === 0，不是 HTTP 200
  if (data.code === 0 && data.data?.TOKEN) {
    // EXPIRES_TIMESTAMP 是 Unix 秒（绝对时间，优先用）；EXPIRES_IN 是秒（相对时长，兜底）
    const expiresAt = data.data.EXPIRES_TIMESTAMP
      ? data.data.EXPIRES_TIMESTAMP * 1000
      : Date.now() + (data.data.EXPIRES_IN || 600) * 1000;
    return { token: data.data.TOKEN, expiresAt };
  }
  // 业务失败：错误码原样透传（10001 是通用错，message 仅供参考）
  throw err(data.code || "UNKNOWN", data.message || "未知错误");
}

// —— 带缓存与单飞的登录入口（login 与 report 共用）——
async function ensureLogin(args) {
  const cached = readCache();
  if (!args.force && cacheValid(cached)) {
    return { token: cached.token, expiresAt: cached.expiresAt, fresh: false };
  }
  await acquireLock();
  try {
    // 拿到锁后二次检查：等锁期间别人可能刚登完（双检锁）
    const again = readCache();
    if (!args.force && cacheValid(again)) {
      return { token: again.token, expiresAt: again.expiresAt, fresh: false };
    }
    const cfg = getConfig(args);
    const result = await doLogin(cfg);
    writeCache(result);
    return { ...result, fresh: true };
  } finally {
    releaseLock();
  }
}

// —— 通用 ERP 请求：自动带 Token、认证失效（20001/20004）清缓存重登重试一次 ——
async function erpPost(args, path, body) {
  const send = async () => {
    const { token } = await ensureLogin(args); // 缓存有效直取；无效自动真登（需要账号参数）
    let resp;
    try {
      resp = await fetch(`${getConfig(args).baseUrl}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12_000), // 报表比登录慢，给 12 秒
      });
    } catch (e) {
      throw err("NETWORK", `连不上 ERP 服务器（${getConfig(args).baseUrl}）：${e.message}。若服务刚启动可能正在预热（>10s 属正常），稍后重试即可`);
    }
    if (!resp.ok) {
      throw err("HTTP_" + resp.status, `ERP 请求失败：HTTP ${resp.status}`);
    }
    try {
      return await resp.json();
    } catch {
      throw err("BAD_RESPONSE", "ERP 返回了非 JSON 响应（可能是站点错误页）——检查站点地址与后端状态");
    }
  };

  let data = await send();
  // 认证失效（20001 凭证空 / 20004 凭证过期）→ 清缓存 → 重登 → 重试一次。
  // 只重试一次：两次都失败说明不是瞬时问题，再试就是死循环。
  if (data.code === 20001 || data.code === 20004) {
    clearCache();
    data = await send(); // ensureLogin 会重新登录
  }
  // ⚠️ 铁律：成功 = code === 0
  if (data.code !== 0) {
    throw err(data.code || "UNKNOWN", data.message || "未知错误");
  }
  return data;
}

// —— 受订报表 invso（getReport 十格标准布局）——
// 结构照抄 MCP 项目注册表（2026-10 实测出 9 行特斯拉）。十格逐格含义见 references/pitfalls.md。
function buildInvsoBody(args) {
  const displayFields = [
    "CUS_NO", "CUS_NAME", "OS_DD", "OS_NO", "PRD_NO", "PRD_NAME",
    "PRD_MARK", "A001", "WH_NAME", "UNIT", "UP", "QTY", "DIS_CNT",
    "AMT_DIS_CNT", "AMTN", "AMTN_NET", "TAX", "AMTN_WITHTAX",
    "QTY_PS", "QTY_PS_UNSH", "QTY_JH", "QTY_UNPS", "QTY_PRE",
    "QTY_PRE_UNSH", "QTY_RK", "QTY_RK_UNSH", "EST_DD", "REM_B",
  ];
  const year = String(new Date().getFullYear());
  const from = args.dateFrom;
  const to = args.dateTo;
  const searchInfo = [];
  searchInfo[0] = { offset: [0, 5000], temp: true }; // 一刀切全量（服务端无视 offset 的 start）
  searchInfo[1] = { showLadder: "F", displayFields, sumFields: [] };
  searchInfo[2] = { fixCondition: { REPORT_DD_FIELD: "OS_DD", SUB_CUS: "" } };
  // 日期格：给了日期 → range；不给 → this_year 默认今年（ERP 规矩：空筛选传 "" 不传 null）
  searchInfo[3] = {
    field: "OS_DD",
    operator: from || to ? "range" : "this_year",
    fieldType: "date",
    need: true,
    fieldDisabled: true,
    value: [from || `${year}-01-01`, to || `${year}-12-31`],
  };
  searchInfo[4] = { field: "CUS_NO", operator: "in", fieldDisabled: false, checkUnder: "T", value: args.cusno || "" };
  searchInfo[5] = { field: "PRD_NO", operator: "in", fieldDisabled: false, value: args.prdno || "" };
  searchInfo[6] = { field: "DEP", operator: "in", fieldDisabled: false, checkUnder: "T", value: "" }; // 不开放 → 恒空
  searchInfo[7] = { field: "WH", operator: "in", fieldDisabled: false, checkUnder: "T", value: "" }; // 不开放 → 恒空
  searchInfo[8] = { field: "CHK_STATUS", operator: "equal", fieldDisabled: false, value: "" }; // 不限制审核状态
  searchInfo[9] = { orderBy: { OS_DD: "asc" } };
  return { PGM: "REP_SOLIST", SEARCH_INFO: searchInfo, DISPLAY_FIELDS: displayFields.join(",") };
}

// —— 总分类账 accgl（SSE 长连接流式，三格 SEARCH_INFO + 占位符模板）——
// 照抄 MCP 项目注册表（2026-08 实测 12 行）。占位符思路：fixCondition 里写 @BOOK_NO/@PERIOD/
// @YEARS/@IPERIOD/@DATE_B/@DATE_E/@START_DD，按参数派生上下文统一替换——
// 「一个会计期间派生整族字段」的手艺只写一次，总账家族加报表时零改动复用。
const ACCGL_DISPLAY_FIELDS = [
  "ACC_NO", "ACC_NAME", "ACC_IPERIOD", "DC", "REM_TYPE",
  "FZHS_TITLE", "CUR_NAME", "AMTN_D", "AMTN_C", "AMTN_BAL",
];

function buildStreamCtx(args) {
  const now = new Date();
  // 格式对但数值荒谬（如 9999-99）也会被拦下：月份必须 01-12（自检三问之「超大」）
  const period = /^\d{4}-(0[1-9]|1[0-2])$/.test(args.dateCst || "")
    ? args.dateCst
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const years = parseInt(period.slice(0, 4), 10);
  const iperiod = parseInt(period.slice(5, 7), 10);
  const lastDay = new Date(years, iperiod, 0).getDate(); // 本月第 0 天 = 上月末 → 本月天数
  return {
    BOOK_NO: args.bookNo || "",
    PERIOD: period,
    YEARS: years,
    IPERIOD: iperiod,
    DATE_B: `${period}-01`,
    DATE_E: `${period}-${String(lastDay).padStart(2, "0")}`,
    START_DD: `${period}-01T00:00:00`,
  };
}

function buildAccglBody(args) {
  const ctx = buildStreamCtx(args);
  const ph = (v) => (typeof v === "string" && v.startsWith("@") ? ctx[v.slice(1)] ?? "" : v);
  const fixCondition = {};
  for (const [k, v] of Object.entries({
    BOOK_NO: "@BOOK_NO",
    CUR_ID: "",
    ACC_IPERIOD_B: "@PERIOD",
    ACC_IPERIOD_E: "@PERIOD",
    CHK_ACCN_TYPE: "2",
    ACC_NO: "",
    ACC_NO_B: "",
    ACC_NO_E: "",
    REL_CLS_B: 1,
    REL_CLS_E: 10,
    AMTN_BAL_TYPE: "1",
    CHK_POSTACC: "F",
    CHK_STOP: "F",
    CHK_NOVOH: "F",
    CHK_NOVOH_BAL_ZERO: "F",
    CHK_FZHS_DETAIL: "F",
    CHK_ARP_DAT: "F",
    CHK_DETAIL_ACCN: "F",
    CHK_NO_POA_VOH: "F",
    CHK_NO_SYTZ_VOH: "F",
    SHOW_BN_TYPE: "1",
    ORDERBY_TYPE: "1",
    START_DD: "@START_DD",
    YEARS: "@YEARS",
    IPERIOD: "@IPERIOD",
    TYPE_NO: "01",
    CHK_GROUP_CUR_LOC: "F",
    DATE_B: "@DATE_B",
    DATE_E: "@DATE_E",
  })) {
    fixCondition[k] = ph(v);
  }
  return {
    PGM: "ACCRPTGL", // 实测该端点不校验 PGM，但请求体必须带
    SEARCH_INFO: [
      { showBody: "T", showLadder: "F", displayFields: ACCGL_DISPLAY_FIELDS, sumFields: [] },
      { fixCondition },
      { orderBy: { SYS_DATE: "asc" } },
    ],
    DISPLAY_FIELDS: ACCGL_DISPLAY_FIELDS.join(","),
  };
}

// —— 账簿清单请求体（AccBook/GetList，依赖链第一步）——
function buildBookListBody() {
  return {
    DEP: "00000000",
    SEARCH_INFO: [
      {
        showBody: "F",
        showLadder: null,
        showSumField: null,
        displayFields: [
          "BOOK_NO", "NAME", "BOOK_XZ", "ACC_MD", "CUR_ID", "CUR_NAME", "TYPE_NO",
          "TYPE_NAME", "DEP", "DEP_NAME", "START_DD", "STOP_DD", "YEARS", "IPERIOD",
          "USR_NAME", "SYS_DATE", "MODIFY_MAN_NAME", "MODIFY_DD",
        ],
        sumFields: [],
      },
      { fixCondition: {} },
      { field: "BOOK_NO", operator: "in", fieldType: "string", fieldDisabled: false, value: "" },
      { field: "NAME", operator: "contain", fieldType: "string", fieldDisabled: false, value: "" },
    ],
    PAGE_INFO: { PAGE_SIZE: 200, CURRENT_PAGE: 1 },
  };
}

// 账簿兜底（依赖链的「不让 Claude 猜」落地）：BOOK_NO 是总账报表必填条件（空值 ERP 回 406）。
// 不传 bookNo 时自动查账簿清单取第一本。
async function resolveBookNo(args) {
  if (args.bookNo) return args.bookNo;
  const data = await erpPost(args, "api/AccBook/GetList", buildBookListBody());
  const books = data.data?.ACC_BOOK_BS || [];
  if (!books.length) {
    // 实测证据（2026-10-12）：清单空可能是后端清单接口异常，不代表没启用总账——
    // 错误文案给 Claude 可行动的下一步，而不是断言「未启用」
    throw err("NO_BOOK", "ERP 未返回账簿清单，无法自动确定账簿——请用 --book-no 直接指定账簿代号（学习环境 00000000 实测可查）");
  }
  return books[0].BOOK_NO;
}

// —— SSE 流式请求：与 erpPost 的区别是响应不是一次性 JSON，而是 data: {JSON} 事件流 ——
// 三步判别全部有实测依据：① HTTP 错 → HTTP 级错误（BOOK_NO 空 → 406）
// ② Content-Type 含 application/json → 失败不走流，按普通 JSON 业务码处理
// ③ text/event-stream → 进入流解析
async function erpPostStream(args, path, body) {
  const send = async () => {
    const { token } = await ensureLogin(args);
    let resp;
    try {
      resp = await fetch(`${getConfig(args).baseUrl}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        // 长连接比普通报表慢；且实测「无凭证 → HTTP 200 + 空 body 永久挂起」，超时兜底是唯一出路
        signal: AbortSignal.timeout(60_000),
      });
    } catch (e) {
      throw err("NETWORK", `连不上 ERP 服务器（${getConfig(args).baseUrl}）：${e.message}。若服务刚启动可能正在预热（>10s 属正常），稍后重试即可`);
    }
    if (!resp.ok) {
      throw err("HTTP_" + resp.status, `ERP 流式请求失败：HTTP ${resp.status}（406 = 账簿代号缺失）`);
    }
    const ctype = resp.headers.get("content-type") || "";
    if (ctype.includes("application/json")) {
      const j = await resp.json();
      if (j.code !== 0) throw err(j.code, j.message || "未知错误");
      return [];
    }
    return await parseSseStream(resp);
  };

  try {
    return await send();
  } catch (e) {
    if (e.code === 20001 || e.code === 20004) {
      clearCache();
      return await send(); // 认证失效重试一次，与 erpPost 同一套防活锁纪律
    }
    throw e;
  }
}

// SSE 解析：逐 chunk 读、行缓冲、事件切分。
// 行缓冲：chunk 边界可能切断一行，不完整行保留到下一个 chunk。
async function parseSseStream(resp) {
  const reader = resp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  const messages = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop(); // 最后一行可能不完整，留给下一个 chunk
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue; // 空行/其他前缀直接跳过
      let msg;
      try {
        msg = JSON.parse(line.slice(6));
      } catch {
        continue; // 非 JSON 行跳过
      }
      if (msg.ERR) {
        throw err("STREAM_ERR", `ERP 流内错误：${msg.ERR}`);
      }
      // 进度是服务端内部事：只进日志（stderr 不污染 JSON 协议），不进结果
      console.error(`[erp-client] 流进度 ${msg.PERCENT ?? "?"}%：${msg.TITLE || ""}`);
      messages.push(msg);
    }
  }
  return messages;
}

// —— 产品成本分析 mrppu（getList 八格：顶层 OTHERINFO/PAGE_INFO、无 orderBy、取数键 TRANS）——
// 照抄 MCP 项目注册表（2026-10 实测：学习库无成本数据 → 空结果属正常口径）。
function buildMrppuBody(args) {
  const displayFields = [
    "BIL_DD", "BIL_NO", "ITM", "PRD_NO", "PRD_NAME", "A001", "BAT_NO",
    "WH", "UNIT_NAME", "QTY", "QTY1", "CST", "CST_OUT", "CST_ALL",
    "SO_NO", "JH_NO", "MO_NO", "TW_NO", "TZ_NO", "DATE_CST", "CST_MAN1", "CST_MAK1",
  ];
  const searchInfo = [];
  searchInfo[0] = { showBody: "T", showLadder: "F", displayFields }; // [0] 无 offset：分页在顶层 PAGE_INFO
  searchInfo[1] = { fixCondition: { CHK_ALL: "F" } };
  // [2]~[5] 固定禁用格：形状取自 MCP/AsCoding 实测；DATE_CST 格的 value 从 dateCst 参数注入
  searchInfo[2] = { field: "DEP_GROUP", operator: "contain", fieldDisabled: true, value: "" };
  searchInfo[3] = { field: "BIL_ID", operator: "in", fieldType: "select", fieldDisabled: true, value: "" };
  searchInfo[4] = { field: "DATE_CST", operator: "equal", fieldType: "date", fieldDisabled: true, value: args.dateCst || "" };
  searchInfo[5] = { field: "CLOSE_ID", operator: "equal", fieldType: "string", fieldDisabled: true, value: "" };
  searchInfo[6] = { field: "DEP", operator: "in", fieldDisabled: false, checkUnder: "T", value: args.dep || "" };
  searchInfo[7] = { field: "PRD_NO", operator: "in", fieldDisabled: false, value: args.prdno || "" };
  return {
    PGM: "MRPPU",
    OTHERINFO: { DEP_GROUP: "00000000", INCLUDESON: "F" },
    SEARCH_INFO: searchInfo,
    PAGE_INFO: { PAGE_SIZE: -1, CURRENT_PAGE: 1 }, // -1 = 取全量（与 AsCoding 实测一致，无 5000 截断）
  };
}

// —— report <报表名> 统一入口 ——
async function cmdReport(args, report) {
  if (report === "invso") {
    const data = await erpPost(args, "api/invso/getReport", buildInvsoBody(args));
    ok(shapeRows("invso", data.data?.REPORT__TAB || []));
    return;
  }
  if (report === "accgl") {
    // 依赖链：不传 bookNo → 自动查账簿清单取第一本（清单空 → NO_BOOK 可读错误）
    args = { ...args, bookNo: await resolveBookNo(args) };
    const messages = await erpPostStream(args, "api/accGeneralLedger/GetReportStream", buildAccglBody(args));
    // 事件语义：数据在 DATA.REPORT__TAB 里（可能分多条消息），拼成最终行集合
    const rows = [];
    for (const msg of messages) {
      if (Array.isArray(msg.DATA?.REPORT__TAB)) rows.push(...msg.DATA.REPORT__TAB);
    }
    ok(shapeRows("accgl", rows));
    return;
  }
  if (report === "mrppu") {
    // 取数键是 TRANS 不是 REPORT__TAB（getList 模式）；空结果属正常口径，不报错
    const data = await erpPost(args, "api/mrppu/getList", buildMrppuBody(args));
    ok(shapeRows("mrppu", data.data?.TRANS || []));
    return;
  }
  if (report === "accbook") {
    // 账簿清单（依赖链第一步的独立报表化）：取数键 ACC_BOOK_BS
    const data = await erpPost(args, "api/AccBook/GetList", buildBookListBody());
    ok(shapeRows("accbook", data.data?.ACC_BOOK_BS || []));
    return;
  }
  throw err("USAGE", `暂不支持的报表：${report}（当前支持 invso / accgl / mrppu / accbook）`);
}

// 统一结果形状：列名以 ERP 实际返回为准（Object.keys 自适应，不自造列名）
function shapeRows(report, rows) {
  return {
    action: "report",
    report,
    count: rows.length,
    truncated: rows.length >= 5000,
    columns: rows.length ? Object.keys(rows[0]) : [],
    rows,
  };
}

// —— status：只读缓存状态，不联网 ——
function cmdStatus() {
  const cached = readCache();
  if (cacheValid(cached)) ok({ action: "status", cached: true, valid: true, expiresAt: cached.expiresAt });
  else if (cached) ok({ action: "status", cached: true, valid: false, expiresAt: cached.expiresAt });
  else ok({ action: "status", cached: false, valid: false });
}

// —— login ——
async function cmdLogin(args) {
  const r = await ensureLogin(args);
  ok({ action: "login", fresh: r.fresh, expiresAt: r.expiresAt, token: r.token });
}

// —— 入口 ——
const { cmd, sub, args } = parseArgs(process.argv.slice(2));
try {
  if (cmd === "login") await cmdLogin(args);
  else if (cmd === "status") cmdStatus();
  else if (cmd === "report") await cmdReport(args, sub);
  else {
    throw err(
      "USAGE",
      "用法：node erp-client.mjs login|status [--compno X] [--usr Y] [--pwd Z] [--force]\n" +
        "      node erp-client.mjs report invso [--date-from YYYY-MM-DD] [--date-to YYYY-MM-DD] [--cusno X] [--prdno X]\n" +
        "      node erp-client.mjs report accgl [--book-no X] [--date-cst YYYY-MM]\n" +
        "      node erp-client.mjs report mrppu [--date-cst YYYY-MM] [--dep X] [--prdno X]\n" +
        "      node erp-client.mjs report accbook"
    );
  }
} catch (e) {
  console.log(JSON.stringify({ ok: false, code: e.code || "UNKNOWN", message: e.message }));
  process.exitCode = 1;
}
