# dev / prod 分家（RealHome）

> as-of 2026-06-25。家族 mature paradigm（branch + GH Actions + esbuild content-hash
> bundle）。**为什么这么设计**见 canonical：`../../20260524 WebPaint/docs/20260625-dev-prod-split.md`
> —— 本文只记 RealHome 的差异 + 一次性 cutover 步骤。

## 一句话

`main` = 工作区，push → `/dev/`；`prod` 分支 = 上次 promote 时 main 的 ff snapshot，push → `/`。
一个 GH Actions workflow 把两分支组合成一个站。

- `https://fangzhangmnm.github.io/realhome/`      ← prod（真用户）
- `https://fangzhangmnm.github.io/realhome/dev/`  ← dev（你 + AI 测）

为什么 RealHome 值得分家：OneDrive 同步的世界数据在 PWA 里，一个 sync bug 能让人丢东西 → 满足
canonical 的「有用户数据」门槛。

## RealHome 差异 vs WebPaint

| 点 | RealHome |
|---|---|
| 入口 | `index.html` → `./dist/realhome-<hash>.mjs`（esbuild bundle） |
| vendor | three / three-mesh-bvh / @azure/msal-browser **不进 bundle**——`--external` + index.html 的 `<script type="importmap">` 运行时解析（= WebPaint「vendor 不打包」原则的 ES-module 形态） |
| build | `scripts/build.sh`（抄 WebPaint，改 ENTRY/名/externals）。esbuild binary `tools/esbuild/`（gitignored，自动 curl） |
| TS | **今天还没迁**。ENTRY=`./src/app.js`。build.sh 里 tsc 门是占位（装 tsconfig+tsc 即生效）→ 将来逐个 .js→.ts 平滑 |
| SW | content-hash 自动失效（cache name = `realhome-<bundleHash>`，install 时从 index.html 抠）。**不再手 bump CACHE_VERSION** |
| 世界 | `.glb/.gltf` 在 SW 里 passthrough（store 用 If-None-Match 自己管新鲜度，SW 不许碰）——已保留 |

## Daily（push dev）

```bash
# 编辑 src/... 或 index.html
bash scripts/build.sh              # src/ → dist/realhome-<hash>.mjs，sed 改 index.html 引新 hash
git add . && git commit -m "..." && git push origin main
# → GH Actions ~30s → /dev/。iPad/Quest 开 .../realhome/dev/ 刷新即新版（/dev/ 无 SW，改完即见）
```

## Promote 到 prod（**push prod 必须问人——家族铁律**）

```bash
git checkout prod
git merge --ff-only main      # ff-only：拒非线性，保 prod 历史线性
git push origin prod
git checkout main
```
→ Actions → `/` 部署。`cancel-in-progress: true` 防 deploy race（别改回 false）。

## 一次性 cutover（顺序要紧！）

⚠ **现在 `origin/main` 就是 prod**（Pages「deploy from branch: main」）。在切到 GitHub Actions 之前
push 新 main = 直接把新代码（含 debug 物理 toggle / dash=10）推上线。所以顺序必须是：

1. **seed prod 分支 = 当前线上**（= `origin/main` 当前 sha，本批改动之前的那个）：
   ```bash
   git branch prod <当前线上 sha>      # 本批 = f3548a8（emoji+改键那个，已是线上）
   git push origin prod
   ```
   此刻 `/` 不变（Pages 还在 branch:main 模式，main 也还没 push 新码）。
2. **人手**：GitHub → Settings → Pages → Source 改 **"GitHub Actions"**。
   （线上站暂留上一次 branch 部署的内容 = f3548a8，不会掉。）
3. **push main**（新码：bundle + debug toggle）：
   ```bash
   git push origin main
   ```
   → Actions 组合：prod(f3548a8 raw app) → `/`（不变！），main(bundled 新码) → `/dev/`。
4. **人手**：Azure → 给 OneDrive app 加重定向 URI `https://fangzhangmnm.github.io/realhome/dev/`
   （`config.js onedriveRedirectUri()` = origin+pathname，所以 /dev/ 要单独登记，否则 dev 登录 OneDrive 失败）。

cutover 后：`/` = prod 分支，`/dev/` = main。以后 daily push main 只动 /dev/。

## AI 工作规则

唯一铁律：**push prod 前问人**。push main（→/dev/）是常态、不用问。

## 必踩坑（同 canonical）

1. prod 分支不存在就 push main → Actions checkout prod fail。先建 prod。
2. 别手改 index.html 里 `./dist/realhome-<hash>.mjs` 那行——build.sh 用 sed 认它。
3. `concurrency.cancel-in-progress` 必须 `true`，别改回 false（deploy race）。
4. esbuild binary 不入 git（10MB+跨 OS）。build.sh 没找到自动 curl；或从
   `../../20260524 WebPaint/tools/esbuild/esbuild` 拷一份进 `tools/esbuild/`。
