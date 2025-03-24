// dashboard-ui.js - Frontend JavaScript for Wallet Dashboard

// Mock implementation for demonstration - would be replaced with real backend communication
class DashboardAPI {
    constructor() {
        // For demo purposes we'll use localStorage to persist some state
        this.initLocalStorage();
        
        // Mock connection to backend
        console.log('Initializing dashboard API...');
        
        // Initial network is devnet
        this.network = localStorage.getItem('network') || 'devnet';
        
        // Mock token address if previously set
        this.tokenAddress = localStorage.getItem('tokenAddress') || '';
        
        // Create initial wallets if not exists
        if (!localStorage.getItem('walletsInitialized')) {
            this.createInitialWallets();
            localStorage.setItem('walletsInitialized', 'true');
        }
    }
    
    initLocalStorage() {
        // Initialize local storage with demo data if not exists
        if (!localStorage.getItem('tradeHistory')) {
            const initialTrades = [
                {
                    type: 'BUY',
                    timestamp: Date.now() - 3600000,
                    amount: 0.1,
                    tokenAmount: 100000,
                    wallet: this.truncateAddress(this.generateRandomAddress()),
                    botType: 'sniper',
                    status: 'completed',
                    txId: `sim_${Date.now() - 3600000}_123456`
                },
                {
                    type: 'SELL',
                    timestamp: Date.now() - 1800000,
                    amount: 0.05,
                    tokenAmount: 50000,
                    wallet: this.truncateAddress(this.generateRandomAddress()),
                    botType: 'volume_1',
                    status: 'completed',
                    txId: `sim_${Date.now() - 1800000}_654321`
                }
            ];
            localStorage.setItem('tradeHistory', JSON.stringify(initialTrades));
        }
    }
    
    async createInitialWallets() {
        const botTypes = [
            'sniper',
            'volume_1',
            'volume_2',
            'volume_3',
            'volume_4',
            'volume_5',
            'volume_6'
        ];
        
        const wallets = botTypes.map(botType => ({
            publicKey: this.generateRandomAddress(),
            botType,
            isActive: false,
            solBalance: botType === 'sniper' ? 2.5 : 1.0 + Math.random(),
            tokenBalance: botType === 'sniper' ? 250000 : Math.floor(Math.random() * 100000),
            config: {
                slippage: 0.5,
                maxBuyAmount: 1.0,
                minSellPrice: 1.2,
                buyInterval: 60
            }
        }));
        
        localStorage.setItem('wallets', JSON.stringify(wallets));
        
        return wallets;
    }
    
    generateRandomAddress() {
        let result = ''; 
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; 
        for (let i = 0; i < 44; i++) { 
            result += characters.charAt(Math.floor(Math.random() * characters.length)); 
        }
        return result;
    }
    
    truncateAddress(address) {
        if (!address) return '';
        return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
    }
    
    async getWalletBalances() {
        // Mock implementation - would call backend API in real implementation
        const wallets = JSON.parse(localStorage.getItem('wallets') || '[]');
        return wallets;
    }
    
    async getTradeHistory() {
        // Mock implementation - would call backend API in real implementation
        const trades = JSON.parse(localStorage.getItem('tradeHistory') || '[]');
        return trades.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    async switchNetwork(network) {
        // Mock implementation
        console.log(`Switching network to ${network}`);
        this.network = network;
        localStorage.setItem('network', network);
        
        // Simulate network status check with random latency
        const latency = Math.floor(Math.random() * 100) + 20;
        
        return {
            network,
            status: 'connected',
            latency
        };
    }
    
    async setTokenAddress(address) {
        // Mock implementation
        console.log(`Setting token address to ${address}`);
        this.tokenAddress = address;
        localStorage.setItem('tokenAddress', address);
        
        return {
            success: true,
            tokenAddress: address
        };
    }
    
    async toggleBot(botIndex, active) {
        // Mock implementation
        const wallets = JSON.parse(localStorage.getItem('wallets') || '[]');
        
        if (botIndex >= 0 && botIndex < wallets.length) {
            wallets[botIndex].isActive = active;
            localStorage.setItem('wallets', JSON.stringify(wallets));
            
            // Show manual trading section if bot is deactivated
            return {
                success: true,
                botIndex,
                active
            };
        }
        
        return {
            success: false,
            error: 'Invalid bot index'
        };
    }
    
    async airDrop(botIndex, amount = 1) {
        // Mock implementation - only works on devnet
        if (this.network !== 'devnet') {
            return {
                success: false,
                error: 'Airdrop only available on devnet'
            };
        }
        
        const wallets = JSON.parse(localStorage.getItem('wallets') || '[]');
        
        if (botIndex >= 0 && botIndex < wallets.length) {
            wallets[botIndex].solBalance += amount;
            localStorage.setItem('wallets', JSON.stringify(wallets));
            
            // Add transaction to history
            this.addTransaction({
                type: 'AIRDROP',
                timestamp: Date.now(),
                amount,
                wallet: wallets[botIndex].publicKey,
                botType: wallets[botIndex].botType,
                status: 'completed',
                txId: `airdrop_${Date.now()}_${Math.floor(Math.random() * 1000000)}`
            });
            
            return {
                success: true,
                amount,
                signature: `airdrop_${Date.now()}`
            };
        }
        
        return {
            success: false,
            error: 'Invalid bot index'
        };
    }
    
    async sendSol(fromBotIndex, toAddress, amount) {
        // Mock implementation
        const wallets = JSON.parse(localStorage.getItem('wallets') || '[]');
        
        if (fromBotIndex >= 0 && fromBotIndex < wallets.length) {
            if (wallets[fromBotIndex].solBalance < amount) {
                return {
                    success: false,
                    error: 'Insufficient balance'
                };
            }
            
            wallets[fromBotIndex].solBalance -= amount;
            localStorage.setItem('wallets', JSON.stringify(wallets));
            
            // Add transaction to
history
            this.addTransaction({
                type: 'SEND',
                timestamp: Date.now(),
                amount,
                recipient: toAddress,
                wallet: wallets[fromBotIndex].publicKey,
                botType: wallets[fromBotIndex].botType,
                status: 'completed',
                txId: `send_${Date.now()}_${Math.floor(Math.random() * 1000000)}`
            });
            
            return {
                success: true,
                amount,
                signature: `send_${Date.now()}`
            };
        }
        
        return {
            success: false,
            error: 'Invalid bot index'
        };
    }
    
    async sendTokens(fromBotIndex, toAddress, amount) {
        // Mock implementation
        const wallets = JSON.parse(localStorage.getItem('wallets') || '[]');
        
        if (fromBotIndex >= 0 && fromBotIndex < wallets.length) {
            if (wallets[fromBotIndex].tokenBalance < amount) {
                return {
                    success: false,
                    error: 'Insufficient token balance'
                };
            }
            
            wallets[fromBotIndex].tokenBalance -= amount;
            localStorage.setItem('wallets', JSON.stringify(wallets));
            
            // Add transaction to history
            this.addTransaction({
                type: 'SEND_TOKEN',
                timestamp: Date.now(),
                tokenAmount: amount,
                recipient: toAddress,
                wallet: wallets[fromBotIndex].publicKey,
                botType: wallets[fromBotIndex].botType,
                status: 'completed',
                txId: `send_token_${Date.now()}_${Math.floor(Math.random() * 1000000)}`
            });
            
            return {
                success: true,
                amount,
                signature: `send_token_${Date.now()}`
            };
        }
        
        return {
            success: false,
            error: 'Invalid bot index'
        };
    }
    
    async manualBuy(botIndex, amount) {
        // Mock implementation
        const wallets = JSON.parse(localStorage.getItem('wallets') || '[]');
        
        if (botIndex >= 0 && botIndex < wallets.length) {
            if (wallets[botIndex].isActive) {
                return {
                    success: false,
                    error: 'Deactivate automatic trading before manual trading'
                };
            }
            
            if (wallets[botIndex].solBalance < amount) {
                return {
                    success: false,
                    error: 'Insufficient SOL balance'
                };
            }
            
            // Simulate token purchase
            wallets[botIndex].solBalance -= amount;
            const tokenAmount = amount * 1000000; // Mock exchange rate
            wallets[botIndex].tokenBalance += tokenAmount;
            
            localStorage.setItem('wallets', JSON.stringify(wallets));
            
            // Add transaction to history
            const trade = {
                type: 'BUY',
                timestamp: Date.now(),
                amount,
                tokenAmount,
                wallet: wallets[botIndex].publicKey,
                botType: wallets[botIndex].botType,
                status: 'completed',
                txId: `manual_buy_${Date.now()}_${Math.floor(Math.random() * 1000000)}`
            };
            
            this.addTransaction(trade);
            
            return {
                success: true,
                ...trade
            };
        }
        
        return {
            success: false,
            error: 'Invalid bot index'
        };
    }
    
    async manualSell(botIndex, tokenAmount) {
        // Mock implementation
        const wallets = JSON.parse(localStorage.getItem('wallets') || '[]');
        
        if (botIndex >= 0 && botIndex < wallets.length) {
            if (wallets[botIndex].isActive) {
                return {
                    success: false,
                    error: 'Deactivate automatic trading before manual trading'
                };
            }
            
            if (wallets[botIndex].tokenBalance < tokenAmount) {
                return {
                    success: false,
                    error: 'Insufficient token balance'
                };
            }
            
            // Simulate token sale
            wallets[botIndex].tokenBalance -= tokenAmount;
            const amount = tokenAmount / 1000000; // Mock exchange rate
            wallets[botIndex].solBalance += amount;
            
            localStorage.setItem('wallets', JSON.stringify(wallets));
            
            // Add transaction to history
            const trade = {
                type: 'SELL',
                timestamp: Date.now(),
                amount,
                tokenAmount,
                wallet: wallets[botIndex].publicKey,
                botType: wallets[botIndex].botType,
                status: 'completed',
                txId: `manual_sell_${Date.now()}_${Math.floor(Math.random() * 1000000)}`
            };
            
            this.addTransaction(trade);
            
            return {
                success: true,
                ...trade
            };
        }
        
        return {
            success: false,
            error: 'Invalid bot index'
        };
    }
    
    async createNewWallet(botType) {
        // Mock implementation
        const wallets = JSON.parse(localStorage.getItem('wallets') || '[]');
        
        const newWallet = {
            publicKey: this.generateRandomAddress(),
            botType,
            isActive: false,
            solBalance: 0,
            tokenBalance: 0,
            config: {
                slippage: 0.5,
                maxBuyAmount: 1.0,
                minSellPrice: 1.2,
                buyInterval: 60
            }
        };
        
        wallets.push(newWallet);
        localStorage.setItem('wallets', JSON.stringify(wallets));
        
        return {
            success: true,
            wallet: newWallet
        };
    }
    
    async updateBotConfig(botIndex, config) {
        // Mock implementation
        const wallets = JSON.parse(localStorage.getItem('wallets') || '[]');
        
        if (botIndex >= 0 && botIndex < wallets.length) {
            wallets[botIndex].config = {
                ...wallets[botIndex].config,
                ...config
            };
            
            localStorage.setItem('wallets', JSON.stringify(wallets));
            
            return {
                success: true,
                botIndex,
                config: wallets[botIndex].config
            };
        }
        
        return {
            success: false,
            error: 'Invalid bot index'
        };
    }
    
    addTransaction(transaction) {
        const trades = JSON.parse(localStorage.getItem('tradeHistory') || '[]');
        trades.unshift(transaction);
        localStorage.setItem('tradeHistory', JSON.stringify(trades.slice(0, 100))); // Keep only latest 100 transactions
    }
}

// Main Dashboard UI Controller
class DashboardUI {
    constructor() {
        this.api = new DashboardAPI();
        
        // Track current selected bot for actions
        this.selectedBotIndex = -1;
        this.currentAction = '';
        
        this.initEventListeners();
        this.refreshDashboard();
        
        // Refresh dashboard every 30 seconds
        setInterval(() => this.refreshDashboard(), 30000);
    }
    
    async initEventListeners() {
        // Network select
        document.getElementById('network-select').addEventListener('change', async (e) => {
            const network = e.target.value;
            await this.switchNetwork(network);
        });
        
        // Token address
        document.getElementById('set-token-btn').addEventListener('click', async () => {
            const tokenAddress = document.getElementById('token-address').value.trim();
            if (tokenAddress) {
                await this.setTokenAddress(tokenAddress);
            }
        });
        
        // Create wallet button
        document.getElementById('create-wallet-btn').addEventListener('click', () => {
            this.showCreateWalletModal();
        });
        
        // Create wallet confirmation
        document.getElementById('create-wallet-confirm').addEventListener('click', async () => {
            const botType = document.getElementById('bot-type').value;
            await this.createNewWallet(botType);
            this.hideCreateWalletModal();
        });
        
        // Create wallet cancel
        document.getElementById('create-wallet-cancel').addEventListener('click', () => {
            this.hideCreateWalletModal();
        });
        
        // Transfer confirmation
        document.getElementById('transfer-confirm').addEventListener('click', async () => {
            const recipientAddress = document.getElementById('recipient-address').value.trim();
            const amount = parseFloat(document.getElementById('transfer-amount').value);
            
            if (recipientAddress && !isNaN(amount) && amount > 0) {
                if (this.currentAction === 'sendSol') {
                    await this.sendSol(this.selectedBotIndex, recipientAddress, amount);
                } else if (this.currentAction === 'sendToken') {
                    await this.sendTokens(this.selectedBotIndex, recipientAddress, amount);
                }
                this.hideTransferModal();
            }
        });
        
        // Transfer cancel
        document.getElementById('transfer-cancel').addEventListener('click', () => {
            this.hideTransferModal();
        });
        
        // Settings confirmation
        document.getElementById('settings-save').addEventListener('click', async () => {
            const config = {
                slippage: parseFloat(document.getElementById('settings-slippage').value),
                maxBuyAmount: parseFloat(document.getElementById('settings-max-buy').value),
                minSellPrice: parseFloat(document.getElementById('settings-min-sell').value),
                buyInterval: parseInt(document.getElementById('settings-buy-interval').value) * 1000 // Convert to ms
            };
            
            await this.updateBotConfig(this.selectedBotIndex, config);
            this.hideBotSettingsModal();
        });
        
        // Settings cancel
        document.getElementById('settings-cancel').addEventListener('click', () => {
            this.hideBotSettingsModal();
        });
    }
async refreshDashboard() {
        await this.updateWalletCards();
        await this.updateTradeHistory();
        this.updateNetworkStatus();
        this.updateTokenAddressDisplay();
    }
    
    async updateWalletCards() {
        const wallets = await this.api.getWalletBalances();
        const container = document.getElementById('wallets-container');
        
        // Clear existing wallet cards
        container.innerHTML = '';
        
        // Create wallet cards
        wallets.forEach((wallet, index) => {
            const card = this.createWalletCard(wallet, index);
            container.appendChild(card);
        });
    }
    
    createWalletCard(wallet, index) {
        // Clone template
        const template = document.getElementById('wallet-card-template');
        const card = document.importNode(template.content, true).firstElementChild;
        
        // Set data attributes
        card.dataset.index = index;
        card.dataset.publicKey = wallet.publicKey;
        card.dataset.botType = wallet.botType;
        
        // Set content
        card.querySelector('.bot-name').textContent = this.formatBotName(wallet.botType);
        
        const addressElement = card.querySelector('.wallet-address');
        addressElement.textContent = this.truncateAddress(wallet.publicKey);
        addressElement.title = wallet.publicKey;
        
        card.querySelector('.sol-balance').textContent = `${wallet.solBalance.toFixed(4)} SOL`;
        card.querySelector('.token-balance').textContent = `${wallet.tokenBalance.toLocaleString()} Tokens`;
        
        // Set toggle state
        const toggle = card.querySelector('.toggle-checkbox');
        toggle.checked = wallet.isActive;
        toggle.id = `bot-toggle-${index}`;
        card.querySelector('.toggle-label').setAttribute('for', `bot-toggle-${index}`);
        
        // Show/hide manual trading section based on bot active state
        const manualTrading = card.querySelector('.manual-trading');
        manualTrading.classList.toggle('hidden', wallet.isActive);
        
        // Add event listeners
        this.addWalletCardEventListeners(card, index);
        
        return card;
    }
    
    addWalletCardEventListeners(card, index) {
        // Bot toggle
        const toggle = card.querySelector('.toggle-checkbox');
        toggle.addEventListener('change', async () => {
            await this.toggleBot(index, toggle.checked);
            
            // Show/hide manual trading section
            const manualTrading = card.querySelector('.manual-trading');
            manualTrading.classList.toggle('hidden', toggle.checked);
        });
        
        // Copy address
        card.querySelector('.copy-address').addEventListener('click', () => {
            const address = card.dataset.publicKey;
            navigator.clipboard.writeText(address)
                .then(() => this.showNotification('Address copied to clipboard'))
                .catch(err => console.error('Could not copy text: ', err));
        });
        
        // Airdrop button
        card.querySelector('.airdrop-btn').addEventListener('click', async () => {
            await this.airDrop(index);
        });
        
        // Settings button
        card.querySelector('.settings-btn').addEventListener('click', () => {
            this.showBotSettingsModal(index);
        });
        
        // Send SOL button
        card.querySelector('.send-sol-btn').addEventListener('click', () => {
            this.showTransferModal(index, 'sendSol');
        });
        
        // Send Token button
        card.querySelector('.send-token-btn').addEventListener('click', () => {
            this.showTransferModal(index, 'sendToken');
        });
        
        // Manual Buy button
        const manualBuyBtn = card.querySelector('.manual-buy-btn');
        manualBuyBtn.addEventListener('click', async () => {
            const amount = parseFloat(card.querySelector('.buy-amount').value);
            if (!isNaN(amount) && amount > 0) {
                await this.manualBuy(index, amount);
            }
        });
        
        // Manual Sell button
        const manualSellBtn = card.querySelector('.manual-sell-btn');
        manualSellBtn.addEventListener('click', async () => {
            const amount = parseFloat(card.querySelector('.sell-amount').value);
            if (!isNaN(amount) && amount > 0) {
                await this.manualSell(index, amount);
            }
        });
    }
    
    async updateTradeHistory() {
        const trades = await this.api.getTradeHistory();
        const tbody = document.getElementById('trade-history-body');
        
        // Clear existing rows
        tbody.innerHTML = '';
        
        // Create trade history rows
        trades.forEach(trade => {
            const row = document.createElement('tr');
            
            // Type cell
            const typeCell = document.createElement('td');
            typeCell.className = 'px-4 py-3 whitespace-nowrap';
            typeCell.innerHTML = `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${this.getTradeTypeColor(trade.type)}">${trade.type}</span>`;
            row.appendChild(typeCell);
            
            // Bot cell
            const botCell = document.createElement('td');
            botCell.className = 'px-4 py-3 whitespace-nowrap text-sm text-gray-500';
            botCell.textContent = this.formatBotName(trade.botType);
            row.appendChild(botCell);
            
            // Amount cell
            const amountCell = document.createElement('td');
            amountCell.className = 'px-4 py-3 whitespace-nowrap text-sm text-gray-900';
            if (trade.type === 'BUY' || trade.type === 'SELL' || trade.type === 'SEND' || trade.type === 'AIRDROP') {
                amountCell.textContent = `${trade.amount.toFixed(4)} SOL`;
            } else if (trade.type === 'SEND_TOKEN') {
                amountCell.textContent = `${trade.tokenAmount.toLocaleString()} Tokens`;
            }
            row.appendChild(amountCell);
            
            // Status cell
            const statusCell = document.createElement('td');
            statusCell.className = 'px-4 py-3 whitespace-nowrap text-sm';
            statusCell.innerHTML = `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${this.getStatusColor(trade.status)}">${trade.status}</span>`;
            row.appendChild(statusCell);
            
            tbody.appendChild(row);
        });
    }
    
    updateNetworkStatus() {
        const statusIndicator = document.querySelector('#network-status span:first-child');
        const statusText = document.querySelector('#network-status span:last-child');
        const latencyElement = document.querySelector('#network-latency span');
        
        if (this.api.network === 'devnet') {
            statusIndicator.className = 'h-3 w-3 rounded-full bg-green-500 mr-2';
            statusText.textContent = 'Devnet Connected';
        } else {
            statusIndicator.className = 'h-3 w-3 rounded-full bg-purple-500 mr-2';
            statusText.textContent = 'Mainnet Connected';
        }
        
        // Mock latency for demo
        const latency = Math.floor(Math.random() * 100) + 20;
        latencyElement.textContent = `${latency}ms`;
    }
    
    updateTokenAddressDisplay() {
        const tokenAddressInput = document.getElementById('token-address');
        tokenAddressInput.value = this.api.tokenAddress || '';
    }
    
    // UI Action Methods
    async switchNetwork(network) {
        const result = await this.api.switchNetwork(network);
        
        if (result.status === 'connected') {
            this.updateNetworkStatus();
            await this.refreshDashboard();
            
            this.showNotification(`Switched to ${network}`);
        }
    }
    
    async setTokenAddress(address) {
        const result = await this.api.setTokenAddress(address);
        
        if (result.success) {
            this.updateTokenAddressDisplay();
            this.showNotification('Token address set successfully');
        }
    }
    
    async toggleBot(index, active) {
        const result = await this.api.toggleBot(index, active);
        
        if (result.success) {
            this.showNotification(`${active ? 'Activated' : 'Deactivated'} ${this.formatBotName(result.botType)}`);
            await this.refreshDashboard();
        }
    }
    
    async airDrop(index) {
        const result = await this.api.airDrop(index);
        
        if (result.success) {
            this.showNotification(`Airdropped ${result.amount} SOL successfully`);
            await this.refreshDashboard();
        } else {
            this.showNotification(result.error, 'error');
        }
    }
    
    async sendSol(fromIndex, toAddress, amount) {
        const result = await this.api.sendSol(fromIndex, toAddress, amount);
        
        if (result.success) {
            this.showNotification(`Sent ${amount} SOL successfully`);
            await this.refreshDashboard();
        } else {
            this.showNotification(result.error, 'error');
        }
    }
    
    async sendTokens(fromIndex, toAddress, amount) {
        const result = await this.api.sendTokens(fromIndex, toAddress, amount);
        
        if (result.success) {
            this.showNotification(`Sent ${amount} tokens successfully`);
            await this.refreshDashboard();
        } else {
            this.showNotification(result.error, 'error');
        }
    }
    
    async manualBuy(index, amount) {
        const result = await this.api.manualBuy(index, amount);
        
        if (result.success) {
            this.showNotification(`Bought tokens for ${amount} SOL successfully`);
            await this.refreshDashboard();
        } else {
            this.showNotification(result.error, 'error');
        }
    }
    
    async manualSell(index, amount) {
        const result = await this.api.manualSell(index, amount);
        
        if (result.success) {
            this.showNotification(`Sold ${amount} tokens successfully`);
            await this.refreshDashboard();
        } else {
            this.showNotification(result.error, 'error');
        }
    }
    
    async createNewWallet(botType) {
        const result = await this.api.createNewWallet(botType);
        
        if (result.success) {
            this.showNotification(`Created new ${this.formatBotName(botType)} wallet`);
            await this.refreshDashboard();
        }
    }
    
    async updateBotConfig(index, config) {
        const result = await this.api.updateBotConfig(index, config);
        
        if (result.success) {
            this.showNotification('Bot settings updated');
            await this.refreshDashboard();
        }
    }
    
    // Modal Controls
    showCreateWalletModal() {
        document.getElementById('create-wallet-modal').classList.remove('hidden');
    }
    
    hideCreateWalletModal() {
        document.getElementById('create-wallet-modal').classList.add('hidden');
    }
    
    showTransferModal(botIndex, action) {
        this.selectedBotIndex = botIndex;
        this.currentAction = action;
        
        const modal = document.getElementById('transfer-modal');
        const title = document.getElementById('transfer-modal-title');
        const amountLabel = document.querySelector('label[for="transfer-amount"]');
        
        if (action === 'sendSol') {
            title.textContent = 'Send SOL';
            amountLabel.textContent = 'Amount (SOL)';
        } else if (action === 'sendToken') {
            title.textContent = 'Send Tokens';
            amountLabel.textContent = 'Amount (Tokens)';
        }
        
        modal.classList.remove('hidden');
    }
    
    hideTransferModal() {
        document.getElementById('transfer-modal').classList.add('hidden');
        document.getElementById('recipient-address').value = '';
        document.getElementById('transfer-amount').value = '';
    }
    
    showBotSettingsModal(botIndex) {
        this.selectedBotIndex = botIndex;
        
        // Get current bot config
        const wallets = JSON.parse(localStorage.getItem('wallets') || '[]');
        const botConfig = wallets[botIndex].config;
        
        // Set form values
        document.getElementById('settings-slippage').value = botConfig.slippage;
        document.getElementById('settings-max-buy').value = botConfig.maxBuyAmount;
        document.getElementById('settings-min-sell').value = botConfig.minSellPrice;
        document.getElementById('settings-buy-interval').value = botConfig.buyInterval / 1000; // Convert to seconds
        
        // Update title
        document.getElementById('bot-settings-title').textContent = `${this.formatBotName(wallets[botIndex].botType)} Settings`;
        
        document.getElementById('bot-settings-modal').classList.remove('hidden');
    }
    
    hideBotSettingsModal() {
        document.getElementById('bot-settings-modal').classList.add('hidden');
    }
    
    // Helper methods
    formatBotName(botType) {
        if (botType === 'sniper') {
            return 'Sniper Bot';
        } else if (botType.startsWith('volume_')) {
            const number = botType.split('_')[1];
            return `Volume Bot ${number}`;
        }
        return botType;
    }
    
    truncateAddress(address) {
        if (!address) return '';
        return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
    }
    
    getTradeTypeColor(type) {
        switch (type) {
            case 'BUY':
                return 'bg-green-100 text-green-800';
            case 'SELL':
                return 'bg-red-100 text-red-800';
            case 'AIRDROP':
                return 'bg-blue-100 text-blue-800';
            case 'SEND':
            case 'SEND_TOKEN':
                return 'bg-purple-100 text-purple-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }
    
    getStatusColor(status) {
        switch (status) {
            case 'completed':
                return 'bg-green-100 text-green-800';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'failed':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    }
    
    showNotification(message, type = 'success') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `fixed bottom-4 right-4 px-4 py-2 rounded-md text-white ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} transition-opacity duration-500`;
        notification.textContent = message;
        
        // Add to DOM
        document.body.appendChild(notification);
        
        // Remove after timeout
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 500);
        }, 3000);
    }
}

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new DashboardUI();
});
