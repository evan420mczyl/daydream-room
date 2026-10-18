#!/usr/bin/env bun
/**
 * seed-edit-password.mjs —— 设置「编辑文章」的全站口令
 *
 * 用法：
 *   bun scripts/seed-edit-password.mjs              # 自动生成 24 位随机密码
 *   bun scripts/seed-edit-password.mjs --set <密码>  # 使用指定密码（需 ≥12 位）
 *
 * 只 upsert EditSetting（argon2id 慢哈希 + 独立盐）。
 * 密码只输出到 stdout（EDIT_PASSWORD_SET <密码>），绝不写入任何文件。
 * bun 运行时自动读取 .env 中的 DATABASE_URL。
 */

import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

const prisma = new PrismaClient();

function generatePassword(len = 24) {
  let out = "";
  while (out.length < len) {
    out += randomBytes(48).toString("base64url").replace(/[^a-zA-Z0-9]/g, "");
  }
  return out.slice(0, len);
}

function policyOk(pw) {
  return typeof pw === "string" && pw.length >= 12 && pw.length <= 128 && !/[\x00-\x1F\x7F]/.test(pw);
}

try {
  const args = process.argv.slice(2);
  let password = null;
  const setIdx = args.indexOf("--set");
  if (setIdx !== -1) {
    const value = args[setIdx + 1];
    if (typeof value === "string" && value.length > 0) {
      password = value;
    }
  }
  if (!password) {
    password = generatePassword(24);
  }
  if (!policyOk(password)) {
    console.error("密码不满足策略：至少 12 位、至多 128 位、不含控制字符");
    process.exit(1);
  }

  const passwordHash = await hash(password, {
    algorithm: 2 /* Argon2id */,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await prisma.editSetting.upsert({
    where: { id: "global" },
    create: { id: "global", passwordHash, algo: "argon2id" },
    update: { passwordHash, algo: "argon2id" },
  });

  // 唯一输出通道：stdout。绝不写文件、绝不进日志库。
  console.log(`EDIT_PASSWORD_SET ${password}`);
} finally {
  await prisma.$disconnect();
}
