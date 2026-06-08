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
  return value.replace(/\/$/, "");
}

export function getApiBaseUrl(): string {
  if (CONFIGURED_API_BASE_URL) {
    return stripTrailingSlash(CONFIGURED_API_BASE_URL);
  }

  if (typeof window !== "undefined") {
    const runtimeApiBaseUrl = window.__ANTARIYA_RUNTIME_CONFIG__?.apiBaseUrl?.trim();

    if (runtimeApiBaseUrl) {
      return stripTrailingSlash(runtimeApiBaseUrl);
    }

    if (window.location.origin) {
      return `${stripTrailingSlash(window.location.origin)}/api`;
    }
  }

  return "/api";
}