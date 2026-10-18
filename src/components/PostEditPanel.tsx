"use client";

/**
 * ============================================================
 * 凭密码编辑文章 —— 触发按钮 + 全流程对话框
 * ------------------------------------------------------------
 * 阶段机：closed → password → editing
 *  · password ：输入编辑密码，换取这篇文章 30 分钟编辑会话
 *               （错误文案一律统一，防枚举）
 *  · editing  ：标题 / 摘要 / 阅读分钟 / 内容块的结构化编辑，
 *               保存 / 恢复原文 / 锁定会话
 *
 * 编辑口令由站长在服务端固定设置（站点不提供改密 / 找回入口）。
 * 会话缓存放模块级：同页重开免再输密码；换文章或失效即作废；
 * 组件卸载不清空（跨文章按 slug 校验复用）。
 * 对话框经 portal 渲染到 document.body —— 规避玻璃主题
 * .post-layout 的 backdrop-filter 对 fixed 后代形成的包含块。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronUp,
  KeyRound,
  Loader2,
  Plus,
  SquarePen,
  Trash2,
  X,
} from "lucide-react";
import {
  editFetch,
  ERROR_MESSAGES,
  MAX_BLOCK_LEN,
  MAX_BLOCKS,
  MAX_EXCERPT_LEN,
  MAX_TITLE_LEN,
  type BlockType,
  type EditBlock,
  type LivePost,
  type SaveResponse,
  type UnlockResponse,
} from "@/lib/edit-contract";
import { getPost } from "@/lib/posts";
import { refreshPosts, usePostsStore } from "@/lib/posts-store";

type Stage = "closed" | "password" | "editing";
type Notice = { kind: "ok" | "err"; text: string };

/** 模块级会话缓存（cookie 令牌在服务端，这里只记 csrf / 到期时刻） */
let sessionCache: { slug: string; csrf: string; expiresAt: number } | null = null;

function mmss(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 侧栏 / hint 用的 MM.DD 短日期（本地时区） */
function formatMMDD(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// ------------------------------------------------------------
// 内容块卡片：类型切换 + 上移/下移/删除 + 自适应高度 textarea
// ------------------------------------------------------------
function EditBlockCard({
  index,
  block,
  canMoveUp,
  canMoveDown,
  canDelete,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  block: EditBlock;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
  onChange: (index: number, patch: Partial<EditBlock>) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (index: number) => void;
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // 自适应高度：挂载时 + 块文本/类型变化后重算（纯 DOM 操作，无 setState）
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(72, el.scrollHeight + 2)}px`;
  }, [block.text, block.type]);

  return (
    <div className={`edit-block edit-block--${block.type}`}>
      <div className="edit-block-head">
        <select
          className="edit-type-select"
          value={block.type}
          onChange={(e) => onChange(index, { type: e.target.value as BlockType })}
          aria-label={`第 ${index + 1} 块的类型`}
        >
          <option value="p">段落</option>
          <option value="h2">小标题</option>
          <option value="quote">金句</option>
        </select>
        <span className="edit-block-num mono" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
        <button
          type="button"
          className="edit-icon-btn"
          disabled={!canMoveUp}
          onClick={() => onMove(index, -1)}
          aria-label={`上移第 ${index + 1} 块`}
          title="上移"
        >
          <ChevronUp size={15} aria-hidden />
        </button>
        <button
          type="button"
          className="edit-icon-btn"
          disabled={!canMoveDown}
          onClick={() => onMove(index, 1)}
          aria-label={`下移第 ${index + 1} 块`}
          title="下移"
        >
          <ChevronDown size={15} aria-hidden />
        </button>
        <button
          type="button"
          className="edit-icon-btn edit-icon-btn--del"
          disabled={!canDelete}
          onClick={() => onRemove(index)}
          aria-label={`删除第 ${index + 1} 块`}
          title={canDelete ? "删除这一块" : "至少保留一个内容块"}
        >
          <Trash2 size={15} aria-hidden />
        </button>
      </div>
      <textarea
        ref={taRef}
        className="edit-block-text"
        value={block.text}
        maxLength={MAX_BLOCK_LEN}
        placeholder={block.type === "h2" ? "小标题文字…" : block.type === "quote" ? "金句文字…" : "段落文字…"}
        aria-label={`第 ${index + 1} 块的${block.type === "h2" ? "小标题" : block.type === "quote" ? "金句" : "段落"}内容`}
        onChange={(e) => onChange(index, { text: e.target.value })}
        onInput={(e) => {
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${Math.max(72, el.scrollHeight + 2)}px`;
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------
// 主组件
// ------------------------------------------------------------
export default function PostEditPanel({ post }: { post: LivePost }) {
  const [stage, setStage] = useState<Stage>("closed");
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null); // password 阶段错误行（统一文案）
  const [notice, setNotice] = useState<Notice | null>(null); // 通知区（成功 mint / 失败红）

  const [title, setTitle] = useState(post.title);
  const [excerpt, setExcerpt] = useState(post.excerpt);
  const [minutes, setMinutes] = useState(post.minutes);
  const [blocks, setBlocks] = useState<EditBlock[]>([]);

  const [remaining, setRemaining] = useState(0);
  const [resetArmed, setResetArmed] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------- 工具 ----------

  const seedForm = useCallback((src: LivePost) => {
    setTitle(src.title);
    setExcerpt(src.excerpt);
    setMinutes(src.minutes);
    setBlocks(src.blocks.map((b) => ({ type: b.type, text: b.text })));
  }, []);

  const syncRemaining = useCallback(() => {
    setRemaining(
      sessionCache ? Math.max(0, Math.round((sessionCache.expiresAt - Date.now()) / 1000)) : 0
    );
  }, []);

  const closeDialog = useCallback(() => {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
    setResetArmed(false);
    setPassword("");
    setErr(null);
    setNotice(null);
    setStage("closed");
  }, []);

  const openDialog = useCallback(() => {
    setErr(null);
    setNotice(null);
    setPassword("");
    if (sessionCache && sessionCache.slug === post.slug && sessionCache.expiresAt > Date.now()) {
      seedForm(post);
      syncRemaining();
      setStage("editing");
    } else {
      if (sessionCache && sessionCache.slug !== post.slug) sessionCache = null; // 换文章即作废
      setStage("password");
    }
  }, [post, seedForm, syncRemaining]);

  // ---------- 倒计时：仅在 editing 阶段跑 1s interval，卸载/切走即清理 ----------

  useEffect(() => {
    if (stage !== "editing") return;
    const id = setInterval(() => {
      setRemaining(
        sessionCache ? Math.max(0, Math.round((sessionCache.expiresAt - Date.now()) / 1000)) : 0
      );
    }, 1000);
    return () => clearInterval(id);
  }, [stage]);

  // ---------- Escape 关闭（busy 时禁止） ----------

  useEffect(() => {
    if (stage === "closed" || busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDialog();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, busy, closeDialog]);

  // ---------- 对话框打开时锁住背景滚动 ----------

  useEffect(() => {
    if (stage === "closed") return;
    const root = document.documentElement;
    root.classList.add("is-edit-open");
    return () => root.classList.remove("is-edit-open");
  }, [stage]);

  // ---------- 内容块操作 ----------

  const updateBlock = useCallback((index: number, patch: Partial<EditBlock>) => {
    setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }, []);

  const moveBlock = useCallback((index: number, dir: -1 | 1) => {
    setBlocks((prev) => {
      const j = index + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[index];
      next[index] = next[j];
      next[j] = tmp;
      return next;
    });
  }, []);

  const removeBlock = useCallback((index: number) => {
    setBlocks((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }, []);

  const addBlock = useCallback((type: BlockType) => {
    setBlocks((prev) => (prev.length >= MAX_BLOCKS ? prev : [...prev, { type, text: "" }]));
  }, []);

  const handleMinutes = useCallback((raw: string) => {
    if (raw === "") {
      setMinutes(1);
      return;
    }
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return;
    setMinutes(Math.min(120, Math.max(1, n)));
  }, []);

  // ---------- 解锁 ----------

  const submitUnlock = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (busy) return;
      const pw = password;
      setPassword(""); // 提交后立即把密码字符串从 state 清掉
      if (!pw) return;
      setBusy(true);
      setErr(null);
      setNotice(null);
      try {
        const res = await editFetch(`/api/posts/${post.slug}/unlock`, { body: { password: pw } });
        const data = (await res.json()) as UnlockResponse;
        if (data.ok) {
          const expiresAt = +new Date(data.expiresAt);
          if (!Number.isFinite(expiresAt)) throw new Error("invalid expiresAt");
          sessionCache = { slug: post.slug, csrf: data.csrf, expiresAt };
          seedForm(post);
          syncRemaining();
          setStage("editing");
        } else {
          setErr(ERROR_MESSAGES[data.error]);
        }
      } catch {
        setErr(ERROR_MESSAGES.server_error);
      } finally {
        setBusy(false);
      }
    },
    [busy, password, post, seedForm, syncRemaining]
  );

  // ---------- 保存 ----------

  const submitSave = useCallback(async () => {
    if (busy || stage !== "editing" || !sessionCache) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await editFetch(`/api/posts/${post.slug}/save`, {
        body: {
          title: title.trim(),
          excerpt: excerpt.trim(),
          minutes,
          blocks: blocks.map((b) => ({ type: b.type, text: b.text })),
        },
        csrf: sessionCache.csrf,
      });
      const data = (await res.json()) as SaveResponse;
      if (data.ok) {
        const expiresAt = +new Date(data.expiresAt);
        if (Number.isFinite(expiresAt)) {
          sessionCache = { slug: post.slug, csrf: data.csrf, expiresAt };
        }
        syncRemaining();
        setNotice({ kind: "ok", text: "已保存 ✓（内容已更新，可继续修改）" });
        // 保存响应自带权威合并后的 post：就地打补丁即时反馈，
        // 再拉一次列表做权威同步（失败静默，静态兜底不变）
        usePostsStore.getState().patchPost(data.post);
        await refreshPosts();
      } else if (data.error === "session_invalid") {
        sessionCache = null;
        setStage("password");
        setErr(ERROR_MESSAGES.session_invalid);
      } else {
        setNotice({
          kind: "err",
          text:
            data.error === "bad_request" && data.message
              ? data.message
              : ERROR_MESSAGES[data.error],
        });
      }
    } catch {
      setNotice({ kind: "err", text: ERROR_MESSAGES.server_error });
    } finally {
      setBusy(false);
    }
  }, [blocks, busy, excerpt, minutes, post.slug, stage, syncRemaining, title]);

  // ---------- 恢复原文（两步确认） ----------

  const doReset = useCallback(async () => {
    if (!sessionCache) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await editFetch(`/api/posts/${post.slug}/reset`, {
        body: {},
        csrf: sessionCache.csrf,
      });
      // reset 与 save 一样会旋转令牌：响应携带新 csrf + 新到期时刻，
      // 必须立即替换本地会话，否则后续保存会用已消费的旧 csrf 被 403。
      const data = (await res.json()) as SaveResponse;
      if (data.ok) {
        const expiresAt = +new Date(data.expiresAt);
        if (Number.isFinite(expiresAt)) {
          sessionCache = { slug: post.slug, csrf: data.csrf, expiresAt };
        }
        syncRemaining();
        setNotice({ kind: "ok", text: "已恢复原文 ✓" });
        // 响应的 post 即静态原帖（权威）；静态兑底仅为防御
        const original = data.post ?? getPost(post.slug);
        if (original) {
          seedForm(original);
          usePostsStore.getState().patchPost(original); // 立即去掉「最近编辑」标记
        }
        await refreshPosts();
      } else if (data.error === "session_invalid") {
        sessionCache = null;
        setStage("password");
        setErr(ERROR_MESSAGES.session_invalid);
      } else {
        setNotice({ kind: "err", text: data.message || ERROR_MESSAGES[data.error] });
      }
    } catch {
      setNotice({ kind: "err", text: ERROR_MESSAGES.server_error });
    } finally {
      setBusy(false);
    }
  }, [post.slug, seedForm, syncRemaining]);

  const handleReset = useCallback(() => {
    if (busy || stage !== "editing") return;
    if (!resetArmed) {
      setResetArmed(true);
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setResetArmed(false), 3000);
      return;
    }
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
    setResetArmed(false);
    void doReset();
  }, [busy, doReset, resetArmed, stage]);

  // ---------- 锁定会话 ----------

  const doLock = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    const csrf = sessionCache?.csrf;
    try {
      if (csrf) await editFetch(`/api/posts/${post.slug}/lock`, { body: {}, csrf });
    } catch {
      // 即便通知服务端失败，也照样作废本地会话并关门
    }
    sessionCache = null;
    setBusy(false);
    closeDialog();
  }, [busy, closeDialog, post.slug]);

  // ---------- 渲染 ----------

  const hint = post.editedAt
    ? `上次编辑 ${formatMMDD(post.editedAt)}`
    : "凭密码解锁 · 30 分钟会话";

  return (
    <>
      <button type="button" className="edit-btn" onClick={openDialog} aria-haspopup="dialog">
        <SquarePen size={14} aria-hidden /> 编辑文章
      </button>
      <span className={`post-edit-hint mono${post.editedAt ? " post-edit-hint--edited" : ""}`}>
        {hint}
      </span>

      {stage !== "closed" &&
        createPortal(
          <div
            className="edit-overlay"
            role="presentation"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !busy) closeDialog();
            }}
          >
            <div className="edit-panel" role="dialog" aria-modal="true" aria-labelledby="edit-panel-title">
              {/* ---------------- 密码解锁 ---------------- */}
              {stage === "password" && (
                <>
                  <div className="edit-head">
                    <span className="edit-pw-icon" aria-hidden="true">
                      <KeyRound size={17} />
                    </span>
                    <h3 className="edit-title" id="edit-panel-title">
                      解锁编辑
                    </h3>
                    <button
                      type="button"
                      className="edit-close"
                      onClick={closeDialog}
                      aria-label="关闭对话框"
                      disabled={busy}
                    >
                      <X size={16} aria-hidden />
                    </button>
                  </div>
                  <div className="edit-scroll edit-pw">
                    <form className="edit-form" onSubmit={(e) => void submitUnlock(e)}>
                      <p className="edit-note">输入编辑密码，获得这篇文章 30 分钟的编辑会话。</p>
                      <div className="edit-field">
                        <label className="edit-field-label" htmlFor="edit-pw-input">
                          编辑密码
                        </label>
                        <input
                          id="edit-pw-input"
                          className="edit-input"
                          type="password"
                          autoComplete="off"
                          autoFocus
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                      {err ? (
                        <p className="edit-err" role="alert">
                          {err}
                        </p>
                      ) : notice ? (
                        <p className="edit-ok" role="status">
                          {notice.text}
                        </p>
                      ) : null}
                    </form>
                  </div>
                  <div className="edit-actions">
                    <button
                      type="button"
                      className="ebtn ebtn--primary"
                      onClick={() => void submitUnlock()}
                      disabled={busy || password.length === 0}
                      aria-busy={busy}
                    >
                      {busy ? (
                        <Loader2 size={14} className="edit-spin" aria-hidden />
                      ) : (
                        <KeyRound size={14} aria-hidden />
                      )}{" "}
                      解锁
                    </button>
                    <span className="edit-note mono">连续试错会暂时锁定</span>
                  </div>
                </>
              )}

              {/* ---------------- 编辑器 ---------------- */}
              {stage === "editing" && (
                <>
                  <div className="edit-head">
                    <h3 className="edit-title" id="edit-panel-title">
                      编辑文章
                    </h3>
                    <span className="edit-slug-badge mono" title={post.slug}>
                      {post.slug}
                    </span>
                    <span
                      className={`edit-countdown mono${remaining < 120 ? " is-low" : ""}`}
                      title="编辑会话剩余时间"
                    >
                      <i aria-hidden="true" />
                      {remaining <= 0 ? "已过期" : mmss(remaining)}
                    </span>
                    <button
                      type="button"
                      className="edit-close"
                      onClick={closeDialog}
                      aria-label="关闭编辑器"
                      disabled={busy}
                    >
                      <X size={16} aria-hidden />
                    </button>
                  </div>
                  <div className="edit-scroll">
                    <div className="edit-form">
                      <div className="edit-field">
                        <label className="edit-field-label" htmlFor="edit-title-input">
                          标题
                        </label>
                        <input
                          id="edit-title-input"
                          className="edit-input"
                          type="text"
                          value={title}
                          maxLength={MAX_TITLE_LEN}
                          onChange={(e) => setTitle(e.target.value)}
                        />
                        <span className="edit-counter mono" aria-hidden="true">
                          {title.length} / {MAX_TITLE_LEN}
                        </span>
                      </div>
                      <div className="edit-field">
                        <label className="edit-field-label" htmlFor="edit-excerpt-input">
                          摘要
                        </label>
                        <textarea
                          id="edit-excerpt-input"
                          className="edit-textarea"
                          value={excerpt}
                          maxLength={MAX_EXCERPT_LEN}
                          rows={3}
                          onChange={(e) => setExcerpt(e.target.value)}
                        />
                        <span className="edit-counter mono" aria-hidden="true">
                          {excerpt.length} / {MAX_EXCERPT_LEN}
                        </span>
                      </div>
                      <div className="edit-field edit-field--row">
                        <label className="edit-field-label" htmlFor="edit-minutes-input">
                          阅读分钟
                        </label>
                        <input
                          id="edit-minutes-input"
                          className="edit-input edit-input--num"
                          type="number"
                          min={1}
                          max={120}
                          value={minutes}
                          onChange={(e) => handleMinutes(e.target.value)}
                        />
                      </div>
                      <div className="edit-field">
                        <span className="edit-field-label">
                          内容块 · {blocks.length} / {MAX_BLOCKS}
                        </span>
                      </div>
                      <div className="edit-blocks">
                        {blocks.map((b, i) => (
                          <EditBlockCard
                            key={i}
                            index={i}
                            block={b}
                            canMoveUp={i > 0}
                            canMoveDown={i < blocks.length - 1}
                            canDelete={blocks.length > 1}
                            onChange={updateBlock}
                            onMove={moveBlock}
                            onRemove={removeBlock}
                          />
                        ))}
                      </div>
                      <div className="edit-add-row">
                        <button
                          type="button"
                          className="edit-add-btn"
                          disabled={blocks.length >= MAX_BLOCKS}
                          onClick={() => addBlock("p")}
                        >
                          <Plus size={13} aria-hidden /> 段落
                        </button>
                        <button
                          type="button"
                          className="edit-add-btn"
                          disabled={blocks.length >= MAX_BLOCKS}
                          onClick={() => addBlock("h2")}
                        >
                          <Plus size={13} aria-hidden /> 小标题
                        </button>
                        <button
                          type="button"
                          className="edit-add-btn"
                          disabled={blocks.length >= MAX_BLOCKS}
                          onClick={() => addBlock("quote")}
                        >
                          <Plus size={13} aria-hidden /> 金句
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="edit-actions">
                    {notice ? (
                      <p
                        className={notice.kind === "ok" ? "edit-ok" : "edit-err"}
                        role={notice.kind === "ok" ? "status" : "alert"}
                      >
                        {notice.text}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      className="ebtn ebtn--primary"
                      onClick={() => void submitSave()}
                      disabled={busy || remaining <= 0}
                      aria-busy={busy}
                    >
                      {busy ? (
                        <Loader2 size={14} className="edit-spin" aria-hidden />
                      ) : (
                        <SquarePen size={14} aria-hidden />
                      )}{" "}
                      保存修改
                    </button>
                    <button
                      type="button"
                      className={`ebtn ebtn--ghost${resetArmed ? " ebtn--danger-confirm" : ""}`}
                      onClick={handleReset}
                      disabled={busy}
                      aria-busy={busy}
                    >
                      {resetArmed ? "确认恢复？" : "恢复原文"}
                    </button>
                    <button
                      type="button"
                      className="ebtn ebtn--ghost"
                      onClick={() => void doLock()}
                      disabled={busy}
                      aria-busy={busy}
                    >
                      锁定会话
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
