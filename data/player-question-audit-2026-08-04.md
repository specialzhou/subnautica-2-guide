# 玩家问题候选审核报告 — 2026-08-04

## 概要

- 采集状态：当日（2026-08-04）「收集玩家问题候选」GitHub Action 尚未运行（该 cron 约北京时间 16:00 触发；本自动化 10:10 北京时间先于采集）。本轮审计对象为最近一次成功采集：2026-08-03T08:42:31Z（run 30798409098）。
- 本轮待审：4 条 `system-review`（均来自 r/Subnautica_2，`addedThisRun=4`，属 08-03 采集新增，main 分支此前无此 4 条）。
- 审核结论：**1 条 ready-to-reply，3 条 dismissed，0 条 system-review**。终态：76 dismissed + 4 ready-to-reply + 0 system-review（总数 80）。
- 新增 ready-to-reply 1 条（1vdl6sx），已写入当前版本官方证据与已核验英文回复；流量机会 Issue 由独立「整理 Reddit 流量机会」工作流后续生成，站长复制英文回复即可，无需判断游戏事实。

## 逐条判定（4 条）

| Reddit ID | 标题（摘要） | 判定 | 理由 |
| --- | --- | --- | --- |
| 1vdl6sx | Does your collector comes out of his zone every now and then? | ready-to-reply（evidence-verified） | 原帖未解决（楼主在 Karakorum Metal Farm／毒区边界被 Collector 抓死，困惑其为何离开区域）。SN2 Wiki「Collector Leviathan」页（永久修订 oldid=19477）明确游戏内有两只 Collector：一只巡逻 Karakorum Metal Farms 上空，另一只巡逻 Sparse Plains 海沟。故绿色水池／金属农场上空本就是第二只的设计内巡逻区，非 bug；Attitude: Aggressive，不可击杀只能规避。社区称“会学习／陪你玩”属臆测，Wiki 未记载，不写为事实。 |
| 1vdkwlt | I just finished the available part of the story | dismissed（not-a-question） | 分享／观点帖，非求助问题。楼主惊讶剧情中途停住；评论区一致解释 SN2 为 EA，剧情本就未完（首作 EA 时期剧情更少）。无破损状态需修复，社区已充分说明。 |
| 1ve4df5 | The Great Trench might be much larger than we think | dismissed（insufficient-information） | 原帖已被版主移除（标题与正文均显示 [removed]，因 Rule #6 剧透未标注）。原文不可检索，无可核对问题或安全答案；社区讨论仅围绕“剧透需标注”展开，非可解答问题。 |
| 1vdwk48 | does anyone else feel like the out-of-bounds leviathan is too aggressive? | dismissed（not-a-question） | 观点／感受帖，非问题。楼主误入边界被 Shiver Leviathan 追击，认为 aggro 范围应更远；评论共识“你不该在那儿／这正是它的意义”，属设计偏好讨论，社区已确认 working as intended。 |

## 已核验英文回复与官方来源（1vdl6sx，供流量机会 Issue／站长直接复制）

> Yes — this is intended, not a bug. There are **two** Collector Leviathans in Subnautica 2: one patrols the area above the **Karakorum Metal Farms** (the green-pools / metal-farm biome you were in), and the other patrols the trench in the **Sparse Plains**. So running into one in the poisonous / Karakorum zone is expected — that's its territory. The Collector is an aggressive leviathan-class lifeform; it can't be killed, only avoided. To break aggro: stay close to the seafloor, use **Distraction Flares** or the **Camouflage** biomod, and it may lose interest if your Tadpole breaches the surface.
>
> Source: Subnautica 2 Wiki — Collector Leviathan (permanent revision, verified 2026-08-04): https://wiki.subnautica.com/sn2/Collector_Leviathan?oldid=19477

## 证据与纪律说明

- 全部候选经已登录 Reddit 会话只读读取原帖正文与评论（`comments/<id>.json`），未发帖、未评论、未投票、未私信。
- 判定不依赖社区猜测作为事实：1vdl6sx 社区称“Collector 会学习／陪你玩／给只 Tadpole 就放过你”未见于官方 Wiki，已排除，仅采用 Wiki 记载的“两只 Collector 与各自领地”事实。
- 证据来源为 Subnautica 2 Wiki 永久修订（oldid=19477），非社区说法；该页含 Adaptive Measures 更新引用，对应当前版本。
- Gmail／Reddit 外部动作纪律：未回复任何邮件、未提交 Data API 材料、未创建 Reddit 应用、未配置密钥；未在 Reddit 发帖／评论／投票／私信。
