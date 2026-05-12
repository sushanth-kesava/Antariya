// Runtime configuration for Antariya pre-launch website
// This file is loaded at runtime to allow dynamic API endpoint configuration
// without requiring a rebuild for different deployment environments

(function() {
  // Default: use the same origin (relative path)
  const apiBaseUrl = '';
  
  // Export configuration
  window.__ANTARIYA_RUNTIME_CONFIG__ = {
    apiBaseUrl: apiBaseUrl
  };
})();
