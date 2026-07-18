const ForecastService = require('../services/forecast.service');

exports.getDashboard = async (req, res) => {
  try {
    const data = await ForecastService.getDashboard();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
