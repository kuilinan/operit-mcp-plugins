# DeepSeek 原生搜索（DeepSeek Native Search）

> ⚠️ **本 0.2.0 版本由社区开发者重构**，将底层调用切换为官方最新独立搜索接口，特此致谢原作者。
> ✉️ 联系方式：kuilinan@qq.com

调用 **DeepSeek 官方全新独立搜索接口**（`POST /v1/tools/search`），返回结构化来源列表（标题 / 短摘要 / 长摘要 / URL / 发布日期 / 站点名 / 权威度分级）。

**本包不进行任何模型推理**：一次调用 = 一次搜索请求，**按次计费，不消耗模型 Token**，也没有「答案摘要」字段。

> **计费说明**：本插件调用 DeepSeek 独立搜索 API，按次计费；价格与计费规则以 DeepSeek 官方文档为准。未经授权的失败请求不产生功能返回。

## 接入 Key（用户自己接）

任选其一：

1. **Operit 环境变量（优先）**：设置 `DEEPSEEK_API_KEY=<你的 DeepSeek 官方 API Key>`（`sk-` 开头；可在 Operit 设置中配置，或用 operit_editor 的 `write_environment_variable` 写入）。
2. **配置文件**：把 Key 写入 `/root/.deepseek_native_search_key`（建议 `chmod 600`）。

Key 获取：<https://platform.deepseek.com>。未配置时工具会返回明确错误与接入指引，**不会伪造结果**。

## 工具

### `deepseek_native_search(query, maxResults?, timeoutMs?)`

| 参数 | 必填 | 说明 |
|---|---|---|
| `query` | ✅ | 搜索查询（1–128 字符；支持 `site:`、`-site:`、引号短语） |
| `maxResults` | — | 返回来源数上限（默认 5，范围 1–50） |
| `timeoutMs` | — | 请求超时毫秒（默认 30000，最少 5000） |

**返回结构**

```
{
  query,
  endpoint,
  model: null,          // 本站接口不调用模型，固定为 null
  sources: [
    {
      url,              // 必返回
      title?,           // 有则给
      snippet?,         // 短摘要；缺失时自动回退到 summary
      publishedAt?,     // ISO 8601；源无 date 或日期非法时不出现
      authority?,       // 权威等级 0–4（-1 表示未知），≥3 为高权威
      rerankScore?,     // 相关度得分（0–3）
      siteName?         // 站点名
    }
  ],
  count
}
```

- `snippet` 优先取官方 `snippet`（通常 100–200 字），为空时回退到 `summary`（通常 600–800 字）。
- 结果已按 URL 去重，`count` 为去重后的实际条数。
- **无 `answer` 字段**：独立搜索接口不生成模型答案。

## 示例

```
deepseek_native_search(query="DeepSeek model docs", maxResults=5)
```

## 说明

- 官方端点：`https://api.deepseek.com/v1/tools/search`
- 请求方法：`POST`，`Content-Type: application/json`，鉴权头 `Authorization: Bearer <KEY>`
- 请求体：`{ query, count }`（`count` 由此前 `maxResults` 映射而来）
- 本包为纯 HTTP + JSON 解析，**零运行时依赖**
- 本包**不读取** DSH 的凭据文件（`.credentials.yaml`），Key 完全由用户自行接入本包通道

## License

本重构版本采用 **MIT License** 发布。原作者署名保留为 `芸`。

---

# DeepSeek Native Search

> ⚠️ **Version 0.2.0 is a community refactor**: the backend was switched to DeepSeek's official standalone Search API. Special thanks to the original author.
> ✉️ Contact: kuilinan@qq.com

Call DeepSeek's official standalone Search API (`POST /v1/tools/search`) and get structured sources (title / snippet / summary / URL / publish date / site name / authority tier).

This package performs **no model inference**, so one call equals one search request: **billed per call, no model tokens consumed**, and there is no "answer" field.

> **Billing**: this plugin calls DeepSeek's standalone Search API, billed per call. Prices and billing rules are governed by the official DeepSeek documentation.

## Bring Your Own Key

Pick one:

1. **Operit environment variable (preferred)**: set `DEEPSEEK_API_KEY=<your DeepSeek official API key>` (starts with `sk-`; configure in Operit settings or via operit_editor `write_environment_variable`).
2. **Config file**: write the key to `/root/.deepseek_native_search_key` (`chmod 600` recommended).

Get a key at <https://platform.deepseek.com>. Without a key the tool returns a clear error with setup instructions — it never fabricates results.

## Tool

### `deepseek_native_search(query, maxResults?, timeoutMs?)`

| Param | Required | Description |
|---|---|---|
| `query` | ✅ | Search query (1–128 chars; supports `site:`, `-site:`, quoted phrases) |
| `maxResults` | — | Max sources to return (default 5, range 1–50) |
| `timeoutMs` | — | Request timeout in ms (default 30000, min 5000) |

**Returns**

`sources` is a list of `{ url, title?, snippet?, publishedAt?, authority?, rerankScore?, siteName? }`:

- `snippet` falls back to the official `summary` when empty.
- Duplicated URLs are de-duplicated; `count` is the real number of returned sources.
- **No `answer` field**: the standalone Search API does not generate a model answer.

## Notes

- Official endpoint: `https://api.deepseek.com/v1/tools/search`
- Method: `POST`, `Content-Type: application/json`, auth header `Authorization: Bearer <KEY>`
- Request body: `{ query, count }` (`count` maps from `maxResults`)
- Pure HTTP + JSON parsing, no runtime dependencies
- This package **never reads** DSH's credential file (`.credentials.yaml`)

## License

This refactored version is released under the **MIT License**. Original authorship (`芸`) is preserved.

---

<sub>计费提示：本接口按次计费。官方针对特定生态客户端（如 Claude Code 等）有免费窗口期，裸 API 调用不享受此政策。具体价格与规则以 DeepSeek 官方文档为准。</sub>
