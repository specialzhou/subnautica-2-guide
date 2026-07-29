# 每日玩家问题证据审核报告 · 2026-07-29

## 一、Gmail 邮件审核（Reddit / Data API 申请状态）

**结论：Gmail 连接正常（浏览器登录态直读），2026-07-23 之后无任何审批、拒绝或补件通知，无需站长处理。**

- 检查目标：`liuzhou0117@gmail.com`（`in:anywhere`，含垃圾邮件），2026-07-23 之后来自 Reddit，或主题/正文含 `Data API` / `developer platform` / `developer application` 的邮件。
- 命中结果（仅 2 封，均为已知旧邮件）：
  1. **Reddit Support**，2026-07-23 23:50，「API Access Request Submission」——API 申请**提交回执**（工单 N2YMJW-D4XXN），非审批/拒绝/补件。
  2. **Reddit**，2026-07-26 02:44，AutoModerator 在 r/passive_income 的回帖通知，与 API 申请无关。
- `"data api"`、`"developer platform" OR "developer application"` 两组正文关键词检索均为 0 结果。
- 纪律：未自动回复、未提交材料、未创建 Reddit 应用、未配置任何密钥。

## 二、Reddit 玩家问题证据审核

### 采集 Action 状态
- 「收集玩家问题候选」今日（07-29）cron（约 07:47Z）在本自动化运行时（10:00 北京时间）**尚未触发**；最近一次成功运行为 **2026-07-28 07:47Z（success）**，其数据已随 PR #49 合入 main。07-27 那次调度 failure，未产出数据。
- 本轮审核对象即 main 上 07-28 数据：候选 30，审核前 `system-review 9 / ready-to-reply 2 / dismissed 19`。
- 07-27、07-28 两日自动化未留下审核记录，本轮一并消化积压的 9 条 system-review。

### 流水线问题（需关注）
- **1v5gwdc「Dive elevators bug」曾于 2026-07-25 经 PR #44 判 dismissed，但被后续采集流水线覆盖回 system-review。** 采集器代码本身会保留已有 review 状态，覆盖发生在 `automation/player-question-candidates` 分支基于旧数据重建时。本轮已恢复 dismissed；若再次复发，建议让采集 workflow 每次以 main 最新 JSON 为基线。

### 本轮审核判定（9 条 system-review）

| redditId | 标题 | 判定 | 依据摘要 |
| --- | --- | --- | --- |
| 1v8680z | BUG: Tadpoles keeps exploding | dismissed（已解决） | 楼主编辑原帖确认非 bug：基地 380m 超出 Tadpole 默认 250m 压坏深度，装 Depth Module 后解决（wiki oldid=17908 证实模块存在）。 |
| 1v8jbmr | 游戏内有没有未扫描项清单 | dismissed（无安全答案） | 帖内已有共识答案（没有），否定性断言无官方证据；EA 1.1 公告仅提到 Biomod 扫描计数可见。与 1v8o9r3/1v8mjgf 同主题。 |
| 1v7ylul | Tadpole won't dock | **ready-to-reply** | 原帖未解决；EA 1.1 官方公告明确「Moonpool 需扩建才能建造/停靠载具时会有提示」并缩小了 Vehicle Dock 占位。站内深链 guide/items/tadpole-dock.html（wiki oldid=19275）。 |
| 1v81x3v | 这是什么低吼/隆隆声 | dismissed（无安全答案） | 评论两种猜测（Deepwing Brooder vs Collector Leviathan）冲突，无官方来源标注环境音归属。 |
| 1v89xmq | Bug I think?（一次性崩溃） | dismissed（信息不足） | 无复现、无损失、零评论，官方无对应已知问题。 |
| 1v8k557 | 门无法放在墙正中 | dismissed（无安全答案） | 仅社区推测，楼主自查未定位原因，官方补丁无对应条目。 |
| 1v8o9r3 | 有没有游戏内补全图鉴的便捷方式 | dismissed（无安全答案/重复） | 帖内已答（暂无），与 1v8jbmr 重复主题。 |
| 1v5gwdc | Dive elevators bug | dismissed（维持 07-25 判定） | 穿模吐槽帖，评论全为玩笑/许愿；EA 1.1 仅修复电梯偶发不伸出，未涉及穿模。 |
| 1v8mjgf | Scanner room BIO/LIFE FORM identifier | dismissed（非问题） | flair 为 Suggestion，是给开发组的功能建议，非求助。 |

全部候选均以 Reddit 登录态只读核对原帖正文与评论，并对照 Steam 官方公告（EA 1.1「Adaptive Measures」2026-07-08、Hotfix 4 2026-07-14）与带永久修订链接的 Subnautica 2 Wiki。未把社区猜测写成确定事实。

### 审核后状态
- `system-review 0 / ready-to-reply 3 / dismissed 27`（total 30 不变）。
- 已同步更新 `data/player-question-candidates.json` 与 `data/player-question-candidates.md`。
- `npm run validate` 全部通过。

### 流量机会 Issue
- 本轮新增 1 条 ready-to-reply（1v7ylul，145 赞、18 评论），已生成流量机会 Issue，内含**已核验、可直接复制的英文回复**与官方来源清单，站长不需要判断游戏事实。

## 三、纪律声明
- 未在 Reddit 发帖、评论、投票或私信；未自动回复邮件、未提交任何申请材料。
- 代码改动走 feature 分支 + 中文 PR，远端检查通过且无证据风险后合并。
