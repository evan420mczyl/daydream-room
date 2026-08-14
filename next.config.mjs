/** @type {import('next').NextConfig} */

// 基础安全头。CSP 只在生产环境启用：开发模式下 webpack 需要 eval，加了会打断 HMR。
const baseHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const csp =
  "default-src 'self'; " +
  "img-src 'self' data:; " +
  "style-src 'self' 'unsafe-inline'; " +
  "script-src 'self' 'unsafe-inline'; " +
  "font-src 'self' data:; " +
  "connect-src 'self'; " +
  "frame-ancestors 'none'";

const nextConfig = {
  outputFileTracingRoot: import.meta.dirname,
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {},
  webpack: (config, { isServer }) => {
    // 确保 @ 路径别名在客户端和服务端都能正确解析
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": import.meta.dirname,
    };
    return config;
  },
  async headers() {
    const headers = [...baseHeaders];
    if (process.env.NODE_ENV === "production") {
      headers.push({ key: "Content-Security-Policy", value: csp });
    }
    return [{ source: "/(.*)", headers }];
  },
};

export default nextConfig;
