# Scrapling Absorption Plan / Scrapling 吸收方案

## Audience / 受众

This document is for maintainers evaluating whether `Scrapling` ideas should be absorbed into
`web-search-pro`, and if so, which parts fit the product and compliance boundary.

## Goal / 目标

This document explains how `web-search-pro` should learn from `Scrapling` without breaking its
current architecture, OpenClaw posture, or ClawHub compliance story.  
这份文档说明 `web-search-pro` 应该如何吸收 `Scrapling`，同时不破坏现有架构、OpenClaw 使用
方式和 ClawHub 合规叙事。

The core conclusion is simple:

- borrow **extraction and crawling architecture**
- do **not** import Scrapling's full **anti-bot / stealth promise** into the main skill

核心结论很简单：

- 吸收的是 **提取和抓取架构**
- 不直接把 Scrapling 完整的 **反爬 / stealth 承诺** 并进主 skill

## What Scrapling Actually Is / Scrapling 本质上是什么

Based on the official library repo and the official bundled skill:

- [README.md](/Users/codez/develop/scrapling/README.md)
- [SKILL.md](/Users/codez/develop/scrapling/agent-skill/Scrapling-Skill/SKILL.md)
- [mcp-server.md](/Users/codez/develop/scrapling/agent-skill/Scrapling-Skill/references/mcp-server.md)

Scrapling is not a search framework. It is a scraping stack with:

- HTTP fetch
- browser-rendered fetch
- stealth browser fetch
- adaptive extraction
- concurrent spiders
- proxy/session/anti-bot tooling

Scrapling 不是搜索框架，而是一套抓取栈，重点在：

- HTTP 获取
- 浏览器渲染获取
- stealth 浏览器获取
- 自适应提取
- 并发 spider
- 代理 / session / 反爬能力

Its official skill explicitly advertises:

- anti-bot bypass
- Cloudflare handling
- stealth headless browsing
- spider crawling
- adaptive scraping

官方 skill 明确强调：

- anti-bot bypass
- Cloudflare 处理
- stealth headless browsing
- spider crawling
- adaptive scraping

That means its center of gravity is closer to:

- `extract`
- `render`
- `crawl`
- structured page acquisition

and much less about:

- multi-provider search
- federated retrieval
- review posture
- model-facing evidence-pack orchestration

也就是说，它更接近：

- `extract`
- `render`
- `crawl`
- 页面采集层

而不是：

- 多 provider 搜索
- federated retrieval
- 审查与合规视图
- 面向模型的 evidence pack 编排

## Why It Is Relevant / 为什么它值得吸收

`web-search-pro` has already become strong in search, routing, diagnostics, federation, and
research-pack structure. The remaining weakness is not "search intent understanding", but
"page acquisition quality".  
`web-search-pro` 现在在搜索、路由、自检、federation、research pack 结构上已经很强，剩下更
明显的短板不是“搜索意图理解”，而是“页面采集质量”。

The deeper root cause is:

- `search` is already product-grade
- `research` now cleans and structures evidence well enough
- but `extract / render / crawl` still decide the ceiling of evidence quality

更深层的根因是：

- `search` 已经是产品级
- `research` 也已经能把证据结构化
- 但 `extract / render / crawl` 仍然决定证据输入质量的上限

That is exactly where Scrapling is strong.

## Current Architecture vs Scrapling / 现有架构与 Scrapling 映射

### Search Layer / 搜索层

`web-search-pro`:

- [planner.mjs](/Users/codez/develop/web-search-pro/scripts/lib/planner.mjs)
- [federated-search.mjs](/Users/codez/develop/web-search-pro/scripts/lib/federated-search.mjs)
- [search.mjs](/Users/codez/develop/web-search-pro/scripts/search.mjs)

`selectedProvider` means the primary route.  
`federated.providersUsed` means the providers that actually returned results.  
`selectedProvider` 表示主路由。`federated.providersUsed` 表示真实返回结果的 provider。

Scrapling has no equivalent search layer.  
Scrapling 没有对应的搜索层。

Conclusion:

- no direct absorption here
- Scrapling is not a replacement for our search/federation architecture

结论：

- 这一层没有直接可替代关系
- Scrapling 不是我们搜索 / federation 架构的替代品

### Safe Fetch Layer / 安全获取层

`web-search-pro`:

- [web-fetch.mjs](/Users/codez/develop/web-search-pro/scripts/lib/web-fetch.mjs)

Current meaning:

- `fetchUrlSnapshot`
  fetches one URL safely, follows bounded redirects, validates remote targets, then extracts
  readable text and links
- `maxRedirects`
  controls redirect depth
- `maxChars`
  controls output size after extraction

当前变量语义：

- `fetchUrlSnapshot`
  安全抓单页，带有限重定向、远端目标校验，然后提取正文和链接
- `maxRedirects`
  控制重定向深度
- `maxChars`
  控制抽取后的输出大小

Scrapling equivalent:

- `get`
- `bulk_get`
- `Fetcher`
- `FetcherSession`

What Scrapling does better:

- richer request/session model
- stronger content narrowing through CSS selector first
- more flexible output forms

Scrapling 做得更强的点：

- 请求 / session 模型更丰富
- 更强调“先用 selector 缩窄内容，再交给模型”
- 输出形态更灵活

Recommended absorption:

- add a stronger "content narrowing first" path to our fetch/extract flow
- keep our current URL safety boundary intact
- do not import proxy or stealth semantics here

建议吸收：

- 给我们的 fetch/extract 增加更强的“内容先缩窄”能力
- 保留现有 URL 安全边界
- 不把代理和 stealth 语义带进这一层

### Browser Render Lane / 浏览器渲染通道

`web-search-pro`:

- [render-fetch.mjs](/Users/codez/develop/web-search-pro/scripts/lib/render-fetch.mjs)
- [render-runtime.mjs](/Users/codez/develop/web-search-pro/scripts/lib/render-runtime.mjs)
- [render-safety.mjs](/Users/codez/develop/web-search-pro/scripts/lib/render-safety.mjs)

Current meaning:

- `renderLane`
  runtime availability and policy summary for local browser rendering
- `render.policy`
  decides whether render is `off`, `fallback`, or `force`
- `sameOriginOnly`
  restricts main navigation scope for render/crawl paths

当前变量语义：

- `renderLane`
  本地浏览器渲染的运行时可用性和策略摘要
- `render.policy`
  控制 render 是 `off`、`fallback` 还是 `force`
- `sameOriginOnly`
  限制 render/crawl 路径里的主导航范围

Scrapling equivalent:

- `fetch`
- `bulk_fetch`
- `DynamicFetcher`
- `DynamicSession`

What Scrapling does better:

- browser fetch API is a first-class lane
- waiting and selector-based extraction are more explicit
- dynamic fetch and extraction are tightly integrated

Scrapling 做得更强的点：

- 浏览器 fetch 是一等能力
- wait / wait_selector / selector extraction 更显式
- 动态获取和正文提取耦合得更紧

Recommended absorption:

- add a stronger selector-aware render extraction path
- add "main content only" style narrowing before research evidence generation
- keep anti-bot challenge detection as a hard boundary

建议吸收：

- 给 render 增加更强的 selector-aware extraction
- 在 research evidence 生成前加入更强的 main-content narrowing
- 保留我们现有的 anti-bot challenge 显式失败边界

Do not absorb:

- `solve_cloudflare`
- stealth fingerprint spoofing
- browser-based anti-bot promises

不要吸收：

- `solve_cloudflare`
- stealth 指纹伪装
- 浏览器反爬突破承诺

### Crawl and Spider Layer / 站点抓取与 Spider 层

`web-search-pro`:

- [crawl-runner.mjs](/Users/codez/develop/web-search-pro/scripts/lib/crawl-runner.mjs)
- [map-runner.mjs](/Users/codez/develop/web-search-pro/scripts/lib/map-runner.mjs)

Current meaning:

- `depth`
  BFS depth limit
- `maxPages`
  upper bound for crawl size
- `sameOrigin`
  whether discovery must stay within entry origins
- `respectRobotsTxt`
  whether to apply robots rules

当前变量语义：

- `depth`
  BFS 深度上限
- `maxPages`
  crawl 页数上限
- `sameOrigin`
  发现链接是否必须留在入口 origin 内
- `respectRobotsTxt`
  是否应用 robots 规则

Scrapling equivalent:

- `Spider`
- `Request`
- `Response`
- session-based crawl routing

What Scrapling does better:

- spider is a first-class abstraction
- crawl persistence and pause/resume
- per-request session differentiation
- stronger blocked-request handling

Scrapling 做得更强的点：

- spider 是一等抽象
- crawl 持久化与 pause/resume
- 每个请求可选择不同 session 类型
- blocked request handling 更成熟

Recommended absorption:

- borrow spider-level concepts for docs/site crawling
- add better crawl state and page-type awareness
- keep our current safe-origin and safe-URL rules as non-negotiable

建议吸收：

- 借它的 spider 分层做 docs / site crawling
- 补更强的 crawl state 和 page-type awareness
- 继续把 safe-origin 和 safe-URL 规则当成不可谈判的硬边界

### Adaptive Extraction / 自适应提取层

`web-search-pro` today:

- [extract-flow.mjs](/Users/codez/develop/web-search-pro/scripts/lib/extract-flow.mjs)
- [document-quality.mjs](/Users/codez/develop/web-search-pro/scripts/lib/research/document-quality.mjs)
- [noise-filter.mjs](/Users/codez/develop/web-search-pro/scripts/lib/research/noise-filter.mjs)

Current meaning:

- `providersUsed`
  extract providers that actually produced content
- `documentQuality`
  quality of extracted page body
- `boilerplateRatio`
  ratio of page chrome / repeated template noise

当前变量语义：

- `providersUsed`
  真实产出内容的 extract provider
- `documentQuality`
  提取正文质量
- `boilerplateRatio`
  页面模板 / 导航噪音占比

Scrapling equivalent:

- adaptive parser
- selector relocation
- explicit CSS narrowing

What Scrapling does better:

- it treats extraction robustness as a core feature, not a post-process

Scrapling 的更强点：

- 它把 extraction robustness 当成核心能力，而不是事后修补

Recommended absorption:

- introduce optional selector-driven narrowing in extract/render
- add stronger page-part targeting for docs/article pages
- treat extraction robustness as a first-class concern in evidence quality

建议吸收：

- 在 extract/render 里引入可选 selector-driven narrowing
- 对 docs/article 页面增加更强的正文区 targeting
- 把 extraction robustness 提升成 evidence quality 的一等能力

## The Deeper Conflict / 更深层的冲突

The temptation is to say:

- Scrapling is stronger on scraping
- therefore we should merge Scrapling into `web-search-pro`

That is the wrong conclusion.  
最容易犯的错是：

- Scrapling 抓取更强
- 所以直接把 Scrapling 并进 `web-search-pro`

这个结论是错的。

The real conflict is architectural and operational:

1. `web-search-pro` currently presents a `node`-only hard requirement in metadata
2. its ClawHub posture relies on explicit, reviewable boundaries
3. Scrapling's official promise includes stealth, anti-bot bypass, and Python tooling
4. directly importing that posture would change the moderation surface, dependency story, and
   runtime assumptions

真正的冲突在架构和运行面：

1. `web-search-pro` 当前 metadata 的硬依赖只有 `node`
2. 现有 ClawHub 叙事依赖清晰、可审查的边界
3. Scrapling 官方承诺包含 stealth、反爬、Python 工具链
4. 直接并进会改变 moderation surface、依赖模型和运行时假设

So the deeper recommendation is:

- absorb its architecture
- isolate its dependency and anti-bot posture

更深的建议是：

- 吸收架构
- 隔离依赖和反爬语义

## What We Should Borrow / 我们应该借什么

### 1. Lane Escalation Model / 分级升级模型

Scrapling has a very clean escalation story:

- `get`
- `fetch`
- `stealthy_fetch`

This is useful because it separates:

- low-cost static fetch
- browser render
- high-risk stealth fetch

这套分级很值得借，因为它把：

- 低成本静态获取
- 浏览器渲染
- 高风险 stealth 获取

拆成了清楚的 lane。

For `web-search-pro`, the right adaptation is:

- `fetch`
- `render`
- optional future `scrapling-adapter`

在 `web-search-pro` 里的正确映射应该是：

- `fetch`
- `render`
- 未来可选的 `scrapling-adapter`

### 2. Selector-First Extraction / 先缩窄再提取

Scrapling consistently encourages narrowing content before handing it to the model.
This matches our recent research-quality work.

我们最近在 research 里做的证据降噪，和 Scrapling 的“先缩窄再提取”思路是同向的。

This should become a first-class capability in:

- `extract`
- `render`
- research evidence collection

这应该成为以下层的一等能力：

- `extract`
- `render`
- research evidence collection

### 3. Spider Concepts for Docs / docs 场景的 spider 思维

Scrapling's spider layer is overpowered for our main skill, but its architecture is useful for:

- docs trees
- product documentation sections
- knowledge-base style sites

Scrapling 的 spider 层对我们主 skill 来说偏重，但它的分层思想很适合：

- 文档树
- 产品文档区
- knowledge-base 类站点

This is especially relevant because our current `crawl/map` is safe and correct, but still simpler
than a structured docs spider.

## What We Should Not Borrow Into the Main Skill / 不应直接借进主 skill 的部分

Do not move these into the default `web-search-pro` promise:

- stealth fingerprint spoofing
- anti-bot bypass as a default feature
- Cloudflare-solving semantics
- proxy rotation
- Python as a new hard runtime dependency

这些都不应该进入 `web-search-pro` 的默认承诺：

- stealth 指纹伪装
- 默认反爬绕过
- Cloudflare 求解语义
- 代理轮换
- Python 作为新的硬依赖

Reason:

- they conflict with our current review posture
- they would force a metadata and operational story change
- they widen the moderation risk surface

原因是：

- 它们和当前 review / compliance 叙事冲突
- 会强迫我们重写 metadata 和运行时依赖模型
- 会扩大 moderation 风险面

## Integration Options / 接入方案选项

### Option A: Directly merge into the main skill / 直接并进主 skill

Pros:

- fastest access to Scrapling capabilities

Cons:

- breaks the current `node`-only story
- expands ClawHub review surface immediately
- mixes safe extraction with stealth extraction in one product identity

优点：

- 最快拿到 Scrapling 能力

缺点：

- 破坏当前 `node`-only 叙事
- 立刻扩大 ClawHub 审查面
- 把安全提取和 stealth 提取混进同一个产品身份里

Recommendation:

- **do not choose**

建议：

- **不要选**

### Option B: Optional adapter inside this repo / 在本仓库做可选 adapter

Pros:

- strongest code reuse
- can keep the main search stack unchanged
- can expose Scrapling as an explicit advanced lane

Cons:

- introduces cross-runtime complexity into the repo
- still risks documentation and compliance confusion if not carefully isolated

优点：

- 代码复用强
- 不必动主搜索栈
- 可以把 Scrapling 暴露成显式高级 lane

缺点：

- 会把跨运行时复杂度带进本仓库
- 如果边界不清楚，仍然会引发文档和合规混乱

Recommendation:

- **possible, but only after a stricter boundary doc and adapter contract**

建议：

- **可以做，但必须先有更严格的边界文档和 adapter 契约**

### Option C: Companion skill / 配套 companion skill

Pros:

- cleanest compliance boundary
- Python and stealth semantics stay isolated
- easier to explain to users and reviewers

Cons:

- product surface becomes broader
- users may need to install two skills for the full stack

优点：

- 合规边界最干净
- Python 和 stealth 语义被隔离
- 更容易向用户和审核解释

缺点：

- 产品面会更宽
- 用户如果想要完整栈，可能要装两个 skill

Recommendation:

- **best option if we want real Scrapling-powered runtime later**

建议：

- **如果后面真要引入 Scrapling 运行时，这是最好的方案**

## Recommended Path / 推荐路线

### Phase 0: Borrow concepts only / 只借架构思想

Do now:

- improve selector-first narrowing in `extract` and `render`
- improve docs-focused crawl behavior
- improve main-content targeting for research evidence

现在就该做：

- 强化 `extract` 和 `render` 的 selector-first narrowing
- 强化 docs-focused crawl 行为
- 强化 research evidence 的 main-content targeting

This phase requires no Scrapling runtime dependency.  
这一阶段不需要引入 Scrapling 运行时依赖。

### Phase 1: Define a strict adapter contract / 定义严格 adapter 契约

Add an explicit internal interface such as:

- `fetcherLane = fetch | render | external-adapter`
- `adapterCapabilities`
- `adapterRiskProfile`

可以定义内部接口，例如：

- `fetcherLane = fetch | render | external-adapter`
- `adapterCapabilities`
- `adapterRiskProfile`

Meaning:

- `fetcherLane`
  which acquisition lane produced the page
- `adapterCapabilities`
  what the external lane can do
- `adapterRiskProfile`
  whether the lane is safe, browser-based, or stealth-like

变量语义：

- `fetcherLane`
  页面由哪条采集 lane 产出
- `adapterCapabilities`
  外部 lane 能做什么
- `adapterRiskProfile`
  这条 lane 是安全型、浏览器型还是 stealth 型

This phase still does not need to expose Scrapling publicly.  
这一阶段仍然不需要对外暴露 Scrapling。

### Phase 2: Companion skill, not main-skill merge / 做 companion skill，而不是并进主 skill

If we later want real Scrapling runtime:

- build `web-search-pro-scrapling` or similar
- keep `web-search-pro` as the core retrieval stack
- let the companion skill provide advanced extraction/spider lanes

如果后面真要接 Scrapling 运行时：

- 做一个 `web-search-pro-scrapling` 或类似 companion skill
- `web-search-pro` 保持核心检索栈定位
- companion skill 提供高级提取 / spider lane

This preserves:

- ClawHub posture
- current metadata semantics
- product clarity

这样可以保住：

- ClawHub 叙事
- 当前 metadata 语义
- 产品边界清晰度

## Immediate Engineering Recommendation / 立即可执行的工程建议

The next work item should **not** be "integrate Scrapling runtime now".  
下一步不应该是“立刻接 Scrapling 运行时”。

The next work item should be:

1. add selector-first extraction support to `extract/render`
2. add docs/article-oriented page-part targeting
3. add page-type-aware crawl heuristics
4. document an adapter boundary for future external fetch lanes

更合理的下一步应该是：

1. 给 `extract/render` 增加 selector-first extraction 支持
2. 给 docs/article 页面增加更强的正文区 targeting
3. 给 crawl 增加 page-type-aware heuristics
4. 为未来外部 fetch lane 先定义 adapter 边界

That path absorbs the best part of Scrapling without importing its most controversial posture.

这条路线吸收了 Scrapling 最有价值的部分，同时避免把它最有争议的运行时姿态带进来。

## Final Recommendation / 最终建议

My recommendation is:

- do **not** merge Scrapling directly into the main skill
- **do** borrow its lane design, selector-first extraction, and spider concepts
- if we later need true Scrapling runtime, ship it as a **companion skill or isolated adapter**

我的最终建议是：

- **不要**把 Scrapling 直接并进主 skill
- **要**借它的 lane 设计、selector-first extraction 和 spider 思维
- 如果以后真要接 Scrapling 运行时，就做成 **companion skill 或隔离 adapter**
