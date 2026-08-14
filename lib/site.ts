/**
 * 站点级配置：改这里，全站（Footer、SEO、sitemap、robots）一起变。
 *
 * 部署时通过环境变量 NEXT_PUBLIC_SITE_URL 指定正式域名，
 * 不设置时默认使用 localhost（本地开发）。
 */
export const SITE_NAME = "白日梦陈列室";
export const SITE_NAME_EN = "Daydream Room";
export const SITE_DESCRIPTION =
  "把一些轻飘飘的念头，写上架子。一个关于随笔、设计、手帐与漫游的个人博客。";

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const GITHUB_URL = "https://file.zhuyitai.com/feedback/202608/d30bfc6e5da78f38aff8356b2af35d05.html";
