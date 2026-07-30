# 每日玩家问题证据审核报告 — 2026-07-30

## 一、Gmail API 审批检查（liuzhou0117@gmail.com，含垃圾邮件）

**结论：无任何审批 / 拒绝 / 补件通知，站长无需处理 API 相关事项。Gmail 连接正常，无需重新授权。**

范围：2026-07-23 之后，来自 Reddit 或主题/正文含 `Data API` / `developer platform` / `developer application` 的邮件（含垃圾邮件 `in:anywhere`）。三组拆分查询结果：

| 查询 | 命中 | 说明 |
|---|---|---|
| `from:reddit after:2026/07/23` | 2 封（均旧邮件） | 见下 |
| `"data api" after:2026/07/23` | 0 | — |
| `("developer platform" OR "developer application") after:2026/07/23` | 0 | — |

命中的 2 封邮件（非审批状态）：

1. **Reddit Support** — `support@reddit.zendesk.com` — 2026-07-23 23:50 — 主题「API Access Request Submission」
   - 内容：API 访问申请**提交回执**（工单号 `N2YMJW-D4XXN`），非审批结果、非拒绝、非补件要求。
   - 站长需处理事项：**无**。等待 Reddit 后续审批邮件即可。
2. **Reddit (AutoModerator)** — `noreply@redditmail.com` — 2026-07-26 02:44 — 主题「u/AutoModerator replied to your post in r/passive_income」
   - 内容：社区自动回帖通知，与 Data API 申请无关。
   - 站长需处理事项：**无**。

> 说明：截至本次审核，Reddit 官方尚未就 Data API 申请（工单 N2YMJW-D4XXN）返回审批 / 拒绝 / 补件邮件。未回复任何邮件、未提交任何材料、未创建 Reddit 应用、未配置任何密钥。

## 二、Reddit 玩家问题证据审核

**结论：本轮无可处理的新候选，无内容变化；同时修复了导致已审结论被反复冲回的采集流水线缺陷（PR #52，已合并）。**

### 1. 采集 Action 状态

- 今日（2026-07-30）采集 cron（`17 5 * * *` UTC，约北京 13:17+）在本自动化 10:10 运行时**尚未触发**。
- 上一次采集：2026-07-29 07:59Z **failure**（脚本因候选字段不完整 `Incomplete player question candidate` 报错 exit 1，未更新分支）。
- 因此 `automation/player-question-candidates` 分支最新数据仍是 **2026-07-28 07:51Z**（`collectedAt=2026-07-28T07:47:28Z`）。

### 2. 候选核对（automation 分支 vs main）

| 项 | automation 分支 | main（权威） |
|---|---|---|
| 候选总数 | 30 | 30 |
| system-review | 9 | 0 |
| ready-to-reply | 2 | 3 |
| dismissed | 19 | 27 |

- **真新候选（main 中不存在）：0 条。**
- automation 分支的 9 条 `system-review` 与 main 上 2026-07-29（PR #50）已审结的 9 条**完全同源**（同一次采集、候选集完全一致、`lastSeenAt` 无更新），仅 `review.state` 被采集流水线覆盖回 `system-review`。

这 9 条的权威判定（07-29 已用官方证据核证）：

| redditId | 标题 | 权威判定 | 依据摘要 |
|---|---|---|---|
| 1v7ylul | Tadpole won't dock | **ready-to-reply** | 原帖未解决；Steam 官方公告 EA 1.1（2026-07-08）修复 Moonpool 停靠相关问题，haul chassis 需更大 Moonpool，多 Moonpool 可能触发空间不足——有当前版本证据。本轮已用登录态复核原帖（149 赞、20 评论、楼主未确认修复），维持判定。 |
| 1v8680z | Tadpoles keeps exploding | dismissed | 楼主编辑原帖自证：基地 380m 超 Tadpole 默认 250m 压坏深度，非 bug。 |
| 1v8jbmr | INGAME list of unscanned items | dismissed | 帖内共识：游戏内无该功能；否定性断言无官方证据。 |
| 1v81x3v | growling/rumbling 音效来源 | dismissed | 评论两种猜测互相冲突，无官方来源。 |
| 1v89xmq | Bug I think? | dismissed | 一次性崩溃、无复现步骤、零评论、官方无对应条目。 |
| 1v8k557 | Weird issue with building | dismissed | 门无法居中，评论仅推测，官方补丁无对应修复。 |
| 1v8o9r3 | 一键补全图鉴 | dismissed | 与 1v8jbmr 重复主题，否定性断言无官方证据。 |
| 1v5gwdc | Dive elevators bug | dismissed | 穿模吐槽，评论全玩笑，EA 1.1 无对应修复（沿用 PR #44）。 |
| 1v8mjgf | Scanner room 生物识别 | dismissed | flair=Suggestion，是给开发组的功能建议，非求助。 |

### 3. 根因修复（PR #52，已合并）

采集 workflow「准备审核分支」步骤用 `automation` 旧分支 JSON 覆盖刚检出的 `origin/main`，把 main 的已审结论冲回 `system-review`，导致人工队列每天重复消化同一批候选（2026-07-25 / 07-29 均复发）。

修复：审核基线**固定为 `origin/main`**，删除覆盖逻辑。采集脚本读取工作区 JSON 时保留 `review` 状态（prior-review 合并），基线为 main 即可保住权威结论。

- `npm run validate` 全绿（206 recipes / 81 entities / 972 HTML / 3 locales）。
- 远端检查 `验证数据、页面和多语言` = pass，已合并到 main（`5a759014`）。
- 效果：从今日采集 cron 起，已审结论不再被冲回。

### 4. 流量机会 Issue

本轮无新增 `ready-to-reply` 候选（唯一的 1v7ylul 已在 07-29 PR #50 处理、并生成过流量机会 Issue #51），故**不新建 Issue**。

## 三、合规声明

未在 Reddit 发帖、评论、投票或私信；未回复任何邮件；未提交任何材料；未创建 Reddit 应用；未配置任何密钥。所有 Reddit 原帖读取均通过已登录只读会话完成。
