# 每日审核报告 — 2026-08-08

## 一、Reddit Data API 审批状态（Gmail 核查）

> 注意：本工作区「agent-mail」MCP 当前为 `not_bound`（需在主面板重新授权/绑定）。本次 Gmail 核查改用 ego-browser 登录态直读 liuzhou0117@gmail.com，仅读取、未回复、未提交材料、未创建 Reddit 应用、未配置任何密钥。agent-mail 未绑定仅作说明，不视为审批状态。

核查范围：2026-07-23 之后，发件人含 Reddit / redditinc.com，或主题/正文含 `Data API` / `developer platform` / `developer application` / `API Access` 的邮件，含垃圾邮件（`in:anywhere` / `in:spam`）。

结果：共命中 3 封已知邮件，**无新增审批 / 拒绝 / 补件通知**。

| 时间 | 发件人 | 主题 | 状态 |
| --- | --- | --- | --- |
| 2026-07-23 23:50 PDT | Reddit Support | API Access Request Submission（工单 N2YMJW-D4XXN） | 提交回执（非审批） |
| 2026-07-26 | Reddit (u/AutoModerator) | replied to your post in r/passive_income | 无关（非 API） |
| 2026-07-31 08:04 PDT | Reddit Support | Re: Your request sent to Reddit Support（工单 18167333） | **拒绝** |

当前状态：**Reddit Data API 申请仍处「拒绝」状态**（工单 18167333），自 07-31 起无变化。

站长需处理事项：
- 补全「Responsible Maker Policy」要求的用例文档（使用场景、数据用途、合规说明），通过回复该邮件或重新提交申请。
- 本任务未代站长回复邮件、未提交材料、未创建 Reddit 应用、未配置密钥。

## 二、Subnautica 2 玩家问题证据审核

采集流水线：当日「收集玩家问题候选」Action 已于 2026-08-07 06:18Z 完成（`automation/player-question-candidates` 分支，collectedAt=2026-08-07T06:18:59Z）。本自动化 10:10 早于采集 cron，故审的是 08-07 采集数据（与历史一致）。

候选集变化（重要）：本次为 08-05/06/07 连续采集累积、但 08-05–08-07 每日审核未执行，形成 46 条 `system-review` 积压。与 main（08-03 状态）相比，候选集整体平移——46 条为新增、46 条已退出采集窗口（均为此前 `dismissed`；4 条 `ready-to-reply` 仍保留在重叠集中，未丢失）。终态 80：75 `dismissed` + 5 `ready-to-reply` + 0 `system-review`。

审核方法：46 条 `system-review` 全部用 ego-browser 登录态（Reddit 账号 UltradudeRW）读取原帖正文+评论核对；答案以官方证据为判准——Unknown Worlds 官方补丁、官方支持、Steam 官方公告、带永久修订链接的 Subnautica 2 Wiki。社区猜测不写为事实。

### 新增 ready-to-reply（1 条）
- **1vdislm**「[SN2] What does this line in the EA 1.1 patch notes mean?」（six Biomods from Biolabs）
  - 证据：Steam 官方公告《Subnautica 2 Early Access 1.1 - Adaptive Measures Update》(appid 1962700) 明确：『Players can now unlock a total of six Biomods from Biolabs found throughout the world, up from four previously』，并 `Added two more Biolabs, one in Coral Gardens and one in Axum Ruins`、`Smoothed out Biomod progression throughout the early game`。Biomod 由扫描 Biolabs（废弃基地结构）解锁，与 biobed / 工具无关。
  - 已生成流量机会 Issue（含可复制英文回复 + 官方来源），站长复制即可，无需判断游戏事实。

### 驳回（45 条）分类
- 纯 SN1 / 非 SN2 范围（`not-applicable`，30 条）：`r/Subnautica` 初代 Subnautica / Below Zero 机制帖（PRAWN、Cyclops、Aurora、Scanner Room、Silver Ore、Thermoblade 等 SN1 专属），超出本攻略站 SN2 范围。
- 观点 / 讨论帖（`not-a-question`，含 SN2 相关 6 条）：Axum 设定、shiver leviathan、SN2 开局、旧 moonpool、YouTube 剧透、剧情 theory 等，无安全答案。
- 社区策略 / 无官方证据（`no-safe-current-answer`，8 条）：bioscan Collector Leviathan（camo + Tadpole 诱饵）、79 bioscans、angel comb 隐藏 canker、virus 节点、Compiling Shaders 每次重编译、换显卡启动崩溃、DirectX 指南、EA 1.1 FPS 回归——答案依赖社区经验或第三方表，无官方文档。
- 已解决（`resolved-in-thread`，1 条）：`1vf8ili` Tadpole 卡死，楼主 EDIT 已自行解除。
- 无当前官方证据（`no-current-official-evidence`，1 条）：`1vg6z4c` 79 bioscans（第三方表推算，非官方清单）。

纪律：Reddit 全程登录只读，未发帖 / 评论 / 投票 / 私信；未回邮件 / 提交材料 / 建应用 / 配密钥。

## 三、交付
- 分支 `audit/player-questions-2026-08-08`（base origin/main）
- 改动：`data/player-question-candidates.json`（46 条审核结论）、`data/player-question-candidates.md`（重生成）、`data/player-question-audit-2026-08-08.md`
- `npm run validate` 本地全绿；远端检查通过且无证据风险 → 合并。
