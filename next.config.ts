import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // 原生模块（.node 二进制）不参与打包，交给 Node/Bun 运行时直接加载，
  // 规避 Turbopack 对 argon2 原生插件的解析问题。
  serverExternalPackages: ["@node-rs/argon2"],
};

export default nextConfig;
