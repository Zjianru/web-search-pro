# Marketing Launch Kit

This document turns the current `web-search-pro` release state into reusable promotion material.
It is optimized for agent-first distribution, not generic product marketing.

## Positioning

Primary English line:

> Agent-first web search and retrieval stack with a real no-key baseline, explainable routing,
> visible federated-search gains, and built-in extract, crawl, map, and research flows.

Primary Chinese line:

> 面向 Agent 的 Web 搜索与检索栈：零 key 可用、路由可解释、联邦搜索增益可见，并内置
> extract、crawl、map、research 全链路能力。

Do not lead with provider count. Lead with:

- no-key baseline
- explainable routing
- visible federation value
- search that grows into extraction and research

## Proof Points To Reuse

- `search`, `extract`, `crawl`, `map`, and `research` live in one skill
- routing exposes `confidence`, `selectionMode`, and `topSignals`
- federation exposes concrete gain metrics:
  - `resultsRecoveredByFanout`
  - `resultsCorroboratedByFanout`
  - `duplicateSavings`
- `bootstrap` and `doctor` make the skill easier for agents to inspect
- `head-to-head` suites exist for route-first and live comparisons

## Distribution Plan

### 1. Registry Distribution

- ClawHub listing:
  - ask for ratings and short reviews
  - keep the first screen focused on `no-key`, `news`, `docs`, `research`, and `federation`
- Request `Verified` when ready, because ClawHub search ranks verified skills higher and recommends
  them earlier.

### 2. Directory Distribution

- `awesome-openclaw-skills` PR:
  - URL: <https://github.com/sundial-org/awesome-openclaw-skills/pull/17>
  - section: `Web & Search`
  - angle: search plus retrieval, not just another search wrapper

### 3. Community Distribution

- OpenClaw Discord
- OpenClaw forum
- WeChat groups
- GitHub Discussions or showcase-style launch posts

### 4. Content Distribution

- short launch post
- benchmark post against other search skills
- one or two workflow posts showing `search -> extract -> research`

## Ready-To-Post Copy

### Discord / Forum (English)

```text
Web Search Pro 2.1.3 is live.

It is an agent-first web search and retrieval stack with:
- a real no-key baseline
- explainable routing with confidence and top signals
- visible federated-search gains
- built-in extract, crawl, map, and research flows

This is not just a search wrapper. The goal is to let an agent search, inspect sources, recover
missing results with federation, and continue into evidence collection without switching skills.

ClawHub:
https://www.clawhub.com/Zjianru/web-search-pro

GitHub:
https://github.com/Zjianru/web-search-pro
```

### WeChat / Chinese Community

```text
Web Search Pro 2.1.3 已发布。

这是一个面向 Agent 的 Web 搜索与检索栈，不只是“搜索一下”：
- 零 key baseline 可直接跑通
- 路由可解释，能看到 confidence / top signals
- 联邦搜索增益可见，能直接看到多 provider 多找回了什么
- 内置 extract / crawl / map / research，搜索后可以继续做证据收集

ClawHub：
https://www.clawhub.com/Zjianru/web-search-pro

GitHub：
https://github.com/Zjianru/web-search-pro
```

### Rating / Review Ask

```text
If you install and use Web Search Pro on ClawHub, a short rating or review would help a lot.
The most useful feedback is:
- what task you used it for
- whether the no-key baseline was enough
- whether routing and federation output helped your agent workflow
```

## Launch Post Draft

Title:

`Web Search Pro 2.1.3: explainable agent search with visible federation gains`

Body:

```markdown
`web-search-pro` started as a multi-provider search skill and has grown into a broader
agent-first retrieval stack.

The current release focuses on one idea: search should be usable by agents, not just by humans.

That means three things:

1. A real no-key baseline so the first run succeeds without forcing users to collect provider keys.
2. Explainable routing so an agent can see why a provider was selected, how confident that choice
   was, and what signals drove it.
3. Visible federation gains so multi-provider search is not a black box. The output exposes what
   extra providers actually contributed, which results were recovered by fanout, which ones were
   corroborated, and how many duplicates were removed.

`web-search-pro` also goes beyond single-shot search. It includes `extract`, `crawl`, `map`, and
`research`, so agents can move from search into evidence gathering without switching tools or
rewriting context.

If you want to try it:

- ClawHub: https://www.clawhub.com/Zjianru/web-search-pro
- GitHub: https://github.com/Zjianru/web-search-pro

If you use it, feedback that compares baseline search, premium search, and federated search is the
most valuable.
```

## Benchmark Post Draft

Title:

`Why visible federation gains matter more than “more providers”`

Angle:

- show a single query where primary-only misses one result
- show `resultsRecoveredByFanout`
- show `resultsCorroboratedByFanout`
- explain that the goal is not to fan out blindly, but to expose exactly where extra providers
  improved the final answer set

## Workflow Post Draft

Title:

`From search to evidence pack in one agent workflow`

Angle:

- run `search`
- inspect `routingSummary`
- continue into `extract` or `research`
- show that the skill is valuable because the agent does not need to switch tools mid-task
