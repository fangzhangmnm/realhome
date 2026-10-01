// 「清缓存重启」只许动自己的：结构守卫（不跑浏览器）。created 2026-10-01 by Claude Fable 5.1
// 家族的 app 几乎都挂在同一个域名下，缓存和 service worker 是按域名算的——src 里不许「注销全部 service worker」，
// 删缓存必须先按自己的前缀筛（否则会把兄弟 app 的离线壳、家族共享的模型缓存 pwa-models 一起清掉）。
// 依据：家族 CLAUDE.md「共享模型库 · 命名与共享规矩」第 2 条。
import { describe, it, eq, assert } from "./runner.mjs";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));
function* walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== "vendor") yield* walk(p); } else if (/\.(js|mjs|ts)$/.test(f)) yield p; } }

describe("force reset scope", () => {
  it("src 里没有 getRegistrations()；caches.delete 都带自己前缀的筛子", () => {
    const hits = [];
    for (const p of walk(SRC)) readFileSync(p, "utf8").split("\n").forEach((l, i) => {
      const code = l.replace(/\/\/.*$/, "");
      if (/getRegistrations\s*\(/.test(code)) hits.push(`${p.slice(SRC.length)}:${i + 1}: getRegistrations()`);
      if (/caches\s*\.\s*delete\s*\(/.test(code) && !/startsWith\(SHELL_CACHE_PREFIX\)/.test(code)) hits.push(`${p.slice(SRC.length)}:${i + 1}: caches.delete without the own-prefix filter`);
    });
    eq(hits.join("\n"), "");
  });
  it("前缀和 service-worker.js 的壳缓存名对得上", () => {
    const sw = readFileSync(fileURLToPath(new URL("../service-worker.js", import.meta.url)), "utf8");
    const page = readFileSync(join(SRC, "swUpdates.js"), "utf8");
    const prefix = page.match(/SHELL_CACHE_PREFIX = "([^"]+)"/)?.[1];
    assert(prefix && sw.includes(`"${prefix}boot"`) && sw.includes("`" + prefix + "${"), `prefix ${prefix} not found in service-worker.js cache names`);
  });
});
