# Web Search Pro 2.1

`web-search-pro` is an agent-first web search and retrieval stack for live web search, news
search, docs lookup, code lookup, company research, site crawl, site map, and structured evidence
packs.  
`web-search-pro` 是一个面向 Agent 的 Web 搜索与检索基础设施，覆盖实时网页搜索、新闻搜索、
官方文档检索、代码检索、公司研究、站点抓取、站点结构发现，以及结构化 evidence pack。

It started as a `1.x` multi-provider search skill and evolved into a broader `2.x` product with
search routing, extraction, crawling, diagnostics, and research-pack generation.  
它起源于 `1.x` 的多引擎搜索 skill，`2.x` 开始进化为更完整的产品：搜索路由、提取、抓取、
诊断、自审和 research evidence pack。

## What Agents Use It For / Agent 适用任务

- live web search and current-events search / 实时网页搜索与时效信息检索
- news search and latest-update lookup / 新闻搜索与最新动态查询
- official docs, API docs, and reference lookup / 官方文档、API 文档与参考资料检索
- code lookup, implementation lookup, and developer research / 代码检索、实现方案检索与开发研究
- company, product, and competitor research / 公司、产品与竞品研究
- site crawl, site map, and docs discovery / 站点抓取、站点结构发现与文档发现
- answer-first cited search with explainable routing / 带引用的 answer-first 搜索与可解释路由
- no-key baseline retrieval with optional premium providers / 零 key baseline 检索与可选 premium provider 扩展

## Search And Capability Keywords / 检索与能力关键词

`web search`, `news search`, `latest updates`, `current events`, `docs search`, `API docs`,
`code search`, `company research`, `competitor analysis`, `site crawl`, `site map`,
`multilingual search`, `Baidu search`, `Google-like search`, `answer-first search`,
`cited answers`, `explainable routing`, `no-key baseline`

## Quick Start / 快速开始

The shortest successful path is:

- start with the no-key baseline
- add one premium provider only when you need stronger recall or fresher results
- then try docs, news, and research flows

最短上手路径是：

- 先跑通零 key baseline
- 只有在需要更强召回或更强时效时，再加一个 premium provider
- 然后继续尝试 docs、news 和 research 流程

### Option A: No-key baseline / 零 key 基线

No API key is required for the first successful run. The baseline is:

- `ddg` for best-effort web search
- `fetch` for extract, crawl, and map fallback

第一条成功路径不需要 API key。baseline 由两部分组成：

- `ddg`：best-effort 网页搜索
- `fetch`：extract、crawl、map 的零 key fallback

```bash
node scripts/doctor.mjs --json
node scripts/bootstrap.mjs --json
node scripts/search.mjs "OpenAI Responses API docs" --json
```

### Option B: Add one premium provider / 只加一个 premium provider

If you only add one premium provider, start with `TAVILY_API_KEY`. It is the shortest upgrade path
because it improves general web search, news search, and extract quality with one credential.

如果你只想先加一个 premium provider，优先从 `TAVILY_API_KEY` 开始。它是最短升级路径，因为
一组凭据就能同时增强一般网页搜索、新闻搜索和 extract 质量。

```bash
export TAVILY_API_KEY=tvly-xxxxx
node scripts/doctor.mjs --json
node scripts/search.mjs "latest OpenAI news" --type news --json
```

### First successful searches / 第一批成功命令

```bash
node scripts/search.mjs "OpenClaw web search" --json
node scripts/search.mjs "OpenAI Responses API docs" --preset docs --plan --json
node scripts/extract.mjs "https://platform.openai.com/docs" --json
```

### Then try docs, news, and research / 然后继续尝试 docs、news 和 research

```bash
node scripts/search.mjs "OpenAI Responses API docs" --preset docs --json
node scripts/search.mjs "latest OpenAI news" --type news --json
node scripts/research.mjs "OpenClaw search skill landscape" --plan --json
```

## Why Federated Search Matters / 联邦搜索为什么有价值

Federation is not just "more providers". It makes multi-provider value visible with compact,
machine-readable gain metrics.

联邦搜索不只是“多跑几个 provider”，而是把多 provider 的真实增益变成紧凑、可机器消费的指标。

- `federated.providersUsed`
  Providers that actually returned results.
  真实返回结果的 provider 集合。
- `federated.value.additionalProvidersUsed`
  How many non-primary providers actually contributed.
  真正贡献结果的非主 provider 数量。
- `federated.value.resultsRecoveredByFanout`
  Final results that disappear in primary-only mode.
  如果只跑主 provider 就会消失的最终结果数量。
- `federated.value.resultsCorroboratedByFanout`
  Final results supported by both the primary and at least one fanout provider.
  同时得到主 provider 和 fanout provider 支持的最终结果数量。
- `federated.value.duplicateSavings`
  Exact or near-duplicate results collapsed by the merge.
  merge 过程中被折叠掉的精确或近似重复结果数量。
- `routingSummary.federation.value`
  The compact federation gain summary exposed alongside route explanation.
  与路由解释一起暴露的紧凑联邦增益摘要。

Example:

```json
{
  "federated": {
    "providersUsed": ["serper", "tavily"],
    "value": {
      "additionalProvidersUsed": 1,
      "resultsWithFanoutSupport": 2,
      "resultsRecoveredByFanout": 1,
      "resultsCorroboratedByFanout": 1,
      "duplicateSavings": 1,
      "answerProvider": "tavily",
      "primarySucceeded": true
    }
  }
}
```

Interpretation:

- `resultsRecoveredByFanout=1` means federation produced one final result that primary-only search
  would have missed.
- `resultsCorroboratedByFanout=1` means another final result got multi-provider support.
- `duplicateSavings=1` means the merge removed one duplicate instead of wasting result slots.

## Versioning / 版本说明

- Product / docs version: `2.1`
- JSON schema version: `1.0`

`2.x` is the retrieval-stack line, and the current product/docs release is `2.1`. Machine-readable
payloads remain additive and compatible, so schema stays `1.0`.
`2.x` 是检索基础设施这一产品线，当前文档与产品版本是 `2.1`。机器消费的 JSON 输出仍保持增量兼容，因此 schema 继续是 `1.0`。

## Distribution Surfaces / 分发面

The repository now has two honest distribution surfaces:

- GitHub / local OpenClaw source tree: the full `2.1` feature set
- ClawHub publish package: a generated core profile built by `scripts/build-clawhub-package.mjs`

仓库现在有两个都真实、但职责不同的分发面：

- GitHub / 本地 OpenClaw 源码树：完整 `2.1` 能力面
- ClawHub 发布包：通过 `scripts/build-clawhub-package.mjs` 生成的 core profile

Why this split exists:

- GitHub 和本地 OpenClaw 需要完整的 `render`、`eval`、测试与研究工具链
- ClawHub registry 更适合一个更窄、更诚实、静态扫描噪音更小的安装包

Detailed notes / 详细说明：
- [docs/clawhub-package.md](/Users/codez/develop/web-search-pro/docs/clawhub-package.md)
- [docs/search-routing-model.md](/Users/codez/develop/web-search-pro/docs/search-routing-model.md)
- [docs/agent-contract-p0.md](/Users/codez/develop/web-search-pro/docs/agent-contract-p0.md)

## From 1.x to 2.x / 从 1.x 到 2.x

| Dimension | `1.x` | `2.x` |
| --- | --- | --- |
| Product identity | Multi-engine search supplement | Retrieval stack for agents / 检索基础设施 |
| Baseline | Provider key usually required | No-key baseline via `ddg` + `fetch` |
| Surface | Mostly `search` + `extract` | `search`, `extract`, `render`, `crawl`, `map`, `research`, `doctor`, `review`, `eval` |
| Routing | Static auto-select rules | Capability matrix + config + health + federation |
| Site retrieval | Single-page extract | Extract + render + BFS crawl + map |
| Research | None | Structured `plan + evidence pack` |
| Review posture | Mostly documentation-level | Runtime diagnostics, review output, health visibility |

What `2.x` keeps from `1.x`: explicit flags, predictable CLI semantics, engine forcing, and
provider-aware query control.  
`2.x` 保留了 `1.x` 里已经做对的东西：显式参数控制、可预测的 CLI 语义、强制指定引擎、
以及围绕 provider 的精细化查询控制。

## Core Capabilities / 核心能力

| Command | Purpose |
| --- | --- |
| `search.mjs` | Multi-provider search with explainable routing / 多引擎搜索与可解释路由 |
| `extract.mjs` | Single-page readable extraction / 单页正文提取 |
| `render.mjs` | Forced browser-backed extraction / 强制浏览器渲染提取 |
| `crawl.mjs` | Safe BFS crawl / 安全 BFS 站点抓取 |
| `map.mjs` | Site structure discovery / 站点结构发现 |
| `research.mjs` | Structured `plan + evidence pack` / 结构化研究规划与证据包 |
| `doctor.mjs` | Runtime diagnostics / 运行时诊断 |
| `bootstrap.mjs` | Agent-readable runtime bootstrap contract / 面向 Agent 的运行时 bootstrap 合同 |
| `capabilities.mjs` | Provider capability snapshot / Provider 能力快照 |
| `review.mjs` | Moderation / review summary / 审查与合规摘要 |
| `cache.mjs`, `health.mjs`, `eval.mjs` | Operations, health, and benchmark tooling / 运维、健康与评测工具 |

## Routing Model / 路由模型

Routing combines:

1. capability filtering
2. structured query signals
3. runtime policy from `config.json`
4. provider health
5. optional federated fanout

路由由五层共同决定：

1. 能力过滤
2. 结构化 query signals
3. `config.json` 运行时策略
4. provider 健康状态
5. 可选的 federated fanout

Important semantics / 关键语义：

- `selectedProvider`
  Primary route, not the only data source.  
  主路由，不代表唯一数据来源。
- `routingSummary`
  Compact route explanation with `selectionMode`, `confidence`, and `topSignals`, plus alternatives and federation context.
  紧凑路由解释，包含 `selectionMode`、`confidence`、`topSignals`，以及替代候选和 federation 上下文。
- `routing.diagnostics`
  Full route diagnostics exposed by `--explain-routing` or `--plan`, including matched query signals and runner-up context.
  仅在 `--explain-routing` 或 `--plan` 下暴露的完整路由诊断，包括命中的 query signals 和 runner-up 上下文。
- `federated.providersUsed`
  Providers that actually returned results.  
  真实参与并返回结果的 provider 集合。
- `federated.value`
  Compact federation gain summary: added providers, recovered results, corroborated results,
  and duplicate savings.
  紧凑的联邦增益摘要：额外 provider、补回结果、多源佐证结果，以及重复去除收益。
- `cached` / `cache`
  Cache hit flag plus age / TTL telemetry for agents.
  面向 Agent 的缓存命中标志与 age / TTL 遥测。
- `renderLane`
  Browser-lane runtime availability and policy summary.  
  浏览器渲染通道的运行时可用性和策略摘要。
- `topicType`, `topicSignals`, `researchAxes`
  Research-pack planning summaries for upstream models.  
  给上层模型消费的 research 规划摘要。

## Baseline and Providers / Baseline 与增强 Provider

No API key is required for the baseline. Optional provider credentials or endpoints unlock enhanced features.
基础能力不要求 API key。配置可选 provider 凭据或 endpoint 后可解锁增强能力。

For direct local CLI usage, provider keys must already be present in the current shell environment or injected by OpenClaw.  
如果直接在本地终端运行 CLI，provider key 需要已经进入当前 shell 环境，或由 OpenClaw 注入。

```bash
TAVILY_API_KEY=tvly-xxxxx
EXA_API_KEY=exa-xxxxx
QUERIT_API_KEY=xxxxx
SERPER_API_KEY=xxxxx
BRAVE_API_KEY=xxxxx
SERPAPI_API_KEY=xxxxx
YOU_API_KEY=xxxxx
SEARXNG_INSTANCE_URL=https://searx.example.com

# Perplexity / Sonar: choose one transport path
PERPLEXITY_API_KEY=xxxxx
OPENROUTER_API_KEY=xxxxx
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1  # optional override
KILOCODE_API_KEY=xxxxx

# Or use a custom OpenAI-compatible gateway
PERPLEXITY_GATEWAY_API_KEY=xxxxx
PERPLEXITY_BASE_URL=https://gateway.example.com/v1
PERPLEXITY_MODEL=perplexity/sonar-pro  # accepts sonar* or perplexity/sonar*
```

Provider roles / 各 provider 角色：

- Tavily: strongest premium default for deep search, news, extract
- Exa: semantic retrieval and extract fallback
- Querit: multilingual AI search with native geo / language filters
- Serper: Google-like search, strong for news and locale
- Brave: structured general web search, especially useful when OpenClaw users already have `BRAVE_API_KEY`
- SerpAPI: multi-engine routing including Baidu / Yandex
- You.com: LLM-ready web search with freshness, locale, and mixed web/news coverage
- SearXNG: self-hosted privacy-first metasearch fallback
- Perplexity: answer-first grounded search for question-style queries via native or gateway transport
- DDG: best-effort no-key baseline search
- Fetch: no-key extract / crawl / map baseline
- Render: optional local browser lane

Browser render is explicit and bounded: challenge / anti-bot interstitial pages are reported as failures, not silent successes.  
浏览器渲染是显式且受限的：遇到 challenge / anti-bot 中间页会明确报失败，不会伪装成成功。

Current JSON outputs expose:

- `routingSummary` for compact route transparency with `selectionMode`, `confidence`, and `topSignals`
- `routing.diagnostics` for full route diagnostics when `--explain-routing` or `--plan` is used
- `meta.searchType` / `meta.intentPreset` for user-facing search intent declarations
- `cached` / `cache` for cache hit and TTL telemetry
- `bootstrap.mjs` for an agent-readable runtime contract

Search UX additions:

- `--type`
  User-facing result surface selector. Current shipped values are `web | news`.
- `--preset`
  User-facing intent preset. Current shipped values are `general | code | company | docs | research`.

These are product-layer inputs, not provider ids. They influence routing, but do not replace
`--engine`.

## Research Layer / Research 层

`research.mjs` is not a long-form report writer. It is a model-facing structured layer for:

- question decomposition
- retrieval planning
- evidence normalization
- evidence hygiene and source prioritization
- claim clusters
- candidate findings
- uncertainties and limited follow-up

`research.mjs` 不是长报告生成器，而是给模型消费的结构化层，负责：

- 问题拆解
- 检索规划
- 证据归一化
- 证据降噪与来源提权
- claim 聚类
- 候选结论
- 面向模型的紧凑 handoff 摘要
- 不确定性与有限补证据

The intended boundary is:
- the skill cleans and structures evidence
- the upstream model reasons and writes

这层的边界是：
- skill 负责把证据洗干净、组织好
- 上层模型负责推理和表达

Detailed contract / 详细契约：
- [docs/research-layer.md](/Users/codez/develop/web-search-pro/docs/research-layer.md)

## Boundaries / 能力边界

`web-search-pro 2.1` is strong at:

- capability-aware retrieval
- safe extract / crawl / map
- explainable federation
- structured research packs
- local diagnostics and review surfaces

`web-search-pro 2.1` 擅长：

- 能力感知的检索路由
- 安全的 extract / crawl / map
- 可解释的 federated retrieval
- 结构化 research evidence pack
- 本地诊断与审查视图

It is intentionally not:

- a hosted remote scraping service
- a narrative report writer
- a browser-first crawl system by default
- an unlimited no-key search guarantee

它有意不是：

- 托管式远程抓取服务
- 最终报告写作器
- 默认浏览器优先的抓取系统
- 无上限、强保证的零 key 搜索服务

## Positioning vs Other Skills / 与其他 Skill 的定位对比

This is a public-description snapshot as of **2026-03-13**.  
以下对比基于 **2026-03-13** 的公开描述快照。

- [web-search-plus](https://playbooks.com/skills/robbyczgw-cla/web-search-plus/web-search-plus)
  Stronger as a search-router-first product; `web-search-pro 2.1` is broader as a retrieval stack.
  更像“搜索路由器”产品；`web-search-pro 2.1` 则更像完整检索系统。
- [Firecrawl Search](https://openclaw.army/skills/ashwingupy/firecrawl-search/)
  Stronger for managed JS-heavy scraping; `web-search-pro 2.1` is more local, explainable, and provider-diverse.
  更强于托管式 JS 重抓取；`web-search-pro 2.1` 更本地化、可解释、provider 更多样。
- [ddg-web-search](https://playbooks.com/skills/openclaw/skills/ddg-web-search)
  Lighter zero-key fallback; `web-search-pro 2.1` is intentionally heavier but much broader.
  更轻的零 key fallback；`web-search-pro 2.1` 故意更重，但能力面明显更宽。
- [web-search-free](https://playbooks.com/skills/openclaw/skills/web-search-free)
  Stronger when you specifically want Exa MCP workflows first; `web-search-pro 2.1` is stronger on local orchestration and review surfaces.
  如果你优先要 Exa MCP 工作流，它更合适；`web-search-pro 2.1` 更强于本地编排、自检和审查视图。

## ClawHub Compliance / ClawHub 合规

The compliance posture is:

- metadata declares only the real hard requirement: `node`
- provider credentials are optional
- disclosure happens through `capabilities.mjs`, `doctor.mjs`, `bootstrap.mjs`, and `review.mjs`
- no-key baseline behavior is explicit and bounded
- safe fetch and render boundaries are inspectable

当前合规策略是：

- metadata 只声明真实硬依赖：`node`
- provider 凭据是可选的
- 凭据和能力披露通过 `capabilities.mjs`、`doctor.mjs`、`bootstrap.mjs`、`review.mjs`
- no-key baseline 明确存在，但边界也明确
- safe fetch 与 render 边界可检查、可解释

Detailed notes / 详细说明：
- [docs/clawhub-compliance.md](/Users/codez/develop/web-search-pro/docs/clawhub-compliance.md)
- [docs/clawhub-package.md](/Users/codez/develop/web-search-pro/docs/clawhub-package.md)

## Safety / 安全边界

Safe fetch:

- allows only `http` / `https`
- blocks credential-bearing URLs
- blocks localhost / private / metadata targets
- revalidates redirects
- keeps JavaScript disabled

Safe fetch 安全边界：

- 仅允许 `http` / `https`
- 拒绝带凭据 URL
- 拒绝 localhost / 私网 / metadata 目标
- 重定向会再次校验
- 默认不执行 JavaScript

Browser render:

- off by default
- uses a local headless browser only when enabled
- revalidates navigations
- can enforce same-origin-only navigation

浏览器渲染通道：

- 默认关闭
- 仅在启用时使用本地 headless browser
- 导航会再次校验
- 可强制 same-origin-only

## Docs / 文档索引

- [CHANGELOG.md](/Users/codez/develop/web-search-pro/CHANGELOG.md)
- [docs/research-layer.md](/Users/codez/develop/web-search-pro/docs/research-layer.md)
- [docs/clawhub-compliance.md](/Users/codez/develop/web-search-pro/docs/clawhub-compliance.md)
- [docs/clawhub-package.md](/Users/codez/develop/web-search-pro/docs/clawhub-package.md)
- [docs/search-ux-model.md](/Users/codez/develop/web-search-pro/docs/search-ux-model.md)
- [docs/head-to-head-eval.md](/Users/codez/develop/web-search-pro/docs/head-to-head-eval.md)
- [docs/scrapling-absorption-plan.md](/Users/codez/develop/web-search-pro/docs/scrapling-absorption-plan.md)
- [docs/releases/v2.1.0.md](/Users/codez/develop/web-search-pro/docs/releases/v2.1.0.md)
- [docs/releases/v2.0.1.md](/Users/codez/develop/web-search-pro/docs/releases/v2.0.1.md)
- [docs/releases/v2.0.0.md](/Users/codez/develop/web-search-pro/docs/releases/v2.0.0.md)

## License

MIT
