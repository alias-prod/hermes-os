import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const required = [
  "plugin.yaml",
  "__init__.py",
  "prompts/openui-inline-ui.md",
  "skills/openui-app/SKILL.md",
];
await Promise.all(required.map((file) => access(join(root, file))));
const manifest = await readFile(join(root, "plugin.yaml"), "utf8");
for (const key of ["name:", "version:", "description:"]) {
  if (!manifest.includes(key)) throw new Error(`plugin.yaml missing ${key}`);
}
console.log("Hermes plugin manifest and OpenUI assets present");
