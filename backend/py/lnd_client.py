import codecs
import json
import os
import requests
import qrcode
import io
import base64
import argparse
import sys

# Using REST for simplicity as per common LND patterns
# The user's script expects LNDClient class with get_info() and add_invoice().

class LNDClient:
    def __init__(self):
        # Paths relative to this script: ../config/
        base_path = os.path.dirname(os.path.abspath(__file__))
        config_path = os.path.join(base_path, '..', 'config')
        
        self.cert_path = os.environ.get('LND_CERT_PATH', os.path.join(config_path, 'tls.cert'))
        self.macaroon_path = os.environ.get('LND_MACAROON_PATH', os.path.join(config_path, 'admin.macaroon'))
        
        # Confirmed REST API port from scan is 8083
        self.api_endpoint = os.environ.get('LND_REST_API', 'https://127.0.0.1:8083') 

    def get_headers(self):
        with open(self.macaroon_path, 'rb') as f:
            macaroon_bytes = f.read()
            macaroon_hex = codecs.encode(macaroon_bytes, 'hex')
        return {'Grpc-Metadata-macaroon': macaroon_hex}

    def _request(self, method, endpoint, data=None):
        url = f"{self.api_endpoint}{endpoint}"
        headers = self.get_headers()
        try:
            response = requests.request(method, url, json=data, headers=headers, verify=self.cert_path)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            # If verify fails, maybe try False if user permits, but better to fail securely or fix cert path.
            # For self-signed localhost, we might need verify=False if cert validation fails despite path.
            # But let's stick to providing cert.
            print(f"Error connecting to LND: {e}", file=sys.stderr)
            if response is not None:
                print(f"Response: {response.text}", file=sys.stderr)
            raise

    def get_info(self):
        return self._request("GET", "/v1/getinfo")

    def add_invoice(self, amount, memo):
        data = {"value": amount, "memo": memo}
        return self._request("POST", "/v1/invoices", data)

    def generate_qr_base64(self, data):
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(data)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
        return img_str

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='LND Client Interface')
    parser.add_argument('command', choices=['info', 'invoice'], help='Command to execute')
    parser.add_argument('--amount', type=int, help='Amount in satoshis (for invoice)')
    parser.add_argument('--memo', type=str, help='Memo for invoice', default='Donation')
    
    args = parser.parse_args()
    
    client = LNDClient()
    
    try:
        if args.command == 'info':
            info = client.get_info()
            print(json.dumps(info))
            
        elif args.command == 'invoice':
            if not args.amount:
                print(json.dumps({"error": "Amount is required for invoice"}))
                sys.exit(1)
                
            invoice = client.add_invoice(args.amount, args.memo)
            payment_request = invoice.get('payment_request')
            
            if payment_request:
                qr_code = client.generate_qr_base64(payment_request)
                invoice['qr_code_base64'] = qr_code
                print(json.dumps(invoice))
            else:
                 print(json.dumps({"error": "Failed to get payment request from LND response", "response": invoice}))
                 sys.exit(1)

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
