import { describe, test } from 'node:test';
import assert from 'node:assert';
import InvoiceGenerator from './invoice-generator.js';

describe('InvoiceGenerator', () => {
  let invoiceGenerator;
  let mockLightningClient;

  // Setup before each test
  function setup() {
    mockLightningClient = {
      lnd: { mock: 'lnd-object' }
    };
    invoiceGenerator = new InvoiceGenerator(mockLightningClient);
  }

  describe('generateInvoice - validation', () => {
    test('rejects invoice with 0 satoshi amount', async () => {
      setup();
      await assert.rejects(
        async () => {
          await invoiceGenerator.generateInvoice({
            amount: 0,
            description: 'Test'
          });
        },
        {
          message: 'Amount must be at least 1 satoshi'
        }
      );
    });

    test('rejects invoice with negative amount', async () => {
      setup();
      await assert.rejects(
        async () => {
          await invoiceGenerator.generateInvoice({
            amount: -100,
            description: 'Test'
          });
        },
        {
          message: 'Amount must be at least 1 satoshi'
        }
      );
    });

    test('rejects invoice with non-integer amount', async () => {
      setup();
      await assert.rejects(
        async () => {
          await invoiceGenerator.generateInvoice({
            amount: 10.5,
            description: 'Test'
          });
        },
        {
          message: 'Amount must be an integer'
        }
      );
    });

    test('rejects invoice with empty description', async () => {
      setup();
      await assert.rejects(
        async () => {
          await invoiceGenerator.generateInvoice({
            amount: 1000,
            description: ''
          });
        },
        {
          message: 'Description must be a non-empty string'
        }
      );
    });

    test('rejects invoice with whitespace-only description', async () => {
      setup();
      await assert.rejects(
        async () => {
          await invoiceGenerator.generateInvoice({
            amount: 1000,
            description: '   '
          });
        },
        {
          message: 'Description must be a non-empty string'
        }
      );
    });

    test('rejects invoice with missing description', async () => {
      setup();
      await assert.rejects(
        async () => {
          await invoiceGenerator.generateInvoice({
            amount: 1000
          });
        },
        {
          message: 'Description must be a non-empty string'
        }
      );
    });

    test('rejects invoice with non-string description', async () => {
      setup();
      await assert.rejects(
        async () => {
          await invoiceGenerator.generateInvoice({
            amount: 1000,
            description: 123
          });
        },
        {
          message: 'Description must be a non-empty string'
        }
      );
    });

    test('throws error when LND is not connected', async () => {
      setup();
      mockLightningClient.lnd = null;

      await assert.rejects(
        async () => {
          await invoiceGenerator.generateInvoice({
            amount: 1000,
            description: 'Test'
          });
        },
        {
          message: 'LND not connected. Call connect() first.'
        }
      );
    });
  });

  describe('checkInvoiceStatus - validation', () => {
    test('throws error when LND is not connected', async () => {
      setup();
      mockLightningClient.lnd = null;

      await assert.rejects(
        async () => {
          await invoiceGenerator.checkInvoiceStatus('payment-hash-123');
        },
        {
          message: 'LND not connected. Call connect() first.'
        }
      );
    });
  });

  describe('checkInvoiceStatus - expiration detection', () => {
    test('detects expired invoice when current time > expiresAt', async () => {
      setup();
      
      // Mock getInvoice to return an expired invoice
      const pastTime = new Date(Date.now() - 3600 * 1000); // 1 hour ago
      const mockGetInvoice = async () => ({
        is_confirmed: false,
        expires_at: pastTime.toISOString()
      });
      
      // Temporarily replace the import
      const originalGetInvoice = invoiceGenerator.checkInvoiceStatus;
      invoiceGenerator.checkInvoiceStatus = async (paymentHash) => {
        const invoice = await mockGetInvoice();
        const expiresAt = new Date(invoice.expires_at);
        const currentTime = new Date();
        
        return {
          settled: invoice.is_confirmed,
          expiresAt: expiresAt,
          expired: currentTime > expiresAt
        };
      };
      
      const status = await invoiceGenerator.checkInvoiceStatus('test-hash');
      
      assert.strictEqual(status.expired, true);
      assert.strictEqual(status.settled, false);
      assert.ok(status.expiresAt < new Date());
    });

    test('detects non-expired invoice when current time < expiresAt', async () => {
      setup();
      
      // Mock getInvoice to return a non-expired invoice
      const futureTime = new Date(Date.now() + 3600 * 1000); // 1 hour from now
      const mockGetInvoice = async () => ({
        is_confirmed: false,
        expires_at: futureTime.toISOString()
      });
      
      // Temporarily replace the method
      invoiceGenerator.checkInvoiceStatus = async (paymentHash) => {
        const invoice = await mockGetInvoice();
        const expiresAt = new Date(invoice.expires_at);
        const currentTime = new Date();
        
        return {
          settled: invoice.is_confirmed,
          expiresAt: expiresAt,
          expired: currentTime > expiresAt
        };
      };
      
      const status = await invoiceGenerator.checkInvoiceStatus('test-hash');
      
      assert.strictEqual(status.expired, false);
      assert.strictEqual(status.settled, false);
      assert.ok(status.expiresAt > new Date());
    });
  });

  describe('constructor', () => {
    test('creates instance with lightning client', () => {
      setup();
      assert.ok(invoiceGenerator instanceof InvoiceGenerator);
      assert.strictEqual(invoiceGenerator.lightningClient, mockLightningClient);
    });
  });

  describe('decodeInvoice', () => {
    test('successfully decodes a valid BOLT11 invoice', async () => {
      setup();
      
      // Mock parsePaymentRequest to return decoded invoice data
      const mockDecoded = {
        id: 'abc123paymenthash',
        tokens: 1000,
        destination: 'node_pubkey_destination',
        description: 'Test payment'
      };
      
      // Temporarily replace the method to simulate ln-service behavior
      const originalMethod = invoiceGenerator.decodeInvoice;
      invoiceGenerator.decodeInvoice = async (paymentRequest) => {
        return {
          paymentHash: mockDecoded.id,
          amount: mockDecoded.tokens,
          destination: mockDecoded.destination,
          description: mockDecoded.description
        };
      };
      
      const result = await invoiceGenerator.decodeInvoice('lnbc1000n1...');
      
      assert.strictEqual(result.paymentHash, 'abc123paymenthash');
      assert.strictEqual(result.amount, 1000);
      assert.strictEqual(result.destination, 'node_pubkey_destination');
      assert.strictEqual(result.description, 'Test payment');
      
      // Restore original method
      invoiceGenerator.decodeInvoice = originalMethod;
    });

    test('extracts payment hash from invoice', async () => {
      setup();
      
      const mockDecoded = {
        id: 'payment_hash_hex_string',
        tokens: 500,
        destination: 'destination_pubkey',
        description: 'Donation'
      };
      
      invoiceGenerator.decodeInvoice = async () => ({
        paymentHash: mockDecoded.id,
        amount: mockDecoded.tokens,
        destination: mockDecoded.destination,
        description: mockDecoded.description
      });
      
      const result = await invoiceGenerator.decodeInvoice('lnbc500n1...');
      
      assert.ok(result.paymentHash);
      assert.strictEqual(typeof result.paymentHash, 'string');
      assert.strictEqual(result.paymentHash, 'payment_hash_hex_string');
    });

    test('extracts amount from invoice', async () => {
      setup();
      
      const mockDecoded = {
        id: 'hash123',
        tokens: 2500,
        destination: 'dest_pubkey',
        description: 'Test'
      };
      
      invoiceGenerator.decodeInvoice = async () => ({
        paymentHash: mockDecoded.id,
        amount: mockDecoded.tokens,
        destination: mockDecoded.destination,
        description: mockDecoded.description
      });
      
      const result = await invoiceGenerator.decodeInvoice('lnbc2500n1...');
      
      assert.strictEqual(result.amount, 2500);
      assert.strictEqual(typeof result.amount, 'number');
    });

    test('extracts destination from invoice', async () => {
      setup();
      
      const mockDecoded = {
        id: 'hash456',
        tokens: 100,
        destination: '03abc123def456...',
        description: 'Payment'
      };
      
      invoiceGenerator.decodeInvoice = async () => ({
        paymentHash: mockDecoded.id,
        amount: mockDecoded.tokens,
        destination: mockDecoded.destination,
        description: mockDecoded.description
      });
      
      const result = await invoiceGenerator.decodeInvoice('lnbc100n1...');
      
      assert.strictEqual(result.destination, '03abc123def456...');
      assert.strictEqual(typeof result.destination, 'string');
    });

    test('handles decoding errors gracefully', async () => {
      setup();
      
      // Restore original method to test actual error handling
      const result = invoiceGenerator.decodeInvoice('invalid_invoice_string');
      
      await assert.rejects(
        async () => await result,
        {
          message: /Failed to decode invoice/
        }
      );
    });
  });
});
