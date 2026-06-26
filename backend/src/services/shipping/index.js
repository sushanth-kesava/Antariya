const ShiprocketProvider = require("./shiprocket.provider");

/**
 * Shipping Provider Factory and Manager
 * Manages provider selection and initialization.
 * Supports multiple providers: Shiprocket, DHL, FedEx, etc.
 */
class ShippingProviderManager {
  static providers = {
    shiprocket: ShiprocketProvider,
    // Future providers:
    // dhl: DHLProvider,
    // fedex: FedexProvider,
    // bluedart: BluedarProvider,
  };

  /**
   * Get provider instance by name.
   * @param {string} providerName - Provider name (e.g., 'shiprocket')
   * @param {object} config - Provider configuration
   * @returns {BaseShippingProvider} - Provider instance
   * @throws {Error} - If provider not found
   */
  static getProvider(providerName, config = {}) {
    const normalizedName = (providerName || "").toLowerCase().trim();

    if (!this.providers[normalizedName]) {
      const available = Object.keys(this.providers).join(", ");
      throw new Error(
        `Shipping provider '${providerName}' not found. Available: ${available}`
      );
    }

    const ProviderClass = this.providers[normalizedName];
    return new ProviderClass(config);
  }

  /**
   * Get default provider based on environment config.
   * @returns {BaseShippingProvider}
   */
  static getDefaultProvider() {
    const defaultProvider = process.env.SHIPPING_PROVIDER || "shiprocket";
    return this.getProvider(defaultProvider);
  }

  /**
   * Register a new provider.
   * Allows extensibility for custom providers.
   * @param {string} name - Provider name
   * @param {class} ProviderClass - Provider class extending BaseShippingProvider
   */
  static registerProvider(name, ProviderClass) {
    const normalizedName = name.toLowerCase().trim();
    if (this.providers[normalizedName]) {
      console.warn(`[ShippingProviderManager] Overwriting provider: ${normalizedName}`);
    }
    this.providers[normalizedName] = ProviderClass;
    console.log(`[ShippingProviderManager] Registered provider: ${normalizedName}`);
  }

  /**
   * List all registered providers.
   * @returns {string[]} - Array of provider names
   */
  static listProviders() {
    return Object.keys(this.providers);
  }

  /**
   * Check if provider exists.
   * @param {string} providerName - Provider name
   * @returns {boolean}
   */
  static hasProvider(providerName) {
    const normalizedName = (providerName || "").toLowerCase().trim();
    return !!this.providers[normalizedName];
  }

  /**
   * Get provider info/status.
   * @param {string} providerName - Provider name
   * @returns {object} - Provider info including availability
   */
  static getProviderInfo(providerName) {
    const normalizedName = (providerName || "").toLowerCase().trim();
    const exists = this.hasProvider(normalizedName);

    return {
      name: normalizedName,
      exists,
      status: exists ? "available" : "not_found",
      implementation: exists ? "ready" : "not_available",
    };
  }
}

module.exports = ShippingProviderManager;
