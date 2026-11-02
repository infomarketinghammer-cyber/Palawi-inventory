import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // pdfkit reads its font metrics from disk at runtime, so it must not be bundled.
  serverExternalPackages: ["pdfkit", "exceljs"],
  // Files the receipt reads from disk at runtime. Vercel only ships files the code visibly imports,
  // so without this the fonts (and pdfkit's built-in Helvetica metrics) are missing and the receipt fails.
  outputFileTracingIncludes: {
    "/donations/[id]/receipt": [
      "./node_modules/pdfkit/js/data/**/*",
      "./node_modules/@fontsource/noto-sans/files/noto-sans-latin-{400,700}-normal.woff",
      "./node_modules/@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-{400,700}-normal.woff",
      "./public/palawi-logo.png",
    ],
  },
  // Excel uploads (the gate register is ~0.5 MB).
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
