import { readFile } from "node:fs/promises";
import path from "node:path";

const sitemapFilePattern = /^sitemap-[a-z0-9-]+\.xml$/;

export async function readSitemapContents(root) {
  const index = await readFile(path.join(root, "sitemap.xml"), "utf8");
  if (!index.includes("<sitemapindex")) return index;

  const childFiles = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => path.basename(new URL(match[1]).pathname))
    .filter((fileName) => sitemapFilePattern.test(fileName));

  if (!childFiles.length) throw new Error("Sitemap index does not reference any local sitemap files");
  return (await Promise.all(childFiles.map((fileName) => readFile(path.join(root, fileName), "utf8")))).join("\n");
}
