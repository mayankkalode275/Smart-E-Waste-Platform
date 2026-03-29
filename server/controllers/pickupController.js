const PickupRequest = require('../models/PickupRequest');

/**
 * Controller for pickup request operations (Now including Marketplace features)
 */
const pickupController = {
  // POST /request-pickup — Create a new pickup request (Standard or Bulk)
  createRequest: async (req, res) => {
    try {
      const { address, location, preferredTime, wasteType, isBulk, weight, requestedBy } = req.body;
      if (!address || !location || !preferredTime) {
        return res.status(400).json({ error: 'Missing required fields: address, location, preferredTime' });
      }
      const request = new PickupRequest({ 
        address, 
        location, 
        preferredTime, 
        wasteType,
        isBulk: isBulk || false,
        weight: weight || null,
        requestedBy: requestedBy || 'User'
      });
      await request.save();
      res.status(201).json({ message: 'Pickup request created successfully', data: request });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create pickup request', details: error.message });
    }
  },

  // GET /pickup-requests — Get all pickup requests
  getAllRequests: async (req, res) => {
    try {
      const requests = await PickupRequest.find().sort({ timestamp: -1 });
      res.json({ data: requests, count: requests.length });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch pickup requests', details: error.message });
    }
  },

  // PATCH /pickup-requests/:id — Update pickup request status
  updateRequest: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, assignedVendor } = req.body;
      const updates = { status };
      if (assignedVendor) updates.assignedVendor = assignedVendor;

      const request = await PickupRequest.findByIdAndUpdate(id, updates, { new: true });
      if (!request) return res.status(404).json({ error: 'Request not found' });
      res.json({ message: 'Request updated', data: request });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update request', details: error.message });
    }
  },

  // POST /pickup-requests/:id/bid — Submit a bid for a bulk request (Vendor Role)
  submitBid: async (req, res) => {
    try {
      const { id } = req.params;
      const { vendorName, amount } = req.body;
      if (!vendorName || !amount) {
        return res.status(400).json({ error: 'vendorName and amount are required' });
      }

      const request = await PickupRequest.findById(id);
      if (!request) return res.status(404).json({ error: 'Request not found' });
      if (!request.isBulk) return res.status(400).json({ error: 'Bidding is only allowed on bulk requests' });

      request.bids.push({ vendorName, amount, status: 'Pending' });
      await request.save();

      res.status(201).json({ message: 'Bid submitted successfully', data: request });
    } catch (error) {
      res.status(500).json({ error: 'Failed to submit bid', details: error.message });
    }
  },

  // POST /pickup-requests/:id/accept-bid — Accept a vendor bid (Business Role)
  acceptBid: async (req, res) => {
    try {
      const { id } = req.params;
      const { bidId } = req.body;

      const request = await PickupRequest.findById(id);
      if (!request) return res.status(404).json({ error: 'Request not found' });

      const bid = request.bids.id(bidId);
      if (!bid) return res.status(404).json({ error: 'Bid not found' });

      // Reject all other bids and accept this one
      request.bids.forEach(b => {
        b.status = b._id.toString() === bidId ? 'Accepted' : 'Rejected';
      });

      // Update the main request
      request.status = 'Scheduled';
      request.assignedVendor = bid.vendorName;
      await request.save();

      res.json({ message: 'Bid accepted and pickup scheduled', data: request });
    } catch (error) {
      res.status(500).json({ error: 'Failed to accept bid', details: error.message });
    }
  }
};

module.exports = pickupController;
