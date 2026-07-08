/// <reference types="vitest/config" />
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
      const htmlFileName = Object.keys(bundle).find((fileName) => fileName.endsWith(".html"));

      if (!htmlFileName) {
        throw new Error("No HTML file was emitted.");
      }

      const htmlAsset = bundle[htmlFileName];

      if (!htmlAsset || htmlAsset.type !== "asset") {
        throw new Error("HTML output is not an asset.");
      }

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
        const nextHtml = html.replace(scriptPattern, `<script type="module">\n${code}\n</script>`);

        if (nextHtml === html) {
          throw new Error(`Could not inline entry script ${fileName}.`);
        }

        html = nextHtml;
        delete bundle[fileName];
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

        if (nextHtml === html) {
          throw new Error(`Could not inline stylesheet ${fileName}.`);
        }

        html = nextHtml;
        delete bundle[fileName];
      }

      htmlAsset.source = html;
    },
  };
}

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    modulePreload: false,
  },
  plugins: [singleFileHtml()],
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
