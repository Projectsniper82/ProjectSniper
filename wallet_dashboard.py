# wallet_dashboard.py
from flask import Flask, render_template, request, jsonify, redirect, url_for
import threading
import time
import json
import requests
from modules.wallet_manager import WalletManager
from modules.token_registry import TokenRegistry
from modules.trading_logic import TradingLogic
from modules.trade_log import initialize_trade_log, clear_trade_log

app = Flask(__name__)

# Initialize components
wallet_manager = WalletManager()
token_registry = TokenRegistry()
trading_logic = TradingLogic(wallet_manager, token_registry)

# Initialize trade log
initialize_trade_log()

# Background health check thread
def health_check_thread():
    while True:
        try:
            wallet_manager.check_health()
            # Check every 30 seconds
            time.sleep(30)
        except Exception as e:
            print(f"Health check error: {str(e)}")
            time.sleep(60)  # Wait longer on error

# Start health check thread
health_thread = threading.Thread(target=health_check_thread, daemon=True)
health_thread.start()

# Background market data update thread
def market_data_thread():
    while True:
        try:
            # Sample liquidity and token data (in real implementation, fetch from API)
            liquidity_sol = 5.0
            liquidity_tokens = 100000.0
            
            # Fetch SOL price from an API
            try:
                response = requests.get("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", timeout=5)
                data = response.json()
                sol_price = data["solana"]["usd"]
            except Exception:
                sol_price = 120.0  # Default fallback
            
            # Update trading logic with market data
            trading_logic.update_market_data(liquidity_sol, liquidity_tokens, sol_price)
            
            # Sleep for 1 minute
            time.sleep(60)
        except Exception as e:
            print(f"Error updating market data: {str(e)}")
            time.sleep(60)

# Start market data thread
market_thread = threading.Thread(target=market_data_thread, daemon=True)
market_thread.start()

# Routes
@app.route('/')
def index():
    """Render the main dashboard page."""
    wallets = wallet_manager.get_all_wallets()
    active_wallet = wallet_manager.get_active_wallet()
    health_status = wallet_manager.health_status
    
    # Get token registry information
    tokens = token_registry.get_all_tokens()
    
    # For each wallet, check if trading is enabled
    for wallet in wallets:
        wallet["trading_enabled"] = trading_logic.is_trading_enabled(wallet["id"])
    
    return render_template(
        'index.html',
        wallets=wallets,
        active_wallet=active_wallet,
        health_status=health_status,
        tokens=tokens,
        current_network=wallet_manager.current_network,
        token_price_sol=trading_logic.token_price_sol,
        token_price_usd=trading_logic.token_price_usd,
        liquidity_sol=trading_logic.liquidity_sol,
        liquidity_tokens=trading_logic.liquidity_tokens
    )

# Add new trading routes

@app.route('/all_wallets')
def all_wallets():
    """Render the all wallets page."""
    wallets = wallet_manager.get_all_wallets()
    health_status = wallet_manager.health_status
    
    # For each wallet, check if trading is enabled
    for wallet in wallets:
        wallet["trading_enabled"] = trading_logic.is_trading_enabled(wallet["id"])
    
    return render_template(
        'all_wallets.html',
        wallets=wallets,
        health_status=health_status,
        current_network=wallet_manager.current_network,
        token_price_sol=trading_logic.token_price_sol,
        token_price_usd=trading_logic.token_price_usd,
        liquidity_sol=trading_logic.liquidity_sol,
        liquidity_tokens=trading_logic.liquidity_tokens
    )

@app.route('/api/trading/<wallet_id>/enable', methods=['POST'])
def enable_trading(wallet_id):
    """API endpoint to enable trading for a wallet."""
    if wallet_id not in wallet_manager.wallets:
        return jsonify({"success": False, "error": "Wallet not found"}), 400
    
    success = trading_logic.enable_trading(wallet_id)
    return jsonify({"success": success})

@app.route('/api/trading/<wallet_id>/disable', methods=['POST'])
def disable_trading(wallet_id):
    """API endpoint to disable trading for a wallet."""
    if wallet_id not in wallet_manager.wallets:
        return jsonify({"success": False, "error": "Wallet not found"}), 400
    
    success = trading_logic.disable_trading(wallet_id)
    return jsonify({"success": success})

@app.route('/api/trading/<wallet_id>/buy', methods=['POST'])
def execute_buy(wallet_id):
    """API endpoint to execute a buy order."""
    data = request.json
    amount_sol = float(data.get('amount_sol', 0))
    
    if amount_sol <= 0:
        return jsonify({"success": False, "error": "Invalid amount"}), 400
    
    success, message = trading_logic.execute_buy(wallet_id, amount_sol)
    return jsonify({"success": success, "message": message})

@app.route('/api/trading/<wallet_id>/sell', methods=['POST'])
def execute_sell(wallet_id):
    """API endpoint to execute a sell order."""
    data = request.json
    amount_tokens = float(data.get('amount_tokens', 0))
    
    if amount_tokens <= 0:
        return jsonify({"success": False, "error": "Invalid amount"}), 400
    
    success, message = trading_logic.execute_sell(wallet_id, amount_tokens)
    return jsonify({"success": success, "message": message})

# Keep your existing routes...

@app.route('/api/wallets', methods=['GET'])
def get_wallets():
    """API endpoint to get all wallets."""
    wallets = wallet_manager.get_all_wallets()
    return jsonify(wallets)

@app.route('/api/wallets/create', methods=['POST'])
def create_wallet():
    """API endpoint to create a new wallet."""
    data = request.json
    name = data.get('name', 'New Wallet')
    
    try:
        wallet_id = wallet_manager.create_wallet(name)
        return jsonify({"success": True, "wallet_id": wallet_id})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

@app.route('/api/wallets/import', methods=['POST'])
def import_wallet():
    """API endpoint to import a wallet using secret key."""
    data = request.json
    name = data.get('name', 'Imported Wallet')
    secret_key = data.get('secret_key', '')
    
    try:
        # Convert secret key string to bytes
        if isinstance(secret_key, str):
            # Handle different formats (array string, base58, base64, etc.)
            if secret_key.startswith('[') and secret_key.endswith(']'):
                # Convert array string to bytes
                secret_key = bytes([int(x.strip()) for x in secret_key[1:-1].split(',')])
            else:
                # Assume base58 encoded
                from base58 import b58decode
                secret_key = b58decode(secret_key)
        
        wallet_id = wallet_manager.import_wallet(name, secret_key)
        return jsonify({"success": True, "wallet_id": wallet_id})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

@app.route('/api/wallets/watch', methods=['POST'])
def add_watch_wallet():
    """API endpoint to add a watch-only wallet."""
    data = request.json
    name = data.get('name', 'Watch Wallet')
    public_key = data.get('public_key', '')
    
    try:
        wallet_id = wallet_manager.add_watch_wallet(name, public_key)
        return jsonify({"success": True, "wallet_id": wallet_id})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

@app.route('/api/wallets/active', methods=['POST'])
@app.route("/api/wallets/<wallet_id>/set-active", methods=["POST"])
def set_wallet_active(wallet_id):
    """API endpoint to set a wallet as active and return to index."""
    if wallet_manager.set_active_wallet(wallet_id):
        return jsonify({"success": True})
    else:
        return jsonify({"success": False, "error": "Invalid wallet ID"}), 400


def set_active_wallet():
    """API endpoint to set the active wallet."""
    data = request.json
    wallet_id = data.get('wallet_id', '')
    
    if wallet_manager.set_active_wallet(wallet_id):
        return jsonify({"success": True})
    else:
        return jsonify({"success": False, "error": "Invalid wallet ID"}), 400

@app.route('/api/wallets/<wallet_id>', methods=['DELETE'])
def delete_wallet(wallet_id):
    """API endpoint to delete a wallet."""
    if wallet_manager.delete_wallet(wallet_id):
        return jsonify({"success": True})
    else:
        return jsonify({"success": False, "error": "Invalid wallet ID"}), 400

@app.route('/api/network', methods=['POST'])
def set_network():
    """API endpoint to set the network."""
    data = request.json
    network = data.get('network', '')
    
    if wallet_manager.set_network(network):
        return jsonify({"success": True})
    else:
        return jsonify({"success": False, "error": "Invalid network"}), 400

@app.route('/api/balance/<wallet_id>', methods=['GET'])
def get_balance(wallet_id):
    """API endpoint to get wallet balance."""
    try:
        balance = wallet_manager.get_sol_balance(wallet_id)
        return jsonify({"success": True, "balance": balance})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

@app.route('/api/tokens/<wallet_id>', methods=['GET'])
def get_tokens(wallet_id):
    """API endpoint to get wallet tokens."""
    try:
        tokens = wallet_manager.get_token_accounts(wallet_id)
        # Enhance with token metadata
        for token in tokens:
            token_info = token_registry.get_token_info(token.get('mint', ''))
            if token_info:
                token.update(token_info)
        return jsonify({"success": True, "tokens": tokens})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400

@app.route('/api/health', methods=['GET'])
def get_health():
    """API endpoint to get system health status."""
    health_status = wallet_manager.check_health()
    return jsonify(health_status)

if __name__ == '__main__':
    app.run(debug=True, port=5001)
