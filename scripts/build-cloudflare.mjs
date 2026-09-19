import { cp, mkdir, rm } from "node:fs/promises";
import { WAM_NAME } from "../packages/shared/dist/index.js";

const wamDir = `cloudflare/static/resource/wam/${WAM_NAME}`;
await rm("cloudflare/static", { recursive: true, force: true });
await mkdir(wamDir, { recursive: true });
await cp("wam/dist", wamDir, {
  recursive: true,
});
