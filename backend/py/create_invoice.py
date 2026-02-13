#!/usr/bin/env python3
"""
Create Invoice Script for Bootcamp Day 4
"""
import argparse
import base64
from lnd_client import LNDClient

def main():
    parser = argparse.ArgumentParser(description="Create a Lightning Invoice")
    parser.add_argument("--amount", type=int, help="Amount in satoshis")
    parser.add_argument("--memo", type=str, help="Invoice memo/description")
    
    args = parser.parse_args()
    
    # Interactive mode if arguments missing
    if args.amount is None:
        try:
            val = input("Enter amount (sats): ")
            if not val:
                print("Amount is required.")
                return
            args.amount = int(val)
        except ValueError:
            print("Invalid amount.")
            return

    if args.memo is None:
        args.memo = input("Enter memo (optional): ")

    try:
        # Initialize client
        lnd = LNDClient()
        
        # Verify connection first
        info = lnd.get_info()
        print(f"Connected to LND node: {info.get('alias', 'unknown')}")
        
        # Create invoice
        print(f"Creating invoice for {args.amount} sats...")
        invoice = lnd.add_invoice(amount=args.amount, memo=args.memo)
        
        # Output results
        print("\n=== INVOICE CREATED ===")
        print(f"Payment Request: {invoice['payment_request']}")
        
        # r_hash is returned as base64 from lnd_client.add_invoice based on my reading of lnd_client.py?
        # Let's double check lnd_client.py source from previous turn.
        # lnd_client.py line 115 returns self._request("POST", "/v1/invoices", data)
        # LND REST API /v1/invoices returns r_hash as base64 encoded string usually, or hex? 
        # Actually lnd_client.py line 84 in checkout() helper does: r_hash = base64.b64decode(result["r_hash"]).hex()
        # So the result['r_hash'] is base64.
        
        r_hash_b64 = invoice['r_hash']
        r_hash_hex = base64.b64decode(r_hash_b64).hex()
        
        print(f"R Hash (hex):    {r_hash_hex}")
        print(f"Add Index:       {invoice.get('add_index', 'N/A')}")
        print("=======================")
        
    except Exception as e:
        print(f"\nError: {e}")
        print("Make sure your LND node is running and lnd_client.py determines the correct paths.")

if __name__ == "__main__":
    main()
