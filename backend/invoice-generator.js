import { createInvoice, getInvoice, parsePaymentRequest } from 'ln-service';

/**
 * InvoiceGenerator handles creation and management of Lightning invoices
 * for recipients.
 */
class InvoiceGenerator {
  /**
   * Create a new Invoice Generator
   * @param {Object} lightningClient - LightningClient instance
   */
  constructor(lightningClient) {
    this.lightningClient = lightningClient;
  }

  /**
   * Generate a Lightning invoice with specified amount and description
   * @param {Object} params - Invoice parameters
   * @param {number} params.amount - Amount in satoshis (minimum 1)
   * @param {string} params.description - Invoice description
   * @param {number} [params.expirySeconds=3600] - Expiry time in seconds (default 1 hour)
   * @returns {Promise<Object>} Invoice details
   * @property {string} paymentRequest - BOLT11 invoice string
   * @property {string} paymentHash - Payment hash (hex)
   * @property {Date} expiresAt - Expiration timestamp
   * @throws {Error} If amount is invalid or invoice creation fails
   */
  async generateInvoice(params) {
    const { amount, description, expirySeconds = 3600 } = params;

    // Validate amount >= 1 satoshi
    if (!amount || amount < 1) {
      throw new Error('Amount must be at least 1 satoshi');
    }

    // Validate amount is an integer
    if (!Number.isInteger(amount)) {
      throw new Error('Amount must be an integer');
    }

    // Validate description is provided
    if (!description || typeof description !== 'string' || description.trim() === '') {
      throw new Error('Description must be a non-empty string');
    }

    // Ensure LND is connected
    if (!this.lightningClient.lnd) {
      throw new Error('LND not connected. Call connect() first.');
    }

    try {
      // Calculate expiration time
      const expiresAt = new Date(Date.now() + expirySeconds * 1000);

      // Create invoice using ln-service
      const invoice = await createInvoice({
        lnd: this.lightningClient.lnd,
        tokens: amount,
        description: description,
        expires_at: expiresAt.toISOString()
      });

      return {
        paymentRequest: invoice.request,
        paymentHash: invoice.id,
        expiresAt: expiresAt
      };
    } catch (error) {
      throw new Error(`Failed to create invoice: ${error.message}`);
    }
  }

  /**
   * Check the status of an invoice by payment hash
   * @param {string} paymentHash - Payment hash (hex)
   * @returns {Promise<Object>} Invoice status
   * @property {boolean} settled - Whether the invoice has been paid
   * @property {string} [preimage] - Payment preimage if settled (hex)
   * @property {Date} [settledAt] - Settlement timestamp if settled
   * @property {Date} expiresAt - Expiration timestamp
   * @property {boolean} expired - Whether the invoice has expired (current time > expiresAt)
   * @throws {Error} If invoice lookup fails
   */
  async checkInvoiceStatus(paymentHash) {
    // Ensure LND is connected
    if (!this.lightningClient.lnd) {
      throw new Error('LND not connected. Call connect() first.');
    }

    try {
      // Get invoice details from LND
      const invoice = await getInvoice({
        lnd: this.lightningClient.lnd,
        id: paymentHash
      });

      const expiresAt = new Date(invoice.expires_at);
      const currentTime = new Date();
      
      const result = {
        settled: invoice.is_confirmed,
        expiresAt: expiresAt,
        expired: currentTime > expiresAt
      };

      // Add preimage and settlement time if invoice is settled
      if (invoice.is_confirmed) {
        result.preimage = invoice.secret;
        result.settledAt = new Date(invoice.confirmed_at);
      }

      return result;
    } catch (error) {
      throw new Error(`Failed to check invoice status: ${error.message}`);
    }
  }

  /**
   * Decode a BOLT11 invoice to extract payment details
   * @param {string} paymentRequest - BOLT11 invoice string
   * @returns {Promise<Object>} Decoded invoice details
   * @property {string} paymentHash - Payment hash (hex)
   * @property {number} amount - Amount in satoshis
   * @property {string} destination - Destination node public key
   * @property {string} description - Invoice description
   * @throws {Error} If invoice decoding fails
   */
  async decodeInvoice(paymentRequest) {
    try {
      const decoded = await parsePaymentRequest({
        request: paymentRequest
      });

      return {
        paymentHash: decoded.id,
        amount: decoded.tokens,
        destination: decoded.destination,
        description: decoded.description
      };
    } catch (error) {
      throw new Error(`Failed to decode invoice: ${error.message}`);
    }
  }
}

export default InvoiceGenerator;
