/**
 * 站点级配置：改这里，全站（Footer、SEO）一起变。
 *
 * 部署时通过环境变量 NEXT_PUBLIC_SITE_URL 指定正式域名，
 * 不设置时默认使用 localhost（本地开发）。
 */
export const SITE_NAME = "Evan 的游乐场";
export const SITE_NAME_EN = "Evan's Playground";
export const SITE_DESCRIPTION =
  "一个极客开发者的 AI 编程笔记、工具折腾记录和生活碎碎念。代码、设计和好奇心，都摆在这里。";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const GITHUB_URL = "https://github.com/Evan-420";
