import type { Metadata } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource/noto-serif-sc/300.css";
import "@fontsource/noto-serif-sc/600.css";
import "@fontsource/noto-serif-sc/900.css";
import "@fontsource/noto-sans-sc/400.css";
import "@fontsource/noto-sans-sc/500.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import InitialLoader from "@/components/InitialLoader";
import { SITE_NAME, SITE_NAME_EN, SITE_DESCRIPTION, SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Evan的个人博客`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  icons: [{ rel: "icon", url: "/icon.svg", type: "image/svg+xml" }],
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: "/",
    siteName: `${SITE_NAME} — Evan的个人博客`,
    title: `${SITE_NAME} — Evan的个人博客`,
    description: SITE_DESCRIPTION,
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Evan的个人博客`,
    description: SITE_DESCRIPTION,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning：浏览器翻译类扩展（如 Trancy）会在 React 挂载前
    // 向 <html> 注入 trancy-version 等属性，导致 hydration 属性对比失败
    <html lang="zh-CN" suppressHydrationWarning data-theme="original">
      <body>
        <InitialLoader />
        <div className="page-shell">{children}</div>
      </body>
    </html>
  );
}
