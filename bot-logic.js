// bot-logic.js - Trading bot logic implementation

const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { Market, TokenInstructions } = require('@project-serum/serum');
const { Token } = require('@solana/spl-token');
const fs = require('fs');

// Bot types
const BOT_TYPES = {
  SNIPER: 'sniper',
  VOLUME_1: 'volume_1',
  VOLUME_2: 'volume_2',
  VOLUME_3: 'volume_3',
  VOLUME_4: 'volume_4',
  VOLUME_5: 'volume_5',
  VOLUME_6: 'volume_6'
};

class TradingBot {
  constructor(wallet, botType, config = {}) {
    this.wallet = wallet;
    this.botType = botType;
    this.isActive = false;
    this.config = {
      slippage: 0.5, // Default 0.5%
      maxBuyAmount: 1.0, // SOL
      minSellPrice: 0, // 0 means no minimum
      buyInterval: 60000, // ms
      ...config
    };
    this.tradeHistory = [];
    this.tokenBalance = 0;
    this.tokenAddress = null;
    this.connection = null;
    this.network = 'devnet'; // Default to devnet
  }

  setNetwork(network) {
    this.network = network;
    this.connection = new Connection(network === 'mainnet' ? 
      'https://api.mainnet-beta.solana.com' : 
      'https://api.devnet.solana.com');
    return this;
  }

  setTokenAddress(tokenAddress) {
    this.tokenAddress = new PublicKey(tokenAddress);
    return this;
  }

  async activate() {
    if (!this.tokenAddress) {
      throw new Error('Token address must be set before activating bot');
    }
    if (!this.connection) {
      this.setNetwork(this.network);
    }
    this.isActive = true;
    
    // Start trading logic based on bot type
    if (this.botType === BOT_TYPES.SNIPER) {
      this.startSniperLogic();
    } else {
      this.startVolumeLogic();
    }
    
    return this;
  }

  deactivate() {
    this.isActive = false;
    // Stop any ongoing processes or timers
    if (this.tradeInterval) {
      clearInterval(this.tradeInterval);
      this.tradeInterval = null;
    }
    return this;
  }

  async startSniperLogic() {
    // Sniper bot waits for token launch and tries to buy immediately
    console.log(`Starting Sniper bot for wallet ${this.wallet.publicKey.toString()}`);
    
    // In a real implementation this would involve monitoring liquidity pool creation events
    // and executing a buy as soon as liquidity is added

    // For demo purposes, we'll simulate with a direct buy
    await this.executeBuy(this.config.maxBuyAmount);
  }

  async startVolumeLogic() {
    // Volume bots create trading volume at different intervals and amounts
    const volumeNumber = parseInt(this.botType.split('_')[1]);
    
    // Different strategies based on volume bot number
    switch(volumeNumber) {
      case 1: // Frequent small trades
        this.tradeInterval = setInterval(async () => {
          if (this.isActive) {
            const amount = 0.01 + (Math.random() * 0.05);
            await this.executeTrade(amount);
          }
        }, 30000); // Every 30 seconds
        break;
      
      case 2: // Medium-sized trades
        this.tradeInterval = setInterval(async () => {
          if (this.isActive) {
            const amount = 0.05 + (Math.random() * 0.1);
            await this.executeTrade(amount);
          }
        }, 60000); // Every minute
        break;
      
      case 3: // Larger, less frequent trades
        this.tradeInterval = setInterval(async () => {
          if (this.isActive) {
            const amount = 0.1 + (Math.random() * 0.2);
            await this.executeTrade(amount);
          }
        }, 180000); // Every 3 minutes
        break;
      
      case 4: // Mixed buy/sell focused
        this.tradeInterval = setInterval(async () => {
          if (this.isActive) {
            const amount = 0.05 + (Math.random() * 0.15);
            const isBuy = Math.random() > 0.4; // 60% chance to buy
            if (isBuy) {
              await this.executeBuy(amount);
            } else {
              await this.executeSell(amount);
            }
          }
        }, 120000); // Every 2 minutes
        break;
      
      case 5: // Price support bot
        this.tradeInterval = setInterval(async () => {
          if (this.isActive) {
            // Check current price and buy if below threshold
            const currentPrice = await this.getTokenPrice();
            if (currentPrice < this.config.supportPrice) {
              const amount = 0.1 + (Math.random() * 0.1);
              await this.executeBuy(amount);
            }
          }
        }, 60000); // Every minute
        break;
      
      case 6: // Profit taking bot
        this.tradeInterval = setInterval(async () => {
          if (this.isActive) {
            // Check current price and sell if above threshold
            const currentPrice = await this.getTokenPrice();
            if (currentPrice > this.config.profitPrice) {
              // Sell a percentage of holdings
              const sellPercentage = 0.1 + (Math.random() * 0.2); // 10-30%
              const tokensToSell = this.tokenBalance * sellPercentage;
              await this.executeSellTokens(tokensToSell);
            }
          }
        }, 300000); // Every 5 minutes
        break;
    }
  }

  async getTokenPrice() {
    // In a real implementation, this would fetch the current price from a DEX or oracle
    // For demo purposes, return a simulated price
    return 0.000001 * (1 + (Math.random() * 0.1 - 0.05)); // Random fluctuation
  }

  async executeTrade(amount) {
    // Randomly choose buy or sell
    if (Math.random() > 0.5) {
      await this.executeBuy(amount);
    } else {
      await this.executeSell(amount);
    }
  }

  async executeBuy(solAmount) {
    try {
      if (!this.isActive) return;
      
      console.log(`${this.botType} bot executing BUY for ${solAmount} SOL`);
      
      // In a real implementation, this would interact with a DEX to execute the swap
      // For demo purposes, we'll simulate the purchase
      
      // Log the trade
      const trade = {
        type: 'BUY',
        timestamp: Date.now(),
        amount: solAmount,
        tokenAmount: solAmount * 1000000, // Simulated exchange rate
        wallet: this.wallet.publicKey.toString(),
        botType: this.botType,
        status: 'completed',
        txId: `sim_${Date.now()}_${Math.floor(Math.random() * 1000000)}`
      };
      
      this.tradeHistory.push(trade);
      this.logTrade(trade);
      
      // Update token balance
      this.tokenBalance += trade.tokenAmount;
      
      return trade;
    } catch (error) {
      console.error(`Buy error for ${this.botType}:`, error);
      return {
        type: 'BUY',
        timestamp: Date.now(),
        amount: solAmount,
        wallet: this.wallet.publicKey.toString(),
        botType: this.botType,
        status: 'failed',
        error: error.message
      };
    }
  }

  async executeSell(solEquivalentAmount) {
    try {
      if (!this.isActive) return;
      
      // Calculate tokens to sell based on current price
      const price = await this.getTokenPrice();
      const tokensToSell = solEquivalentAmount / price;
      
      return this.executeSellTokens(tokensToSell);
    } catch (error) {
      console.error(`Sell error for ${this.botType}:`, error);
      return {
        type: 'SELL',
        timestamp: Date.now(),
        amount: solEquivalentAmount,
        wallet: this.wallet.publicKey.toString(),
        botType: this.botType,
        status: 'failed',
        error: error.message
      };
    }
  }

  async executeSellTokens(tokenAmount) {
    try {
      if (!this.isActive) return;
      if (tokenAmount > this.tokenBalance) {
        tokenAmount = this.tokenBalance;
      }
      
      if (tokenAmount <= 0) {
        return null; // Nothing to sell
      }
      
      console.log(`${this.botType} bot executing SELL for ${tokenAmount} tokens`);
      
      // In a real implementation, this would interact with a DEX to execute the swap
      // For demo purposes, we'll simulate the sale
      
      // Calculate SOL received
      const price = await this.getTokenPrice();
      const solReceived = tokenAmount * price;
      
      // Log the trade
      const trade = {
        type: 'SELL',
        timestamp: Date.now(),
        amount: solReceived,
        tokenAmount: tokenAmount,
        wallet: this.wallet.publicKey.toString(),
        botType: this.botType,
        status: 'completed',
        txId: `sim_${Date.now()}_${Math.floor(Math.random() * 1000000)}`
      };
      
      this.tradeHistory.push(trade);
      this.logTrade(trade);
      
      // Update token balance
      this.tokenBalance -= tokenAmount;
      
      return trade;
    } catch (error) {
      console.error(`Sell error for ${this.botType}:`, error);
      return {
        type: 'SELL',
        timestamp: Date.now(),
        tokenAmount: tokenAmount,
        wallet: this.wallet.publicKey.toString(),
        botType: this.botType,
        status: 'failed',
        error: error.message
      };
    }
  }

  async manualBuy(solAmount) {
    // For manual trading when auto-trading is turned off
    if (this.isActive) {
      throw new Error('Deactivate automatic trading before manual trading');
    }
    return this.executeBuy(solAmount);
  }

  async manualSell(tokenAmount) {
    // For manual trading when auto-trading is turned off
    if (this.isActive) {
      throw new Error('Deactivate automatic trading before manual trading');
    }
    return this.executeSellTokens(tokenAmount);
  }

  async getBalances() {
    try {
      if (!this.connection) {
        this.setNetwork(this.network);
      }
      
      // Get SOL balance
      const solBalance = await this.connection.getBalance(this.wallet.publicKey) / LAMPORTS_PER_SOL;
      
      // In a real implementation, we would fetch the token balance from the chain
      // Here we're using our cached value
      
      return {
        sol: solBalance,
        token: this.tokenBalance,
        tokenAddress: this.tokenAddress ? this.tokenAddress.toString() : null
      };
    } catch (error) {
      console.error('Error fetching balances:', error);
      return { sol: 0, token: this.tokenBalance };
    }
  }

  async airDrop(amount = 1) {
    if (this.network !== 'devnet') {
      throw new Error('Airdrop only available on devnet');
    }
    
    try {
      const signature = await this.connection.requestAirdrop(
        this.wallet.publicKey,
        amount * LAMPORTS_PER_SOL
      );
      
      await this.connection.confirmTransaction(signature);
      
      return {
        success: true,
        amount,
        signature
      };
    } catch (error) {
      console.error('Airdrop error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendSol(recipientPublicKey, amount) {
    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: this.wallet.publicKey,
          toPubkey: new PublicKey(recipientPublicKey),
          lamports: amount * LAMPORTS_PER_SOL
        })
      );
      
      transaction.feePayer = this.wallet.publicKey;
      const blockhash = await this.connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash.blockhash;
      
      // Sign transaction
      transaction.sign(this.wallet);
      
      // Send transaction
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize()
      );
      
      await this.connection.confirmTransaction(signature);
      
      return {
        success: true,
        signature,
        amount
      };
    } catch (error) {
      console.error('Send SOL error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendTokens(recipientPublicKey, amount) {
    // Implementation for sending tokens would go here
    // This would use SPL Token Program to transfer tokens
    console.log(`Sending ${amount} tokens to ${recipientPublicKey}`);
    
    // For demo purposes, we'll simulate the transfer
    return {
      success: true,
      signature: `sim_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
      amount
    };
  }

  logTrade(trade) {
    // Add to local history
    this.tradeHistory.push(trade);
    
    // Also write to trades.json file for persistence
    try {
      let trades = [];
      if (fs.existsSync('./trades.json')) {
        const tradesData = fs.readFileSync('./trades.json', 'utf8');
        trades = JSON.parse(tradesData);
      }
      
      trades.push(trade);
      fs.writeFileSync('./trades.json', JSON.stringify(trades, null, 2));
    } catch (error) {
      console.error('Error logging trade:', error);
    }
  }

  setConfig(config) {
    this.config = {
      ...this.config,
      ...config
    };
    return this;
  }
}

// Export the bot class and types
module.exports = {
  TradingBot,
  BOT_TYPES
};
