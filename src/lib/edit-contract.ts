/**
 * ============================================================
 * 「凭密码编辑文章」前后端共享契约（单一事实源）
 * ------------------------------------------------------------
 * 安全设计三前提（对应威胁模型）：
 *  1. Fail-closed —— 任何控制失效（DB 异常、哈希缺失、配置错误）
 *     一律默认拒绝，绝不放行。
 *  2. 最小权限 —— 密码只换取「编辑这一篇」的短时效令牌，
 *     不附带任何其他权限（无删除、无发布、无上传、无站点设置）。
 *  3. 不信任客户端标识符 —— 每次保存请求服务端都独立做对象级
 *     授权：令牌有效 + 未消费 + 未吊销 + 未过期 + 未空闲超时 +
 *     令牌绑定的 slug === 目标 slug + 作用域 === "edit" + CSRF 匹配。
 *
 * 本文件被客户端与服务端共同 import，不得引入任何运行时副作用。
 */

// ---------- Cookie / Header 约定 ----------

export const EDIT_COOKIE = "ddr_edit"; // 编辑令牌 Cookie（HttpOnly, SameSite=Lax, Path=/）
export const CSRF_HEADER = "x-csrf-token"; // 双重提交 CSRF 校验头（值在解锁响应体中下发）

// ---------- 时效策略 ----------

export const EDIT_TOKEN_TTL_SEC = 30 * 60; // 绝对 TTL：30 分钟
export const EDIT_IDLE_SEC = 15 * 60; // 空闲超时：15 分钟无操作即失效

// （口令策略见 src/lib/security/password.ts：12–128 位、禁控制字符；
//   站点不提供改密 / 找回入口，口令由站长在服务端固定设置）

// ---------- 内容块模型（结构化纯文本，非 HTML）----------
// 输出走 React 文本节点自动转义，天然免疫存储型 XSS；
// 服务端另有 zod 白名单校验（类型枚举 + 长度上限 + 控制字符剥离）。

export const BLOCK_TYPES = ["p", "h2", "quote"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];
export type EditBlock = { type: BlockType; text: string };

export const MAX_TITLE_LEN = 80;
export const MAX_EXCERPT_LEN = 300;
export const MAX_BLOCKS = 100;
export const MAX_BLOCK_LEN = 5000;

// ---------- 响应类型 ----------

/** 合并了数据库编辑覆盖层的文章（editedAt 存在即表示已被编辑过） */
export type LivePost = {
  slug: string;
  title: string;
  category: string;
  date: string;
  accent: string;
  excerpt: string;
  minutes: number;
  blocks: EditBlock[];
  editedAt?: string; // ISO 时间串
};

/**
 * 统一错误码。客户端文案一律不区分
 * 「文章不存在 / 密码错误 / 令牌过期 / 会话失效」—— 防枚举。
 */
export type EditApiError =
  | "unlock_failed" // 无法解锁（密码不对、文章不存在、未配置密码…一律同文案）
  | "slow_down" // 触发限速（按 IP 与按文章双维度）
  | "session_invalid" // 编辑会话失效（令牌无效/过期/越权/CSRF 失败…一律同文案）
  | "bad_request" // 请求体校验失败（仅保存场景附带安全提示语）
  | "server_error"; // 服务端异常（fail-closed 的兜底拒绝）

export const ERROR_MESSAGES: Record<EditApiError, string> = {
  unlock_failed: "无法解锁这篇文章，请检查密码后再试",
  slow_down: "尝试太频繁了，请休息一下再回来",
  session_invalid: "编辑会话已失效，请重新输入密码",
  bad_request: "内容格式有问题，请检查后再保存",
  server_error: "服务器开小差了，请稍后再试",
};

export type UnlockResponse =
  | { ok: true; csrf: string; expiresAt: string }
  | { ok: false; error: EditApiError };

export type SaveResponse =
  | { ok: true; csrf: string; expiresAt: string; post: LivePost }
  | { ok: false; error: EditApiError; message?: string };

export type PostsResponse =
  | { ok: true; posts: LivePost[]; featured: LivePost }
  | { ok: false; error: EditApiError };

// ---------- 客户端请求小助手（统一 JSON content-type + CSRF 头）----------

export async function editFetch(
  path: string,
  opts: { method?: "POST" | "GET"; body?: unknown; csrf?: string } = {}
): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.csrf) headers[CSRF_HEADER] = opts.csrf;
  return fetch(path, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
    credentials: "same-origin",
  });
}
