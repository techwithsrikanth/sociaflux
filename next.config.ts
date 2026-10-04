import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  // The native libSQL binding is only used for the local-file fallback. Keeping
  // it external stops the bundler pulling a native module into serverless output.
  serverExternalPackages: ["@libsql/client", "libsql"]
};

export default nextConfig;
