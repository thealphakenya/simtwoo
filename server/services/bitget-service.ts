import axios from 'axios';
import crypto from 'crypto';
import * as bitget from 'bitget-api';
import Decimal from 'decimal.js';

// Create an interface for APIClient to address type issues
interface APIClient {
  spot: {
    account: {
      assets: () => Promise<any>;
    };
    market: {
      ticker: (params: any) => Promise<any>;
      candles: (params: any) => Promise<any>;
    };
    order: {
      placeOrder: (params: any) => Promise<any>;
      orderInfo: (params: any) => Promise<any>;
      cancelOrder: (params: any) => Promise<any>;
    };
  };
}

// Initialize Bitget API Client
const apiKey = process.env.BITGET_API_KEY || '';
const apiSecret = process.env.BITGET_API_SECRET || '';
const apiPass = process.env.BITGET_API_PASSPHRASE || '';

// Check if all required API credentials are available
const hasCredentials = apiKey && apiSecret && apiPass;

console.log('API Credentials Check:', {
  hasKey: !!apiKey,
  hasSecret: !!apiSecret,
  hasPass: !!apiPass
});

let client: APIClient | null = null;

if (hasCredentials) {
  try {
    // Create real client using the bitget package
    const bitgetClient = new bitget.SpotClient({
      apiKey: apiKey,
      apiSecret: apiSecret,
      apiPassphrase: apiPass,
      endpoint: 'https://api.bitget.com'
    });

    client = {
      spot: {
        account: {
          assets: () => bitgetClient.spot.account.assets()
        },
        market: {
          ticker: (params: any) => bitgetClient.spot.market.ticker(params),
          candles: (params: any) => bitgetClient.spot.market.candles(params)
        },
        order: {
          placeOrder: (params: any) => bitgetClient.spot.order.placeOrder(params),
          orderInfo: (params: any) => bitgetClient.spot.order.orderInfo(params),
          cancelOrder: (params: any) => bitgetClient.spot.order.cancelOrder(params)
        }
      }
    };
    
    console.log('Bitget API client initialized successfully');
  } catch (error: any) {
    console.error('Error initializing Bitget API client:', error);
  }
}

export interface Balance {
  symbol: string;
  available: string;
  frozen: string;
  total: string;
}

export interface AccountSummary {
  totalBalance: string;
  availableBalance: string;
  frozenBalance: string;
  unrealizedPnl: string;
  marginBalance: string;
  balances: Record<string, Balance>;
}

export interface MarketData {
  symbol: string;
  price: string;
  timestamp: number;
  volume24h: string;
  change24h: string;
}

export interface TradeParams {
  symbol: string;
  side: 'buy' | 'sell';
  size: string;
  price?: string; // Optional for market orders
  orderType: 'limit' | 'market';
  leverage?: number; // For margin/futures trading
}

export interface TradeResponse {
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  side: string;
  size: string;
  price: string;
  status: string;
  timestamp: number;
}

export class BitgetService {
  constructor() {
    if (!hasCredentials) {
      console.warn('Bitget API credentials not provided. Trading functionality will be limited.');
    }
  }

  /**
   * Get the account balance summary
   */
  async getAccountBalance(): Promise<AccountSummary> {
    if (!client) {
      throw new Error('Bitget API client not initialized');
    }

    try {
      // Get account assets information
      const response = await client.spot.account.assets();
      
      if (!response || !response.data) {
        throw new Error('Invalid response from Bitget API');
      }

      const balances: Record<string, Balance> = {};
      let totalBalance = new Decimal(0);
      let availableBalance = new Decimal(0);
      let frozenBalance = new Decimal(0);

      if (Array.isArray(response.data)) {
        for (const asset of response.data) {
          if (asset.available && parseFloat(asset.available) > 0) {
            const available = new Decimal(asset.available);
            const frozen = new Decimal(asset.frozen || '0');
            const total = available.plus(frozen);

            balances[asset.coinName] = {
              symbol: asset.coinName,
              available: available.toString(),
              frozen: frozen.toString(),
              total: total.toString()
            };

            // Only sum up USDT value to get total balance
            if (asset.coinName === 'USDT') {
              totalBalance = totalBalance.plus(total);
              availableBalance = availableBalance.plus(available);
              frozenBalance = frozenBalance.plus(frozen);
            }
          }
        }
      }

      return {
        totalBalance: totalBalance.toString(),
        availableBalance: availableBalance.toString(),
        frozenBalance: frozenBalance.toString(),
        unrealizedPnl: '0',
        marginBalance: '0',
        balances
      };
    } catch (error) {
      console.error('Error getting account balance:', error);
      throw new Error(`Failed to get account balance: ${error.message}`);
    }
  }

  /**
   * Get market data for a specific symbol
   */
  async getMarketData(symbol: string): Promise<MarketData> {
    if (!client) {
      throw new Error('Bitget API client not initialized');
    }

    try {
      // Get ticker information
      const response = await client.spot.market.ticker({ symbol });
      
      if (!response || !response.data) {
        throw new Error('Invalid response from Bitget API');
      }

      const ticker = response.data;
      
      return {
        symbol: ticker.symbol,
        price: ticker.close,
        timestamp: parseInt(ticker.ts),
        volume24h: ticker.baseVolume,
        change24h: ticker.chgUTC24h
      };
    } catch (error) {
      console.error(`Error getting market data for ${symbol}:`, error);
      throw new Error(`Failed to get market data: ${error.message}`);
    }
  }

  /**
   * Execute a trade (buy or sell)
   */
  async executeTrade(params: TradeParams): Promise<TradeResponse> {
    if (!client) {
      throw new Error('Bitget API client not initialized');
    }

    try {
      const orderParams = {
        symbol: params.symbol,
        side: params.side,
        orderType: params.orderType,
        force: 'normal',
        size: params.size
      };
      
      // Add price for limit orders
      if (params.orderType === 'limit' && params.price) {
        orderParams['price'] = params.price;
      }

      // Execute the order
      const response = await client.spot.order.placeOrder(orderParams);
      
      if (!response || !response.data) {
        throw new Error('Invalid response from Bitget API');
      }

      return {
        orderId: response.data.orderId,
        clientOrderId: response.data.clientOid,
        symbol: params.symbol,
        side: params.side,
        size: params.size,
        price: params.price || '0',
        status: 'NEW',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error executing trade:', error);
      throw new Error(`Failed to execute trade: ${error.message}`);
    }
  }
  
  /**
   * Get order information
   */
  async getOrderDetails(symbol: string, orderId: string): Promise<any> {
    if (!client) {
      throw new Error('Bitget API client not initialized');
    }

    try {
      const response = await client.spot.order.orderInfo({
        symbol,
        orderId
      });
      
      if (!response || !response.data) {
        throw new Error('Invalid response from Bitget API');
      }

      return response.data;
    } catch (error) {
      console.error('Error getting order details:', error);
      throw new Error(`Failed to get order details: ${error.message}`);
    }
  }
  
  /**
   * Cancel an order
   */
  async cancelOrder(symbol: string, orderId: string): Promise<boolean> {
    if (!client) {
      throw new Error('Bitget API client not initialized');
    }

    try {
      const response = await client.spot.order.cancelOrder({
        symbol,
        orderId
      });
      
      return response && response.code === '00000';
    } catch (error) {
      console.error('Error canceling order:', error);
      throw new Error(`Failed to cancel order: ${error.message}`);
    }
  }
  
  /**
   * Get historical candlestick data
   */
  async getKlines(symbol: string, interval: string, limit: number = 100): Promise<any[]> {
    if (!client) {
      throw new Error('Bitget API client not initialized');
    }

    try {
      const response = await client.spot.market.candles({
        symbol,
        period: interval,
        limit: limit.toString()
      });
      
      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid response from Bitget API');
      }

      return response.data;
    } catch (error) {
      console.error('Error getting kline data:', error);
      throw new Error(`Failed to get kline data: ${error.message}`);
    }
  }
  
  /**
   * Check if API client is ready
   */
  isReady(): boolean {
    return client !== null;
  }
}

// Export a singleton instance
export const bitgetService = new BitgetService();