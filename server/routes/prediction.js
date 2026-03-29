const express = require('express');
const router = express.Router();

/**
 * POST /api/predict-heatmap
 * 
 * Proxy that forwards prediction requests to the Python ML service (port 5001).
 * Fetches waste report locations from MongoDB and sends them to the ML model
 * along with the target time parameters.
 */

const WasteReport = require('../models/WasteReport');

// ML Service URL
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

router.post('/predict-heatmap', async (req, res) => {
  try {
    const { target_hour = 10, target_day = 0 } = req.body;

    // 1. Get all waste report locations from MongoDB
    const reports = await WasteReport.find({}, { location: 1, address: 1, _id: 0 });
    
    if (reports.length === 0) {
      return res.status(404).json({ error: 'No waste report locations found' });
    }

    // 2. Build locations array for ML service
    //    Also add a grid of extra interpolation points for smoother heatmap
    const locations = [];
    
    // Include actual report locations
    for (const r of reports) {
      locations.push({ lat: r.location.lat, lng: r.location.lng });
    }

    // Add grid points around Mumbai for broader coverage
    const LAT_MIN = 18.93, LAT_MAX = 19.25;
    const LNG_MIN = 72.80, LNG_MAX = 72.98;
    const GRID_STEP = 0.015;

    for (let lat = LAT_MIN; lat <= LAT_MAX; lat += GRID_STEP) {
      for (let lng = LNG_MIN; lng <= LNG_MAX; lng += GRID_STEP) {
        locations.push({ lat: parseFloat(lat.toFixed(4)), lng: parseFloat(lng.toFixed(4)) });
      }
    }

    // 3. Call Python ML service
    const mlResponse = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations, target_hour, target_day }),
    });

    if (!mlResponse.ok) {
      const errText = await mlResponse.text();
      console.error('ML service error:', errText);
      return res.status(502).json({ error: 'ML service returned an error', details: errText });
    }

    const mlData = await mlResponse.json();

    // 4. Return predictions to frontend
    res.json({
      predictions: mlData.predictions,
      params: mlData.params,
      model_info: mlData.model_info,
      total_points: mlData.predictions.length,
    });

  } catch (error) {
    console.error('Prediction proxy error:', error.message);

    if (error.cause?.code === 'ECONNREFUSED') {
      return res.status(503).json({
        error: 'ML prediction service is not running',
        hint: 'Start the Python ML server: cd ml_service && python app.py',
      });
    }

    res.status(500).json({ error: 'Failed to get predictions', details: error.message });
  }
});

// GET /api/ml-health — Check if ML service is alive
router.get('/ml-health', async (req, res) => {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/health`);
    const data = await response.json();
    res.json({ ml_service: 'connected', ...data });
  } catch (error) {
    res.json({ ml_service: 'disconnected', error: error.message });
  }
});

module.exports = router;
