import { build } from "esbuild";
import { chmodSync, cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "output");

rmSync(output, { force: true, recursive: true });
mkdirSync(output, { recursive: true });
cpSync(resolve(root, "dist"), resolve(output, "public"), { recursive: true });

await build({
  bundle: true,
  entryPoints: [resolve(root, "server/index.ts")],
  format: "esm",
  outfile: resolve(output, "server.mjs"),
  platform: "node",
  target: "node18",
});

writeFileSync(
  resolve(output, "bootstrap.js"),
  'import { startServer } from "./server.mjs";\nstartServer();\n',
);

writeFileSync(
  resolve(output, "package.json"),
  `${JSON.stringify(
    {
      name: "live-studio-genie-runtime",
      private: true,
      type: "module",
      scripts: {
        start: "node server.mjs",
      },
    },
    null,
    2,
  )}\n`,
);

const bootstrapPath = resolve(output, "bootstrap.sh");
writeFileSync(
  bootstrapPath,
  "#!/usr/bin/env bash\nset -euo pipefail\nexec node server.mjs\n",
);
chmodSync(bootstrapPath, 0o755);
