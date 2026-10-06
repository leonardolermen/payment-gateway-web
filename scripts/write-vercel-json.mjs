// Vercel reads vercel.json BEFORE the build, so it cannot be generated here. What can be done is to
// refuse a build whose VITE_API_URL is not the origin the committed CSP allows: otherwise the
// browser blocks every API call and the first notice is a blank panel in production.
import { readFileSync } from "node:fs";

const apiUrl = process.env.VITE_API_URL;
if (!apiUrl) {
  console.error("VITE_API_URL is not set: cannot verify the CSP in vercel.json");
  process.exit(1);
}

const origin = new URL(apiUrl).origin;
const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const csp = config.headers
  .flatMap((entry) => entry.headers)
  .find((header) => header.key === "Content-Security-Policy")?.value;
const connectSrc = csp?.match(/connect-src ([^;]*)/)?.[1].split(/\s+/) ?? [];

if (!connectSrc.includes(origin)) {
  console.error(
    `vercel.json connect-src (${connectSrc.join(" ")}) does not allow ${origin}; update it to match VITE_API_URL`,
  );
  process.exit(1);
}
