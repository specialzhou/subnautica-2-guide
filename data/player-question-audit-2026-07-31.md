# 玩家问题候选审核报告 — 2026-07-31

## 概要

- 采集状态：07-29/07-30 两天采集 Action 因校验白名单缺陷连续失败（未落库）。今日修复后手动补跑成功（run 30598483041，采集于 2026-07-31T02:15Z），候选总数 30 → 45。
- 本轮待审：15 条 `system-review`（全部来自 r/Subnautica_2）。
- 审核结论：**15 条全部 dismissed，0 条 ready-to-reply**。终态：42 dismissed + 3 ready-to-reply + 0 system-review。
- 未新建流量机会 Issue（无新增 ready-to-reply）。

## 采集流水线修复（随本轮完成）

| PR | 问题 | 修复 |
| --- | --- | --- |
| #54（已合并） | 07-25 P2 给采集加了 r/Subnautica 第二订阅源，但 `validate-data.mjs` 仍只允许 r/Subnautica_2 URL，validate 报 `Incomplete candidate` exit 1，07-29/30 新候选全部丢失 | 白名单同步为两个已配置 subreddit |
| #55（已合并） | r/Subnautica RSS 返回小写 `r/subnautica` URL，#54 的大小写敏感前缀仍不匹配（补跑 run 30598197472 复现） | 改为大小写不敏感正则匹配 |

## 逐条判定（15 条，全部 dismissed）

| Reddit ID | 标题（摘要） | 判定理由 |
| --- | --- | --- |
| 1vaig57 | kind of stuck in game play | 社区已一致解答（当前 EA 主线到东侧观测站为止）；「内容终点」属社区共识，无官方声明可引用 |
| 1v8wg3p | What is everyone doing while waiting? | 闲聊讨论帖，非可解答的游戏问题 |
| 1vb286o | Great base location | Base Tour 展示帖，非求助问题 |
| 1v9s7fv | Why do I have such a bad performance? | 硬件个案（高赞诊断 CPU 过热降频，楼主已接受）；无官方证据可引用 |
| 1vaa6ai | Where to find saves? | Mac + Crossover 平台组合特殊，无官方文档佐证路径；社区已给可行替代方案 |
| 1vaiaeg | I can't destroy a survival or scanner? | 社区已给多个可行方案（桌面硬点/便携柜拆除/垃圾桶），已解决 |
| 1vabpq8 | Stuck at final angle tree | 高赞指向遗漏隐藏幼树/感染点，多人证实；无官方判定条件可佐证，社区已解答 |
| 1vak8a4 | Ray Chassis: moonpool too narrow | 与 ready-to-reply 候选 1v7ylul（Issue #51）主题重复，且 36 条评论已充分解答（按展开尺寸扩建 Moonpool、移开已停靠 Tadpole） |
| 1v9x800 | 发色变化是设计还是 bug | 无官方证据，社区仅猜测（生物模组 vs UE 渲染 bug），无安全答案 |
| 1v94r7g | 基地求评分 | Base Tour 帖，非求助问题 |
| 1v90gjz | Best Way Through The Collector Biome? | 62 条评论已给大量经验方案；纯玩家经验、无官方证据 |
| 1v9j9v4 | Corrupted NoA dialog | 社区称剧情设计但无官方来源证实，不能把社区说法写成事实；楼主已获回应 |
| 1v9ou38 | What is this（金属农场建筑） | Lore 未官方披露，评论均为猜测（含不可验证的拆包说法） |
| 1v9fme2 | 1.1 穿出地图边界方法 | 漏洞利用类，不适合站点解答，无安全答案 |
| 1v9jyxs | 地图外探索分享 | 非求助问题，且属漏洞利用话题 |

## 证据与纪律说明

- 全部候选经已登录 Reddit 会话只读读取原帖正文与评论（`comments/<id>.json`），未发帖、未评论、未投票、未私信。
- 判定不依赖社区猜测作为事实：凡「社区说法无官方来源」者一律 dismissed（1v9x800、1v9j9v4、1v9ou38 等）。
- 既有 3 条 ready-to-reply（1v7ylul 等）状态未变，其证据（Steam 官方公告 EA 1.1、wiki 永久修订）此前已核验。
