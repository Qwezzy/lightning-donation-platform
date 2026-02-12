import fs from 'fs';
import { authenticatedLndGrpc, getWalletInfo, getChannels } from 'ln-service';

/**
 * LightningClient provides a clean abstraction over LND's gRPC API
 * using the ln-service library.
 */
class LightningClient {
  /**
   * Create a new Lightning client
   * @param {Object} config - Configuration object
   * @param {string} config.lndSocket - LND socket address (e.g., 'localhost:10009')
   * @param {string} config.tlsCertPath - Path to TLS certificate file
   * @param {string} config.macaroonPath - Path to macaroon file
   */
  constructor(config) {
    this.lndSocket = config.lndSocket;
    this.tlsCertPath = config.tlsCertPath;
    this.macaroonPath = config.macaroonPath;
    this.lnd = null;
  }

  /**
   * Connect to LND using authenticated gRPC with exponential backoff retry
   * Reads TLS cert and macaroon from file system
   * @param {Object} options - Connection options
   * @param {number} options.maxRetries - Maximum number of retry attempts (default: 6)
   * @param {number[]} options.retryDelays - Array of retry delays in milliseconds (default: [1000, 2000, 4000, 8000, 16000, 30000])
   * @returns {Promise<{lnd: Object}>} Authenticated LND object
   * @throws {Error} If connection fails after all retries or credentials are invalid
   */
  async connect(options = {}) {
    const maxRetries = options.maxRetries || 6;
    const retryDelays = options.retryDelays || [1000, 2000, 4000, 8000, 16000, 30000];
    
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Validate that credential files exist
        if (!fs.existsSync(this.tlsCertPath)) {
          throw new Error(`TLS certificate not found at path: ${this.tlsCertPath}`);
        }
        
        if (!fs.existsSync(this.macaroonPath)) {
          throw new Error(`Macaroon not found at path: ${this.macaroonPath}`);
        }

        // Read TLS certificate and macaroon from file system
        const cert = fs.readFileSync(this.tlsCertPath, 'utf8');
        const macaroon = fs.readFileSync(this.macaroonPath, 'base64');

        // Authenticate with LND using ln-service
        const { lnd } = authenticatedLndGrpc({
          cert,
          macaroon,
          socket: this.lndSocket
        });

        // Verify connection by attempting to get wallet info
        // This will throw if the connection is invalid
        await getWalletInfo({ lnd });

        // Store authenticated LND object for reuse
        this.lnd = lnd;

        return { lnd };
      } catch (error) {
        lastError = error;
        
        // Get error message safely
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        
        // Don't retry for credential/file errors - these won't be fixed by retrying
        if (errorMessage.includes('not found at path') || 
            errorMessage.includes('invalid credentials') ||
            errorMessage.includes('Invalid macaroon') ||
            errorMessage.includes('certificate') ||
            errorMessage.includes('ENOENT')) {
          throw new Error(`Invalid credentials: ${errorMessage}`);
        }
        
        // If this was the last attempt, throw the error
        if (attempt === maxRetries) {
          throw new Error(`Unreachable host: Failed to connect to LND at ${this.lndSocket} after ${maxRetries + 1} attempts. ${errorMessage}`);
        }
        
        // Wait before retrying with exponential backoff
        const delay = retryDelays[attempt] || 30000; // Cap at 30s
        await this._sleep(delay);
      }
    }
    
    // This should never be reached, but just in case
    const finalErrorMessage = lastError?.message || lastError?.toString() || 'Unknown error';
    throw new Error(`Connection failed: ${finalErrorMessage}`);
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get node information including public key, alias, and channel counts
   * @returns {Promise<Object>} Node information object
   * @property {string} publicKey - Node public key (hex)
   * @property {string} alias - Node alias
   * @property {number} numChannels - Total number of channels
   * @property {number} numActiveChannels - Number of active channels
   * @property {boolean} synced - Blockchain sync status
   * @throws {Error} If LND is not connected or query fails
   */
  async getNodeInfo() {
    if (!this.lnd) {
      throw new Error('LND not connected. Call connect() first.');
    }

    try {
      const walletInfo = await getWalletInfo({ lnd: this.lnd });

      return {
        publicKey: walletInfo.public_key,
        alias: walletInfo.alias,
        numChannels: walletInfo.active_channels_count + walletInfo.pending_channels_count,
        numActiveChannels: walletInfo.active_channels_count,
        synced: walletInfo.is_synced_to_chain
      };
    } catch (error) {
      throw new Error(`Failed to get node info: ${error.message}`);
    }
  }

  /**
   * List all channels with their capacity and balance information
   * @returns {Promise<Array<Object>>} Array of channel objects
   * @property {string} id - Channel ID
   * @property {number} capacity - Total capacity in satoshis
   * @property {number} localBalance - Local balance in satoshis
   * @property {number} remoteBalance - Remote balance in satoshis
   * @property {boolean} isActive - Channel active status
   * @property {string} remotePubkey - Remote node public key
   * @property {number} baseFee - Base fee in millisatoshis
   * @property {number} feeRate - Fee rate in parts per million
   * @throws {Error} If LND is not connected or query fails
   */
  async listChannels() {
    if (!this.lnd) {
      throw new Error('LND not connected. Call connect() first.');
    }

    try {
      const { channels } = await getChannels({ lnd: this.lnd });

      return channels.map(channel => ({
        id: channel.id,
        capacity: channel.capacity,
        localBalance: channel.local_balance,
        remoteBalance: channel.remote_balance,
        isActive: channel.is_active,
        remotePubkey: channel.partner_public_key,
        baseFee: channel.local_base_fee_mtokens ? parseInt(channel.local_base_fee_mtokens) / 1000 : 0,
        feeRate: channel.local_fee_rate || 0
      }));
    } catch (error) {
      throw new Error(`Failed to list channels: ${error.message}`);
    }
  }

}

export default LightningClient;
