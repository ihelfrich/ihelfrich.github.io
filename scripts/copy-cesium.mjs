import { access, cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = path.join(root, "node_modules/cesium/Build/Cesium");
const destination = path.join(root, "public/vendor/cesium");
const directories = ["Workers", "ThirdParty", "Assets", "Widgets"];

// These are package-owned static resources. The browser loads only those needed
// by its current view; keeping their relative paths is required by Cesium.
await Promise.all(directories.map((name) => access(path.join(source, name))));
await mkdir(destination, { recursive: true });
await Promise.all(
  directories.map((name) =>
    cp(path.join(source, name), path.join(destination, name), {
      recursive: true,
      force: true,
    }),
  ),
);
console.info("Cesium Workers, ThirdParty, Assets and Widgets copied to public/vendor/cesium.");
