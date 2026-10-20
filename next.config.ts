import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // برای بسته‌بندی دسکتاپ (Electron) خروجی مستقل لازم است
  output: "standalone",
  // PGlite دارای فایل‌های WASM است؛ باید بدون باندل و کامل رهگیری شود
  serverExternalPackages: ["@electric-sql/pglite"],
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@electric-sql/pglite/**/*"],
  },
};

export default nextConfig;
