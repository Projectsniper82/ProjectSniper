# modules/trading_logic.py
import random
import time
import threading
from modules.trade_log import log_trade, update_shared_market_state

class TradingLogic:
    def __init__(self, wallet_manager, token_registry):
        self.wallet_manager = wallet_manager
        self.token_registry = token_registry
        self.trading_enabled = {}  # wallet_id -> bool
        self.liquidity_sol = 0.0
        self.liquidity_tokens = 0.0
        self.token_price_sol = 0.0
        self.token_price_usd = 0.0
        self.sol_price_usd = 120.0  # Default SOL price
        self.trading_threads = {}  # wallet_id -> thread
        self.stop_flags = {}  # wallet_id -> bool
        self.lock = threading.Lock()
        
    def enable_trading(self, wallet_id):
        """Enable trading for a specific wallet."""
        self.trading_enabled[wallet_id] = True
        
        # If a thread already exists, stop it first
        if wallet_id in self.stop_flags:
            self.stop_flags[wallet_id] = True
            if wallet_id in self.trading_threads and self.trading_threads[wallet_id].is_alive():
                self.trading_threads[wallet_id].join(2)
        
        # Start a new trading thread
        self.stop_flags[wallet_id] = False
        self.trading_threads[wallet_id] = threading.Thread(
            target=self._wallet_trading_logic, 
            args=(wallet_id,),
            daemon=True
        )
        self.trading_threads[wallet_id].start()
        return True
    
    def disable_trading(self, wallet_id):
        """Disable trading for a specific wallet."""
        self.trading_enabled[wallet_id] = False
        
        # Stop the trading thread if it exists
        if wallet_id in self.stop_flags:
            self.stop_flags[wallet_id] = True
        return True
    
    def is_trading_enabled(self, wallet_id):
        """Check if trading is enabled for a wallet."""
        return self.trading_enabled.get(wallet_id, False)
    
    def execute_buy(self, wallet_id, amount_sol):
        """Manually execute a buy order."""
        wallet = self.wallet_manager.wallets.get(wallet_id)
        if not wallet:
            return False, "Wallet not found"
        
        if wallet.get("sol_balance", 0) < amount_sol:
            return False, "Insufficient SOL balance"
        
        success, message = self._buy_tokens(wallet_id, amount_sol)
        return success, message
    
    def execute_sell(self, wallet_id, amount_tokens):
        """Manually execute a sell order."""
        wallet = self.wallet_manager.wallets.get(wallet_id)
        if not wallet:
            return False, "Wallet not found"
        
        if wallet.get("token_balance", 0) < amount_tokens:
            return False, "Insufficient token balance"
        
        success, message = self._sell_tokens(wallet_id, amount_tokens)
        return success, message
    
    def update_market_data(self, liquidity_sol, liquidity_tokens, sol_price_usd):
        """Update market data."""
        self.liquidity_sol = liquidity_sol
        self.liquidity_tokens = liquidity_tokens
        self.sol_price_usd = sol_price_usd
        
        # Calculate token price
        if liquidity_tokens > 0:
            self.token_price_sol = liquidity_sol / liquidity_tokens
            self.token_price_usd = self.token_price_sol * sol_price_usd
        
        # Update shared market state
        wallets = [wallet for wallet in self.wallet_manager.wallets.values()]
        update_shared_market_state(
            wallets, 
            liquidity_sol, 
            liquidity_tokens, 
            self.token_price_sol, 
            self.token_price_usd
        )
    
    def _wallet_trading_logic(self, wallet_id):
        """Trading logic for a wallet (runs in a separate thread)."""
        while not self.stop_flags.get(wallet_id, True):
            try:
                if not self.is_trading_enabled(wallet_id):
                    time.sleep(5)
                    continue
                
                wallet = self.wallet_manager.wallets.get(wallet_id)
                if not wallet:
                    time.sleep(5)
                    continue
                
                # Simple trading strategy:
                # 70% chance to buy, 30% chance to sell if have tokens
                action = random.choices(
                    ["buy", "sell"], 
                    weights=[0.7, 0.3], 
                    k=1
                )[0]
                
                if action == "buy":
                    # Buy with 1-5% of SOL balance
                    sol_balance = wallet.get("sol_balance", 0)
                    if sol_balance > 0.01:  # Minimum 0.01 SOL
                        amount = sol_balance * random.uniform(0.01, 0.05)
                        self._buy_tokens(wallet_id, amount)
                
                elif action == "sell" and wallet.get("token_balance", 0) > 0:
                    # Sell 1-5% of token balance
                    token_balance = wallet.get("token_balance", 0)
                    amount = token_balance * random.uniform(0.01, 0.05)
                    self._sell_tokens(wallet_id, amount)
                
                # Sleep for 30-120 seconds before next action
                time.sleep(random.uniform(30, 120))
            
            except Exception as e:
                print(f"Error in trading logic for wallet {wallet_id}: {str(e)}")
                time.sleep(10)
    
    def _buy_tokens(self, wallet_id, amount_sol):
        """Buy tokens with SOL."""
        with self.lock:
            wallet = self.wallet_manager.wallets.get(wallet_id)
            if not wallet:
                return False, "Wallet not found"
            
            if wallet.get("sol_balance", 0) < amount_sol:
                return False, "Insufficient SOL balance"
            
            if self.liquidity_sol <= 0 or self.liquidity_tokens <= 0:
                return False, "No liquidity available"
            
            # Calculate tokens to receive (simplified swap calculation)
            k = self.liquidity_sol * self.liquidity_tokens
            new_liquidity_sol = self.liquidity_sol + amount_sol
            new_liquidity_tokens = k / new_liquidity_sol
            tokens_received = self.liquidity_tokens - new_liquidity_tokens
            
            # Update wallet balances
            wallet["sol_balance"] = wallet.get("sol_balance", 0) - amount_sol
            wallet["token_balance"] = wallet.get("token_balance", 0) + tokens_received
            
            # Update liquidity
            self.liquidity_sol = new_liquidity_sol
            self.liquidity_tokens = new_liquidity_tokens
            
            # Update token price
            self.token_price_sol = self.liquidity_sol / self.liquidity_tokens
            self.token_price_usd = self.token_price_sol * self.sol_price_usd
            
            # Log the trade
            log_trade(
                wallet.get("name", "Unknown"),
                "BUY",
                tokens_received,
                self.token_price_sol,
                self.liquidity_sol,
                time.time()
            )
            
            print(f"🛒 {wallet.get('name', 'Unknown')} BUY: {tokens_received:.2f} tokens for {amount_sol:.3f} SOL")
            return True, f"Successfully bought {tokens_received:.2f} tokens for {amount_sol:.3f} SOL"
    
    def _sell_tokens(self, wallet_id, amount_tokens):
        """Sell tokens for SOL."""
        with self.lock:
            wallet = self.wallet_manager.wallets.get(wallet_id)
            if not wallet:
                return False, "Wallet not found"
            
            if wallet.get("token_balance", 0) < amount_tokens:
                return False, "Insufficient token balance"
            
            if self.liquidity_sol <= 0 or self.liquidity_tokens <= 0:
                return False, "No liquidity available"
            
            # Calculate SOL to receive (simplified swap calculation)
            k = self.liquidity_sol * self.liquidity_tokens
            new_liquidity_tokens = self.liquidity_tokens + amount_tokens
            new_liquidity_sol = k / new_liquidity_tokens
            sol_received = self.liquidity_sol - new_liquidity_sol
            
            # Update wallet balances
            wallet["token_balance"] = wallet.get("token_balance", 0) - amount_tokens
            wallet["sol_balance"] = wallet.get("sol_balance", 0) + sol_received
            
            # Update liquidity
            self.liquidity_sol = new_liquidity_sol
            self.liquidity_tokens = new_liquidity_tokens
            
            # Update token price
            self.token_price_sol = self.liquidity_sol / self.liquidity_tokens
            self.token_price_usd = self.token_price_sol * self.sol_price_usd
            
            # Log the trade
            log_trade(
                wallet.get("name", "Unknown"),
                "SELL",
                amount_tokens,
                self.token_price_sol,
                self.liquidity_sol,
                time.time()
            )
            
            print(f"💸 {wallet.get('name', 'Unknown')} SELL: {amount_tokens:.2f} tokens for {sol_received:.3f} SOL")
            return True, f"Successfully sold {amount_tokens:.2f} tokens for {sol_received:.3f} SOL"
