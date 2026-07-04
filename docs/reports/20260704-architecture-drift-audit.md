# RealHome 架构漂移审计 + 渲染路径统一「升级申请」

> created 20260704
> as-of e8ccc1c / 2026-07-04
> 触发：PC 天空盒全黑 debug 时暴露「flat=两 pass / VR=单 pass」的分叉。用户判定这是 AI drift（"我一直以为 VR 是两 pass"），要求：① flat/VR 走同一代码路径，VR 也两 pass，做不到就 escalate；② 系统核查同一段逻辑写了 5-6 份的地方。
> 范围：**sync/store 内部不在本次范围**（冻结，等 JRB drift 收尾后换 canonical 新 store 模块）。本报告只管 app 侧胶水 + 渲染 + 物理，外加「为迎接新 store 模块该先收敛什么」。

---

## 0. TL;DR

1. **「VR 也两 pass、和 flat 完全一样」= 平台硬约束下做不到，正式 escalate**（见 §1，附 three.js 源码引用）。不是代码风格问题，是 WebXR + three.js 的死规则。
2. **诚实纠偏：让你困惑的那个 render fork，反而不是最脏的 drift。** 物理/输入/插值其实已经收在 `player.js` 一处，loop 里的 `isXR` 分支绝大多数是**薄 dispatch**（该分就得分），不是复制逻辑。你被误导是**我描述失职**（把一个合法的平台分叉说得像对称的两条路），不是这段代码写了两份。（见 §2）
3. **真正的 drift 在别处**（见 §3）：rig 投影 cos/sin 数学在 `player.js` 抄了 3 份；camera near/far 归属被 `scene.js` 和 `app.js` 两家瓜分；WebXR eye-layer 铁律在 3 个文件里各写一遍注释；tracking-origin 重锚 4 处。
4. **为迎接新 store 模块**（§4）：app 侧最大的病是**没有 `worldSession` 属主**——`current` 世界身份 + `loading` 闸 + 「这是不是当前世界」判据被 4 个 load 路径各手抄一遍。这块必须先收敛成一个 seam，新 store 才能一点接入、而不是散落重写。

---

## 1. 升级申请：flat/VR 渲染无法统一成「都两 pass」

### 结论：做不到。这是平台硬约束，不是我们偷懒。

flat 两 pass 的**唯一目的**：大 parallax 天空盒 dome 半径远超近景 `FAR=1000m`，要在**更大的远 frustum（`SKY_FAR=100km`）**里单独画一遍它，再 `clearDepth` 画近景——这样既不裁掉天空盒、又不牺牲近景 depth 精度。它靠 `FAR_LAYER` 把天空盒**隔离到自己的 pass**。

VR 复制不了这套，两条独立死规则：

**① three.js 把 `FAR_LAYER` 从 XR 眼睛相机里强行抹掉。**
`src/vendor/three/build/three.module.js:13571-13573`：
```js
cameraXR.layers.mask = camera.layers.mask | 0b110;   // 强行加 左眼(bit1)+右眼(bit2)
cameraL.layers.mask = cameraXR.layers.mask & 0b011;  // 每只眼只保留 bit0 + bit1
cameraR.layers.mask = cameraXR.layers.mask & 0b101;  // 每只眼只保留 bit0 + bit2
```
`& 0b011` / `& 0b101` 把 **bit3（`FAR_LAYER`）永久裁掉**。在 XR 里 `camera.layers.set(FAR_LAYER)` → 每只眼 mask 变成 `0b010`/`0b100`，**layer 0 也丢了，两只眼什么都画不出**。所以 flat 那套「用 FAR_LAYER 隔离远层」的手法，在 XR 里**物理上无效**。这也是为什么天空盒必须同时挂 layer 0（`worldConvention.js:137` 用 `.enable` 不用 `.set`）。

**② WebXR 的投影矩阵归 runtime/session 所有，改不动 near/far。**
`three.module.js:13553-13563`：near/far 只能通过 `session.updateRenderState({depthNear, depthFar})` 提交，且**下一帧才生效**。你无法在一帧内为「远 pass」临时拉宽 frustum。flat 两 pass 的**整个收益（更大的远 frustum）在 XR 里根本造不出来**。

**推论**：就算硬把 VR 塞成两 pass（改用「按可见性分区」而非按 layer），在 XR 里它也只是把同一个 session frustum 画两遍——天空盒**照样被 session far 裁**、结果和单 pass 一模一样，只是更慢 + 多一次全场景可见性 toggle。这不是统一，是 cargo cult。

### 那「统一」到底能交付什么？

能交付**一个属主**，不能交付**一套 pass 结构**。真正该做的（见 §5 候选 A）：把 `renderLayered` + camera near/far 所有权 + 天空盒可见性契约，收进**一个 `FrameCompositor` 深模块**，里面**只有一处**带文档的合法分叉（flat 换 frustum / XR 用 session 投影），eye-layer 铁律**只写一遍**。分叉还在（它合法），但「一帧怎么合成」从此**一个 SSoT**，不再是散在 68 行 loop 里 + 3 个文件注释里的隐性知识。

> **给用户拍板**：接受「分叉不可消除、但收进一个属主 + 铁律只写一遍」这个定义下的"统一"吗？还是你要我把这条平台约束固化成一条 ADR（免得下次架构审计又来提"为什么 VR 不两 pass"）？

---

## 2. 诚实纠偏：render fork 不是最脏的 drift

audit 结论（render agent 原话精炼）：**flat 和 VR 已经被漏斗进同一个物理模块（`player.js`）、同一套 input 形状、同一条插值路径**。loop 里的 `isXR` 分支几乎全是薄 dispatch：

| 行 | 分支 | 是不是 drift |
|---|---|---|
| `app.js:1620` first-XR-frame reset | 委托共享 `player.reset()` | 否 |
| `app.js:1642` `if(!isXR) flat.applyLook` | 设计性分叉（HMD 自己拥有相机） | 否 |
| `app.js:1647` `inputs = isXR ? xr : flat` | 两个 producer 同一 input 契约 | 契约隐性（见 §3-F） |
| `app.js:1666` `stepVR / stepFlat` | 二者只差 crouch + roomscale，其余共享 helper | 否 |
| `app.js:1681→1703` `renderLayered` | 合法平台分叉 | 见 §1 / §3-②③ |

**物理 fork 是正面样板**：`stepFlat`/`stepVR` 只在该分的地方分，其余全 route 到共享 helper。render 该学它。

所以：**你的困惑 100% 成立，但根因是我把一个合法分叉汇报得像"两条平行 SSoT"**。代码本身在这一处没写两份——它写在一个函数 `renderLayered` 里。真要挑毛病，是这个函数**太瘦**（把 camera 所有权、可见性契约、平台知识都漏给了外部），而不是它被复制了。

---

## 3. 真正的 drift 清单（两 audit 合并，按"静默分歧风险"排序）

### D1 ★最高：rig 投影 cos/sin 数学在 `player.js` 抄 3 份
「把 HMD 偏移从 tracking 空间按 `cos/sin(player_rot)` 旋进世界 XZ」这个公式：
- `player.js:59-62`（`captureRigState`）
- `player.js:258-263`（`stepVR` roomscale）
- `player.js:303-307`（`snap`，与上一份逐字相同）

改一次手性/符号约定，三处得同步改，否则 roomscale / snap-turn / rig-write 静默打架。

### ②：camera `near/far/projection` 被两家瓜分
- `scene.js:68` 构造 `PerspectiveCamera(..., NEAR, FAR)`；`scene.js:88` `resize()` 假设 near/far 是当前值。
- `app.js:1713-1715` flat pass1 **覆写** SKY_NEAR/SKY_FAR；`app.js:1723-1725` pass2 **还原** NEAR/FAR。
- **XR 分支从不设 near/far**，靠构造值 + flat pass 帮它还原。

"正确的 near/far"同时活在构造函数和 pass2 还原里，只因两边都 import 同一 config 常量才没炸。谁改了 `scene.js` 的构造 near，flat 无视你；谁改了 `renderLayered`，XR 无视你。**camera near/far 没有单一属主。**

### ③：WebXR eye-layer 铁律在 3 个文件各写一遍注释
同一条不变量（layer 1/2=左右眼，FAR_LAYER 必须 ≥3 且远层要同时挂 layer 0）被叙述性注释写了三遍，必须锁步改：
- `config.js:134-138`
- `worldConvention.js:127-135`
- `app.js:1685-1695`

文档 drift（非代码 drift），但改 layer 编号时高危。

### D2/D3：tracking-origin 重锚 idiom 4 处 + tracking-jump 双属主
- `tracking_origin.set(...)` 重锚：`player.js:271, 314-315, 336, 363` 四处。
- 「Quest Reset View / 非物理 HMD 跳变」被**两条独立路径**各防一次：事件路径 `app.js:1567 → player.js:361 handleTrackingReset`（加 yaw 重锚）vs 每步幅度闸 `player.js:270`（不加 yaw 重锚）。两个属主管同一件"tracking 不连续怎么办"。

### F：input 形状契约隐性散在 3 文件
无单一类型定义，共享字段靠约定：`controls.js:63` 返回 `{walkX,walkZ,jumpHeld,dash}`；`xrControls.js:105` 返回 `{...snapStickX,reload,respawn}`；`player.js` 在 `stepFlat/stepVR` 里读。改一个 producer 的 `walkZ`，另一条静默断。

### ——以下为 app.js 胶水层 drift（与 §4 store-prep 强相关）——

### G1 ★：「这是不是当前世界」判据手抄 4 份
`(id && id===current.id) || (remoteId && source===current.source && remoteId===current.remoteId)` 这个形状：
`app.js:330-332`、`358-360`、`1013-1015`、`1360-1362`。改身份键（比如加 etag）漏一处就静默认错当前世界。

### G2：`current.*` 身份四元组写入 3 处、`loadedEtag` null 处理不一致
`loadFile:511-514` / `switchToWorld:681-684` / `streamOpenWorld:720-723` 各写一遍 id/source/remoteId/loadedEtag；`loadedEtag` 取值分别是 `record.remoteEtag || null` / `record.remoteEtag` / `result.etag || null`——**真实的 null 处理分歧**。无单一 mutator。

### G3：busy 闸 `if(loading)return; loading=true …finally loading=false` 抄 4 份
`loadFile:492/525`、`switchToWorld:671/694`、`streamOpenWorld:702/733`，外加 `handleEnter:321`、`liveReload:376` 的半闸。某条路径忘了 `finally` 就永久卡死。

### G4：provider 查找两种写法并存（正在 drift）
`getProvider(source)`（会 throw）用于 `pushRecord:553`、`handleDeleteRemote:465`；但 `providers.find(p=>p.source===source)`（返回 undefined）手写于 `streamOpenWorld:708`、`cacheWorld:896`、`refreshThumbnailForRec:955`、`appendWorldCard:1383/1457`、`checkRemoteUpdates:980`。同一查找两套 idiom，错误行为可分歧。

### G5：其余复制点（低危，登记备查）
load-error triad（console.error+setStatus+logError）3 份（`519/688/727`）；signed-in 门 `import("./onedriveAuth.js")+getAccount()` 5 份（`535/559/646/1057/1163`）；进度标签三元 3 份；`"load failed"`/`"loading…"`/`"Not signed in"` 字面量各写 2 遍；`classList.add/remove("hidden")` 30+ 处无 `show/hide` helper；`enterImmersive` 已抽出但 `app.js:155/160` 两个 stragglers 仍内联；`isConfigured`（`onedriveAuth.js:55`）是死别名。

---

## 4. 为迎接新 store 模块，app 侧要先收敛什么

新 canonical store 模块要能**一点接入**，前提是 app 侧有**一个干净的 store-消费 seam**。现状最大障碍就是 §3 的 **G1–G4**：

> **没有 `worldSession` 属主。** `current`（id/source/remoteId/loadedEtag）+ `loading` 闸 + 身份判据，被 4 个 load 路径（loadFile / switchToWorld / streamOpenWorld / liveReload）各自手搓。新 store 一来，这 4 处每处都要重接。

收敛目标：一个 `worldSession` 深模块，独占 `current` + `loading`，对外暴露 `isCurrent(rec)`、`beginLoad()/endLoad()`、`adopt(record)`（唯一写 `current.*` 的地方）。这样：
- 新 store 的 record 形状变化 → 只碰 `adopt()` 一处。
- 身份判据变化（G1）→ 只碰 `isCurrent()` 一处。
- busy 语义（G3）→ 只碰 `beginLoad/endLoad`。

**这是 store-prep 的头号杠杆**，也顺带清掉 G1/G2/G3 三个 drift。**注意**：`worldStore.js` / `onedriveGraph.js` 内部**本次不碰**（冻结待换）；我们只收 app 侧对它们的**调用面**。

---

## 5. 深化候选（deepening candidates）+ 推荐

> 按 skill 规矩，这里只列候选、不定接口。选一个我们再进 grilling 敲设计。

### 候选 A — `FrameCompositor`：收编渲染合成 + camera 所有权 + eye-layer 铁律
**文件**：`app.js:1614-1729`、`scene.js:68/88`、`config.js:134-139`、`worldConvention.js:127-137`
**问题**：`renderLayered` 太瘦——camera near/far 双属主（§3-②）、天空盒可见性契约外泄、平台铁律 3 处注释（§3-③）。合法的 flat/VR 分叉散成隐性知识。
**方案**：一个深模块独占「一帧怎么合成」：拥有 camera near/far、天空盒 pass、`isXR` 那**一处**合法分叉、eye-layer 铁律（**只写一遍**）。
**收益**：locality——渲染合成知识一处可改可测；直接回应用户的"一个 SSoT"诉求（在平台允许的最大范围内）。
**强度**：`Strong`（直接对应原始诉求 + escalation 落点）

### 候选 B — `worldSession`：app 侧 store-消费 seam（store-prep 头号杠杆）
**文件**：`app.js` 的 `current`/`loading` + loadFile/switchToWorld/streamOpenWorld/liveReload/appendWorldCard/checkRemoteUpdates
**问题**：§3 G1-G4——身份判据 4 抄、`current.*` 写 3 处且 null 处理分歧、busy 闸 4 抄、provider 查找 2 套。
**方案**：`worldSession` 独占 `current`+`loading`，暴露 `isCurrent`/`beginLoad`/`endLoad`/`adopt`。
**收益**：新 store 一点接入；一次清掉 4 个 drift；load 路径变薄。
**强度**：`Strong`（迎接新 store 的必要前置）

### 候选 C — `rigProjection`：抽掉 player.js 3 抄的 cos/sin 数学
**文件**：`player.js:59-62 / 258-263 / 303-307`（+ tracking-origin 重锚 4 处 D2）
**问题**：§3 D1/D2——最高静默分歧风险的纯数学复制。
**方案**：一个 `projectRigOffset(origin, rot)` + 一个 `reanchorTrackingOrigin()`，三处调用。
**收益**：手性/符号约定改一处即全对；纯函数、直接可测。
**强度**：`Strong`（最便宜、最高 ROI、零平台风险）

### 候选 D — 拆 `app.js` god 文件（1819 行 / 8 域）
**文件**：`app.js` 全域（GL 韧性 / input-session / menu DOM / sync 编排 / 存储配额 / 渲染 / 物理 / SW）
**问题**：8 个责任域一个文件；`appendWorldCard`(~163)、`pushRecord`(~84)、`bootstrap`(~76) 等巨函数混关注点。
**方案**：分域抽模块（承候选 A/B 之后自然剥离）。
**强度**：`Worth exploring`（大工程；建议在 A/B/C 落地后再动，别一次掀太大）

---

### 推荐先做：**C → A → B**

- **C 先做**：最便宜、纯函数、零 VR 回归风险，先把最高静默分歧风险的数学 drift 清了，立竿见影且不碰渲染热路径。
- **A 次之**：直接回应你的原始诉求（渲染"一个 SSoT"）+ 承接 §1 的 escalation 落点。⚠️ 会动到**现在正常的 VR 渲染路径**，XR 两 pass/clearDepth 我无法自测，**必须你上头显复验**。
- **B 压轴（store-prep）**：等 JRB drift 收尾、新 store 模块形状明朗前做完，让新 store 一点接入。
- **D 缓**：A/B 落地后 god 文件已自然瘦身，再评估。

> **两个待你拍板**：
> 1. §1 那条平台约束，要不要固化成 ADR？
> 2. 先从哪个候选进 grilling？（我建议 C）
>
> **另外**（与本报告解耦的独立 bug）：你那个 PC 全黑的世界，天空盒 mesh/材质在 Blender 叫什么名？不含 `skybox` 就是它没进 FAR_LAYER 被 FAR=1000 裁掉——这个和架构统一是两码事，可以先修。
