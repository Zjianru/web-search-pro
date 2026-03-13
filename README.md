# Web Search Pro 2.0

`web-search-pro` is a retrieval stack for agents and upstream models.  
`web-search-pro` 是一个面向 Agent 和上层模型的检索基础设施。

It started as a `1.x` multi-provider search skill and evolved into a broader `2.0` product with
retrieval, federation, diagnostics, and research-pack generation.  
它起源于 `1.x` 的多引擎搜索 skill，`2.0` 开始进化为更完整的产品：检索、联邦搜索、
诊断、自审和 research evidence pack。

## Versioning / 版本说明

- Product / docs version: `2.0`
- JSON schema version: `1.0`

`2.0` is a major product rewrite, but machine-readable payloads remain additive and compatible.  
`2.0` 是产品层面的重大升级，但机器消费的 JSON 输出仍保持增量兼容，因此 schema 继续是 `1.0`。

## From 1.x to 2.0 / 从 1.x 到 2.0

| Dimension | `1.x` | `2.0` |
| --- | --- | --- |
| Product identity | Multi-engine search supplement | Retrieval stack for agents / 检索基础设施 |
| Baseline | Provider key usually required | No-key baseline via `ddg` + `fetch` |
| Surface | Mostly `search` + `extract` | `search`, `extract`, `render`, `crawl`, `map`, `research`, `doctor`, `review`, `eval` |
| Routing | Static auto-select rules | Capability matrix + config + health + federation |
| Site retrieval | Single-page extract | Extract + render + BFS crawl + map |
| Research | None | Structured `plan + evidence pack` |
| Review posture | Mostly documentation-level | Runtime diagnostics, review output, health visibility |

What `2.0` keeps from `1.x`: explicit flags, predictable CLI semantics, engine forcing, and
provider-aware query control.  
`2.0` 保留了 `1.x` 里已经做对的东西：显式参数控制、可预测的 CLI 语义、强制指定引擎、
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
| `capabilities.mjs` | Provider capability snapshot / Provider 能力快照 |
| `review.mjs` | Moderation / review summary / 审查与合规摘要 |
| `cache.mjs`, `health.mjs`, `eval.mjs` | Operations, health, and benchmark tooling / 运维、健康与评测工具 |

## Routing Model / 路由模型

Routing combines:

1. capability filtering
2. runtime policy from `config.json`
3. provider health
4. optional federated fanout

路由由四层共同决定：

1. 能力过滤
2. `config.json` 运行时策略
3. provider 健康状态
4. 可选的 federated fanout

Important semantics / 关键语义：

- `selectedProvider`
  Primary route, not the only data source.  
  主路由，不代表唯一数据来源。
- `federated.providersUsed`
  Providers that actually returned results.  
  真实参与并返回结果的 provider 集合。
- `renderLane`
  Browser-lane runtime availability and policy summary.  
  浏览器渲染通道的运行时可用性和策略摘要。
- `topicType`, `topicSignals`, `researchAxes`
  Research-pack planning summaries for upstream models.  
  给上层模型消费的 research 规划摘要。

## Baseline and Providers / Baseline 与增强 Provider

No API key is required for the baseline. Optional provider keys unlock enhanced features.  
基础能力不要求 API key。配置可选 provider key 后可解锁增强能力。

For direct local CLI usage, provider keys must already be present in the current shell environment or injected by OpenClaw.  
如果直接在本地终端运行 CLI，provider key 需要已经进入当前 shell 环境，或由 OpenClaw 注入。

```bash
TAVILY_API_KEY=tvly-xxxxx
EXA_API_KEY=exa-xxxxx
SERPER_API_KEY=xxxxx
SERPAPI_API_KEY=xxxxx
```

Provider roles / 各 provider 角色：

- Tavily: strongest premium default for deep search, news, extract
- Exa: semantic retrieval and extract fallback
- Serper: Google-like search, strong for news and locale
- SerpAPI: multi-engine routing including Baidu / Yandex
- DDG: best-effort no-key baseline search
- Fetch: no-key extract / crawl / map baseline
- Render: optional local browser lane

## Quick Start / 快速开始

```bash
# Search / 搜索
node scripts/search.mjs "OpenClaw web search"
node scripts/search.mjs "query" --deep --plan --json

# Extract / 提取
node scripts/extract.mjs "https://example.com/article" --json

# Crawl / Map / 抓取与站点结构
node scripts/crawl.mjs "https://example.com/docs" --depth 2 --max-pages 10 --json
node scripts/map.mjs "https://example.com/docs" --depth 2 --max-pages 50 --json

# Research pack / 研究证据包
node scripts/research.mjs "OpenClaw search skill landscape" --plan --json

# Review / 自检与审查
node scripts/doctor.mjs --json
node scripts/review.mjs --json
node scripts/eval.mjs run --suite research --json
```

Browser render is explicit and bounded: challenge / anti-bot interstitial pages are reported as failures, not silent successes.  
浏览器渲染是显式且受限的：遇到 challenge / anti-bot 中间页会明确报失败，不会伪装成成功。

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

`web-search-pro 2.0` is strong at:

- capability-aware retrieval
- safe extract / crawl / map
- explainable federation
- structured research packs
- local diagnostics and review surfaces

`web-search-pro 2.0` 擅长：

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
  Stronger as a search-router-first product; `web-search-pro 2.0` is broader as a retrieval stack.
  更像“搜索路由器”产品；`web-search-pro 2.0` 则更像完整检索系统。
- [Firecrawl Search](https://openclaw.army/skills/ashwingupy/firecrawl-search/)
  Stronger for managed JS-heavy scraping; `web-search-pro 2.0` is more local, explainable, and provider-diverse.
  更强于托管式 JS 重抓取；`web-search-pro 2.0` 更本地化、可解释、provider 更多样。
- [ddg-web-search](https://playbooks.com/skills/openclaw/skills/ddg-web-search)
  Lighter zero-key fallback; `web-search-pro 2.0` is intentionally heavier but much broader.
  更轻的零 key fallback；`web-search-pro 2.0` 故意更重，但能力面明显更宽。
- [web-search-free](https://playbooks.com/skills/openclaw/skills/web-search-free)
  Stronger when you specifically want Exa MCP workflows first; `web-search-pro 2.0` is stronger on local orchestration and review surfaces.
  如果你优先要 Exa MCP 工作流，它更合适；`web-search-pro 2.0` 更强于本地编排、自检和审查视图。

## ClawHub Compliance / ClawHub 合规

The compliance posture is:

- metadata declares only the real hard requirement: `node`
- provider credentials are optional
- disclosure happens through `capabilities.mjs`, `doctor.mjs`, and `review.mjs`
- no-key baseline behavior is explicit and bounded
- safe fetch and render boundaries are inspectable

当前合规策略是：

- metadata 只声明真实硬依赖：`node`
- provider 凭据是可选的
- 凭据和能力披露通过 `capabilities.mjs`、`doctor.mjs`、`review.mjs`
- no-key baseline 明确存在，但边界也明确
- safe fetch 与 render 边界可检查、可解释

Detailed notes / 详细说明：
- [docs/clawhub-compliance.md](/Users/codez/develop/web-search-pro/docs/clawhub-compliance.md)

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
- [docs/scrapling-absorption-plan.md](/Users/codez/develop/web-search-pro/docs/scrapling-absorption-plan.md)
- [docs/releases/v2.0.0.md](/Users/codez/develop/web-search-pro/docs/releases/v2.0.0.md)

## License

MIT
