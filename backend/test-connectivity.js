#!/usr/bin/env node
/**
 * Lightning Client Connectivity Test
 * 
 * This script tests the Lightning client's ability to connect to LND
 * and retrieve node information. It's used for the checkpoint verification.
 */

import LightningClient from './lightning.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration - adjust these paths based on your LND setup
const config = {
  lndSocket: process.env.LND_SOCKET || 'localhost:10009',
  tlsCertPath: process.env.TLS_CERT_PATH || path.join(__dirname, 'config', 'tls.cert'),
  macaroonPath: process.env.MACAROON_PATH || path.join(__dirname, 'config', 'admin.macaroon')
};

async function testConnectivity() {
  console.log('🔌 Testing Lightning Client Connectivity...\n');
  console.log('Configuration:');
  console.log(`  LND Socket: ${config.lndSocket}`);
  console.log(`  TLS Cert: ${config.tlsCertPath}`);
  console.log(`  Macaroon: ${config.macaroonPath}\n`);

  const client = new LightningClient(config);

  try {
    // Test 1: Connection
    console.log('Test 1: Connecting to LND...');
    const { lnd } = await client.connect();
    console.log('✅ Successfully connected to LND\n');

    // Test 2: Get Node Info
    console.log('Test 2: Retrieving node information...');
    const nodeInfo = await client.getNodeInfo();
    console.log('✅ Successfully retrieved node information:');
    console.log(`  Public Key: ${nodeInfo.publicKey}`);
    console.log(`  Alias: ${nodeInfo.alias}`);
    console.log(`  Total Channels: ${nodeInfo.numChannels}`);
    console.log(`  Active Channels: ${nodeInfo.numActiveChannels}`);
    console.log(`  Synced to Chain: ${nodeInfo.synced}\n`);

    // Test 3: List Channels
    console.log('Test 3: Listing channels...');
    const channels = await client.listChannels();
    console.log(`✅ Successfully retrieved ${channels.length} channel(s):`);
    
    if (channels.length > 0) {
      channels.forEach((channel, index) => {
        console.log(`\n  Channel ${index + 1}:`);
        console.log(`    ID: ${channel.id}`);
        console.log(`    Capacity: ${channel.capacity} sats`);
        console.log(`    Local Balance: ${channel.localBalance} sats`);
        console.log(`    Remote Balance: ${channel.remoteBalance} sats`);
        console.log(`    Active: ${channel.isActive}`);
        console.log(`    Base Fee: ${channel.baseFee} msats`);
        console.log(`    Fee Rate: ${channel.feeRate} ppm`);
        
        // Check for zero-fee configuration (important for NGO hub)
        if (channel.baseFee === 0 && channel.feeRate === 0) {
          console.log(`    ✅ Zero-fee channel (suitable for charity routing)`);
        }
      });
    } else {
      console.log('  ⚠️  No channels found. You may need to open channels for payment routing.');
    }

    console.log('\n✅ All connectivity tests passed!');
    console.log('\n🎉 Lightning client is ready for use.');
    
    return true;
  } catch (error) {
    console.error('\n❌ Connectivity test failed:');
    console.error(`  Error: ${error.message}`);
    
    // Provide helpful troubleshooting tips
    console.log('\n💡 Troubleshooting tips:');
    console.log('  1. Ensure LND is running and accessible at the configured socket');
    console.log('  2. Verify TLS certificate and macaroon paths are correct');
    console.log('  3. Check that the macaroon has sufficient permissions (admin.macaroon recommended)');
    console.log('  4. Ensure LND is fully synced to the blockchain');
    
    return false;
  }
}

// Run the test
testConnectivity()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
