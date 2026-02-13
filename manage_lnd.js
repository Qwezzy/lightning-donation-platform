import lndConfig from './backend/config/lnd-config.js';
import lnService from 'ln-service';
import fs from 'fs';

// Initialize LND connection
const { lnd } = lnService.authenticatedLndGrpc({
    cert: fs.readFileSync(lndConfig.tlsCertPath).toString('base64'),
    macaroon: fs.readFileSync(lndConfig.macaroonPath).toString('base64'),
    socket: lndConfig.lndSocket,
});

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
    try {
        switch (command) {
            case 'getinfo':
                const info = await lnService.getWalletInfo({ lnd });
                console.log(JSON.stringify(info, null, 2));
                break;

            case 'connect':
                // Usage: node manage_lnd.js connect <pubkey>@<host>:<port>
                if (!args[0]) throw new Error('Usage: connect <pubkey>@<host>:<port>');
                const [pubkey_host] = args;
                const [public_key, socket] = pubkey_host.split('@');
                await lnService.addPeer({ lnd, public_key, socket });
                console.log(`Successfully connected to ${public_key}`);
                break;

            case 'openchannel':
                // Usage: node manage_lnd.js openchannel --node_key=<pubkey> --local_amt=<sats>
                const partnerKey = args.find(a => a.startsWith('--node_key='))?.split('=')[1];
                const amount = args.find(a => a.startsWith('--local_amt='))?.split('=')[1];
                if (!partnerKey || !amount) throw new Error('Usage: openchannel --node_key=<pubkey> --local_amt=<sats>');

                const channel = await lnService.openChannel({
                    lnd,
                    partner_public_key: partnerKey,
                    local_tokens: parseInt(amount)
                });
                console.log('Channel open initiated:', channel);
                break;

            case 'addinvoice':
                // Usage: node manage_lnd.js addinvoice --amt=<sats> --memo="<text>"
                const amt = args.find(a => a.startsWith('--amt='))?.split('=')[1];
                const memo = args.find(a => a.startsWith('--memo='))?.split('=')[1] || 'Manual Invoice';
                if (!amt) throw new Error('Usage: addinvoice --amt=<sats> [--memo="<text>"]');

                const invoice = await lnService.createInvoice({
                    lnd,
                    tokens: parseInt(amt),
                    description: memo
                });
                console.log('Invoice created:');
                console.log(invoice.request);
                break;

            case 'payinvoice':
                // Usage: node manage_lnd.js payinvoice <request>
                if (!args[0]) throw new Error('Usage: payinvoice <payment_request>');
                const payment = await lnService.pay({ lnd, request: args[0] });
                console.log('Payment successful:', payment);
                break;

            case 'decodepayment':
                // Usage: node manage_lnd.js decodepayment <request>
                if (!args[0]) throw new Error('Usage: decodepayment <payment_request>');
                const details = await lnService.decodePaymentRequest({ lnd, request: args[0] });
                console.log('Invoice Details:');
                console.log(`Destination: ${details.destination}`);
                console.log(`Amount: ${details.tokens} sats`);
                console.log(`Description: ${details.description}`);
                console.log(`Expires At: ${details.expires_at}`);
                break;

            case 'listchannels':
                const channels = await lnService.getChannels({ lnd });
                console.log(JSON.stringify(channels, null, 2));
                break;

            case 'fwdhistory':
                const forwards = await lnService.getForwardingRep({ lnd });
                console.log(JSON.stringify(forwards, null, 2));
                break;

            default:
                console.log(`
Available commands:
  getinfo
  connect <pubkey>@<host>:<port>
  openchannel --node_key=<pubkey> --local_amt=<sats>
  addinvoice --amt=<sats> [--memo="<text>"]
  payinvoice <payment_request>
  decodepayment <payment_request>
  listchannels
  fwdhistory
                `);
        }
    } catch (error) {
        console.error('Error:', error.message || error);
    }
}

main();
