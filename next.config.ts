import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // برای بسته‌بندی دسکتاپ (Electron) خروجی مستقل لازم است
  output: "standalone",
};

export default nextConfig;
