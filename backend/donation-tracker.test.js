import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import DonationTracker from './donation-tracker.js';
import fs from 'fs/promises';
import path from 'path';

describe('DonationTracker - Query Methods', () => {
  const testStoragePath = path.join('backend', 'data', 'test-donations.json');
  let tracker;

  beforeEach(async () => {
    tracker = new DonationTracker(testStoragePath);
    await tracker.loadFromDisk();
  });

  afterEach(async () => {
    // Clean up test file
    try {
      await fs.unlink(testStoragePath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  });

  describe('getDonationByHash', () => {
    test('returns donation when payment hash exists', async () => {
      // Create a donation
      const donation = await tracker.createDonation({
        amount: 1000,
        paymentHash: 'abc123',
        description: 'Test donation',
        paymentRequest: 'lnbc...'
      });

      // Retrieve it
      const retrieved = await tracker.getDonationByHash('abc123');

      assert.notStrictEqual(retrieved, null);
      assert.strictEqual(retrieved.id, donation.id);
      assert.strictEqual(retrieved.amount, 1000);
      assert.strictEqual(retrieved.paymentHash, 'abc123');
    });

    test('returns null when payment hash does not exist', async () => {
      const retrieved = await tracker.getDonationByHash('nonexistent');
      assert.strictEqual(retrieved, null);
    });

    test('returns correct donation when multiple donations exist', async () => {
      // Create multiple donations
      await tracker.createDonation({
        amount: 1000,
        paymentHash: 'hash1',
        description: 'Donation 1',
        paymentRequest: 'lnbc1...'
      });

      const donation2 = await tracker.createDonation({
        amount: 2000,
        paymentHash: 'hash2',
        description: 'Donation 2',
        paymentRequest: 'lnbc2...'
      });

      await tracker.createDonation({
        amount: 3000,
        paymentHash: 'hash3',
        description: 'Donation 3',
        paymentRequest: 'lnbc3...'
      });

      // Retrieve specific donation
      const retrieved = await tracker.getDonationByHash('hash2');

      assert.notStrictEqual(retrieved, null);
      assert.strictEqual(retrieved.id, donation2.id);
      assert.strictEqual(retrieved.amount, 2000);
      assert.strictEqual(retrieved.paymentHash, 'hash2');
    });
  });

  describe('getAllDonations', () => {
    test('returns empty array when no donations exist', async () => {
      const donations = await tracker.getAllDonations();
      assert.deepStrictEqual(donations, []);
    });

    test('returns all donations when multiple exist', async () => {
      // Create multiple donations
      const donation1 = await tracker.createDonation({
        amount: 1000,
        paymentHash: 'hash1',
        description: 'Donation 1',
        paymentRequest: 'lnbc1...'
      });

      const donation2 = await tracker.createDonation({
        amount: 2000,
        paymentHash: 'hash2',
        description: 'Donation 2',
        paymentRequest: 'lnbc2...'
      });

      const donation3 = await tracker.createDonation({
        amount: 3000,
        paymentHash: 'hash3',
        description: 'Donation 3',
        paymentRequest: 'lnbc3...'
      });

      // Get all donations
      const donations = await tracker.getAllDonations();

      assert.strictEqual(donations.length, 3);
      const ids = donations.map(d => d.id);
      assert.ok(ids.includes(donation1.id));
      assert.ok(ids.includes(donation2.id));
      assert.ok(ids.includes(donation3.id));
    });

    test('returns array with correct donation properties', async () => {
      await tracker.createDonation({
        amount: 5000,
        paymentHash: 'test-hash',
        description: 'Test donation',
        paymentRequest: 'lnbc...'
      });

      const donations = await tracker.getAllDonations();

      assert.strictEqual(donations.length, 1);
      const donation = donations[0];
      assert.ok(donation.id);
      assert.strictEqual(donation.amount, 5000);
      assert.strictEqual(donation.paymentHash, 'test-hash');
      assert.strictEqual(donation.description, 'Test donation');
      assert.strictEqual(donation.status, 'pending');
      assert.ok(donation.createdAt);
    });

    test('returns updated donations after status change', async () => {
      await tracker.createDonation({
        amount: 1000,
        paymentHash: 'hash1',
        description: 'Donation 1',
        paymentRequest: 'lnbc1...'
      });

      // Update status
      await tracker.updateDonationStatus('hash1', 'completed', {
        preimage: 'preimage123',
        completedAt: new Date()
      });

      const donations = await tracker.getAllDonations();

      assert.strictEqual(donations.length, 1);
      assert.strictEqual(donations[0].status, 'completed');
      assert.strictEqual(donations[0].preimage, 'preimage123');
    });
  });
});

describe('DonationTracker updateDonationStatus', () => {
  const testDataPath = path.join('backend', 'data', 'test-update-donations.json');
  let tracker;

  beforeEach(async () => {
    tracker = new DonationTracker(testDataPath);
    // Clean up any existing test file
    try {
      await fs.unlink(testDataPath);
    } catch (error) {
      // File doesn't exist, that's fine
    }
  });

  afterEach(async () => {
    // Clean up test file
    try {
      await fs.unlink(testDataPath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('updateDonationStatus updates status to completed with preimage', async () => {
    // Create a donation
    await tracker.createDonation({
      amount: 5000,
      paymentHash: 'test_hash_1',
      description: 'Test payment',
      paymentRequest: 'lnbc5000...'
    });

    // Update to completed
    const completedAt = new Date();
    await tracker.updateDonationStatus('test_hash_1', 'completed', {
      preimage: 'abc123preimage',
      completedAt
    });

    // Verify update
    const donation = await tracker.getDonationByHash('test_hash_1');
    assert.strictEqual(donation.status, 'completed');
    assert.strictEqual(donation.preimage, 'abc123preimage');
    assert.strictEqual(donation.completedAt, completedAt.toISOString());
  });

  test('updateDonationStatus updates status to failed with error', async () => {
    // Create a donation
    await tracker.createDonation({
      amount: 3000,
      paymentHash: 'test_hash_2',
      description: 'Test payment',
      paymentRequest: 'lnbc3000...'
    });

    // Update to failed
    await tracker.updateDonationStatus('test_hash_2', 'failed', {
      error: 'Payment timeout'
    });

    // Verify update
    const donation = await tracker.getDonationByHash('test_hash_2');
    assert.strictEqual(donation.status, 'failed');
    assert.strictEqual(donation.error, 'Payment timeout');
  });

  test('updateDonationStatus updates status to expired', async () => {
    // Create a donation
    await tracker.createDonation({
      amount: 1000,
      paymentHash: 'test_hash_3',
      description: 'Test payment',
      paymentRequest: 'lnbc1000...'
    });

    // Update to expired
    await tracker.updateDonationStatus('test_hash_3', 'expired');

    // Verify update
    const donation = await tracker.getDonationByHash('test_hash_3');
    assert.strictEqual(donation.status, 'expired');
  });

  test('updateDonationStatus throws error for non-existent donation', async () => {
    // Try to update non-existent donation
    await assert.rejects(
      async () => {
        await tracker.updateDonationStatus('non_existent_hash', 'completed', {
          preimage: 'test'
        });
      },
      {
        message: 'Donation not found for payment hash: non_existent_hash'
      }
    );
  });

  test('updateDonationStatus persists changes to disk', async () => {
    // Create a donation
    await tracker.createDonation({
      amount: 2000,
      paymentHash: 'test_hash_4',
      description: 'Test payment',
      paymentRequest: 'lnbc2000...'
    });

    // Update status
    await tracker.updateDonationStatus('test_hash_4', 'completed', {
      preimage: 'xyz789',
      completedAt: new Date()
    });

    // Create new tracker and load from disk
    const newTracker = new DonationTracker(testDataPath);
    await newTracker.loadFromDisk();

    // Verify the update was persisted
    const donation = await newTracker.getDonationByHash('test_hash_4');
    assert.strictEqual(donation.status, 'completed');
    assert.strictEqual(donation.preimage, 'xyz789');
  });
});
