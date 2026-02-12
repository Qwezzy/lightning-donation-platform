import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import ProofManager from './proof-manager.js';
import DonationTracker from './donation-tracker.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

describe('ProofManager', () => {
  const testStoragePath = path.join('backend', 'data', 'test-proof-donations.json');
  let tracker;
  let proofManager;

  beforeEach(async () => {
    tracker = new DonationTracker(testStoragePath);
    await tracker.loadFromDisk();
    proofManager = new ProofManager(tracker);
  });

  afterEach(async () => {
    // Clean up test file
    try {
      await fs.unlink(testStoragePath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  describe('verifyProof', () => {
    test('returns true when preimage correctly hashes to payment hash', () => {
      // Generate a random preimage
      const preimage = crypto.randomBytes(32).toString('hex');
      
      // Calculate the payment hash
      const paymentHash = crypto
        .createHash('sha256')
        .update(Buffer.from(preimage, 'hex'))
        .digest('hex');

      // Verify the proof
      const result = proofManager.verifyProof(paymentHash, preimage);
      
      assert.strictEqual(result, true);
    });

    test('returns false when preimage does not hash to payment hash', () => {
      const preimage = crypto.randomBytes(32).toString('hex');
      const wrongHash = crypto.randomBytes(32).toString('hex');

      const result = proofManager.verifyProof(wrongHash, preimage);
      
      assert.strictEqual(result, false);
    });

    test('returns false for invalid preimage format', () => {
      const paymentHash = crypto.randomBytes(32).toString('hex');
      const invalidPreimage = 'not-a-valid-hex-string';

      const result = proofManager.verifyProof(paymentHash, invalidPreimage);
      
      assert.strictEqual(result, false);
    });

    test('handles empty preimage gracefully', () => {
      const paymentHash = crypto.randomBytes(32).toString('hex');
      const emptyPreimage = '';

      const result = proofManager.verifyProof(paymentHash, emptyPreimage);
      
      assert.strictEqual(result, false);
    });
  });

  describe('storeProof', () => {
    test('stores proof with valid preimage and updates donation to completed', async () => {
      // Generate preimage and payment hash
      const preimage = crypto.randomBytes(32).toString('hex');
      const paymentHash = crypto
        .createHash('sha256')
        .update(Buffer.from(preimage, 'hex'))
        .digest('hex');

      // Create a donation
      await tracker.createDonation({
        amount: 5000,
        paymentHash,
        description: 'Test donation',
        paymentRequest: 'lnbc...'
      });

      // Store the proof
      const completedAt = new Date();
      await proofManager.storeProof({
        paymentHash,
        preimage,
        completedAt
      });

      // Verify the donation was updated
      const donation = await tracker.getDonationByHash(paymentHash);
      assert.strictEqual(donation.status, 'completed');
      assert.strictEqual(donation.preimage, preimage);
      assert.strictEqual(donation.completedAt, completedAt.toISOString());
    });

    test('throws error when preimage verification fails', async () => {
      const preimage = crypto.randomBytes(32).toString('hex');
      const wrongHash = crypto.randomBytes(32).toString('hex');

      // Create a donation with wrong hash
      await tracker.createDonation({
        amount: 1000,
        paymentHash: wrongHash,
        description: 'Test donation',
        paymentRequest: 'lnbc...'
      });

      // Try to store proof with mismatched preimage
      await assert.rejects(
        async () => {
          await proofManager.storeProof({
            paymentHash: wrongHash,
            preimage,
            completedAt: new Date()
          });
        },
        {
          message: 'Preimage verification failed: hash mismatch'
        }
      );
    });

    test('throws error when donation does not exist', async () => {
      const preimage = crypto.randomBytes(32).toString('hex');
      const paymentHash = crypto
        .createHash('sha256')
        .update(Buffer.from(preimage, 'hex'))
        .digest('hex');

      // Try to store proof for non-existent donation
      await assert.rejects(
        async () => {
          await proofManager.storeProof({
            paymentHash,
            preimage,
            completedAt: new Date()
          });
        },
        {
          message: `Donation not found for payment hash: ${paymentHash}`
        }
      );
    });

    test('persists proof to disk', async () => {
      // Generate preimage and payment hash
      const preimage = crypto.randomBytes(32).toString('hex');
      const paymentHash = crypto
        .createHash('sha256')
        .update(Buffer.from(preimage, 'hex'))
        .digest('hex');

      // Create a donation
      await tracker.createDonation({
        amount: 3000,
        paymentHash,
        description: 'Test donation',
        paymentRequest: 'lnbc...'
      });

      // Store the proof
      await proofManager.storeProof({
        paymentHash,
        preimage,
        completedAt: new Date()
      });

      // Create new tracker and load from disk
      const newTracker = new DonationTracker(testStoragePath);
      await newTracker.loadFromDisk();

      // Verify the proof was persisted
      const donation = await newTracker.getDonationByHash(paymentHash);
      assert.strictEqual(donation.status, 'completed');
      assert.strictEqual(donation.preimage, preimage);
    });
  });

  describe('getProof', () => {
    test('retrieves proof for completed donation', async () => {
      // Generate preimage and payment hash
      const preimage = crypto.randomBytes(32).toString('hex');
      const paymentHash = crypto
        .createHash('sha256')
        .update(Buffer.from(preimage, 'hex'))
        .digest('hex');

      // Create and complete a donation
      await tracker.createDonation({
        amount: 2000,
        paymentHash,
        description: 'Test donation',
        paymentRequest: 'lnbc...'
      });

      await proofManager.storeProof({
        paymentHash,
        preimage,
        completedAt: new Date()
      });

      // Get the proof
      const proof = await proofManager.getProof(paymentHash);

      assert.strictEqual(proof.preimage, preimage);
      assert.strictEqual(proof.paymentHash, paymentHash);
      assert.strictEqual(proof.verified, true);
      assert.ok(proof.donation);
      assert.strictEqual(proof.donation.status, 'completed');
    });

    test('throws error when donation does not exist', async () => {
      const nonExistentHash = crypto.randomBytes(32).toString('hex');

      await assert.rejects(
        async () => {
          await proofManager.getProof(nonExistentHash);
        },
        {
          message: `Donation not found for payment hash: ${nonExistentHash}`
        }
      );
    });

    test('throws error when proof is not available (donation not completed)', async () => {
      const paymentHash = crypto.randomBytes(32).toString('hex');

      // Create a pending donation (no preimage)
      await tracker.createDonation({
        amount: 1000,
        paymentHash,
        description: 'Test donation',
        paymentRequest: 'lnbc...'
      });

      await assert.rejects(
        async () => {
          await proofManager.getProof(paymentHash);
        },
        {
          message: `Proof not available for payment hash: ${paymentHash}`
        }
      );
    });

    test('returns verified=false if stored preimage is corrupted', async () => {
      const paymentHash = crypto.randomBytes(32).toString('hex');
      const corruptedPreimage = 'corrupted_preimage';

      // Create a donation
      await tracker.createDonation({
        amount: 1000,
        paymentHash,
        description: 'Test donation',
        paymentRequest: 'lnbc...'
      });

      // Manually update with corrupted preimage (bypassing verification)
      await tracker.updateDonationStatus(paymentHash, 'completed', {
        preimage: corruptedPreimage,
        completedAt: new Date()
      });

      // Get the proof
      const proof = await proofManager.getProof(paymentHash);

      assert.strictEqual(proof.verified, false);
      assert.strictEqual(proof.preimage, corruptedPreimage);
    });

    test('includes complete donation information in proof', async () => {
      // Generate preimage and payment hash
      const preimage = crypto.randomBytes(32).toString('hex');
      const paymentHash = crypto
        .createHash('sha256')
        .update(Buffer.from(preimage, 'hex'))
        .digest('hex');

      const amount = 7500;
      const description = 'Disaster relief donation';

      // Create and complete a donation
      await tracker.createDonation({
        amount,
        paymentHash,
        description,
        paymentRequest: 'lnbc...'
      });

      await proofManager.storeProof({
        paymentHash,
        preimage,
        completedAt: new Date()
      });

      // Get the proof
      const proof = await proofManager.getProof(paymentHash);

      assert.ok(proof.donation.id);
      assert.strictEqual(proof.donation.amount, amount);
      assert.strictEqual(proof.donation.description, description);
      assert.strictEqual(proof.donation.paymentHash, paymentHash);
      assert.strictEqual(proof.donation.preimage, preimage);
      assert.ok(proof.donation.createdAt);
      assert.ok(proof.donation.completedAt);
    });
  });

  describe('Round-trip proof storage and retrieval', () => {
    test('stores and retrieves proof correctly', async () => {
      // Generate preimage and payment hash
      const preimage = crypto.randomBytes(32).toString('hex');
      const paymentHash = crypto
        .createHash('sha256')
        .update(Buffer.from(preimage, 'hex'))
        .digest('hex');

      // Create a donation
      await tracker.createDonation({
        amount: 10000,
        paymentHash,
        description: 'Round-trip test',
        paymentRequest: 'lnbc...'
      });

      // Store the proof
      const completedAt = new Date();
      await proofManager.storeProof({
        paymentHash,
        preimage,
        completedAt
      });

      // Retrieve the proof
      const proof = await proofManager.getProof(paymentHash);

      // Verify round-trip
      assert.strictEqual(proof.preimage, preimage);
      assert.strictEqual(proof.paymentHash, paymentHash);
      assert.strictEqual(proof.verified, true);
    });
  });
});
