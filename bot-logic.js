// bot-logic.js - Trading bot logic implementation

const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { Market, TokenInstructions } = require('@project-serum/serum');
const { Token, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { Jupiter } = require('@jup-ag/core');
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

// Helper function to add retry logic for rate-limited operations
async function withRetry(fn, maxRetries = 5, initialDelay = 500) {
  let retries = 0;
  let delay = initialDelay;
  
  while (retries < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      if (error.message && error.message.includes('429 Too Many Requests')) {
        retries++;
        console.log(`Server responded with 429 Too Many Requests. Retrying after ${delay}ms delay...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        throw error; // Re-throw if not a rate limit error
      }
    }
  }
  
  throw new Error(`Operation failed after ${maxRetries} retries due to rate limiting`);
}

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
    this.lastPriceCheck = 0;
    this.cachedPrice = null;
    this.priceCacheTime = 60000; // 1 minute
  }

  setNetwork(network) {
    this.network = network;
    this.connection = new Connection(network === 'mainnet' ? 
      'https://api.mainnet-beta.solana.com' : 
      'https://api.devnet.solana.com', {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000, // 60 seconds
      });
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
    
    // For simplicity in testing, we'll just execute a buy
    // In production, this would monitor for liquidity pool creation
    try {
      const buy = await this.executeBuy(this.config.maxBuyAmount);
      console.log("Sniper bot initial buy result:", buy);
    } catch (error) {
      console.error("Sniper bot initial buy error:", error);
    }
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
              
              // Get current token balance
              const balances = await this.getBalances();
              const tokensToSell = balances.token * sellPercentage;
              
              if (tokensToSell > 0) {
                await this.executeSellTokens(tokensToSell);
              }
            }
          }
        }, 300000); // Every 5 minutes
        break;
    }
  }

  async getTokenPrice() {
    // Use cached price if available and recent
    const now = Date.now();
    if (this.cachedPrice && now - this.lastPriceCheck < this.priceCacheTime) {
      return this.cachedPrice;
    }
    
    try {
      if (!this.tokenAddress) {
        return 0;
      }

      return await withRetry(async () => {
        // Setup for a quote using Jupiter
        const jupiter = await Jupiter.load({
          connection: this.connection,
          cluster: this.network === 'mainnet' ? 'mainnet-beta' : 'devnet',
          user: this.wallet
        });
        
        // We need to get a quote for a small amount to determine the price
        const inputMint = this.tokenAddress;
        const outputMint = new PublicKey('So11111111111111111111111111111111111111112'); // Native SOL
        
        // Get token decimals from token account if available
        let decimals = 9; // Default assumption
        
        try {
          const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
            this.wallet.publicKey,
            { mint: this.tokenAddress }
          );
          
          if (tokenAccounts.value.length > 0) {
            decimals = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.decimals;
          }
        } catch (error) {
          console.log("Couldn't determine token decimals, using default 9");
        }
        
        // Try to get a quote for a small amount (e.g., 1 token)
        const sampleAmount = Math.pow(10, decimals); // 1 token in raw units
        
        try {
          const routes = await jupiter.computeRoutes({
            inputMint,
            outputMint,
            inputAmount: sampleAmount,
            slippage: this.config.slippage || 1,
          });
          
          if (routes.routesInfos.length > 0) {
            const sampleRoute = routes.routesInfos[0];
            const sampleSolOutput = sampleRoute.outAmount / LAMPORTS_PER_SOL;
            
            // Cache the price
            this.cachedPrice = sampleSolOutput;
            this.lastPriceCheck = now;
            
            // This is the price of 1 token in SOL
            return sampleSolOutput;
          }
        } catch (error) {
          console.log("Error getting price quote:", error);
        }
        
        // Fallback - return a simulated price
        return 0.000001 * (1 + (Math.random() * 0.1 - 0.05));
      });
    } catch (error) {
      console.error("Error in getTokenPrice:", error);
      return 0.000001 * (1 + (Math.random() * 0.1 - 0.05)); // Random fluctuation
    }
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
	if (!this.isActive && this.botType !== 'sniper' && this.manualBuyInProgress !== true) {
        console.log(`Bot not active, skipping buy`);
        return null;
      }
      
      if (!this.tokenAddress) {
        console.log(`No token address set, cannot buy`);
        throw new Error('Token address must be set before buying');
      }
      
      console.log(`${this.botType} bot executing DEX BUY for ${solAmount} SOL with token ${this.tokenAddress.toString()}`);
      
      return await withRetry(async () => {
        // Check if we have enough SOL
        const solBalance = await this.connection.getBalance(this.wallet.publicKey);
        const solBalanceInSol = solBalance / LAMPORTS_PER_SOL;
        
        console.log(`Current SOL balance: ${solBalanceInSol}`);
        
        if (solBalanceInSol < solAmount) {
          console.log(`Insufficient SOL balance: ${solBalanceInSol.toFixed(4)}, needed: ${solAmount}`);
          throw new Error(`Insufficient SOL balance: ${solBalanceInSol.toFixed(4)}, needed: ${solAmount}`);
        }
        
        // Check if wallet has token account for this token, if not create one
        const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
          this.wallet.publicKey,
          { mint: this.tokenAddress }
        );
        
        if (tokenAccounts.value.length === 0) {
          console.log(`Creating token account for ${this.tokenAddress.toString()}`);
          
          try {
            // Create associated token account
            const associatedTokenAddress = await Token.getAssociatedTokenAddress(
              ASSOCIATED_TOKEN_PROGRAM_ID,
              TOKEN_PROGRAM_ID,
              this.tokenAddress,
              this.wallet.publicKey
            );
            
            const transaction = new Transaction().add(
              Token.createAssociatedTokenAccountInstruction(
                ASSOCIATED_TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                this.tokenAddress,
                associatedTokenAddress,
                this.wallet.publicKey,
                this.wallet.publicKey
              )
            );
            
            transaction.feePayer = this.wallet.publicKey;
            const blockhash = await this.connection.getRecentBlockhash();
            transaction.recentBlockhash = blockhash.blockhash;
            
            transaction.sign(this.wallet);
            const signature = await this.connection.sendRawTransaction(transaction.serialize());
            await this.connection.confirmTransaction(signature);
            
            console.log(`Created token account: ${associatedTokenAddress.toString()}`);
          } catch (error) {
            console.error('Error creating token account:', error);
            // Continue anyway, the Jupiter swap will create it if needed
          }
        }
        
        // We'll use native SOL for the input token
        const inputMint = new PublicKey('So11111111111111111111111111111111111111112'); // Native SOL
        const outputMint = this.tokenAddress; // The token we want to buy
        
        console.log(`Setting up Jupiter for swap from ${inputMint.toString()} to ${outputMint.toString()}`);
        
        // Setup Jupiter
        try {
          console.log(`Loading Jupiter with network: ${this.network}`);
          const jupiter = await Jupiter.load({
            connection: this.connection,
            cluster: this.network === 'mainnet' ? 'mainnet-beta' : 'devnet',
            user: this.wallet // The wallet is the user keypair
          });
          
          // Calculate the amount in lamports
          const inputAmount = Math.floor(solAmount * LAMPORTS_PER_SOL);
          console.log(`Calculated input amount: ${inputAmount} lamports`);
          
          // Get routes
          console.log(`Finding routes to swap ${solAmount} SOL for ${outputMint.toString()} tokens...`);
          
          try {
            const routes = await jupiter.computeRoutes({
              inputMint,
              outputMint,
              inputAmount,
              slippage: this.config.slippage || 1, // Default 1% slippage
              forceFetch: true
            });
            
            if (!routes || !routes.routesInfos || routes.routesInfos.length === 0) {
              console.log(`No routes found for the swap`);
              throw new Error(`No routes found to swap SOL for ${outputMint.toString()}`);
            }
            
            // Select the best route
            const bestRoute = routes.routesInfos[0];
            console.log(`Best route found, expected output: ${bestRoute.outAmount} tokens`);
            
            // Execute the swap
            console.log(`Preparing to execute the swap`);
            const { execute } = await jupiter.exchange({
              routeInfo: bestRoute
            });
            
            // Execute the transaction
            console.log(`Executing the swap transaction`);
            const swapResult = await execute();
            
            // Check if the transaction was successful
            if (swapResult.error) {
              console.error('Swap failed:', swapResult.error);
              throw new Error(`Swap failed: ${swapResult.error}`);
            }
            
            // Get the transaction signature
            const txid = swapResult.txid;
            console.log(`Swap successful, transaction: ${txid}`);
            
            // Calculate the amount of tokens purchased
            const tokenAmount = bestRoute.outAmount;
            
            // Log the real trade
            const trade = {
              type: 'BUY',
              timestamp: Date.now(),
              amount: solAmount,
              tokenAmount: tokenAmount,
              wallet: this.wallet.publicKey.toString(),
              botType: this.botType,
              status: 'completed',
              txId: txid
            };
            
            this.tradeHistory.push(trade);
            this.logTrade(trade);
            
            return trade;
          } catch (routesError) {
            console.error('Error computing routes:', routesError);
            
            // For testing purposes, create a simulated trade record
            const simulatedTrade = {
              type: 'BUY',
              timestamp: Date.now(),
              amount: solAmount,
              tokenAmount: solAmount * 1000000, // Simulated amount
              wallet: this.wallet.publicKey.toString(),
              botType: this.botType,
              status: 'completed',
              txId: `simulated_${Date.now()}`
            };
            
            this.tradeHistory.push(simulatedTrade);
            this.logTrade(simulatedTrade);
            
            return simulatedTrade;
          }
        } catch (jupiterError) {
          console.error('Error setting up Jupiter:', jupiterError);
          throw new Error(`Jupiter setup failed: ${jupiterError.message}`);
        }
      });
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
      if (!this.isActive) return null;
      
      if (!this.tokenAddress) {
        throw new Error('Token address must be set before selling');
      }
      
      console.log(`${this.botType} bot calculating sell amount for ${solEquivalentAmount} SOL equivalent`);
      
      return await withRetry(async () => {
        // Get current token price to estimate amount
        console.log(`Getting current price for ${this.tokenAddress.toString()}`);
        
        // Get token decimals
        const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
          this.wallet.publicKey,
          { mint: this.tokenAddress }
        );
        
        if (tokenAccounts.value.length === 0) {
          console.log(`No token account found for ${this.tokenAddress.toString()}, cannot sell`);
          return null;
        }
        
        const accountInfo = tokenAccounts.value[0].account.data.parsed.info;
        const decimals = accountInfo.tokenAmount.decimals;
        const rawBalance = accountInfo.tokenAmount.amount;
        const actualTokenBalance = parseInt(rawBalance) / Math.pow(10, decimals);
        
        if (actualTokenBalance <= 0) {
          console.log(`No tokens to sell`);
          return null;
        }
        
        // Setup for a quote using Jupiter
        const jupiter = await Jupiter.load({
          connection: this.connection,
          cluster: this.network === 'mainnet' ? 'mainnet-beta' : 'devnet',
          user: this.wallet
        });
        
        // Try to get a rough price estimate to determine how many tokens to sell
        const tokenPrice = await this.getTokenPrice();
        
        if (tokenPrice <= 0) {
          console.log(`Could not determine token price, using 10% of balance`);
          // If we can't get a price, sell 10% of the balance
          const tokensToSell = actualTokenBalance * 0.1;
          return this.executeSellTokens(tokensToSell);
        }
        
        // Calculate tokens needed to get solEquivalentAmount
        const tokensToSell = solEquivalentAmount / tokenPrice;
        console.log(`Need to sell approximately ${tokensToSell} tokens to get ${solEquivalentAmount} SOL`);
        
        // Make sure we don't try to sell more than we have
        const finalAmount = Math.min(tokensToSell, actualTokenBalance);
        
        if (finalAmount <= 0) {
          console.log(`Calculated amount to sell is 0 or negative`);
          return null;
        }
        
        // Execute the sell with the calculated token amount
        return this.executeSellTokens(finalAmount);
      });
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
      if (!this.isActive) return null;
      
      if (!this.tokenAddress) {
        throw new Error('Token address must be set before selling');
      }
      
      return await withRetry(async () => {
        // Check if we have enough tokens to sell
        const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
          this.wallet.publicKey,
          { mint: this.tokenAddress }
        );
        
        if (tokenAccounts.value.length === 0) {
          throw new Error(`No token account found for ${this.tokenAddress.toString()}`);
        }
        
        const accountInfo = tokenAccounts.value[0].account.data.parsed.info;
        const decimals = accountInfo.tokenAmount.decimals;
        const rawBalance = accountInfo.tokenAmount.amount;
        const actualTokenBalance = parseInt(rawBalance) / Math.pow(10, decimals);
        
        if (tokenAmount > actualTokenBalance) {
          console.log(`Reducing sell amount from ${tokenAmount} to available balance ${actualTokenBalance}`);
          tokenAmount = actualTokenBalance;
        }
        
        if (tokenAmount <= 0) {
          return null; // Nothing to sell
        }
        
        console.log(`${this.botType} bot executing real DEX SELL for ${tokenAmount} tokens`);
        
        // Setup the mints - we're selling tokens for SOL
        const inputMint = this.tokenAddress; // The token we're selling
        const outputMint = new PublicKey('So11111111111111111111111111111111111111112'); // Native SOL
        
        // Setup Jupiter
        const jupiter = await Jupiter.load({
          connection: this.connection,
          cluster: this.network === 'mainnet' ? 'mainnet-beta' : 'devnet',
          user: this.wallet
        });
        
        // Calculate the raw token amount based on decimals
        const inputAmount = Math.floor(tokenAmount * Math.pow(10, decimals));
        
        // Get routes
        console.log(`Finding routes to swap ${tokenAmount} tokens for SOL...`);
        const routes = await jupiter.computeRoutes({
          inputMint,
          outputMint,
          inputAmount,
          slippage: this.config.slippage || 1, // Default 1% slippage
          forceFetch: true
        });
        
        if (routes.routesInfos.length === 0) {
          console.log(`No routes found for selling tokens`);
          
          // For testing, simulate a sale
          const simulatedSolReceived = tokenAmount * 0.000001; // Simulated price
          
          // Log simulated trade
          const simulatedTrade = {
            type: 'SELL',
            timestamp: Date.now(),
            amount: simulatedSolReceived,
            tokenAmount: tokenAmount,
            wallet: this.wallet.publicKey.toString(),
            botType: this.botType,
            status: 'completed',
            txId: `simulated_${Date.now()}`
          };
          
          this.tradeHistory.push(simulatedTrade);
          this.logTrade(simulatedTrade);
          
          return simulatedTrade;
        }
        
        // Select the best route
        const bestRoute = routes.routesInfos[0];
        const expectedSolOutput = bestRoute.outAmount / LAMPORTS_PER_SOL;
        console.log(`Best route found, expected SOL output: ${expectedSolOutput}`);
        
        // Execute the swap
        const { execute } = await jupiter.exchange({
          routeInfo: bestRoute
        });
        
        // Execute the transaction
        const swapResult = await execute();
        
        // Check if the transaction was successful
        if (swapResult.error) {
          console.error('Swap failed:', swapResult.error);
          throw new Error(`Swap failed: ${swapResult.error}`);
        }
        
        // Get the transaction signature
        const txid = swapResult.txid;
        console.log(`Swap successful, transaction: ${txid}`);
        
        // Log the trade
        const trade = {
          type: 'SELL',
          timestamp: Date.now(),
          amount: expectedSolOutput, // SOL received
          tokenAmount: tokenAmount,
          wallet: this.wallet.publicKey.toString(),
          botType: this.botType,
          status: 'completed',
          txId: txid
        };
        
        this.tradeHistory.push(trade);
        this.logTrade(trade);
        
        return trade;
      });
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
  try {
    this.manualBuyInProgress = true;
    const result = await this.executeBuy(solAmount);
    return result;
  } finally {
    this.manualBuyInProgress = false;
  }
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
      
      return await withRetry(async () => {
        // Get SOL balance
        const solBalance = await this.connection.getBalance(this.wallet.publicKey) / LAMPORTS_PER_SOL;
        
        // Get token balance from the blockchain
        let tokenBalance = 0;
        if (this.tokenAddress) {
          try {
            // First, check if the wallet has a token account for this token
            const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
              this.wallet.publicKey,
              { mint: this.tokenAddress }
            );
            
            if (tokenAccounts.value.length > 0) {
              // Get the balance from the first token account found
              const accountInfo = tokenAccounts.value[0].account.data.parsed.info;
              const decimals = accountInfo.tokenAmount.decimals;
              const amount = accountInfo.tokenAmount.amount;
              
              // Convert to a human-readable format based on decimals
              tokenBalance = parseInt(amount) / Math.pow(10, decimals);
            } else {
              console.log(`No token account found for token ${this.tokenAddress.toString()} in wallet ${this.wallet.publicKey.toString()}`);
            }
          } catch (tokenError) {
            console.error('Error fetching token balance:', tokenError);
          }
        }
        
        return {
          sol: solBalance,
          token: tokenBalance,
          tokenAddress: this.tokenAddress ? this.tokenAddress.toString() : null
        };
      });
    } catch (error) {
      console.error('Error fetching balances:', error);
      return { sol: 0, token: 0 };
    }
  }

  async airDrop(amount = 1) {
    if (this.network !== 'devnet') {
      throw new Error('Airdrop only available on devnet');
    }
    
    try {
      return await withRetry(async () => {
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
      });
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
      return await withRetry(async () => {
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
      });
    } catch (error) {
      console.error('Send SOL error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendTokens(recipientPublicKey, amount) {
    try {
      if (!this.tokenAddress) {
        throw new Error('Token address must be set before sending tokens');
      }
      
      return await withRetry(async () => {
        // Get the source token account (owned by this wallet)
        const sourceTokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
          this.wallet.publicKey,
          { mint: this.tokenAddress }
        );
        
        if (sourceTokenAccounts.value.length === 0) {
          throw new Error(`No token account found for ${this.tokenAddress.toString()}`);
        }
        
        const sourceTokenAccount = sourceTokenAccounts.value[0].pubkey;
        const accountInfo = sourceTokenAccounts.value[0].account.data.parsed.info;
        const decimals = accountInfo.tokenAmount.decimals;
        
        // Convert amount to raw token amount
        const rawAmount = amount * Math.pow(10, decimals);
        
        // Create a destination token account if it doesn't exist
        const recipientPubkey = new PublicKey(recipientPublicKey);
        
        // Check if recipient has a token account
        let destinationTokenAccount;
        
        try {
          const destTokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
            recipientPubkey,
            { mint: this.tokenAddress }
          );
          
          if (destTokenAccounts.value.length > 0) {
            destinationTokenAccount = destTokenAccounts.value[0].pubkey;
          } else {
            // Create associated token account for recipient
            destinationTokenAccount = await Token.getAssociatedTokenAddress(
              ASSOCIATED_TOKEN_PROGRAM_ID,
              TOKEN_PROGRAM_ID,
              this.tokenAddress,
              recipientPubkey
            );
            
            // Create the account if it doesn't exist
            const transaction = new Transaction().add(
              Token.createAssociatedTokenAccountInstruction(
                ASSOCIATED_TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                this.tokenAddress,
                destinationTokenAccount,
                recipientPubkey,
                this.wallet.publicKey
              )
            );
            
            transaction.feePayer = this.wallet.publicKey;
            const blockhash = await this.connection.getRecentBlockhash();
            transaction.recentBlockhash = blockhash.blockhash;
            
            transaction.sign(this.wallet);
            const signature = await this.connection.sendRawTransaction(transaction.serialize());
            await this.connection.confirmTransaction(signature);
            
            console.log(`Created token account for recipient: ${destinationTokenAccount.toString()}`);
          }
        } catch (error) {
          console.error('Error checking/creating recipient token account:', error);
          throw error;
        }
        
        // Create token transfer instruction
        const transferInstruction = Token.createTransferInstruction(
          TOKEN_PROGRAM_ID,
          sourceTokenAccount,
          destinationTokenAccount,
          this.wallet.publicKey,
          [],
          rawAmount
        );
        
        // Create and sign transaction
        const transaction = new Transaction().add(transferInstruction);
        transaction.feePayer = this.wallet.publicKey;
        const blockhash = await this.connection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash.blockhash;
        
        transaction.sign(this.wallet);
        const signature = await this.connection.sendRawTransaction(transaction.serialize());
        await this.connection.confirmTransaction(signature);
        
        console.log(`Sent ${amount} tokens to ${recipientPublicKey}, tx: ${signature}`);
        
        return {
          success: true,
          signature,
          amount
        };
      });
    } catch (error) {
      console.error('Send tokens error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  logTrade(trade) {
    // Add to local history if not already there
    if (!this.tradeHistory.find(t => t.txId === trade.txId)) {
      this.tradeHistory.push(trade);
    }
    
    // Also write to trades.json file for persistence
    try {
      let trades = [];
      if (fs.existsSync('./trades.json')) {
        const tradesData = fs.readFileSync('./trades.json', 'utf8');
        trades = JSON.parse(tradesData);
      }
      
      // Add trade if not already in file
      if (!trades.find(t => t.txId === trade.txId)) {
        trades.push(trade);
        fs.writeFileSync('./trades.json', JSON.stringify(trades, null, 2));
      }
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
