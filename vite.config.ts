import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/apple-touch-icon.png", "icons/favicon.svg"],
      manifest: {
        name: "Podsieci — trener IPv4",
        short_name: "Podsieci",
        description: "Podsieci bez rozpisywania bitów: metoda magicznej liczby, VLSM, quiz L2/L3.",
        lang: "pl",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "any",
        background_color: "#0b1020",
        theme_color: "#0b1020",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "index.html"
      }
    })
  ]
});
