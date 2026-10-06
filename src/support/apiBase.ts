const raw: unknown = import.meta.env.VITE_API_URL;

// Fails at module load: an unset value would otherwise surface as requests to "undefined/v1/...".
if (typeof raw !== "string" || !/^https?:\/\/.+/.test(raw)) {
  throw new Error("VITE_API_URL is not set");
}

export const API_BASE: string = raw.replace(/\/+$/, "");
