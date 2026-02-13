import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    port: process.env.PORT || 3000,
    dataFilePath: process.env.DATA_FILE_PATH || path.join(__dirname, '../data/donations.json'),
    env: process.env.NODE_ENV || 'development'
};
