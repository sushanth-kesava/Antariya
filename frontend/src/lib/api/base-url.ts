const CONFIGURED_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

type RuntimeConfig = {
  apiBaseUrl?: string;
  razorpayKeyId?: string;
};

declare global {
  interface Window {
    __ANTARIYA_RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

// Normalize a configured API base URL so the app is resilient to common
// env-var mistakes that have repeatedly broken deployments:
//   - a stray leading comma/whitespace (e.g. ", https://api...") from pasting
//     a comma-separated list into a single-value field
//   - a value accidentally given as a comma-separated list (take the first)
//   - a missing/extra trailing slash
//   - a MISSING "/api" suffix — the backend serves every route under /api, so
//     the base URL MUST end in /api. We append it automatically when absent.
function normalizeApiBaseUrl(rawValue: string): string {
  let value = String(rawValue || "").trim();
  if (!value) {
    return "";
  }

  // If someone pasted a comma-separated list (possibly with a stray leading
  // comma, e.g. ", https://api..."), keep the first NON-EMPTY entry.
  if (value.includes(",")) {
    const firstNonEmpty = value
      .split(",")
      .map((part) => part.trim())
      .find((part) => part.length > 0);
    value = firstNonEmpty || "";
  }

  // Strip any stray leading whitespace/punctuation.
  value = value.trim().replace(/^[,\s]+/, "").trim();

  value = stripTrailingSlash(value);
  if (!value) {
    return "";
  }

  // Guarantee the "/api" suffix. Only append when the path doesn't already
  // end in /api (case-insensitive), so we never produce ".../api/api".
  if (!/\/api$/i.test(value)) {
    value = `${value}/api`;
  }

  return value;
}

export function getApiBaseUrl(): string {
  if (CONFIGURED_API_BASE_URL) {
    const normalized = normalizeApiBaseUrl(CONFIGURED_API_BASE_URL);
    if (normalized) {
      return normalized;
    }
  }

  if (typeof window !== "undefined") {
    const runtimeApiBaseUrl = window.__ANTARIYA_RUNTIME_CONFIG__?.apiBaseUrl?.trim();

    if (runtimeApiBaseUrl) {
      const normalized = normalizeApiBaseUrl(runtimeApiBaseUrl);
      if (normalized) {
        return normalized;
      }
    }

    if (window.location.origin) {
      return `${stripTrailingSlash(window.location.origin)}/api`;
    }
  }

  return "/api";
}
