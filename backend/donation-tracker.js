import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

/**
 * DonationTracker manages donation records with persistent storage.
 * 
 * Responsibilities:
 * - Create donation records with initial "pending" status
 * - Update donation status as payments progress
 * - Store preimage for completed donations
 * - Persist donations to JSON file atomically
 * - Load donations on system startup
 * - Query donations by payment hash
 * 
 * Validates: Requirements 6.1, 6.4
 */
class DonationTracker {
  /**
   * Creates a new DonationTracker instance.
   * 
   * @param {string} storageFilePath - Path to JSON file for persistent storage
   */
  constructor(storageFilePath) {
    this.storageFilePath = storageFilePath;
    // In-memory Map for fast lookups by payment hash
    this.donations = new Map();
  }

  /**
   * Creates a new donation record with "pending" status.
   * 
   * @param {Object} params - Donation parameters
   * @param {number} params.amount - Amount in satoshis
   * @param {string} params.paymentHash - Lightning payment hash (hex)
   * @param {string} params.description - Payment description
   * @param {string} params.paymentRequest - BOLT11 invoice string
   * @returns {Promise<Object>} Created donation record
   */
  async createDonation({ amount, paymentHash, description, paymentRequest }) {
    const donation = {
      id: uuidv4(),
      amount,
      description,
      paymentHash,
      paymentRequest,
      preimage: null,
      status: 'pending',
      error: null,
      createdAt: new Date().toISOString(),
      completedAt: null,
      expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour default
    };

    this.donations.set(paymentHash, donation);
    await this.saveToDisk();
    
    return donation;
  }

  /**
   * Updates the status of an existing donation.
   * 
   * @param {string} paymentHash - Payment hash to identify donation
   * @param {string} status - New status: 'pending' | 'completed' | 'expired' | 'failed'
   * @param {Object} metadata - Optional metadata
   * @param {string} metadata.preimage - Preimage for completed donations
   * @param {string} metadata.error - Error message for failed donations
   * @param {Date} metadata.completedAt - Completion timestamp
   * @returns {Promise<void>}
   */
  async updateDonationStatus(paymentHash, status, metadata = {}) {
    const donation = this.donations.get(paymentHash);
    
    if (!donation) {
      throw new Error(`Donation not found for payment hash: ${paymentHash}`);
    }

    donation.status = status;
    
    if (metadata.preimage) {
      donation.preimage = metadata.preimage;
    }
    
    if (metadata.error) {
      donation.error = metadata.error;
    }
    
    if (metadata.completedAt) {
      donation.completedAt = metadata.completedAt.toISOString();
    }

    await this.saveToDisk();
  }

  /**
   * Retrieves a donation by payment hash.
   * 
   * @param {string} paymentHash - Payment hash to lookup
   * @returns {Promise<Object|null>} Donation record or null if not found
   */
  async getDonationByHash(paymentHash) {
    return this.donations.get(paymentHash) || null;
  }

  /**
   * Retrieves all donation records.
   * 
   * @returns {Promise<Array>} Array of all donation records
   */
  async getAllDonations() {
    return Array.from(this.donations.values());
  }

  /**
   * Loads donation records from disk into memory.
   * Creates the data directory if it doesn't exist.
   * Handles corrupted JSON gracefully.
   * 
   * @returns {Promise<void>}
   */
  async loadFromDisk() {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(this.storageFilePath);
      await fs.mkdir(dir, { recursive: true });

      // Try to read the file
      const data = await fs.readFile(this.storageFilePath, 'utf8');
      const donations = JSON.parse(data);

      // Populate the Map
      this.donations.clear();
      for (const donation of donations) {
        this.donations.set(donation.paymentHash, donation);
      }

      console.log(`Loaded ${donations.length} donations from disk`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, start with empty state
        console.log('No existing donations file found, starting fresh');
      } else if (error instanceof SyntaxError) {
        // Corrupted JSON
        console.error('Corrupted donations file, starting with empty state:', error.message);
      } else {
        // Other errors
        console.error('Error loading donations from disk:', error.message);
      }
    }
  }

  /**
   * Saves donation records to disk atomically.
   * Uses temp file + rename to prevent corruption.
   * 
   * @returns {Promise<void>}
   */
  async saveToDisk() {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(this.storageFilePath);
      await fs.mkdir(dir, { recursive: true });

      // Convert Map to array
      const donations = Array.from(this.donations.values());

      // Write to temp file first (atomic write)
      const tempPath = `${this.storageFilePath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(donations, null, 2), 'utf8');

      // Rename temp file to target (atomic operation)
      await fs.rename(tempPath, this.storageFilePath);
    } catch (error) {
      console.error('Error saving donations to disk:', error.message);
      throw error;
    }
  }
}

export default DonationTracker;
