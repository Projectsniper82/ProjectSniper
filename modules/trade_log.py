# modules/trade_log.py
import threading
import json
import os
import time

TRADE_LOG_FILE = "trading_memory.json"
json_lock = threading.Lock()

def initialize_trade_log():
    with json_lock:
        with open(TRADE_LOG_FILE, "w") as f:
            json.dump({"sniper_actions": [], "volume_bots": [], "signals": []}, f, indent=4)

def clear_trade_log():
    with json_lock:
        with open(TRADE_LOG_FILE, "w") as f:
            json.dump({"sniper_actions": [], "volume_bots": [], "signals": []}, f, indent=4)

def load_json_data():
    with json_lock:
        try:
            with open(TRADE_LOG_FILE, "r") as f:
                content = f.read().strip()
                if not content:
                    return {"sniper_actions": [], "volume_bots": [], "signals": []}
                return json.loads(content)
        except (json.JSONDecodeError, FileNotFoundError):
            return {"sniper_actions": [], "volume_bots": [], "signals": []}

def log_trade(bot_name, action, quantity, price_sol, current_lp, timestamp):
    data = load_json_data()
    data.setdefault("sniper_actions", []).append({
        "bot": bot_name,
        "action": action,
        "quantity": quantity,
        "price_sol": price_sol,
        "current_lp": current_lp,
        "timestamp": timestamp
    })
    data["sniper_actions"] = data["sniper_actions"][-500:]
    with json_lock:
        with open(TRADE_LOG_FILE, "w") as f:
            json.dump(data, f, indent=4)

def update_shared_market_state(wallets, liquidity_sol, liquidity_tokens, token_price_sol, token_price_usd):
    with json_lock:
        try:
            with open(TRADE_LOG_FILE, "r+") as f:
                data = json.load(f)
                data["market_metrics"] = {
                    "current_price_sol": token_price_sol,
                    "current_price_usd": token_price_usd,
                    "liquidity_pool_sol": liquidity_sol,
                    "liquidity_pool_tokens": liquidity_tokens
                }
                data["wallet_balances"] = {
                    wallet["name"]: {
                        "sol_balance": wallet.get("sol_balance", 0),
                        "token_balance": wallet.get("token_balance", 0)
                    } for wallet in wallets
                }
                f.seek(0)
                json.dump(data, f, indent=4)
                f.truncate()
        except Exception as e:
            print("Error updating market state:", e)
