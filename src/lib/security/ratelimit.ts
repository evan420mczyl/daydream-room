/**
 * ============================================================
 * 内存滑动窗口限速（失败计数 + 指数退避锁定）
 * ------------------------------------------------------------
 * 三维度策略（key 前缀决定策略）：
 *  - "ip:"   60s 窗口内 ≥5 次失败 → 锁 300s × 2^(n-1)，上限 3600s
 *  - "slug:" 600s 窗口内 ≥20 次失败 → 锁 600s
 *  - "pwip:" 600s 窗口内 ≥3 次失败 → 锁 600s（改密码专用，最严）
 *
 * 实现说明：使用模块级 Map 而非 globalThis —— 开发环境 HMR 时模块
 * 重载即清零，便于联调测试（如解锁失败 5 次触发锁定后，触碰本文件
 * 即可重置重新测）。生产环境无 HMR，模块只加载一次，行为不受影响。
 * （多实例水平扩展时应换 Redis 等共享存储，当前单实例部署足够。）
 */

type Bucket = {
  /** 滑动窗口内的失败时间戳（ms） */
  failures: number[];
  /** 锁定截止时间戳（ms），0 = 未锁定 */
  lockUntil: number;
  /** 历史触发锁定的次数（供指数退避） */
  lockCount: number;
};

const buckets = new Map<string, Bucket>();

type Policy = {
  windowSec: number;
  threshold: number;
  baseLockSec: number;
  exponential: boolean;
  maxLockSec: number;
};

const POLICIES: Record<"ip" | "slug" | "pwip", Policy> = {
  ip: { windowSec: 60, threshold: 5, baseLockSec: 300, exponential: true, maxLockSec: 3600 },
  slug: { windowSec: 600, threshold: 20, baseLockSec: 600, exponential: false, maxLockSec: 600 },
  pwip: { windowSec: 600, threshold: 3, baseLockSec: 600, exponential: false, maxLockSec: 600 },
};

function policyFor(key: string): Policy {
  if (key.startsWith("pwip:")) return POLICIES.pwip;
  if (key.startsWith("slug:")) return POLICIES.slug;
  return POLICIES.ip;
}

/** 预检：该 key 当前是否放行；被锁时返回建议等待秒数（≥1）。 */
export function allowed(key: string): { allowed: boolean; retryAfterSec: number } {
  const b = buckets.get(key);
  if (!b) return { allowed: true, retryAfterSec: 0 };
  const now = Date.now();
  if (b.lockUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((b.lockUntil - now) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

/** 记一次失败；窗口内失败数达到阈值 → 计算锁定（含指数退避）。 */
export function recordFailure(key: string): void {
  const policy = policyFor(key);
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { failures: [], lockUntil: 0, lockCount: 0 };
    buckets.set(key, b);
  }
  // 锁已到期则复位锁定态（lockCount 保留，退避继续累加）
  if (b.lockUntil > 0 && b.lockUntil <= now) {
    b.lockUntil = 0;
  }
  // 滑动窗口：丢弃窗口外的旧失败
  b.failures = b.failures.filter((t) => now - t < policy.windowSec * 1000);
  b.failures.push(now);

  if (b.failures.length >= policy.threshold) {
    b.lockCount += 1;
    let lockSec = policy.baseLockSec;
    if (policy.exponential) {
      lockSec = policy.baseLockSec * Math.pow(2, b.lockCount - 1);
    }
    lockSec = Math.min(lockSec, policy.maxLockSec);
    b.lockUntil = now + lockSec * 1000;
    // 触发锁定即清空计数：锁到期后须重新累积整窗失败才会再锁
    b.failures = [];
  }
}

/** 成功 → 整桶重置（失败计数与锁定退避历史一并清零）。 */
export function recordSuccess(key: string): void {
  buckets.delete(key);
}


// dev-reset: 此行用于开发期触发 HMR 重载（清零内存限速桶）。生产无影响。

// dev-reset #2: 清理后复位内存限速桶（真实内容变化才会触发 Turbopack 重载）。

// dev-reset #3: 全部自测完成后的最终复位（生产无影响，模块仅加载一次）。
