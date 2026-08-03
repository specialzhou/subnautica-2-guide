# 玩家问题证据审核报告 — 2026-08-03

> 自动任务：每日审核 Subnautica 2 玩家问题与 Reddit Data API 审批状态
> 审核分支：`audit/player-questions-2026-08-03`（base `main`）
> 候选数据源：`automation/player-question-candidates`（采集时间 2026-08-02T07:41:09Z）

## A. Reddit Data API 审批状态（Gmail 核对）

**结论：本期无新增审批/补件邮件；唯一需站长处理的事项仍是 2026-07-31 的「拒绝」通知。**

- 复核方式：ego-browser 登录态直读 `liuzhou0117@gmail.com`（含垃圾邮件），6 组查询（`from:reddit` / `data api` / `developer platform` / `developer application` / `from:redditinc.com` / `subject:(API)`，范围 `after:2026/07/23`）。
- 命中邮件（共 3 封，均为此前已知）：
  1. **[Reddit Support] Re: Your request sent to Reddit Support** — 发件人 `support@reddit.zendesk.com`，**2026-07-31 23:04（太平洋时间）**，工单 `18167333` / `N2YMJW-D4XXN`。即对 Data API 访问请求的**拒绝通知**（不满足 Responsible Maker 政策 / 材料缺失）。
  2. u/AutoModerator 回复（r/passive_income，2026-07-26）— 无关。
  3. API Access Request Submission（2026-07-23，工单 `N2YMJW-D4XXN`）— 提交回执，非审批。
- `data api` / `developer platform` / `developer application` / `from:redditinc.com` 四组查询均 **0 结果**。
- **站长需处理**：Reddit 已于 07-31 拒绝 Data API 访问请求。如需继续，应**人工**按 Responsible Maker 政策补齐全套用例文档后重新提交；**本任务未自动回复、未提交材料、未创建 Reddit 应用、未配置任何密钥。**
- Gmail 连接正常，无需重新授权。

## B. Reddit 玩家问题证据审核

### 审核范围与结果

| 指标 | 数值 |
| --- | --- |
| 本轮 system-review 候选 | 44 |
| 本轮处置：dismissed | 44（全部） |
| 维持 ready-to-reply（不变） | 3（`1v7ylul` / `1uuswe2` / `1ut24gk`） |
| 新增 ready-to-reply | **0** |
| 新建流量机会 Issue | **无**（无新 ready-to-reply） |
| 终态计数 | 80 候选：dismissed 77 / ready-to-reply 3 / system-review 0 |

### 处置口径（44 条 dismissed 依据）

- **SN1 非 SN2 内容（r/subnautica 且站点为 SN2 攻略）**：约 33 条（如 `1v7bhp2` 储物柜居中、`1vb6l6h` 500m 基地、`1v8eaqt` 浮岛制造台、`1vaw0gn` Seamoth 卡地形、`1v6vsqz` 水体物理失效、`1v82cjo` Cyclops 卡住、`1v90btr` 异种蛋穿模等）→ `no-platform-specific-official-evidence`。
- **模组冲突（无原版/官方修复）**：`1v7ltnq`（Cyclops 制造台，TweaksAndFixes 等）→ `no-safe-current-answer`。
- **meme / 粉丝画 / 故事 / 观点讨论（非问题）**：`1v97gto` `1v7c3bo` `1v8d7iu` `1vaveep` `1vbesdt` `1v91w2u` `1vb8er7` `1v822mh` `1va8f5x` `1v7n5f5` `1v6wlks` `1v7kt2k` `1vasq29` `1va7vsh` `1v95axr` `1v9jcon` `1v8ku3m`（BZ 搞笑截图）等 → `not-a-question`。
- **社区已解答 / 楼主自解**：`1v6tkin`（楼主自认感染藏山体下）→ `resolved-in-thread`；其余进度类询问社区已一致解答 → `no-platform-specific-official-evidence`。
- **SN2 但无当前版本官方证据（不杜撰）**：
  - `1v87dym`（jet-streams 洋流被移除）— 移除属社区解释，官方更新日志/Wiki 未找到可引用单点声明 → `no-current-official-evidence`。
  - `1v7nzrf`（扫描 75→80）— 社区仅给 Reddit 列表，无官方清单 → `no-current-official-evidence`。
  - `1v8uplm`（通关后还能干嘛）/ `1v8g1p3`（Cicada 残骸）— 剧情终点/EA 内容边界属社区共识、无单一官方声明，部分源自 leak → `insufficient-official-story-evidence`。
  - `1vc9g0e` `1v8fsx3`（卡地图下方 glitch）/ `1v9oow2`（太阳能板脱离 glitch）— 已知 glitch，官方支持站无对应专文，无官方恢复路径 → `bug-report-no-recovery`。
  - `1vcaqyu`（多人找人）/ `1v9j3a5`（第三方地图自荐）— 社交/推广，非游戏机制事实 → `not-applicable`。
  - `1vbhjr5`（第 4 种载具推测）— 未发布内容 + 数据挖掘推测，写推测为事实违反审核纪律 → `not-a-question`。

### 候选集变动说明

- **2 条新候选**（仅在本期采集，main 无）：`1vcaqyu`（SN2 多人组队）、`1vc9g0e`（SN2 卡地图下方），均已审核并 dismissed。
- **2 条被采集器裁剪**（main 有、本期采集无）：`1v9j9v4`（Corrupted NoA dialog，已 dismissed/not-applicable）、`1v8o9r3`（in-game 完成数据库，已 dismissed/no-safe-current-answer）。二者此前已是 dismissed，本轮无待决结论丢失；候选集以最新采集为准。

### 纪律确认

- Reddit 全程登录态**只读**（comments JSON 批量核对），未发帖 / 评论 / 投票 / 私信。
- 未回复任何邮件、未提交材料、未创建 Reddit 应用、未配置密钥。
- 未将社区推测当作事实写入；无官方当前版本证据的条目一律 dismissed，不杜撰修复。

## 交付

- 已更新 `data/player-question-candidates.json` 与 `data/player-question-candidates.md`（44 条 system-review → dismissed，终态 77/3/0）。
- `npm run validate` 通过（本地）。
- 中文 PR 已提交（base `main`）；远端检查通过且无证据风险后合并。
- 无新 ready-to-reply → 未建流量机会 Issue。
