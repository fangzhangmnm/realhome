# RealHome（家族总规则见上级 CLAUDE.md）

WebXR PWA：替代 Quest 被砍掉的自定义家——丢一个 glb/glTF（1m=1m，原点出生）就能走进去；Blender→OneDrive→Quest 美术闭环；桌面平面模式兼容。

- 数据：glb 世界 = 内置官方世界 + 本地上传 + OneDrive AppFolder 递归扫描；IDB 缓存 800M–1G；缩略图 sidecar（404-proof）。
- 云姿态：只读镜像，**LWW 可接受**（"冲突直接上传时间覆盖就行，和写作不同"——冲突策略是 per-domain 的）。本项目是家族同步约束优先级排序的发源地（零账号第一公民 → 无 consent 不删 → 断网可用 cache）。
- **物理方案以 repo 内 docs 为准**（3 层 Unity 式 rig、fixed-update、高 dt 鲁棒算法）——聊天里的闲聊版本会误导，用户明确警告过。
- 悬而未决：第三方公共世界源（github repo 作 source）；多云 provider 接口（留接缝不实现）；研发成果将来复用做 VR metaverse games。
