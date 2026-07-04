// 零依赖 test runner（抄 WebPaint test/runner.mjs，家族一致）。
// ESM 模块单例 → test 文件与 run.mjs 共享同一 _tests 数组。
let _suite = "";
const _tests = [];

export function describe(name, fn) { _suite = name; fn(); _suite = ""; }
export function it(name, fn) { _tests.push({ name: `${_suite} › ${name}`, fn }); }
export function assert(cond, msg) { if (!cond) throw new Error(msg || "断言失败"); }
export function eq(actual, expected, msg) {
  if (actual !== expected) throw new Error(`${msg || "不相等"}: 期望 ${JSON.stringify(expected)}，实得 ${JSON.stringify(actual)}`);
}

export async function run() {
  let pass = 0, fail = 0;
  for (const t of _tests) {
    try { await t.fn(); console.log("  \x1b[32m✓\x1b[0m", t.name); pass++; }
    catch (e) { console.log("  \x1b[31m✗\x1b[0m", t.name, "\n      ", e.message); fail++; }
  }
  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  if (fail) process.exit(1);
}
