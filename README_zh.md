[English](README.md) | [中文](README_zh.md)

# Web Search Pro

`web-search-pro` 是一个给 Agent 使用的 OpenClaw 搜索技能和本地 Node 检索运行时。它不只做
网页搜索，还能继续提取页面、抓取站点、发现站点结构，并整理出适合上游模型继续消费的
research-ready evidence pack。

- ClawHub：[web-search-pro](https://clawhub.ai/Zjianru/web-search-pro)
- GitHub：[Zjianru/web-search-pro](https://github.com/Zjianru/web-search-pro)
- OpenClaw 归档：[openclaw/skills/tree/main/skills/zjianru/web-search-pro](https://github.com/openclaw/skills/tree/main/skills/zjianru/web-search-pro)

## 这是什么

这个项目介于“轻量搜索 skill”和“完整托管抓取产品”之间。

最简单的理解方式是：

- 一个给 Agent 用的搜索 skill
- 一个本地检索运行时
- 一条从 `search` 延伸到 `extract`、`crawl`、`map`、`research` 的能力链

如果你的任务里，搜索不是终点，而只是证据收集的开始，那它就是为这类场景设计的。

## 适合什么场景

如果你需要下面这些能力，适合选 `web-search-pro`：

- 实时网页搜索和时效信息查询
- 带可解释路由的新闻搜索
- 官方文档、API 文档、代码检索
- 公司、产品、竞品研究
- 站点抓取、站点结构发现、文档发现
- 先跑零 key baseline，再按需补 premium provider
- 输出给上游模型继续消费的结构化结果

一句话说：它适合那些希望一个 skill 覆盖搜索、检索和证据整理链路的开发者。

## 不适合什么场景

如果你主要想要的是下面这些东西，那 `web-search-pro` 可能不是最佳选择：

- 最轻量、最单一的一次性 web search wrapper
- 托管式远程抓取 SaaS
- 默认以浏览器为主的 crawler
- 隐藏检索细节、直接输出最终文案的报告写手
- 无上限、强保证的零 key 搜索能力

如果你只想做最轻量的一次性搜索，通常更小的 skill 会更合适。

## 为什么开发者会选它

和普通搜索 skill 相比，`web-search-pro` 的核心差异在这里：

- **可解释路由**
  `routingSummary` 会告诉你为什么选这个 provider、路由置信度如何、关键命中信号是什么。
- **联邦搜索增益可见**
  `federated.value` 会直接告诉你多 provider fanout 实际补回了什么、佐证了什么、去掉了多少重复。
- **从搜索延伸到研究**
  同一个 surface 可以从 `search` 继续走到 `extract`、`crawl`、`map`、`research`。
- **零 key baseline**
  不需要先配一堆 provider key 才能评估这个 skill。
- **面向 Agent 的诊断**
  `doctor.mjs`、`bootstrap.mjs`、`capabilities.mjs`、`review.mjs` 会把运行时状态和边界显式暴露出来。

## 快速开始

这个项目有两种都真实、都合理的使用方式：

- **作为 skill 安装并使用**
  如果你要在 OpenClaw 里使用它，直接从 ClawHub 页面或 OpenClaw archive 入口开始。
- **从源码直接运行**
  如果你要本地评估运行时、观察输出、或者参与开发，直接运行下面的命令。

最短成功路径是：

- 先跑通零 key baseline
- 只有当你需要更强召回或更强时效时，再加一个 premium provider
- 然后继续尝试 docs、news 和 research 流程

### 方案 A：零 key 基线

第一条成功路径不需要 API key。

baseline 的角色分工是：

- `ddg`：best-effort 网页搜索
- `fetch`：extract、crawl、map 的零 key fallback

```bash
node scripts/doctor.mjs --json
node scripts/bootstrap.mjs --json
node scripts/search.mjs "OpenAI Responses API docs" --json
```

这几个命令的意义：

- `doctor.mjs`：当前运行时到底能不能用
- `bootstrap.mjs`：给 Agent 的运行时快照
- `search.mjs`：先证明 baseline 检索路径能跑通，再考虑补 provider

### 方案 B：增加一个 premium provider

如果你只想先加一个 premium provider，优先从 `TAVILY_API_KEY` 开始。

原因是它是一条最短升级路径，一组凭据就能增强：

- 一般网页搜索
- 新闻搜索
- extract 质量

```bash
export TAVILY_API_KEY=tvly-xxxxx
node scripts/doctor.mjs --json
node scripts/search.mjs "latest OpenAI news" --type news --json
```

### 第一批成功命令

```bash
node scripts/search.mjs "OpenClaw web search" --json
node scripts/search.mjs "OpenAI Responses API docs" --preset docs --plan --json
node scripts/extract.mjs "https://platform.openai.com/docs" --json
```

### 然后继续尝试 docs、news 和 research

```bash
node scripts/search.mjs "OpenAI Responses API docs" --preset docs --json
node scripts/search.mjs "latest OpenAI news" --type news --json
node scripts/research.mjs "OpenClaw search skill landscape" --plan --json
```

## 核心命令

| 命令 | 作用 |
| --- | --- |
| `search.mjs` | 多 provider 搜索与可解释路由 |
| `extract.mjs` | 单页正文提取 |
| `render.mjs` | 通过本地 render lane 强制浏览器渲染提取 |
| `crawl.mjs` | 安全 BFS 抓取 |
| `map.mjs` | 站点结构发现 |
| `research.mjs` | 结构化 `plan + evidence pack` 生成 |
| `doctor.mjs` | 运行时诊断 |
| `bootstrap.mjs` | 给 Agent 的运行时 bootstrap contract |
| `capabilities.mjs` | Provider 能力快照 |
| `review.mjs` | 审查与 moderation 摘要 |
| `cache.mjs` | 缓存检查 |
| `health.mjs` | Provider 健康检查 |
| `eval.mjs` | 检索与评测工具 |

## 联邦搜索为什么有价值

联邦搜索不只是“多跑几个 provider”，而是把多 provider 带来的真实增益变成紧凑、可机器消费的指标。

关键字段：

- `federated.providersUsed`
  真正返回结果的 provider 集合
- `federated.value.additionalProvidersUsed`
  真正贡献结果的非主 provider 数量
- `federated.value.resultsRecoveredByFanout`
  如果只跑主 provider 就会消失的最终结果数量
- `federated.value.resultsCorroboratedByFanout`
  同时得到主 provider 和至少一个 fanout provider 支持的最终结果数量
- `federated.value.duplicateSavings`
  merge 过程中去掉的精确或近似重复结果数量
- `routingSummary.federation.value`
  与路由解释一起输出的紧凑联邦增益摘要

示例：

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

怎么理解：

- `resultsRecoveredByFanout=1`：联邦搜索补回了一个主 provider 模式下拿不到的最终结果
- `resultsCorroboratedByFanout=1`：另一个最终结果得到了多 provider 支持
- `duplicateSavings=1`：merge 去掉了一个重复结果，没有浪费结果位

## 路由与输出契约

路由由五层事实共同决定：

1. provider 能力事实
2. 结构化 query signals
3. `config.json` 里的运行时策略
4. 本地 health 状态
5. 可选 federation

关键字段：

- `selectedProvider`
  主路由，不等于“唯一用到的 provider”
- `routingSummary`
  紧凑路由解释，包含 `selectionMode`、`confidence`、`topSignals`、替代候选和 federation 上下文
- `routing.diagnostics`
  `--explain-routing` 或 `--plan` 下暴露的完整路由诊断
- `federated.providersUsed`
  fanout 激活时，真实返回结果的 provider 集合
- `federated.value`
  紧凑联邦增益摘要：额外 provider、补回结果、佐证结果、去重收益
- `cached` / `cache`
  面向 Agent 的缓存命中和 age / TTL 遥测
- `renderLane`
  浏览器渲染通道的运行时可用性和策略摘要
- `meta.searchType`
  用户层结果面声明，当前 shipped 值为 `web | news`
- `meta.intentPreset`
  用户层任务 preset，当前 shipped 值为
  `general | code | company | docs | research`

这些都是产品层输入，不是 provider id。

## Provider 与升级路径

baseline 不要求 API key。可选 provider 凭据或 endpoint 会解锁更强覆盖：

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
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
KILOCODE_API_KEY=xxxxx

# Or use a custom OpenAI-compatible gateway
PERPLEXITY_GATEWAY_API_KEY=xxxxx
PERPLEXITY_BASE_URL=https://gateway.example.com/v1
PERPLEXITY_MODEL=perplexity/sonar-pro
```

各 provider 的角色：

- Tavily：一般搜索、新闻、extract 的最强 premium 默认选择
- Exa：语义检索和 extract fallback
- Querit：带原生 geo / language filters 的多语言 AI 搜索
- Serper：偏 Google-like，新闻和 locale 表现强
- Brave：结构化一般网页搜索
- SerpAPI：多引擎路由，包括 Baidu / Yandex
- You.com：适合 freshness 和混合 web/news 的 LLM-ready 搜索
- SearXNG：自建、隐私优先的 metasearch fallback
- Perplexity / Sonar：native 或 gateway 形态的 answer-first grounded search
- DDG：best-effort 零 key baseline 搜索
- Fetch：零 key extract / crawl / map baseline
- Render：可选本地浏览器通道

## 分发面

这个项目有两个都真实、但职责不同的分发面：

- **GitHub / 本地源码树**
  完整能力面，包含 `render.mjs`、`eval.mjs`、测试和更深的 research 工具链
- **ClawHub 发布包**
  由 `scripts/build-clawhub-package.mjs` 生成的 core profile

为什么要这样拆：

- 本地开发者需要完整运行时和 benchmark surface
- ClawHub moderation 更适合更窄、更诚实的发布边界
- registry 上的包仍然是 code-backed Node runtime，不是 instruction-only bundle

详细说明：

- [docs/clawhub-package.md](/Users/codez/develop/web-search-pro/docs/clawhub-package.md)
- [docs/clawhub-compliance.md](/Users/codez/develop/web-search-pro/docs/clawhub-compliance.md)

## 能力边界

`web-search-pro` 擅长：

- capability-aware retrieval
- explainable routing
- safe extract / crawl / map
- structured research packs
- 本地诊断与 review surfaces

它有意不是：

- 托管式远程抓取服务
- 最终报告写作器
- 默认浏览器优先的 crawler
- 无上限、强保证的零 key 搜索服务

## 和别的技能差在哪

- **相比轻量 `web-search` 技能**
  `web-search-pro` 更重，但能给你 explainable routing、联邦搜索增益可见，以及延伸到
  `extract`、`crawl`、`map`、`research` 的完整链路。
- **相比 `web-search-plus` 这类 search-router-first skill**
  `web-search-pro` 更像完整检索栈，差异不只是“在哪搜”，而是“搜完之后还能继续做什么”。
- **相比托管 scrape-first 产品**
  `web-search-pro` 更 local-first、更可检查，也更明确地暴露安全边界和运行时行为。

## 安全边界

Safe fetch：

- 仅允许 `http` / `https`
- 拒绝带凭据 URL
- 拒绝 localhost、私网和 metadata 目标
- 重定向会重新校验
- 默认不执行 JavaScript

Browser render：

- 默认关闭
- 仅在启用时使用本地 headless browser
- 导航会再次校验
- 可强制 same-origin-only

challenge 和 anti-bot 中间页会被明确报告为失败，不会伪装成成功。

## 检索关键词

`web search`, `news search`, `latest updates`, `current events`, `docs search`, `API docs`,
`code search`, `company research`, `competitor analysis`, `site crawl`, `site map`,
`multilingual search`, `Baidu search`, `Google-like search`, `answer-first search`,
`cited answers`, `explainable routing`, `no-key baseline`

## 版本说明

- Product / docs version: `2.1`
- JSON schema version: `1.0`

`2.x` 是 retrieval-stack 产品线。机器消费的 payload 仍保持增量兼容，因此 schema 保持
`1.0`。

## 文档索引

- [README.md](/Users/codez/develop/web-search-pro/README.md)
- [CHANGELOG.md](/Users/codez/develop/web-search-pro/CHANGELOG.md)
- [docs/search-routing-model.md](/Users/codez/develop/web-search-pro/docs/search-routing-model.md)
- [docs/search-ux-model.md](/Users/codez/develop/web-search-pro/docs/search-ux-model.md)
- [docs/research-layer.md](/Users/codez/develop/web-search-pro/docs/research-layer.md)
- [docs/head-to-head-eval.md](/Users/codez/develop/web-search-pro/docs/head-to-head-eval.md)
- [docs/clawhub-package.md](/Users/codez/develop/web-search-pro/docs/clawhub-package.md)
- [docs/clawhub-compliance.md](/Users/codez/develop/web-search-pro/docs/clawhub-compliance.md)
- [docs/marketing-launch-kit.md](/Users/codez/develop/web-search-pro/docs/marketing-launch-kit.md)
- [docs/agent-contract-p0.md](/Users/codez/develop/web-search-pro/docs/agent-contract-p0.md)

## License

MIT
