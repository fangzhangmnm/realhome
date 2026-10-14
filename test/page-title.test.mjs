// 网页标题 = 只是「RealHome」：index.html 写死，运行时谁都不改 document.title。
// 世界名进标题 = 浏览器历史按世界名记那个地址（user 2026-10-14「就放一个自己的名字，不解释，google也这么干的」，全家族同一标准）。
// created 2026-10-14 by Claude Opus 5.5
import { describe, it, eq, assert } from "./runner.mjs";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
function* walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== "vendor") yield* walk(p); } else if (/\.(js|mjs|ts)$/.test(f)) yield p; } }

describe("网页标题", () => {
  it("index.html 的 <title> 只是 RealHome", () => {
    eq(readFileSync(join(ROOT, "index.html"), "utf8").match(/<title>([^<]*)<\/title>/)?.[1], "RealHome");
  });
  it("src 里没有人改 document.title", () => {
    const hits = [...walk(join(ROOT, "src"))].filter((p) => /document\.title\s*=/.test(readFileSync(p, "utf8")));
    assert(hits.length === 0, `这些文件在改 document.title：${hits}`);
  });
});
