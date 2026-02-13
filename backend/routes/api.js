import express from 'express';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execPromise = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pythonScriptPath = path.join(__dirname, '../py/lnd_client.py');

const router = express.Router();

export default function createApiRoutes(invoiceGenerator, statusMonitor, lightningClient, donationTracker) {

    // POST /api/invoice - Create a new lightning invoice
    router.post('/invoice', async (req, res, next) => {
        try {
            const { amount, description } = req.body;

            // Basic validation
            if (!amount || amount < 1) {
                return res.status(400).json({ error: 'Amount must be a positive integer' });
            }

            console.log(`Generating invoice via Python script for ${amount} sats...`);

            // Execute Python script
            // Ensure we use the right python command. Tries 'python3' then 'python'
            const command = `python "${pythonScriptPath}" invoice --amount ${amount} --memo "${description || 'Donation'}"`;

            // Increase maxBuffer for large base64 output if needed (default is 1MB which is enough for QR)
            const { stdout, stderr } = await execPromise(command);

            if (stderr) {
                // Python might output warnings to stderr, but if it exits 0 it's fine. 
                // However, we should check if stdout is valid JSON.
                console.warn('Python stderr:', stderr);
            }

            let invoiceData;
            try {
                invoiceData = JSON.parse(stdout);
            } catch (e) {
                console.error('Failed to parse Python output:', stdout);
                throw new Error('Invalid response from invoice generator script');
            }

            if (invoiceData.error) {
                throw new Error(`Python script error: ${invoiceData.error}`);
            }

            console.log('Invoice generated successfully:', invoiceData.r_hash);

            // Create donation record (Keep existing tracking logic)
            // We need to construct the object expected by donationTracker
            // Python returns: request, r_hash, add_index, payment_addr, qr_code_base64

            // We need expiresAt. The python script doesn't return it explicitly in current modifications,
            // but we can default or add it. LND default is 3600.
            // Let's assume 1 hour from now for tracking purpose.
            const expiresAt = new Date(Date.now() + 3600 * 1000);

            await donationTracker.createDonation({
                paymentHash: invoiceData.r_hash, // Python returns 'r_hash'
                amount: parseInt(amount),
                description: description || 'Donation',
                paymentRequest: invoiceData.payment_request,
                expiresAt: expiresAt
            });

            res.status(201).json({
                payment_request: invoiceData.payment_request,
                r_hash: invoiceData.r_hash,
                amount: parseInt(amount),
                expires_at: expiresAt,
                qr_code_base64: invoiceData.qr_code_base64 // Send this to frontend
            });

        } catch (error) {
            console.error('Invoice generation error:', error);
            next(error);
        }
    });

    // GET /api/invoice/:paymentHash - Check invoice status
    router.get('/invoice/:paymentHash', async (req, res, next) => {
        try {
            const { paymentHash } = req.params;

            // Check status using StatusMonitor
            // Note: StatusMonitor.checkPaymentStatus returns { status, donation }
            const statusResult = await statusMonitor.checkPaymentStatus(paymentHash);

            if (!statusResult || !statusResult.donation) {
                return res.status(404).json({ error: 'Invoice not found' });
            }

            res.json({
                settled: statusResult.status === 'completed',
                status: statusResult.status,
                preimage: statusResult.donation.preimage,
                payment_request: statusResult.donation.paymentRequest
            });

        } catch (error) {
            next(error);
        }
    });

    // GET /api/node - Get LND node info
    router.get('/node', async (req, res, next) => {
        try {
            const info = await lightningClient.getNodeInfo();
            res.json(info);
        } catch (error) {
            next(error);
        }
    });

    return router;
}
