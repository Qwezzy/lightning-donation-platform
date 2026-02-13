import axios from 'axios';

class MavaPayClient {
    constructor(apiKey, environment = 'staging') {
        this.apiKey = apiKey;
        this.baseUrl = environment === 'production'
            ? 'https://api.mavapay.co/api/v1'
            : 'https://staging.api.mavapay.co/api/v1';
    }

    async getBanks(countryCode) {
        try {
            const response = await axios.get(`${this.baseUrl}/bank/bankcode`, {
                params: { country: countryCode },
                headers: { 'x-api-key': this.apiKey }
            });
            return response.data.data;
        } catch (error) {
            console.error('MavaPay getBanks error:', error.response?.data || error.message);
            throw new Error('Failed to fetch banks');
        }
    }

    async getQuote({ amount, amountCurrency = 'ZARCENT', bankId, bankAccountNumber, accountName }) {
        try {
            // Construct payload based on Gist documentation
            const payload = {
                amount: amount.toString(), // Amount in lowest denomination (e.g., cents)
                sourceCurrency: 'BTCSAT',
                targetCurrency: 'ZARCENT',
                paymentMethod: 'LIGHTNING',
                paymentCurrency: amountCurrency, // usually ZARCENT for fixed fiat amount
                autopayout: 'true',
                beneficiary: {
                    name: accountName,
                    bankName: bankId, // MavaPay uses bank name as ID in some contexts, strictly follow docs
                    bankAccountNumber: bankAccountNumber
                }
            };

            const response = await axios.post(`${this.baseUrl}/quote`, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey
                }
            });

            return response.data.data;
        } catch (error) {
            console.error('MavaPay getQuote error:', error.response?.data || error.message);
            throw new Error(`Failed to get quote: ${error.response?.data?.message || error.message}`);
        }
    }

    async verifyAccount({ bankCode, accountNumber }) {
        try {
            const response = await axios.get(`${this.baseUrl}/bank/account-name`, {
                params: {
                    bankCode: bankCode,
                    accountNumber: accountNumber
                },
                headers: { 'x-api-key': this.apiKey }
            });
            return response.data.data;
        } catch (error) {
            console.error('MavaPay verifyAccount error:', error.response?.data || error.message);
            // throw new Error('Failed to verify account');
            return null; // Return null if verification fails
        }
    }
}

export default MavaPayClient;
