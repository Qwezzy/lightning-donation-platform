import crypto from 'crypto';

/**
 * ProofManager manages cryptographic proof of payment delivery.
 * 
 * Responsibilities:
 * - Store preimage receipts for completed payments
 * - Verify preimage hashes to payment hash using SHA256
 * - Associate proofs with donation records
 * - Provide proof retrieval for donors
 * 
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4
 */
class ProofManager {
  /**
   * Creates a new ProofManager instance.
   * 
   * @param {DonationTracker} donationTracker - DonationTracker instance for storing proofs
   */
  constructor(donationTracker) {
    this.donationTracker = donationTracker;
  }

  /**
   * Verifies that a preimage correctly hashes to a payment hash.
   * 
   * @param {string} paymentHash - Payment hash (hex)
   * @param {string} preimage - Preimage to verify (hex)
   * @returns {boolean} True if preimage hashes to payment hash
   */
  verifyProof(paymentHash, preimage) {
    try {
      // Hash the preimage using SHA256
      const hash = crypto
        .createHash('sha256')
        .update(Buffer.from(preimage, 'hex'))
        .digest('hex');
      
      // Compare with payment hash
      return hash === paymentHash;
    } catch (error) {
      console.error('Error verifying proof:', error.message);
      return false;
    }
  }

  /**
   * Stores a proof by verifying the preimage and updating the donation record.
   * 
   * @param {Object} params - Proof parameters
   * @param {string} params.paymentHash - Payment hash (hex)
   * @param {string} params.preimage - Preimage (hex)
   * @param {Date} params.completedAt - Completion timestamp
   * @returns {Promise<void>}
   * @throws {Error} If preimage verification fails or donation not found
   */
  async storeProof({ paymentHash, preimage, completedAt }) {
    // Verify preimage hashes to payment hash
    if (!this.verifyProof(paymentHash, preimage)) {
      throw new Error('Preimage verification failed: hash mismatch');
    }

    // Update donation with preimage and set status to completed
    await this.donationTracker.updateDonationStatus(
      paymentHash,
      'completed',
      {
        preimage,
        completedAt
      }
    );
  }

  /**
   * Retrieves a proof for a given payment hash.
   * 
   * @param {string} paymentHash - Payment hash to lookup
   * @returns {Promise<Object>} Proof object with verified flag
   * @throws {Error} If donation not found or proof not available
   */
  async getProof(paymentHash) {
    // Retrieve donation by payment hash
    const donation = await this.donationTracker.getDonationByHash(paymentHash);
    
    if (!donation) {
      throw new Error(`Donation not found for payment hash: ${paymentHash}`);
    }

    if (!donation.preimage) {
      throw new Error(`Proof not available for payment hash: ${paymentHash}`);
    }

    // Verify proof integrity
    const verified = this.verifyProof(paymentHash, donation.preimage);

    return {
      preimage: donation.preimage,
      paymentHash: donation.paymentHash,
      verified,
      donation
    };
  }
}

export default ProofManager;
