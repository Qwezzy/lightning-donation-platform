/**
 * StatusMonitor monitors invoice payment status and provides real-time updates.
 * Implements caching to avoid excessive LND queries.
 */
class StatusMonitor {
  /**
   * Create a new Status Monitor
   * @param {Object} lightningClient - LightningClient instance
   * @param {Object} donationTracker - DonationTracker instance
   * @param {Object} proofManager - ProofManager instance
   */
  constructor(lightningClient, donationTracker, proofManager) {
    this.lightningClient = lightningClient;
    this.donationTracker = donationTracker;
    this.proofManager = proofManager;
    
    // Cache for status checks: Map<paymentHash, { timestamp, status }>
    // Ensures max 1 check per second per invoice
    this.statusCache = new Map();
    
    // Cache TTL in milliseconds (1 second)
    this.cacheTTL = 1000;
  }

  /**
   * Check if cached status is still valid (less than 1 second old)
   * @param {string} paymentHash - Payment hash to check
   * @returns {Object|null} Cached status or null if expired/not found
   * @private
   */
  _getCachedStatus(paymentHash) {
    const cached = this.statusCache.get(paymentHash);
    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.timestamp < this.cacheTTL) {
      return cached.status;
    }

    // Cache expired, remove it
    this.statusCache.delete(paymentHash);
    return null;
  }

  /**
   * Store status in cache
   * @param {string} paymentHash - Payment hash
   * @param {Object} status - Status object to cache
   * @private
   */
  _setCachedStatus(paymentHash, status) {
    this.statusCache.set(paymentHash, {
      timestamp: Date.now(),
      status: status
    });
  }

  /**
   * Check payment status for an invoice
   * Queries invoice status via InvoiceGenerator, checks if settled/expired,
   * stores proof if settled, updates donation status if expired
   * @param {string} paymentHash - Payment hash (hex)
   * @returns {Promise<Object>} Status and donation information
   * @property {string} status - 'pending' | 'completed' | 'expired' | 'failed'
   * @property {string} [preimage] - Payment preimage if completed (hex)
   * @property {Object} donation - Donation record
   * @throws {Error} If donation not found or status check fails
   */
  async checkPaymentStatus(paymentHash) {
    // Check cache first
    const cachedStatus = this._getCachedStatus(paymentHash);
    if (cachedStatus) {
      return cachedStatus;
    }

    // Get donation record
    const donation = await this.donationTracker.getDonationByHash(paymentHash);
    if (!donation) {
      throw new Error(`Donation not found for payment hash: ${paymentHash}`);
    }

    // If donation is already in a terminal state, return it immediately
    if (donation.status === 'completed' || donation.status === 'expired' || donation.status === 'failed') {
      const result = {
        status: donation.status,
        donation: donation
      };
      
      if (donation.preimage) {
        result.preimage = donation.preimage;
      }
      
      this._setCachedStatus(paymentHash, result);
      return result;
    }

    // Query invoice status from LND
    // We need to use InvoiceGenerator's checkInvoiceStatus method
    // Since we don't have direct access to InvoiceGenerator, we'll use the LightningClient
    // to query the invoice directly
    try {
      const { getInvoice } = await import('ln-service');
      
      const invoice = await getInvoice({
        lnd: this.lightningClient.lnd,
        id: paymentHash
      });

      const expiresAt = new Date(invoice.expires_at);
      const currentTime = new Date();
      const isExpired = currentTime > expiresAt;
      const isSettled = invoice.is_confirmed;

      let result;

      if (isSettled) {
        // Payment completed - store proof
        const preimage = invoice.secret;
        const settledAt = new Date(invoice.confirmed_at);

        await this.proofManager.storeProof({
          paymentHash: paymentHash,
          preimage: preimage,
          completedAt: settledAt
        });

        // Get updated donation record
        const updatedDonation = await this.donationTracker.getDonationByHash(paymentHash);

        result = {
          status: 'completed',
          preimage: preimage,
          donation: updatedDonation
        };
      } else if (isExpired) {
        // Invoice expired - update donation status
        await this.donationTracker.updateDonationStatus(
          paymentHash,
          'expired',
          {}
        );

        // Get updated donation record
        const updatedDonation = await this.donationTracker.getDonationByHash(paymentHash);

        result = {
          status: 'expired',
          donation: updatedDonation
        };
      } else {
        // Still pending
        result = {
          status: 'pending',
          donation: donation
        };
      }

      // Cache the result
      this._setCachedStatus(paymentHash, result);
      
      return result;
    } catch (error) {
      throw new Error(`Failed to check payment status: ${error.message}`);
    }
  }

  /**
   * Start monitoring an invoice (placeholder for future real-time monitoring)
   * @param {string} paymentHash - Payment hash to monitor
   * @returns {Promise<void>}
   */
  async startMonitoring(paymentHash) {
    // Placeholder for future implementation using ln-service.subscribeToInvoice
    // For now, polling via checkPaymentStatus is sufficient
  }

  /**
   * Stop monitoring an invoice (placeholder for future real-time monitoring)
   * @param {string} paymentHash - Payment hash to stop monitoring
   * @returns {Promise<void>}
   */
  async stopMonitoring(paymentHash) {
    // Placeholder for future implementation
    // Clear cache entry when stopping monitoring
    this.statusCache.delete(paymentHash);
  }
}

export default StatusMonitor;
