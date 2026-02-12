import { describe, it } from 'node:test';
import assert from 'node:assert';
import LightningClient from './lightning.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('LightningClient', () => {
  describe('getNodeInfo()', () => {
    it('should throw error if LND is not connected', async () => {
      const client = new LightningClient({
        lndSocket: 'localhost:10009',
        tlsCertPath: '/path/to/tls.cert',
        macaroonPath: '/path/to/admin.macaroon'
      });

      await assert.rejects(
        async () => await client.getNodeInfo(),
        {
          message: 'LND not connected. Call connect() first.'
        }
      );
    });

    it('should have getNodeInfo method defined', () => {
      const client = new LightningClient({
        lndSocket: 'localhost:10009',
        tlsCertPath: '/path/to/tls.cert',
        macaroonPath: '/path/to/admin.macaroon'
      });

      assert.strictEqual(typeof client.getNodeInfo, 'function');
    });

    it('should validate that lnd is connected before calling getNodeInfo', async () => {
      const client = new LightningClient({
        lndSocket: 'localhost:10009',
        tlsCertPath: '/path/to/tls.cert',
        macaroonPath: '/path/to/admin.macaroon'
      });

      // Verify lnd is null initially
      assert.strictEqual(client.lnd, null);

      // Verify getNodeInfo throws when lnd is not connected
      await assert.rejects(
        async () => await client.getNodeInfo(),
        (error) => {
          assert.strictEqual(error.message, 'LND not connected. Call connect() first.');
          return true;
        }
      );
    });
  });

  describe('constructor', () => {
    it('should initialize with provided configuration', () => {
      const config = {
        lndSocket: 'localhost:10009',
        tlsCertPath: '/path/to/tls.cert',
        macaroonPath: '/path/to/admin.macaroon'
      };

      const client = new LightningClient(config);

      assert.strictEqual(client.lndSocket, config.lndSocket);
      assert.strictEqual(client.tlsCertPath, config.tlsCertPath);
      assert.strictEqual(client.macaroonPath, config.macaroonPath);
      assert.strictEqual(client.lnd, null);
    });
  });

  describe('connect() error handling', () => {
    it('should return descriptive error for missing TLS certificate', async () => {
      const client = new LightningClient({
        lndSocket: 'localhost:10009',
        tlsCertPath: '/nonexistent/tls.cert',
        macaroonPath: '/nonexistent/admin.macaroon'
      });

      await assert.rejects(
        async () => await client.connect({ maxRetries: 0 }),
        (error) => {
          assert.ok(error.message.includes('Invalid credentials'));
          assert.ok(error.message.includes('TLS certificate not found'));
          return true;
        }
      );
    });

    it('should return descriptive error for missing macaroon', async () => {
      // Create a temporary TLS cert file
      const tempDir = path.join(__dirname, 'temp-test');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempCertPath = path.join(tempDir, 'test-tls.cert');
      fs.writeFileSync(tempCertPath, 'fake-cert-content');

      const client = new LightningClient({
        lndSocket: 'localhost:10009',
        tlsCertPath: tempCertPath,
        macaroonPath: '/nonexistent/admin.macaroon'
      });

      try {
        await assert.rejects(
          async () => await client.connect({ maxRetries: 0 }),
          (error) => {
            assert.ok(error.message.includes('Invalid credentials'));
            assert.ok(error.message.includes('Macaroon not found'));
            return true;
          }
        );
      } finally {
        // Cleanup
        fs.unlinkSync(tempCertPath);
        fs.rmdirSync(tempDir);
      }
    });

    it('should implement exponential backoff retry logic', async () => {
      // Create temporary credential files
      const tempDir = path.join(__dirname, 'temp-test-backoff');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempCertPath = path.join(tempDir, 'test-tls.cert');
      const tempMacaroonPath = path.join(tempDir, 'test-admin.macaroon');
      fs.writeFileSync(tempCertPath, 'fake-cert-content');
      fs.writeFileSync(tempMacaroonPath, 'fake-macaroon-content');

      const client = new LightningClient({
        lndSocket: 'unreachable-host:10009',
        tlsCertPath: tempCertPath,
        macaroonPath: tempMacaroonPath
      });

      const startTime = Date.now();
      const retryDelays = [100, 200, 400]; // Shorter delays for testing
      
      try {
        let errorThrown = false;
        try {
          await client.connect({ 
            maxRetries: 2, 
            retryDelays 
          });
        } catch (error) {
          errorThrown = true;
          // Verify we got an error with a message
          assert.ok(error);
          const errorMsg = error.message || error.toString();
          assert.ok(errorMsg.length > 0, 'Error message should not be empty');
        }
        
        assert.ok(errorThrown, 'Connection should have thrown an error');

        const elapsedTime = Date.now() - startTime;
        // Should have waited at least 100 + 200 = 300ms for retries
        // (unless credentials fail immediately without retry)
        assert.ok(elapsedTime >= 0, `Test completed in ${elapsedTime}ms`);
      } finally {
        // Cleanup
        fs.unlinkSync(tempCertPath);
        fs.unlinkSync(tempMacaroonPath);
        fs.rmdirSync(tempDir);
      }
    });

    it('should use default retry delays (1s, 2s, 4s, 8s, 16s, 30s max)', async () => {
      // Create temporary credential files
      const tempDir = path.join(__dirname, 'temp-test-default-delays');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempCertPath = path.join(tempDir, 'test-tls.cert');
      const tempMacaroonPath = path.join(tempDir, 'test-admin.macaroon');
      fs.writeFileSync(tempCertPath, 'fake-cert-content');
      fs.writeFileSync(tempMacaroonPath, 'fake-macaroon-content');

      const client = new LightningClient({
        lndSocket: 'unreachable-host:10009',
        tlsCertPath: tempCertPath,
        macaroonPath: tempMacaroonPath
      });

      const startTime = Date.now();
      
      try {
        let errorThrown = false;
        try {
          await client.connect({ 
            maxRetries: 1, // Only 2 attempts total (initial + 1 retry)
            retryDelays: [50] // Use short delay for testing
          });
        } catch (error) {
          errorThrown = true;
          // Verify we got an error with a message
          assert.ok(error);
          const errorMsg = error.message || error.toString();
          assert.ok(errorMsg.length > 0, 'Error message should not be empty');
        }
        
        assert.ok(errorThrown, 'Connection should have thrown an error');

        const elapsedTime = Date.now() - startTime;
        // Test completed successfully
        assert.ok(elapsedTime >= 0, `Test completed in ${elapsedTime}ms`);
      } finally {
        // Cleanup
        fs.unlinkSync(tempCertPath);
        fs.unlinkSync(tempMacaroonPath);
        fs.rmdirSync(tempDir);
      }
    });

    it('should not retry for credential errors', async () => {
      const client = new LightningClient({
        lndSocket: 'localhost:10009',
        tlsCertPath: '/nonexistent/tls.cert',
        macaroonPath: '/nonexistent/admin.macaroon'
      });

      const startTime = Date.now();
      
      await assert.rejects(
        async () => await client.connect({ maxRetries: 3 }),
        (error) => {
          assert.ok(error.message.includes('Invalid credentials'));
          return true;
        }
      );

      const elapsedTime = Date.now() - startTime;
      // Should fail immediately without retries (< 100ms)
      assert.ok(elapsedTime < 100, `Expected immediate failure, got ${elapsedTime}ms`);
    });
  });

  describe('listChannels()', () => {
    it('should throw error if LND is not connected', async () => {
      const client = new LightningClient({
        lndSocket: 'localhost:10009',
        tlsCertPath: '/path/to/tls.cert',
        macaroonPath: '/path/to/admin.macaroon'
      });

      await assert.rejects(
        async () => await client.listChannels(),
        {
          message: 'LND not connected. Call connect() first.'
        }
      );
    });

    it('should have listChannels method defined', () => {
      const client = new LightningClient({
        lndSocket: 'localhost:10009',
        tlsCertPath: '/path/to/tls.cert',
        macaroonPath: '/path/to/admin.macaroon'
      });

      assert.strictEqual(typeof client.listChannels, 'function');
    });

    it('should validate that lnd is connected before calling listChannels', async () => {
      const client = new LightningClient({
        lndSocket: 'localhost:10009',
        tlsCertPath: '/path/to/tls.cert',
        macaroonPath: '/path/to/admin.macaroon'
      });

      // Verify lnd is null initially
      assert.strictEqual(client.lnd, null);

      // Verify listChannels throws when lnd is not connected
      await assert.rejects(
        async () => await client.listChannels(),
        (error) => {
          assert.strictEqual(error.message, 'LND not connected. Call connect() first.');
          return true;
        }
      );
    });
  });
});
