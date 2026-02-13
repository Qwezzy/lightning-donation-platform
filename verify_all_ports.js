import lndConfig from './backend/config/lnd-config.js';
import lnService from 'ln-service';
import fs from 'fs';

const ports = [10001, 10003, 10004];

async function testPort(port) {
    console.log(`\nTesting Port ${port}...`);
    try {
        const { lnd } = lnService.authenticatedLndGrpc({
            cert: fs.readFileSync(lndConfig.tlsCertPath).toString('base64'),
            macaroon: fs.readFileSync(lndConfig.macaroonPath).toString('base64'),
            socket: `127.0.0.1:${port}`,
        });

        const walletInfo = await lnService.getWalletInfo({ lnd });
        console.log(`✅ Connection Successful on port ${port}!`);
        console.log(`Node Alias: ${walletInfo.alias}`);
        return true;
    } catch (error) {
        console.error(`❌ Failed on ${port}: ${error.code || error.message}`);
        return false;
    }
}

(async () => {
    for (const port of ports) {
        if (await testPort(port)) {
            console.log(`\n🎉 SUCCESS! LND is running on port ${port}.`);
            process.exit(0);
        }
    }
    console.log('\n❌ Could not connect to any port with current credentials.');
    process.exit(1);
})();
