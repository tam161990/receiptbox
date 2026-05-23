#!/usr/bin/env node
/** Generate PWA app icons + web header logo from SVG sources. */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = join(root, "public/icons");
const brandingDir = join(root, "public/branding");

function render(svg, size, background = "white") {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    background,
  });
  return resvg.render().asPng();
}

mkdirSync(iconsDir, { recursive: true });
mkdirSync(brandingDir, { recursive: true });

const appIconSvg = readFileSync(join(root, "assets/branding/lv-app-icon.svg"), "utf8");
for (const [name, size] of [
  ["icon-512.png", 512],
  ["telegram-bot-photo.png", 640],
  ["maskable-icon.png", 512],
  ["icon-192.png", 192],
  ["icon-180.png", 180],
  ["apple-touch-icon.png", 180],
  ["icon-32.png", 32],
  ["app-icon.png", 32],
]) {
  writeFileSync(join(iconsDir, name), render(appIconSvg, size));
  console.log(`Wrote icons/${name} (${size}px)`);
}

const webLogoSvg = readFileSync(join(root, "assets/branding/receiptbox-lv-web-logo.svg"), "utf8");
copyFileSync(
  join(root, "assets/branding/receiptbox-lv-web-logo.svg"),
  join(brandingDir, "receiptbox-lv-logo.svg"),
);
for (const w of [280, 560]) {
  writeFileSync(join(brandingDir, `receiptbox-lv-logo-${w}.png`), render(webLogoSvg, w, "transparent"));
  console.log(`Wrote branding/receiptbox-lv-logo-${w}.png`);
}
