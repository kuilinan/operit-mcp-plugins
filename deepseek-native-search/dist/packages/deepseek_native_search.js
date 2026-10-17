"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepseek_native_search = deepseek_native_search;
/* METADATA
{
  "name": "deepseek_native_search",
  "display_name": {
    "zh": "DeepSeek 原生搜索",
    "en": "DeepSeek Native Search",
    "default": "DeepSeek Native Search"
  },
  "description": {
    "zh": "调用 DeepSeek 官方独立搜索接口（POST https://api.deepseek.com/v1/tools/search），按次计费（5 元/千次），不消耗模型 Token，返回结构化来源列表（标题/摘要/URL/发布时间）。Key 由用户自行接入：优先读 Operit 环境变量 DEEPSEEK_API_KEY，其次读配置文件 /root/.deepseek_native_search_key（权限建议 600）。",
    "en": "Call DeepSeek official standalone Search API (POST https://api.deepseek.com/v1/tools/search), billed per call (5 CNY / 1000 calls), no model tokens consumed. Returns structured sources (title/snippet/URL/publishedAt). Bring your own key: environment variable DEEPSEEK_API_KEY first, then the config file /root/.deepseek_native_search_key (chmod 600 recommended).",
    "default": "Call DeepSeek official standalone Search API (POST https://api.deepseek.com/v1/tools/search), billed per call, no model tokens consumed. Returns structured sources. Requires DEEPSEEK_API_KEY (env var or /root/.deepseek_native_search_key)."
  },
  "enabled_by_default": true,
  "category": "Search",
  "tools": [
    {
      "name": "deepseek_native_search",
      "description": {
        "zh": "DeepSeek 官方独立联网搜索：调 https://api.deepseek.com/v1/tools/search，按次计费，返回可引用来源列表（url/title/snippet/publishedAt）。需要用户已接入 DEEPSEEK_API_KEY（Operit 环境变量或 /root/.deepseek_native_search_key）。注意：本接口不返回模型答案，因此无 answer 字段。",
        "en": "DeepSeek official standalone web search via https://api.deepseek.com/v1/tools/search, billed per call. Returns citable sources (url/title/snippet/publishedAt). Requires DEEPSEEK_API_KEY (Operit env var or /root/.deepseek_native_search_key). Note: no model-generated answer, hence no answer field.",
        "default": "DeepSeek official standalone web search. Returns citable sources. Requires DEEPSEEK_API_KEY."
      },
      "parameters": [
        {
          "name": "query",
          "description": { "zh": "搜索查询（自然语言/关键词，1-128 字符；支持 site:、-site:、引号短语）", "en": "Search query (natural language / keywords, 1-128 chars; supports site:, -site:, quoted phrases)" },
          "type": "string",
          "required": true
        },
        {
          "name": "maxResults",
          "description": { "zh": "返回来源数上限（默认 5，最大 50）", "en": "Max sources to return (default 5, max 50)" },
          "type": "string",
          "required": false
        },
        {
          "name": "timeoutMs",
          "description": { "zh": "请求超时毫秒（默认 30000）", "en": "Request timeout in ms (default 30000)" },
          "type": "string",
          "required": false
        }
      ]
    }
  ]
}
*/
// DeepSeek 独立搜索（Search API）：POST https://api.deepseek.com/v1/tools/search
// 文档：https://api-docs.deepseek.com/api/search
// 计费：按次（不消耗模型 Token），单请求上限 50 条结果。
// Key 接入（用户自行配置）：① Operit 环境变量 DEEPSEEK_API_KEY ② 配置文件 /root/.deepseek_native_search_key
const DEFAULT_ENDPOINT = "https://api.deepseek.com/v1/tools/search";
const KEY_FILE = "/root/.deepseek_native_search_key";
const DEFAULT_COUNT = 5;
const MAX_COUNT = 50;
let cachedSessionId = "";
async function getSession() {
    if (cachedSessionId)
        return cachedSessionId;
    const session = await Tools.System.terminal.create("deepseek_native_search_session");
    cachedSessionId = typeof session === "string" ? session : String(session?.sessionId || session);
    return cachedSessionId;
}
async function execInTerminal(command, timeoutMs) {
    const sessionId = await getSession();
    return Tools.System.terminal.exec(sessionId, command, timeoutMs);
}
async function readLinuxFile(linuxPath, fallback) {
    try {
        const r = await Tools.Files.read({ path: linuxPath, environment: "linux" });
        const content = typeof r === "string" ? r
            : (r && typeof r === "object" ? (r.content ?? r.text ?? JSON.stringify(r)) : String(r ?? ""));
        return String(content ?? "");
    }
    catch (e) {
        return fallback || "";
    }
}
/** 解析用户接入的 API Key：环境变量优先，配置文件兜底；都没有则明确报错（不伪造）。 */
async function resolveApiKey() {
    try {
        const envR = await execInTerminal("printf '%s' \"${DEEPSEEK_API_KEY:-}\"", 10000);
        const envKey = (envR?.output || "").trim();
        if (envKey)
            return envKey;
    }
    catch (e) { /* 继续尝试配置文件 */ }
    const fileKey = (await readLinuxFile(KEY_FILE, "")).trim();
    if (fileKey)
        return fileKey;
    throw new Error("未配置 DeepSeek API Key（DEEPSEEK_API_KEY）。接入方式（任选其一）：\n" +
        "1) Operit 环境变量：设置 DEEPSEEK_API_KEY=<你的 DeepSeek 官方 API Key>（可用 operit_editor 的 write_environment_variable 写入）；\n" +
        "2) 配置文件：把 Key 写入 /root/.deepseek_native_search_key（建议 chmod 600）。\n" +
        "Key 请到 https://platform.deepseek.com 获取（官方 API Key，sk- 开头）。");
}
/** 把 Search API 的 date 字段规范为 ISO 字符串；无法识别的返回 undefined。 */
function normalizeDate(v) {
    if (!v)
        return undefined;
    try {
        const d = new Date(String(v));
        if (isNaN(d.getTime()))
            return undefined;
        return d.toISOString();
    }
    catch (e) {
        return undefined;
    }
}
async function deepseek_native_search(params) {
    const query = String(params?.query || "").trim();
    if (!query)
        throw new Error("query 不能为空");
    if (query.length > 128)
        throw new Error("query 超长：官方限制 1-128 字符，当前 " + query.length + " 字符");
    const rawCount = parseInt(params?.maxResults || "", 10);
    const count = Math.max(1, Math.min(MAX_COUNT, isNaN(rawCount) ? DEFAULT_COUNT : rawCount));
    const timeoutMs = Math.max(5000, parseInt(params?.timeoutMs || "", 10) || 30000);
    const apiKey = await resolveApiKey();
    const body = { query, count };
    const tmp = "/tmp/dnsr_body_" + Date.now().toString(36) + "_" + Math.floor(Math.random() * 1e9).toString(36) + ".json";
    const respFile = tmp + ".resp.json";
    try {
        await Tools.Files.write(tmp, JSON.stringify(body), false, "linux");
        // 响应写文件再完整读取（终端 stdout 会截断导致 JSON 解析失败）
        const cmd = "curl -sS -m " + Math.ceil(timeoutMs / 1000) + " -X POST " + DEFAULT_ENDPOINT +
            " -H 'Content-Type: application/json'" +
            " -H 'Authorization: Bearer " + apiKey + "'" +
            " -H 'Accept: application/json'" +
            " --data-binary @" + tmp + " -o " + respFile;
        await execInTerminal(cmd, timeoutMs + 10000);
        const out = (await readLinuxFile(respFile, "")).trim();
        if (!out)
            throw new Error("DeepSeek 搜索接口无响应（HTTP 层失败，请检查网络/Key）");
        let parsed;
        try {
            parsed = JSON.parse(out);
        }
        catch (e) {
            throw new Error("DeepSeek 搜索接口返回异常（非 JSON）：" + out.slice(0, 400));
        }
        if (parsed && parsed.error) {
            const msg = typeof parsed.error === "string" ? parsed.error
                : (parsed.error?.message ?? JSON.stringify(parsed.error));
            const code = parsed.error?.code ? " [code=" + parsed.error.code + "]" : "";
            throw new Error("DeepSeek Search API 错误：" + msg + code);
        }
        if (!Array.isArray(parsed?.results)) {
            throw new Error("DeepSeek Search API 返回结构异常（缺少 results 数组）：" + out.slice(0, 400));
        }
        const seen = new Set();
        const sources = [];
        for (const item of parsed.results) {
            if (!item || typeof item !== "object" || !item.url || seen.has(item.url))
                continue;
            seen.add(item.url);
            const snippet = typeof item.snippet === "string" && item.snippet ? item.snippet
                : (typeof item.summary === "string" && item.summary ? item.summary : undefined);
            const pub = normalizeDate(item.date);
            const src = { url: String(item.url) };
            if (item.title)
                src.title = String(item.title);
            if (snippet)
                src.snippet = snippet;
            if (pub)
                src.publishedAt = pub;
            // 附加元信息（向后兼容：老调用方只用上面的四个键）
            if (typeof item.authority === "number")
                src.authority = item.authority;
            if (typeof item.rerank_score === "number")
                src.rerankScore = item.rerank_score;
            if (item.site_name)
                src.siteName = String(item.site_name);
            sources.push(src);
        }
        return {
            query,
            endpoint: DEFAULT_ENDPOINT,
            model: null,
            sources,
            count: sources.length,
        };
    }
    finally {
        try {
            await execInTerminal("rm -f " + tmp + " " + respFile, 5000);
        }
        catch (e) { /* 清理失败忽略 */ }
    }
}