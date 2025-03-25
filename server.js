// server.js - Express API server for Solana Dashboard with WebSocket support

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const bodyParser = require('body-parser');
const { WalletDashboard } = require('./dashboard.js');
const { EventEmitter } = require('events');

// Extend WalletDashboard with event capabilities
class EventDashboard extends WalletDashboard {
  constructor() {
    super();
    this.events = new EventEmitter();
    this.lastBalanceCheck = 0;
    this.lastNetworkCheck = 0;
    this.balanceCacheTime = 10000; // 10 seconds
    this.networkCacheTime = 30000; // 30 seconds
  }
  
  // Cache-aware getWalletBalances to reduce API calls
  async getCachedWalletBalances() {
    const now = Date.now();
    if (!this.cachedBalances || now - this.lastBalanceCheck > this.balanceCacheTime) {
      this.cachedBalances = await super.getWalletBalances();
      this.lastBalanceCheck = now;
    }
    return this.cachedBalances;
  }
  
  // Cache-aware network status check
  async getCachedNetworkStatus() {
    const now = Date.now();
    if (!this.cachedNetworkStatus || now - this.lastNetworkCheck > this.networkCacheTime) {
      this.cachedNetworkStatus = await super.checkNetworkStatus();
      this.lastNetworkCheck = now;
    }
    return this.cachedNetworkStatus;
  }
  
  // Override methods to emit events after successful operations
  async toggleBot(botIndex, active) {
    try {
      const result = await super.toggleBot(botIndex, active);
      this.events.emit('balance', await this.getCachedWalletBalances());
      return { success: true, ...result };
    } catch (error) {
      console.error('Error toggling bot:', error);
      return { success: false, error: error.message };
    }
  }
  
  async airDrop(botIndex, amount = 1) {
    try {
      const result = await super.airDrop(botIndex, amount);
      if (result.success) {
        this.events.emit('balance', await this.getCachedWalletBalances());
        this.events.emit('trade', {
          type: 'AIRDROP',
          botIndex,
          amount,
          timestamp: Date.now(),
          success: true
        });
      }
      return result;
    } catch (error) {
      console.error('Error in airDrop:', error);
      return { success: false, error: error.message };
    }
  }
  
  async sendSol(fromBotIndex, toAddress, amount) {
    try {
      const result = await super.sendSol(fromBotIndex, toAddress, amount);
      if (result.success) {
        this.events.emit('balance', await this.getCachedWalletBalances());
        this.events.emit('trade', {
          type: 'SEND',
          fromBotIndex,
          toAddress,
          amount,
          timestamp: Date.now(),
          success: true
        });
      }
      return result;
    } catch (error) {
      console.error('Error in sendSol:', error);
      return { success: false, error: error.message };
    }
  }
  
  async sendTokens(fromBotIndex, toAddress, amount) {
    try {
      const result = await super.sendTokens(fromBotIndex, toAddress, amount);
      if (result.success) {
        this.events.emit('balance', await this.getCachedWalletBalances());
        this.events.emit('trade', {
          type: 'SEND_TOKEN',
          fromBotIndex,
          toAddress,
          amount,
          timestamp: Date.now(),
          success: true
        });
      }
      return result;
    } catch (error) {
      console.error('Error in sendTokens:', error);
      return { success: false, error: error.message };
    }
  }
  
  async manualBuy(botIndex, amount) {
    try {
      const result = await super.manualBuy(botIndex, amount);
      
      // Add this null check
      if (!result) {
        console.log(`manualBuy returned undefined result for bot ${botIndex}`);
        return { success: false, error: "Transaction failed with no result" };
      }
      
      if (result.success || result.status === 'completed') {
        this.events.emit('balance', await this.getCachedWalletBalances());
        this.events.emit('trade', {
          type: 'BUY',
          botIndex,
          amount,
          timestamp: Date.now(),
          success: true,
          ...result
        });
      }
      return result;
    } catch (error) {
      console.error(`Error in manualBuy:`, error);
      return { success: false, error: error.message };
    }
  }
  
  async manualSell(botIndex, amount) {
    try {
      const result = await super.manualSell(botIndex, amount);
      
      // Add this null check
      if (!result) {
        console.log(`manualSell returned undefined result for bot ${botIndex}`);
        return { success: false, error: "Transaction failed with no result" };
      }
      
      if (result.success || result.status === 'completed') {
        this.events.emit('balance', await this.getCachedWalletBalances());
        this.events.emit('trade', {
          type: 'SELL',
          botIndex,
          amount,
          timestamp: Date.now(),
          success: true,
          ...result
        });
      }
      return result;
    } catch (error) {
      console.error(`Error in manualSell:`, error);
      return { success: false, error: error.message };
    }
  }
  
  async createNewWallet(botType) {
    try {
      const result = await super.createNewWallet(botType);
      this.events.emit('balance', await this.getCachedWalletBalances());
      return { success: true, wallet: result };
    } catch (error) {
      console.error('Error in createNewWallet:', error);
      return { success: false, error: error.message };
    }
  }
  
  async switchNetwork(network) {
    try {
      const result = await super.switchNetwork(network);
      this.events.emit('network', result);
      return result;
    } catch (error) {
      console.error('Error in switchNetwork:', error);
      return { status: 'error', error: error.message };
    }
  }
  
  async setTokenAddress(tokenAddress) {
    try {
      const result = await super.setTokenAddress(tokenAddress);
      // After setting token address, refresh balances
      this.events.emit('balance', await this.getCachedWalletBalances());
      return result;
    } catch (error) {
      console.error('Error in setTokenAddress:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow cross-origin requests
app.use(bodyParser.json());

// Initialize the wallet dashboard with event support
const dashboard = new EventDashboard();

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Send initial data
  dashboard.getCachedWalletBalances().then(balances => {
    ws.send(JSON.stringify({
      type: 'balance',
      data: balances
    }));
  });
  
  dashboard.getTradeHistory().then(trades => {
    ws.send(JSON.stringify({
      type: 'trade',
      data: trades
    }));
  });
  
  // Set up event listeners
  const balanceListener = (data) => {
    ws.send(JSON.stringify({
      type: 'balance',
      data
    }));
  };
  
  const tradeListener = (data) => {
    ws.send(JSON.stringify({
      type: 'trade',
      data
    }));
  };
  
  const networkListener = (data) => {
    ws.send(JSON.stringify({
      type: 'network',
      data
    }));
  };
  
  dashboard.events.on('balance', balanceListener);
  dashboard.events.on('trade', tradeListener);
  dashboard.events.on('network', networkListener);
  
  // Clean up when client disconnects
  ws.on('close', () => {
    console.log('Client disconnected');
    dashboard.events.off('balance', balanceListener);
    dashboard.events.off('trade', tradeListener);
    dashboard.events.off('network', networkListener);
  });
});

// Monitor bot trading events - this is important to get real-time updates from the bot logic
// This should be called after each bot is activated
function monitorBotEvents() {
  // Get all active bots and set up event listeners for their trade activities
  const activeBots = dashboard.bots.filter(bot => bot.isActive);
  
  for (const bot of activeBots) {
    if (!bot._isMonitored) {
      bot._isMonitored = true;
      
      // Override the logTrade method to emit events
      const originalLogTrade = bot.logTrade.bind(bot);
      bot.logTrade = (trade) => {
        // Call original method
        originalLogTrade(trade);
        
        // Emit event
        dashboard.events.emit('trade', trade);
        
        // Also refresh balances after a trade
        dashboard.getCachedWalletBalances().then(balances => {
          dashboard.events.emit('balance', balances);
        });
      };
    }
  }
}

// Call monitor function periodically to catch new active bots
setInterval(monitorBotEvents, 10000);

// API Routes
// Get wallet balances
app.get('/api/wallets', async (req, res) => {
    try {
        const wallets = await dashboard.getCachedWalletBalances();
        res.json(wallets);
    } catch (error) {
        console.error('Error fetching wallets:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get trade history
app.get('/api/trades', async (req, res) => {
    try {
        const trades = await dashboard.getTradeHistory();
        res.json(trades);
    } catch (error) {
        console.error('Error fetching trade history:', error);
        res.status(500).json({ error: error.message });
    }
});

// Switch network
app.post('/api/network', async (req, res) => {
    try {
        const { network } = req.body;
        const result = await dashboard.switchNetwork(network);
        res.json(result);
    } catch (error) {
        console.error('Error switching network:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get network status
app.get('/api/network/status', async (req, res) => {
    try {
        const status = await dashboard.getCachedNetworkStatus();
        res.json(status);
    } catch (error) {
        console.error('Error checking network status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Set token address
app.post('/api/token', async (req, res) => {
    try {
        const { address } = req.body;
        const result = await dashboard.setTokenAddress(address);
        res.json(result);
    } catch (error) {
        console.error('Error setting token address:', error);
        res.status(500).json({ error: error.message });
    }
});

// Toggle bot
app.post('/api/bot/toggle', async (req, res) => {
    try {
        const { botIndex, active } = req.body;
        const result = await dashboard.toggleBot(botIndex, active);
        
        // If activated, start monitoring events
        if (active) {
            monitorBotEvents();
        }
        
        res.json(result);
    } catch (error) {
        console.error('Error toggling bot:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update bot config
app.post('/api/bot/config', async (req, res) => {
    try {
        const { botIndex, config } = req.body;
        const result = await dashboard.updateBotConfig(botIndex, config);
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Error updating bot config:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Airdrop SOL
app.post('/api/airdrop', async (req, res) => {
    try {
        const { botIndex, amount } = req.body;
        const result = await dashboard.airDrop(botIndex, amount);
        res.json(result);
    } catch (error) {
        console.error('Error processing airdrop:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send SOL
app.post('/api/send/sol', async (req, res) => {
    try {
        const { fromBotIndex, toAddress, amount } = req.body;
        const result = await dashboard.sendSol(fromBotIndex, toAddress, amount);
        res.json(result);
    } catch (error) {
        console.error('Error sending SOL:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send Tokens
app.post('/api/send/token', async (req, res) => {
    try {
        const { fromBotIndex, toAddress, amount } = req.body;
        const result = await dashboard.sendTokens(fromBotIndex, toAddress, amount);
        res.json(result);
    } catch (error) {
        console.error('Error sending tokens:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Manual buy
app.post('/api/trade/buy', async (req, res) => {
    try {
        const { botIndex, amount } = req.body;
        const result = await dashboard.manualBuy(botIndex, amount);
        
        // Handle null/undefined result
        if (!result) {
            return res.status(500).json({ 
                success: false, 
                error: "Transaction failed with no result" 
            });
        }
        
        res.json({
            success: result.success !== false, // Treat undefined as success
            ...result
        });
    } catch (error) {
        console.error('Error executing buy:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Manual sell
app.post('/api/trade/sell', async (req, res) => {
    try {
        const { botIndex, amount } = req.body;
        const result = await dashboard.manualSell(botIndex, amount);
        
        // Handle null/undefined result
        if (!result) {
            return res.status(500).json({ 
                success: false, 
                error: "Transaction failed with no result" 
            });
        }
        
        res.json({
            success: result.success !== false, // Treat undefined as success
            ...result
        });
    } catch (error) {
        console.error('Error executing sell:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create new wallet
app.post('/api/wallet/create', async (req, res) => {
    try {
        const { botType } = req.body;
        const result = await dashboard.createNewWallet(botType);
        res.json(result);
    } catch (error) {
        console.error('Error creating wallet:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get whole dashboard state
app.get('/api/dashboard', async (req, res) => {
    try {
        const state = await dashboard.getDashboardState();
        res.json(state);
    } catch (error) {
        console.error('Error fetching dashboard state:', error);
        res.status(500).json({ error: error.message });
    }
});

// Serve static files from the root directory
app.use(express.static('./'));

// Fallback route for SPA
app.get('*', (req, res) => {
    res.sendFile('index.html', { root: './' });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Solana Dashboard API server running on port ${PORT}`);
    console.log(`Open your browser to http://localhost:${PORT} to view the dashboard`);
});
