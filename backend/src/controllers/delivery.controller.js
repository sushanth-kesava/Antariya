const axios = require("axios");
const env = require("../config/env");

function mapDelhiveryResponse(data, requestedPincode) {
  const deliveryCodes = Array.isArray(data?.delivery_codes) ? data.delivery_codes : [];

  if (deliveryCodes.length === 0) {
    return {
      success: true,
      available: false,
      message: "Delivery is not currently available for this pincode.",
    };
  }

  const postal = deliveryCodes[0]?.postal_code || {};
  const codSupported = postal.cod === "Y" || postal.cod === true;
  const prepaidSupported = postal.pre_paid === "Y" || postal.pre_paid === true;
  const district = postal.district || postal.city || "Unknown";
  const state = postal.state_code || postal.state || "Unknown";
  const dispatchDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const returnEligible = codSupported || prepaidSupported;

  return {
    success: true,
    available: true,
    message: "Delivery is available for this pincode.",
    pincode: requestedPincode,
    district,
    state,
    codSupported,
    prepaidSupported,
    eta: "2-7 business days",
    shipping: "Shipping calculated at checkout",
    estimatedDispatchDate: dispatchDate,
    lastMilePartner: "Delhivery",
    returnEligible,
  };
}

async function checkPincodeAvailability(req, res, next) {
  try {
    const pincode = String(req.query.pincode || "").trim();

    if (!/^\d{6}$/.test(pincode)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 6-digit Indian pincode.",
      });
    }

    if (!env.delhiveryApiKey) {
      return res.status(503).json({
        success: false,
        message: "Delivery service is not configured. Add DELHIVERY_API_KEY to backend environment.",
      });
    }

    const response = await axios.get(`${env.delhiveryBaseUrl}/c/api/pin-codes/json/`, {
      headers: {
        Authorization: `Token ${env.delhiveryApiKey}`,
      },
      params: {
        filter_codes: pincode,
      },
      timeout: 15000,
    });

    const mapped = mapDelhiveryResponse(response.data, pincode);
    return res.status(200).json(mapped);
  } catch (error) {
    const message = error?.response?.data?.detail || error?.response?.data?.message || error.message;

    if (error?.response?.status === 401 || error?.response?.status === 403) {
      return res.status(502).json({
        success: false,
        message: "Delhivery authentication failed. Verify DELHIVERY_API_KEY.",
      });
    }

    return res.status(502).json({
      success: false,
      message: `Delhivery availability check failed: ${message}`,
    });
  }
}

module.exports = {
  checkPincodeAvailability,
};
