# 每日玩家问题证据审核报告 · 2026-07-25

## 一、Gmail 邮件审核（Reddit / Data API 申请状态）

**结论：本轮无法读取 Gmail，需要重新授权；未发现任何审批/拒绝/补件通知，且此状态不得当作"已通过"。**

- 检查目标：`liuzhou0117@gmail.com`（含垃圾邮件），2026-07-23 之后来自 Reddit，或主题/正文含 `Data API` / `developer platform` / `developer application` 的邮件。
- 实际情况：Gmail 技能依赖 `MATON_API_KEY` 授权凭据，本机环境未设置该变量，且未安装 `maton` CLI、无本地配置文件。无法调用 Gmail API 拉取邮件。
- 处置：按约定仅在报告中说明，不将其视为任何审批结论；未自动回复、未提交材料、未创建 Reddit 应用、未配置任何密钥。
- 需要站长处理：若需恢复邮件审核，请重新完成 Gmail（maton）授权并设置 `MATON_API_KEY`，随后可复跑本自动化补查 07-23 之后的相关邮件。

## 二、Reddit 玩家问题证据审核

### 采集 Action 状态
- 工作流「收集玩家问题候选」于 **2026-07-25 07:28Z 调度运行，状态 success**。
- 数据来源分支 `automation/player-question-candidates`（已随 PR #39 合入 main），`data/player-question-candidates.json` 采集时间 `2026-07-25T07:28:45Z`。
- 候选总数 22：本轮审核前为 `system-review 1 / ready-to-reply 2 / dismissed 19`。

### 本轮需处理候选（system-review = 1）

| 项 | 内容 |
| --- | --- |
| 标题 | Dive elevators bug |
| redditId | 1v5gwdc |
| 链接 | https://www.reddit.com/r/Subnautica_2/comments/1v5gwdc/dive_elevators_bug/ |
| 发布时间 | 2026-07-24 16:50 UTC |
| 采集器备注 | RSS 取评论时 429 限流，未取到正文/评论，转系统核对 |

**登录态只读核对结果：**
- 正文（唯一一句）：潜水电梯放在某些位置时不受碰撞阻挡，可穿透地图（clipping / phase-through）。
- 热度：约 224 赞、13 条评论（仅在报告中说明，未写回 JSON 的 RSS 边界字段）。
- 评论全貌：全部是玩笑与许愿——"这不是 bug 是特性""别修复""当 Satisfactory hypertube 发射器用""希望以后能在基地内建电梯"。**无开发者回复、无解决方案、无复现/规避步骤。**

**官方来源核对：**
- Unknown Worlds 官方补丁说明、官方支持、Steam 官方公告、带永久修订链接的 Subnautica 2 Wiki：均**未**记录该穿模问题、其修复状态或任何官方认可的安全 workaround。

**审核判定：`dismissed`（answerStatus: `no-safe-current-answer`）**
- 判定理由：① 这是穿模 bug 的现象吐槽，不是求助型问题，攻略站无可复用答案；② 社区回应全为玩笑/推测，不能写成确定事实；③ 无当前版本官方证据支撑任何"修复/规避"结论。
- 依审核规则（"没有安全答案 → dismissed；仅当原帖仍未解决且答案有当前版本证据才 ready-to-reply"），关闭该候选。

### 审核后状态
- `system-review 0 / ready-to-reply 2 / dismissed 20`（total 22 不变）。
- 已同步更新 `data/player-question-candidates.json` 与 `data/player-question-candidates.md`。
- `npm run validate` 全部通过（采集/提升/流量测试 + 溯源 + 死链/元数据 + 多语校验）。

### 流量机会 Issue
- 本轮无新增 `ready-to-reply` 候选，**不生成**流量机会 Issue（既有 2 条 ready-to-reply 为往轮已审，非本轮范围）。

## 三、纪律声明
- 未在 Reddit 发帖、评论、投票或私信；未自动回复邮件、未提交任何申请材料。
- 所有代码改动走 feature 分支 + 中文 PR，远端检查通过且无证据风险时方可合并。
