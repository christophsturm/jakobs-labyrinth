/// <reference types="vitest/config" />
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function singleFileHtml(): Plugin {
  return {
    name: "single-file-html",
    apply: "build",
    enforce: "post",
    generateBundle(_, bundle) {
      const htmlFiles = Object.entries(bundle).filter(
        (entry): entry is [string, Extract<(typeof entry)[1], { type: "asset" }>] =>
          entry[0].endsWith(".html") && entry[1].type === "asset",
      );

      if (htmlFiles.length === 0) {
        throw new Error("No HTML file was emitted.");
      }

      const inlinedChunks = new Set<string>();
      const inlinedStylesheets = new Set<string>();

      for (const [, htmlAsset] of htmlFiles) {
        let html = String(htmlAsset.source);

        for (const [fileName, item] of Object.entries(bundle)) {
          if (item.type !== "chunk" || !item.isEntry) {
            continue;
          }

          const filePattern = escapeRegExp(fileName);
          const code = item.code.replace(/<\/script/gi, "<\\/script");
          const scriptPattern = new RegExp(
            `<script\\b[^>]*\\bsrc=["'][^"']*${filePattern}["'][^>]*>\\s*</script>`,
            "g",
          );
          const nextHtml = html.replace(
            scriptPattern,
            `<script type="module">\n${code}\n</script>`,
          );

          if (nextHtml !== html) {
            html = nextHtml;
            inlinedChunks.add(fileName);
          }
        }

        for (const [fileName, item] of Object.entries(bundle)) {
          if (item.type !== "asset" || !fileName.endsWith(".css")) {
            continue;
          }

          const filePattern = escapeRegExp(fileName);
          const css = String(item.source).replace(/<\/style/gi, "<\\/style");
          const linkPattern = new RegExp(
            `<link\\b[^>]*\\bhref=["'][^"']*${filePattern}["'][^>]*>`,
            "g",
          );
          const nextHtml = html.replace(linkPattern, `<style>\n${css}\n</style>`);

          if (nextHtml !== html) {
            html = nextHtml;
            inlinedStylesheets.add(fileName);
          }
        }

        htmlAsset.source = html;
      }

      for (const [fileName, item] of Object.entries(bundle)) {
        if (item.type === "chunk" && item.isEntry && !inlinedChunks.has(fileName)) {
          throw new Error(`Could not inline entry script ${fileName}.`);
        }

        if (inlinedChunks.has(fileName) || inlinedStylesheets.has(fileName)) {
          delete bundle[fileName];
        }
      }
    },
  };
}

export default defineConfig({
  base: "./",
  root: "src",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    modulePreload: false,
    rollupOptions: {
      input: {
        printer: fileURLToPath(new URL("./src/index.html", import.meta.url)),
        dice: fileURLToPath(new URL("./src/dice/index.html", import.meta.url)),
      },
    },
  },
  plugins: [singleFileHtml()],
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
