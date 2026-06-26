/**
 * Abstract Base Class for Shipping Providers
 * All shipping providers must implement this interface.
 * Supports: Shiprocket, DHL, FedEx, etc. (extensible design)
 */
class BaseShippingProvider {
  /**
   * Initialize provider with credentials.
   * @param {object} config - Provider configuration (API key, URL, etc.)
   */
  constructor(config = {}) {
    if (new.target === BaseShippingProvider) {
      throw new TypeError("BaseShippingProvider is abstract and cannot be instantiated directly");
    }
    this.config = config;
    this.name = this.constructor.name;
  }

  /**
   * Create shipment with provider.
   * MUST be implemented by subclasses.
   * @param {object} shipmentData - Shipment details
   * @returns {Promise<{trackingNumber, providerId, shipmentId}>}
   */
  async createShipment(shipmentData) {
    throw new Error(`${this.name}.createShipment() not implemented`);
  }

  /**
   * Get tracking information.
   * MUST be implemented by subclasses.
   * @param {string} trackingNumber - Tracking number from provider
   * @returns {Promise<{status, currentLocation, lastUpdate, events}>}
   */
  async getTracking(trackingNumber) {
    throw new Error(`${this.name}.getTracking() not implemented`);
  }

  /**
   * Get courier/carrier status.
   * MUST be implemented by subclasses.
   * @param {string} trackingNumber - Tracking number
   * @returns {Promise<{courier, status, lastMile, estimatedDelivery}>}
   */
  async getCourierStatus(trackingNumber) {
    throw new Error(`${this.name}.getCourierStatus() not implemented`);
  }

  /**
   * Generate shipping label.
   * MUST be implemented by subclasses.
   * @param {string} trackingNumber - Tracking number
   * @returns {Promise<{labelUrl, labelPdf, labelBase64, format}>}
   */
  async generateLabel(trackingNumber) {
    throw new Error(`${this.name}.generateLabel() not implemented`);
  }

  /**
   * Get delivery estimate.
   * MUST be implemented by subclasses.
   * @param {string} trackingNumber - Tracking number
   * @returns {Promise<{estimatedDeliveryDate, minDays, maxDays, shippingMode}>}
   */
  async getDeliveryEstimate(trackingNumber) {
    throw new Error(`${this.name}.getDeliveryEstimate() not implemented`);
  }

  /**
   * Validate provider credentials.
   * MUST be implemented by subclasses.
   * @returns {Promise<boolean>} - true if credentials valid
   */
  async validateCredentials() {
    throw new Error(`${this.name}.validateCredentials() not implemented`);
  }

  /**
   * Cancel shipment (if supported).
   * Optional - implement if provider supports.
   * @param {string} trackingNumber - Tracking number
   * @returns {Promise<{success, message}>}
   */
  async cancelShipment(trackingNumber) {
    return {
      success: false,
      message: `${this.name} does not support shipment cancellation`,
    };
  }

  /**
   * Helper to log provider operations.
   * @param {string} action - Action name
   * @param {object} data - Data to log
   */
  _log(action, data) {
    console.log(`[${this.name}] ${action}:`, data);
  }

  /**
   * Helper to log provider errors.
   * @param {string} action - Action name
   * @param {Error} error - Error object
   */
  _logError(action, error) {
    console.error(`[${this.name}] ${action} failed:`, error.message);
  }
}

module.exports = BaseShippingProvider;
