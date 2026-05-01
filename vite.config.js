import { defineConfig } from "vite";

export default defineConfig({
    root: ".",
    base: "./", // Relative paths to work no matter the base URL
    build: {
        outDir: "./dist",
        emptyOutDir: true,
    },
});
