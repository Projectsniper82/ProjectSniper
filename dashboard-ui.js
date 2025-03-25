// dashboard-ui.js - Frontend JavaScript for Wallet Dashboard with real-time updates

// Real API implementation that connects to the backend
class DashboardAPI {
    constructor() {
        console.log('Initializing dashboard API with real backend connection...');
        
        // Default network is devnet
        this.network = localStorage.getItem('network') || 'devnet';
        
        // Store token address if previously set
        this.tokenAddress = localStorage.getItem('tokenAddress') || '';
        
        // Base URL for API calls
        this.apiBaseUrl = 'http://localhost:3000/api';
        
        // Setup WebSocket connection for real-time updates
        this.setupWebSocket();
        
        // Event listeners for updates
        this.eventListeners = {
            'trade': [],
            'balance': [],
            'network': []
        };
    }
    
    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        this.socket = new WebSocket(wsUrl);
        
        this.socket.onopen = () => {
            console.log('WebSocket connection established');
        };
        
        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // Trigger appropriate event listeners
                if (data.type && this.eventListeners[data.type]) {
                    this.eventListeners[data.type].forEach(callback => callback(data.data));
                }
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        };
        
        this.socket.onclose = () => {
            console.log('WebSocket connection closed. Reconnecting in 3 seconds...');
            setTimeout(() => this.setupWebSocket(), 3000);
        };
        
        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    // Event listener registration
    on(event, callback) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].push(callback);
        }
    }
    
    // Remove event listener
    off(event, callback) {
        if (this.eventListeners[event]) {
            this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
        }
    }
    
    async apiRequest(endpoint, method = 'GET', data = null) {
        try {
            const url = `${this.apiBaseUrl}/${endpoint}`;
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            if (data && (method === 'POST' || method === 'PUT')) {
                options.body = JSON.stringify(data);
            }
            
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${errorText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    }
    
    async getWalletBalances() {
        try {
            return await this.apiRequest('wallets');
        } catch (error) {
            console.error('Error fetching wallet balances:', error);
            return [];
        }
    }
    
    async getTradeHistory() {
        try {
            return await this.apiRequest('trades');
        } catch (error) {
            console.error('Error fetching trade history:', error);
            return [];
        }
    }
    
    async switchNetwork(network) {
        try {
            const result = await this.apiRequest('network', 'POST', { network });
            this.network = network;
            localStorage.setItem('network', network);
            return result;
        } catch (error) {
            console.error('Error switching network:', error);
            throw error;
        }
    }
    
    async setTokenAddress(address) {
        try {
            const result = await this.apiRequest('token', 'POST', { address });
            this.tokenAddress = address;
            localStorage.setItem('tokenAddress', address);
            return result;
        } catch (error) {
            console.error('Error setting token address:', error);
            throw error;
        }
    }
    
    async toggleBot(botIndex, active) {
        try {
            return await this.apiRequest('bot/toggle', 'POST', { botIndex, active });
        } catch (error) {
            console.error('Error toggling bot:', error);
            throw error;
        }
    }
    
    async airDrop(botIndex, amount = 1) {
        try {
            return await this.apiRequest('airdrop', 'POST', { botIndex, amount });
        } catch (error) {
            console.error('Error requesting airdrop:', error);
            throw error;
        }
    }
    
    async sendSol(fromBotIndex, toAddress, amount) {
        try {
            return await this.apiRequest('send/sol', 'POST', { fromBotIndex, toAddress, amount });
        } catch (error) {
            console.error('Error sending SOL:', error);
            throw error;
        }
    }
    
    async sendTokens(fromBotIndex, toAddress, amount) {
        try {
            return await this.apiRequest('send/token', 'POST', { fromBotIndex, toAddress, amount });
        } catch (error) {
            console.error('Error sending tokens:', error);
            throw error;
        }
    }
    
    async manualBuy(botIndex, amount) {
        try {
            return await this.apiRequest('trade/buy', 'POST', { botIndex, amount });
        } catch (error) {
            console.error('Error executing buy:', error);
            throw error;
        }
    }
    
    async manualSell(botIndex, amount) {
        try {
            return await this.apiRequest('trade/sell', 'POST', { botIndex, amount });
        } catch (error) {
            console.error('Error executing sell:', error);
            throw error;
        }
    }
    
    async createNewWallet(botType) {
        try {
            return await this.apiRequest('wallet/create', 'POST', { botType });
        } catch (error) {
            console.error('Error creating wallet:', error);
            throw error;
        }
    }
    
    async updateBotConfig(botIndex, config) {
        try {
            return await this.apiRequest('bot/config', 'POST', { botIndex, config });
        } catch (error) {
            console.error('Error updating bot config:', error);
            throw error;
        }
    }
    
    async getNetworkStatus() {
        try {
            return await this.apiRequest('network/status');
        } catch (error) {
            console.error('Error getting network status:', error);
            return { status: 'error', latency: 999 };
        }
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
        this.setupRealTimeUpdates();
        this.refreshDashboard();
        
        // Secondary periodic refresh as a fallback (every 10 seconds instead of 30)
        setInterval(() => this.refreshDashboard(), 10000);
    }
    
    setupRealTimeUpdates() {
        // Listen for trade updates
        this.api.on('trade', (tradeData) => {
            console.log('Received trade update:', tradeData);
            this.updateTradeHistory();
            // Also update wallet balances as they will have changed
            this.updateWalletCards();
        });
        
        // Listen for balance updates
        this.api.on('balance', (balanceData) => {
            console.log('Received balance update:', balanceData);
            this.updateWalletCards();
        });
        
        // Listen for network updates
        this.api.on('network', (networkData) => {
            console.log('Received network update:', networkData);
            this.updateNetworkStatus();
        });
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
        await this.updateNetworkStatus();
        this.updateTokenAddressDisplay();
    }
    
    async updateWalletCards() {
        const wallets = await this.api.getWalletBalances();
        const container = document.getElementById('wallets-container');
        
        // Store current state of cards to preserve toggle states
        const currentCards = {};
        Array.from(container.children).forEach(card => {
            const index = card.dataset.index;
            if (index) {
                currentCards[index] = {
                    checked: card.querySelector('.toggle-checkbox').checked,
                    buyAmount: card.querySelector('.buy-amount')?.value,
                    sellAmount: card.querySelector('.sell-amount')?.value
                };
            }
        });
        
        // Clear existing wallet cards
        container.innerHTML = '';
        
        // Create wallet cards
        wallets.forEach((wallet, index) => {
            const card = this.createWalletCard(wallet, index);
            
            // Restore previous state if it exists
            if (currentCards[index]) {
                const toggle = card.querySelector('.toggle-checkbox');
                toggle.checked = currentCards[index].checked;
                
                const buyInput = card.querySelector('.buy-amount');
                if (buyInput && currentCards[index].buyAmount) {
                    buyInput.value = currentCards[index].buyAmount;
                }
                
                const sellInput = card.querySelector('.sell-amount');
                if (sellInput && currentCards[index].sellAmount) {
                    sellInput.value = currentCards[index].sellAmount;
                }
                
                // Show/hide manual trading section based on toggle state
                const manualTrading = card.querySelector('.manual-trading');
                manualTrading.classList.toggle('hidden', toggle.checked);
            }
            
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
        
        card.querySelector('.sol-balance').textContent = `${wallet.sol.toFixed(4)} SOL`;
        card.querySelector('.token-balance').textContent = `${wallet.token.toLocaleString()} Tokens`;
        
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
    
    async updateNetworkStatus() {
        const statusIndicator = document.querySelector('#network-status span:first-child');
        const statusText = document.querySelector('#network-status span:last-child');
        const latencyElement = document.querySelector('#network-latency span');
        
        try {
            const networkStatus = await this.api.getNetworkStatus();
            
            if (this.api.network === 'devnet') {
                statusIndicator.className = 'h-3 w-3 rounded-full bg-green-500 mr-2';
                statusText.textContent = 'Devnet Connected';
            } else {
                statusIndicator.className = 'h-3 w-3 rounded-full bg-purple-500 mr-2';
                statusText.textContent = 'Mainnet Connected';
            }
            
            latencyElement.textContent = `${networkStatus.latency}ms`;
            
            if (networkStatus.status !== 'connected') {
                statusIndicator.className = 'h-3 w-3 rounded-full bg-red-500 mr-2';
                statusText.textContent = 'Connection Error';
            }
        } catch (error) {
            statusIndicator.className = 'h-3 w-3 rounded-full bg-red-500 mr-2';
            statusText.textContent = 'Connection Error';
            latencyElement.textContent = 'N/A';
        }
    }
    
    updateTokenAddressDisplay() {
        const tokenAddressInput = document.getElementById('token-address');
        tokenAddressInput.value = this.api.tokenAddress || '';
    }
    
    // UI Action Methods
    async switchNetwork(network) {
        try {
            const result = await this.api.switchNetwork(network);
            
            if (result.status === 'connected') {
                this.updateNetworkStatus();
                await this.refreshDashboard();
                this.showNotification(`Switched to ${network}`);
            } else {
                this.showNotification(`Failed to connect to ${network}`, 'error');
            }
        } catch (error) {
            this.showNotification(`Network switch failed: ${error.message}`, 'error');
        }
    }
    
    async setTokenAddress(address) {
        try {
            const result = await this.api.setTokenAddress(address);
            
            if (result.success) {
                this.updateTokenAddressDisplay();
                this.showNotification('Token address set successfully');
                await this.refreshDashboard(); // Refresh to update token balances
            } else {
                this.showNotification(`Failed to set token address: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showNotification(`Error setting token address: ${error.message}`, 'error');
        }
    }
    
    async toggleBot(index, active) {
        try {
            const result = await this.api.toggleBot(index, active);
            
            if (result.success) {
                this.showNotification(`${active ? 'Activated' : 'Deactivated'} ${this.formatBotName(result.botType)}`);
                await this.refreshDashboard();
            } else {
                this.showNotification(`Failed to ${active ? 'activate' : 'deactivate'} bot: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showNotification(`Error toggling bot: ${error.message}`, 'error');
        }
    }
    
    async airDrop(index) {
        try {
            const result = await this.api.airDrop(index);
            
            if (result.success) {
                this.showNotification(`Airdropped ${result.amount} SOL successfully`);
                await this.refreshDashboard();
            } else {
                this.showNotification(result.error, 'error');
            }
        } catch (error) {
            this.showNotification(`Airdrop failed: ${error.message}`, 'error');
        }
    }
    
    async sendSol(fromIndex, toAddress, amount) {
        try {
            const result = await this.api.sendSol(fromIndex, toAddress, amount);
            
            if (result.success) {
                this.showNotification(`Sent ${amount} SOL successfully`);
                await this.refreshDashboard();
            } else {
                this.showNotification(result.error, 'error');
            }
        } catch (error) {
            this.showNotification(`Send SOL failed: ${error.message}`, 'error');
        }
    }
    
    async sendTokens(fromIndex, toAddress, amount) {
        try {
            const result = await this.api.sendTokens(fromIndex, toAddress, amount);
            
            if (result.success) {
                this.showNotification(`Sent ${amount} tokens successfully`);
                await this.refreshDashboard();
            } else {
                this.showNotification(result.error, 'error');
            }
        } catch (error) {
            this.showNotification(`Send tokens failed: ${error.message}`, 'error');
        }
    }
    
    async manualBuy(index, amount) {
        try {
            const result = await this.api.manualBuy(index, amount);
            
            if (result.success) {
                this.showNotification(`Bought tokens for ${amount} SOL successfully`);
                await this.refreshDashboard();
            } else {
                this.showNotification(result.error, 'error');
            }
        } catch (error) {
            this.showNotification(`Buy failed: ${error.message}`, 'error');
        }
    }
    
    async manualSell(index, amount) {
        try {
            const result = await this.api.manualSell(index, amount);
            
            if (result.success) {
                this.showNotification(`Sold ${amount} tokens successfully`);
                await this.refreshDashboard();
            } else {
                this.showNotification(result.error, 'error');
            }
        } catch (error) {
            this.showNotification(`Sell failed: ${error.message}`, 'error');
        }
    }
    
    async createNewWallet(botType) {
        try {
            const result = await this.api.createNewWallet(botType);
            
            if (result.success) {
                this.showNotification(`Created new ${this.formatBotName(botType)} wallet`);
                await this.refreshDashboard();
            } else {
                this.showNotification(`Failed to create wallet: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showNotification(`Wallet creation failed: ${error.message}`, 'error');
        }
    }
    
    async updateBotConfig(index, config) {
        try {
            const result = await this.api.updateBotConfig(index, config);
            
            if (result.success) {
                this.showNotification('Bot settings updated');
                await this.refreshDashboard();
            } else {
                this.showNotification(`Failed to update settings: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showNotification(`Settings update failed: ${error.message}`, 'error');
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
        
        // Get wallet data
        this.api.getWalletBalances().then(wallets => {
            if (botIndex >= 0 && botIndex < wallets.length) {
                const botConfig = wallets[botIndex].config || {};
                
                // Set form values with defaults if undefined
                document.getElementById('settings-slippage').value = botConfig.slippage || 0.5;
                document.getElementById('settings-max-buy').value = botConfig.maxBuyAmount || 1.0;
                document.getElementById('settings-min-sell').value = botConfig.minSellPrice || 0;
                document.getElementById('settings-buy-interval').value = (botConfig.buyInterval || 60000) / 1000; // Convert to seconds
                
                // Update title
                document.getElementById('bot-settings-title').textContent = `${this.formatBotName(wallets[botIndex].botType)} Settings`;
                
                document.getElementById('bot-settings-modal').classList.remove('hidden');
            }
        });
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
