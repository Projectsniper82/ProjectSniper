// dashboard.js - Wallet dashboard controller

const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { TradingBot, BOT_TYPES } = require('./bot-logic.js');
const fs = require('fs');

class WalletDashboard {
  constructor() {
    this.wallets = [];
    this.bots = [];
    this.network = 'devnet'; // Default to devnet
    this.connection = new Connection('https://api.devnet.solana.com');
    this.tokenAddress = null;
    this.networkStats = {
      latency: 0,
      status: 'unknown'
    };
    
    this.init();
  }
  
  async init() {
    // Load wallets from storage if available
    try {
      if (fs.existsSync('./wallets.json')) {
        const walletsData = fs.readFileSync('./wallets.json', 'utf8');
        const walletSecrets = JSON.parse(walletsData);
        
        // Recreate wallet objects
        this.wallets = walletSecrets.map(secret => {
          const secretKey = new Uint8Array(secret.secretKey);
          return Keypair.fromSecretKey(secretKey);
        });
        
        // Recreate bots with loaded wallets
        await this.setupBots();
      } else {
        // No existing wallets, create default set
        await this.createInitialWallets();
      }
    } catch (error) {
      console.error('Error initializing dashboard:', error);
      // Fallback to creating new wallets
      await this.createInitialWallets();
    }
    
    // Start network monitoring
    this.startNetworkMonitoring();
  }
  
  async createInitialWallets() {
    console.log('Creating initial wallets...');
    
    // Create one wallet for each bot type
    for (const botType of Object.values(BOT_TYPES)) {
      const wallet = Keypair.generate();
      this.wallets.push(wallet);
      
      // Create corresponding bot
      const bot = new TradingBot(wallet, botType);
      bot.setNetwork(this.network);
      this.bots.push(bot);
      
      console.log(`Created wallet and ${botType} bot: ${wallet.publicKey.toString()}`);
    }
    
    // Save wallets for future sessions
    this.saveWallets();
  }
  
  async setupBots() {
    // Create bot instances for each wallet
    this.bots = [];
    
    Object.values(BOT_TYPES).forEach((botType, index) => {
      if (index < this.wallets.length) {
        const wallet = this.wallets[index];
        const bot = new TradingBot(wallet, botType);
        bot.setNetwork(this.network);
        if (this.tokenAddress) {
          bot.setTokenAddress(this.tokenAddress);
        }
        this.bots.push(bot);
      }
    });
  }
  
  saveWallets() {
    // Save wallet secrets for future sessions
    const walletSecrets = this.wallets.map(wallet => ({
      publicKey: wallet.publicKey.toString(),
      secretKey: Array.from(wallet.secretKey)
    }));
    
    fs.writeFileSync('./wallets.json', JSON.stringify(walletSecrets, null, 2));
  }
  
  async createNewWallet(botType) {
    const wallet = Keypair.generate();
    this.wallets.push(wallet);
    
    // Create corresponding bot
    const bot = new TradingBot(wallet, botType);
    bot.setNetwork(this.network);
    if (this.tokenAddress) {
      bot.setTokenAddress(this.tokenAddress);
    }
    this.bots.push(bot);
    
    // Save updated wallet list
    this.saveWallets();
    
    return {
      publicKey: wallet.publicKey.toString(),
      botType
    };
  }
  
  async switchNetwork(network) {
    if (network !== 'devnet' && network !== 'mainnet') {
      throw new Error('Invalid network. Must be "devnet" or "mainnet"');
    }
    
    this.network = network;
    this.connection = new Connection(
      network === 'mainnet' ? 
        'https://api.mainnet-beta.solana.com' : 
        'https://api.devnet.solana.com'
    );
    
    // Update network for all bots
    for (const bot of this.bots) {
      bot.setNetwork(network);
    }
    
    // Check network status
    await this.checkNetworkStatus();
    
    return {
      network,
      status: this.networkStats.status
    };
  }
  
  async setTokenAddress(tokenAddress) {
    try {
      // Validate address
      this.tokenAddress = new PublicKey(tokenAddress);
      
      // Update for all bots
      for (const bot of this.bots) {
        bot.setTokenAddress(this.tokenAddress);
      }
      
      return {
        success: true,
        tokenAddress: this.tokenAddress.toString()
      };
    } catch (error) {
      console.error('Error setting token address:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async toggleBot(botIndex, active) {
    if (botIndex < 0 || botIndex >= this.bots.length) {
      throw new Error(`Invalid bot index: ${botIndex}`);
    }
    
    const bot = this.bots[botIndex];
    
    if (active) {
      await bot.activate();
    } else {
      bot.deactivate();
    }
    
    return {
      index: botIndex,
      botType: bot.botType,
      active: bot.isActive
    };
  }
  
  async manualBuy(botIndex, amount) {
    if (botIndex < 0 || botIndex >= this.bots.length) {
      throw new Error(`Invalid bot index: ${botIndex}`);
    }
    
    const bot = this.bots[botIndex];
    const result = await bot.manualBuy(amount);
    
    return result;
  }
  
  async manualSell(botIndex, amount) {
    if (botIndex < 0 || botIndex >= this.bots.length) {
      throw new Error(`Invalid bot index: ${botIndex}`);
    }
    
    const bot = this.bots[botIndex];
    const result = await bot.manualSell(amount);
    
    return result;
  }
  
  async airDrop(botIndex, amount = 1) {
    if (this.network !== 'devnet') {
      throw new Error('Airdrop only available on devnet');
    }
    
    if (botIndex < 0 || botIndex >= this.bots.length) {
      throw new Error(`Invalid bot index: ${botIndex}`);
    }
    
    const bot = this.bots[botIndex];
    const result = await bot.airDrop(amount);
    
    return {
      botIndex,
      botType: bot.botType,
      ...result
    };
  }
  
  async sendSol(fromBotIndex, toAddress, amount) {
    if (fromBotIndex < 0 || fromBotIndex >= this.bots.length) {
      throw new Error(`Invalid bot index: ${fromBotIndex}`);
    }
    
    const fromBot = this.bots[fromBotIndex];
    const result = await fromBot.sendSol(toAddress, amount);
    
    return {
      fromBotIndex,
      fromBotType: fromBot.botType,
      toAddress,
      ...result
    };
  }
  
  async sendTokens(fromBotIndex, toAddress, amount) {
    if (fromBotIndex < 0 || fromBotIndex >= this.bots.length) {
      throw new Error(`Invalid bot index: ${fromBotIndex}`);
    }
    
    const fromBot = this.bots[fromBotIndex];
    const result = await fromBot.sendTokens(toAddress, amount);
    
    return {
      fromBotIndex,
      fromBotType: fromBot.botType,
      toAddress,
      ...result
    };
  }
  
  async getWalletBalances() {
    const balances = [];
    
    for (let i = 0; i < this.bots.length; i++) {
      const bot = this.bots[i];
      const balance = await bot.getBalances();
      
      balances.push({
        index: i,
        publicKey: bot.wallet.publicKey.toString(),
        botType: bot.botType,
        ...balance,
        isActive: bot.isActive
      });
    }
    
    return balances;
  }
  
  async getTradeHistory() {
    try {
      if (fs.existsSync('./trades.json')) {
        const tradesData = fs.readFileSync('./trades.json', 'utf8');
        return JSON.parse(tradesData);
      }
      return [];
    } catch (error) {
      console.error('Error loading trade history:', error);
      return [];
    }
  }
  
  startNetworkMonitoring() {
    // Check network status periodically
    this.networkInterval = setInterval(() => {
      this.checkNetworkStatus();
    }, 30000); // Every 30 seconds
    
    // Initial check
    this.checkNetworkStatus();
  }
  
  async checkNetworkStatus() {
    try {
      const startTime = Date.now();
      await this.connection.getRecentBlockhash();
      const endTime = Date.now();
      
      this.networkStats = {
        latency: endTime - startTime,
        status: 'connected'
      };
    } catch (error) {
      console.error('Network check error:', error);
      this.networkStats = {
        latency: 999,
        status: 'error',
        error: error.message
      };
    }
    
    return this.networkStats;
  }
  
  async updateBotConfig(botIndex, config) {
    if (botIndex < 0 || botIndex >= this.bots.length) {
      throw new Error(`Invalid bot index: ${botIndex}`);
    }
    
    const bot = this.bots[botIndex];
    bot.setConfig(config);
    
    return {
      botIndex,
      botType: bot.botType,
      config: bot.config
    };
  }
  
  // Get dashboard state for UI
  async getDashboardState() {
    const walletBalances = await this.getWalletBalances();
    const tradeHistory = await this.getTradeHistory();
    
    return {
      network: this.network,
      networkStats: this.networkStats,
      tokenAddress: this.tokenAddress ? this.tokenAddress.toString() : null,
      wallets: walletBalances,
      tradeHistory: tradeHistory.slice(-100) // Last 100 trades
    };
  }
}

module.exports = {
  WalletDashboard
};
