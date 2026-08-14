# 白日梦陈列室 · Daydream Room

> 把一些轻飘飘的念头，写上架子。一个关于随笔、设计、手帐与漫游的个人博客。

一个带入场动画、Three.js 装饰场景、会眨眼的玩偶吉祥物们的静态博客。内容全部写在代码里，构建后是纯静态页面——不依赖数据库、没有接口、没有登录。

## ✨ 特性

- **纯静态**：所有文章预渲染（SSG），部署到任意静态托管即可
- **会眨眼的玩偶**：五位住员（团团、星星仔、长条君、小幽、绵绵），随机间隔眨眼，响应 `prefers-reduced-motion`
- **Three.js 装饰层**：首页 Hero 的 3D 静物场景，指针微视差，带防裁切缓冲设计
- **入场动画**：加载器在窗口与字体就绪后退出，最短展示时间保证节奏
- **响应式**：桌面 / 平板 / 手机三档布局
- **无障碍考虑**：键盘可达（返回顶部按钮）、读屏文案、减少动态偏好降级

## 🛠 技术栈

- [Next.js 15](https://nextjs.org)（App Router）+ React 19 + TypeScript
- [Three.js](https://threejs.org)（Hero 场景）
- [@fontsource](https://fontsource.org) 自托管字体（Fraunces / Noto Serif SC / Noto Sans SC / Space Mono）
- 样式：手写 CSS（无框架），设计令牌集中在 `app/globals.css`

## 🚀 快速开始

```bash
npm install
npm run dev
```

打开 http://localhost:3000。

生产构建：

```bash
npm run build
npm run start
```

## 📝 写文章

文章数据在 [`lib/posts.ts`](lib/posts.ts)：每条 `Post` 包含 slug、标题、分类、日期、点缀色（`accent`）和内容块（`blocks`，支持段落 / 小标题 / 引用）。新增一篇文章 = 在 `posts` 数组里加一个对象，构建时自动生成对应页面。

## ⚙️ 配置

| 位置 | 说明 |
| --- | --- |
| [`lib/site.ts`](lib/site.ts) | 站点名、描述、GitHub 地址 |
| 环境变量 `NEXT_PUBLIC_SITE_URL` | 正式域名，用于 OG 图、sitemap、canonical。不设置时默认 localhost |
| `app/globals.css` 的 `:root` | 全套设计令牌：纸色、墨色、五色点缀色、字体栈、间距 |

## 📁 目录结构

```
app/
  layout.tsx         # 根布局 + SEO 元数据
  page.tsx           # 首页
  posts/[slug]/      # 文章页（SSG）
  robots.ts          # robots.txt
  sitemap.ts         # sitemap.xml
components/          # 页面组件与玩偶
  dolls/             # 五位住员（眨眼三帧）
lib/
  posts.ts           # 文章数据
  site.ts            # 站点配置
scripts/
  build-doll-frames.mjs  # 玩偶眨眼帧生成管线（需自备原始素材，仅供复刻参考）
public/              # 静态资源（玩偶 webp 帧、OG 图）
```

## 🌍 部署

任意支持 Node 的托管平台（Vercel / Netlify / Cloudflare Pages 均可）。构建命令 `npm run build`，输出目录 `.next`。纯静态部署可用 `next.config` 开启 `output: "export"`（注意 [dynamicParams 已设为 false](app/posts/[slug]/page.tsx)，文章页本身就是纯静态）。

## ⚠️ 已知事项

- 依赖中 Next.js 15 全系传递依赖（postcss / sharp）存在 npm audit 高危标记，本站无用户提交的 CSS、未使用图片优化管线，实际利用面很低；升级修复需迁移到 Next 16（breaking change），可按需规划。
- 玩偶素材为生成图，开源仓库只保留最终 webp 帧；生成管线脚本需要原始素材才能重新运行。

## 📄 许可证

[MIT](LICENSE)
