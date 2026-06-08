// Runtime configuration for the live Antariya site.
// This file is loaded at runtime to keep the shipped static export pointed at
// the production backend without requiring a rebuild.

(function() {
    const apiBaseUrl = 'https://api.antariyaofficial.com/api';

  // Export configuration
  window.__ANTARIYA_RUNTIME_CONFIG__ = {
    apiBaseUrl: apiBaseUrl
  };
})();
