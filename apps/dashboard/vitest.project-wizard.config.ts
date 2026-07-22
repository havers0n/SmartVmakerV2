import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/content-formats-setup.ts"],
    include: [
      "src/features/hwar-create/**/*.test.tsx",
      "src/features/content-formats/content-format-cta.test.tsx",
      "src/app/hwar/create/**/*.test.tsx",
    ],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
