import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default paths for LND credentials (relative to project root)


export default {
    lndSocket: process.env.LND_SOCKET || '127.0.0.1:10003',
    tlsCertPath: process.env.LND_CERT_PATH || path.join(__dirname, 'tls.cert'),
    macaroonPath: process.env.LND_MACAROON_PATH || path.join(__dirname, 'admin.macaroon')
};
