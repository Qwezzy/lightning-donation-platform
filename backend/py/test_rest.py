from lnd_client import LNDClient

try:
    lnd = LNDClient()
    info = lnd.get_info()
    print(f"Connected to {info.get('alias', 'unknown')}")
    print(f"Version: {info.get('version', 'unknown')}")
except Exception as e:
    print(f"Error: {e}")
