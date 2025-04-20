import { bitgetService } from './bitget-service';
import { storage } from '../storage';
import { InsertTrade, InsertBalanceHistory } from '@shared/schema';
import Decimal from 'decimal.js';
import * as ti from 'technicalindicators';

// Define supported strategies
export type Strategy = 'MACD' | 'RSI' | 'BOLLINGER' | 'EMA';

export interface StrategyConfig {
  name: Strategy;
  params: Record<string, any>;
}

export interface HistoricalCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TradeSignal {
  symbol: string;
  side: 'buy' | 'sell';
  price: string;
  time: number;
  strategy: Strategy;
  confidence: number;
  indicators: Record<string, any>;
}

export class TradingService {
  private isRunning: boolean = false;
  private runningIntervals: Record<string, NodeJS.Timeout> = {};
  private balanceUpdateInterval: NodeJS.Timeout | null = null;
  
  private async startBalanceUpdates() {
    if (this.balanceUpdateInterval) return;
    
    this.balanceUpdateInterval = setInterval(async () => {
      try {
        const balance = await bitgetService.getAccountBalance();
        // Broadcast balance update to connected clients
        console.log('Balance updated:', balance.totalBalance);
      } catch (error) {
        console.error('Balance update error:', error);
      }
    }, 30000); // Update every 30 seconds
  }
  
  // Confidence thresholds for trading decisions (0-100%)
  private confidenceThreshold: number = 70;
  
  // Maximum number of concurrent open trades
  private maxConcurrentTrades: number = 3;
  
  // Supported trading pairs with their weights for automatic selection
  private tradingPairs: {symbol: string, weight: number}[] = [
    { symbol: 'BTCUSDT', weight: 0.3 },
    { symbol: 'ETHUSDT', weight: 0.25 },
    { symbol: 'BNBUSDT', weight: 0.2 },
    { symbol: 'XRPUSDT', weight: 0.15 },
    { symbol: 'DOGEUSDT', weight: 0.1 }
  ];
  
  // Track volatility and performance for each pair
  private pairPerformance: Record<string, {
    volatility: number,
    successRate: number,
    lastUpdated: number
  }> = {};
  
  constructor() {
    // Initialize the trading service
    console.log('Trading service initialized');
    
    // Initialize performance metrics for each pair
    this.tradingPairs.forEach(pair => {
      this.pairPerformance[pair.symbol] = {
        volatility: 0,
        successRate: 0,
        lastUpdated: Date.now()
      };
    });
  }
  
  /**
   * Get the top performing trading pairs based on weight and performance
   */
  private getTopTradingPairs(count: number = 3): string[] {
    // Calculate a score for each pair based on weight, volatility, and success rate
    const pairScores = this.tradingPairs.map(pair => {
      const performance = this.pairPerformance[pair.symbol];
      // Score = base weight + (volatility * 0.3) + (success rate * 0.5)
      const score = pair.weight + 
                   (performance.volatility * 0.3) + 
                   (performance.successRate * 0.5);
      
      return {
        symbol: pair.symbol,
        score
      };
    });
    
    // Sort by score in descending order and take the top count
    return pairScores
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map(p => p.symbol);
  }
  
  /**
   * Check if we've reached the maximum number of concurrent trades
   */
  private async hasReachedMaxTrades(userId: number): Promise<boolean> {
    const openTrades = await storage.getOpenTrades(userId);
    return openTrades.length >= this.maxConcurrentTrades;
  }
  
  /**
   * Update performance metrics for a trading pair
   */
  private updatePairPerformance(symbol: string, tradeSuccess: boolean, volatility: number): void {
    const performance = this.pairPerformance[symbol];
    if (!performance) return;
    
    // Update success rate using a weighted average (recent trades have more impact)
    const oldWeight = 0.7;
    const newWeight = 0.3;
    performance.successRate = (performance.successRate * oldWeight) + 
                             (tradeSuccess ? 1 : 0) * newWeight;
    
    // Update volatility
    performance.volatility = (performance.volatility * 0.8) + (volatility * 0.2);
    performance.lastUpdated = Date.now();
  }
  
  /**
   * Start trading for a specific user
   */
  async startTradingForUser(userId: number): Promise<boolean> {
    try {
      // Get user's trading settings
      const settings = await storage.getTradingSettings(userId);
      if (!settings) {
        throw new Error('No trading settings found for user');
      }
      
      if (!settings.enabledTrading) {
        return false;
      }
      
      const interval = this.convertTimeframeToMs(settings.timeframe);
      
      // Create an interval to run the trading strategy
      const intervalId = setInterval(async () => {
        try {
          // Check if we've reached the maximum number of concurrent trades
          const maxTradesReached = await this.hasReachedMaxTrades(userId);
          if (maxTradesReached) {
            console.log(`Maximum concurrent trades (${this.maxConcurrentTrades}) reached for user ${userId}. Skipping trading cycle.`);
            return;
          }
          
          // Auto-select trading pairs if strategy is ENSEMBLE or AUTO
          let symbols = [settings.symbol];
          if (settings.strategy === 'ENSEMBLE' || settings.strategy === 'AUTO') {
            symbols = this.getTopTradingPairs();
            console.log(`Auto-selected trading pairs for user ${userId}: ${symbols.join(', ')}`);
          }
          
          // Run trading cycle for each symbol
          for (const symbol of symbols) {
            await this.runTradingCycle(userId, symbol, settings.strategy, settings.riskPerTrade.toString());
          }
        } catch (error) {
          console.error(`Error in trading cycle for user ${userId}:`, error);
        }
      }, interval);
      
      // Store the interval ID for later cleanup
      this.runningIntervals[`user-${userId}`] = intervalId;
      
      this.isRunning = true;
      return true;
    } catch (error) {
      console.error(`Error starting trading for user ${userId}:`, error);
      return false;
    }
  }
  
  /**
   * Stop trading for a specific user
   */
  stopTradingForUser(userId: number): boolean {
    const intervalKey = `user-${userId}`;
    const intervalId = this.runningIntervals[intervalKey];
    
    if (intervalId) {
      clearInterval(intervalId);
      delete this.runningIntervals[intervalKey];
      return true;
    }
    
    return false;
  }
  
  /**
   * Run a single trading cycle (analyze market, generate signals, execute trades)
   */
  private async runTradingCycle(userId: number, symbol: string, strategyName: string, riskPerTrade: string): Promise<void> {
    try {
      console.log(`Running trading cycle for user ${userId}, symbol ${symbol}, strategy ${strategyName}`);
      
      // 1. Get latest market data
      const candles = await this.getHistoricalData(symbol, '15m', 100);
      
      // 2. Calculate volatility for pair performance tracking
      const volatility = this.calculateVolatility(candles);
      
      // 3. Analyze market using the selected strategy
      const signal = await this.analyzeMarket(candles, strategyName as Strategy);
      
      // 4. Check if we should execute a trade based on confidence
      if (signal && signal.confidence >= this.confidenceThreshold) {
        // 5. Check account balance
        const balance = await bitgetService.getAccountBalance();
        
        // 6. Check if we've reached the maximum number of concurrent trades
        const maxTradesReached = await this.hasReachedMaxTrades(userId);
        if (maxTradesReached) {
          console.log(`Maximum concurrent trades (${this.maxConcurrentTrades}) reached for user ${userId}. Skipping trade execution.`);
          return;
        }
        
        // 7. Calculate position size based on risk per trade
        const positionSize = this.calculatePositionSize(
          balance.availableBalance,
          riskPerTrade,
          signal.price,
          signal.side
        );
        
        // 8. Execute the trade
        if (new Decimal(positionSize).greaterThan(0)) {
          try {
            const tradeResult = await this.executeTrade(userId, signal, positionSize);
            console.log(`Trade executed: ${tradeResult.orderId}`);
            
            // 9. Record the balance after the trade
            await this.recordBalance(userId, balance);
            
            // 10. Update pair performance metrics with successful trade
            this.updatePairPerformance(symbol, true, volatility);
          } catch (tradeError) {
            console.error(`Error executing trade for ${symbol}:`, tradeError);
            // Update pair performance metrics with failed trade
            this.updatePairPerformance(symbol, false, volatility);
          }
        }
      } else {
        // Just update the volatility even if no trade was executed
        this.updatePairPerformance(symbol, true, volatility);
      }
    } catch (error) {
      console.error('Error in trading cycle:', error);
    }
  }
  
  /**
   * Calculate the appropriate position size based on risk parameters
   */
  private calculatePositionSize(availableBalance: string, riskPercentage: string, price: string, side: 'buy' | 'sell'): string {
    // Calculate the amount to risk based on the risk percentage
    const balanceDecimal = new Decimal(availableBalance);
    const riskPercentageDecimal = new Decimal(riskPercentage).dividedBy(100);
    const riskAmount = balanceDecimal.times(riskPercentageDecimal);
    
    // Calculate the position size in base currency
    const priceDecimal = new Decimal(price);
    const positionSize = riskAmount.dividedBy(priceDecimal);
    
    // Ensure the position size is not too small
    if (positionSize.lessThan(0.00001)) {
      return '0';
    }
    
    // Return the position size rounded to 5 decimal places
    return positionSize.toDecimalPlaces(5).toString();
  }
  
  /**
   * Execute a trade based on the generated signal
   */
  private async executeTrade(userId: number, signal: TradeSignal, size: string): Promise<any> {
    // Execute the trade
    const tradeResponse = await bitgetService.executeTrade({
      symbol: signal.symbol,
      side: signal.side,
      size: size,
      orderType: 'market'
    });
    
    // Record the trade in the database
    const trade: InsertTrade = {
      userId,
      symbol: signal.symbol,
      side: signal.side,
      entryPrice: new Decimal(signal.price),
      quantity: new Decimal(size),
      status: 'OPEN',
      strategy: signal.strategy,
      orderId: tradeResponse.orderId,
      tradeData: {
        confidence: signal.confidence,
        indicators: signal.indicators,
        timestamp: signal.time
      }
    };
    
    await storage.createTrade(trade);
    
    return tradeResponse;
  }
  
  /**
   * Record current account balance
   */
  private async recordBalance(userId: number, balance: any): Promise<void> {
    const balanceRecord: InsertBalanceHistory = {
      userId,
      totalBalance: new Decimal(balance.totalBalance),
      availableBalance: new Decimal(balance.availableBalance),
      balanceData: {
        frozenBalance: balance.frozenBalance,
        unrealizedPnl: balance.unrealizedPnl,
        marginBalance: balance.marginBalance,
        timestamp: Date.now()
      }
    };
    
    await storage.saveBalance(balanceRecord);
  }
  
  /**
   * Get historical candle data for analysis
   */
  private async getHistoricalData(symbol: string, interval: string, limit: number): Promise<HistoricalCandle[]> {
    const klines = await bitgetService.getKlines(symbol, interval, limit);
    
    // Convert Bitget candle format to our format
    return klines.map(candle => ({
      time: parseInt(candle[0]),
      open: parseFloat(candle[1]),
      high: parseFloat(candle[2]),
      low: parseFloat(candle[3]),
      close: parseFloat(candle[4]),
      volume: parseFloat(candle[5])
    }));
  }
  
  /**
   * Analyze market data using the selected strategy
   */
  private async analyzeMarket(candles: HistoricalCandle[], strategy: Strategy): Promise<TradeSignal | null> {
    if (candles.length < 50) {
      throw new Error('Not enough data for analysis');
    }
    
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);
    
    const latestCandle = candles[candles.length - 1];
    const symbol = 'BTCUSDT'; // This should be dynamic based on the candles
    
    let signal: TradeSignal | null = null;
    
    switch (strategy) {
      case 'MACD': {
        const macdInput = {
          values: closes,
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9
        };
        
        const macdResults = ti.MACD.calculate(macdInput);
        if (macdResults.length < 2) {
          return null;
        }
        
        const current = macdResults[macdResults.length - 1];
        const previous = macdResults[macdResults.length - 2];
        
        // MACD crossing above signal line = buy
        if (previous.MACD < previous.signal && current.MACD > current.signal) {
          signal = {
            symbol,
            side: 'buy',
            price: latestCandle.close.toString(),
            time: latestCandle.time,
            strategy: 'MACD',
            confidence: this.calculateConfidence('MACD', 'buy', current, previous),
            indicators: {
              macd: current.MACD,
              signal: current.signal,
              histogram: current.histogram
            }
          };
        }
        // MACD crossing below signal line = sell
        else if (previous.MACD > previous.signal && current.MACD < current.signal) {
          signal = {
            symbol,
            side: 'sell',
            price: latestCandle.close.toString(),
            time: latestCandle.time,
            strategy: 'MACD',
            confidence: this.calculateConfidence('MACD', 'sell', current, previous),
            indicators: {
              macd: current.MACD,
              signal: current.signal,
              histogram: current.histogram
            }
          };
        }
        break;
      }
      
      case 'RSI': {
        const rsiInput = {
          values: closes,
          period: 14
        };
        
        const rsiResults = ti.RSI.calculate(rsiInput);
        if (rsiResults.length < 1) {
          return null;
        }
        
        const currentRSI = rsiResults[rsiResults.length - 1];
        
        // RSI below 30 = oversold = buy
        if (currentRSI < 30) {
          signal = {
            symbol,
            side: 'buy',
            price: latestCandle.close.toString(),
            time: latestCandle.time,
            strategy: 'RSI',
            confidence: 80 - currentRSI, // Lower RSI = higher buy confidence
            indicators: {
              rsi: currentRSI
            }
          };
        }
        // RSI above 70 = overbought = sell
        else if (currentRSI > 70) {
          signal = {
            symbol,
            side: 'sell',
            price: latestCandle.close.toString(),
            time: latestCandle.time,
            strategy: 'RSI',
            confidence: currentRSI - 20, // Higher RSI = higher sell confidence
            indicators: {
              rsi: currentRSI
            }
          };
        }
        break;
      }
      
      case 'BOLLINGER': {
        const bbandsInput = {
          values: closes,
          period: 20,
          stdDev: 2
        };
        
        const bbandsResults = ti.BollingerBands.calculate(bbandsInput);
        if (bbandsResults.length < 1) {
          return null;
        }
        
        const current = bbandsResults[bbandsResults.length - 1];
        const price = latestCandle.close;
        
        // Price below lower band = buy
        if (price < current.lower) {
          const percentFromLower = (current.lower - price) / (current.upper - current.lower) * 100;
          signal = {
            symbol,
            side: 'buy',
            price: price.toString(),
            time: latestCandle.time,
            strategy: 'BOLLINGER',
            confidence: Math.min(70 + percentFromLower, 95),
            indicators: {
              upper: current.upper,
              middle: current.middle,
              lower: current.lower
            }
          };
        }
        // Price above upper band = sell
        else if (price > current.upper) {
          const percentFromUpper = (price - current.upper) / (current.upper - current.lower) * 100;
          signal = {
            symbol,
            side: 'sell',
            price: price.toString(),
            time: latestCandle.time,
            strategy: 'BOLLINGER',
            confidence: Math.min(70 + percentFromUpper, 95),
            indicators: {
              upper: current.upper,
              middle: current.middle,
              lower: current.lower
            }
          };
        }
        break;
      }
      
      case 'EMA': {
        const shortEMAInput = {
          values: closes,
          period: 9
        };
        
        const longEMAInput = {
          values: closes,
          period: 21
        };
        
        const shortEMA = ti.EMA.calculate(shortEMAInput);
        const longEMA = ti.EMA.calculate(longEMAInput);
        
        if (shortEMA.length < 2 || longEMA.length < 2) {
          return null;
        }
        
        const currentShortEMA = shortEMA[shortEMA.length - 1];
        const previousShortEMA = shortEMA[shortEMA.length - 2];
        const currentLongEMA = longEMA[longEMA.length - 1];
        const previousLongEMA = longEMA[longEMA.length - 2];
        
        // Short EMA crosses above long EMA = buy
        if (previousShortEMA < previousLongEMA && currentShortEMA > currentLongEMA) {
          const emaDiff = Math.abs(currentShortEMA - currentLongEMA) / currentLongEMA * 100;
          signal = {
            symbol,
            side: 'buy',
            price: latestCandle.close.toString(),
            time: latestCandle.time,
            strategy: 'EMA',
            confidence: Math.min(70 + emaDiff * 10, 95),
            indicators: {
              shortEMA: currentShortEMA,
              longEMA: currentLongEMA
            }
          };
        }
        // Short EMA crosses below long EMA = sell
        else if (previousShortEMA > previousLongEMA && currentShortEMA < currentLongEMA) {
          const emaDiff = Math.abs(currentShortEMA - currentLongEMA) / currentLongEMA * 100;
          signal = {
            symbol,
            side: 'sell',
            price: latestCandle.close.toString(),
            time: latestCandle.time,
            strategy: 'EMA',
            confidence: Math.min(70 + emaDiff * 10, 95),
            indicators: {
              shortEMA: currentShortEMA,
              longEMA: currentLongEMA
            }
          };
        }
        break;
      }
      
      default:
        throw new Error(`Unsupported strategy: ${strategy}`);
    }
    
    return signal;
  }
  
  /**
   * Calculate confidence level for MACD strategy
   */
  private calculateConfidence(strategy: Strategy, side: 'buy' | 'sell', current: any, previous: any): number {
    switch (strategy) {
      case 'MACD': {
        // Base confidence
        let confidence = 70;
        
        // Calculate strength of crossover
        const crossoverStrength = Math.abs(current.MACD - current.signal);
        
        // Stronger crossover = higher confidence
        confidence += crossoverStrength * 10;
        
        // Check histogram trend
        if (side === 'buy' && current.histogram > 0) {
          confidence += 5;
        } else if (side === 'sell' && current.histogram < 0) {
          confidence += 5;
        }
        
        // Cap at 95%
        return Math.min(confidence, 95);
      }
      
      default:
        return 70; // Default confidence level
    }
  }
  
  /**
   * Convert timeframe string to milliseconds
   */
  private convertTimeframeToMs(timeframe: string): number {
    const amount = parseInt(timeframe.slice(0, -1));
    const unit = timeframe.slice(-1);
    
    switch (unit) {
      case 'm':
        return amount * 60 * 1000;
      case 'h':
        return amount * 60 * 60 * 1000;
      case 'd':
        return amount * 24 * 60 * 60 * 1000;
      default:
        return 60 * 60 * 1000; // Default to 1 hour
    }
  }
  
  /**
   * Process large amounts of historical data to identify patterns
   */
  async processHistoricalData(symbol: string, timeframe: string): Promise<any> {
    // Get a large amount of historical data
    const candles = await this.getHistoricalData(symbol, timeframe, 1000);
    
    // Process data in chunks for efficiency
    const chunkSize = 100;
    const results = [];
    
    for (let i = 0; i < candles.length - chunkSize; i += chunkSize) {
      const chunk = candles.slice(i, i + chunkSize);
      const analysis = {
        timeStart: chunk[0].time,
        timeEnd: chunk[chunk.length - 1].time,
        priceChange: (chunk[chunk.length - 1].close - chunk[0].close) / chunk[0].close * 100,
        volatility: this.calculateVolatility(chunk),
        volume: chunk.reduce((sum, candle) => sum + candle.volume, 0),
        indicators: this.calculateAllIndicators(chunk)
      };
      
      results.push(analysis);
    }
    
    return results;
  }
  
  /**
   * Calculate volatility for a set of candles
   */
  private calculateVolatility(candles: HistoricalCandle[]): number {
    const closes = candles.map(c => c.close);
    const returns = [];
    
    for (let i = 1; i < closes.length; i++) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
    
    // Calculate standard deviation of returns
    const mean = returns.reduce((sum, val) => sum + val, 0) / returns.length;
    const squaredDiffs = returns.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / squaredDiffs.length;
    
    return Math.sqrt(variance) * 100; // Expressed as percentage
  }
  
  /**
   * Calculate all technical indicators for a set of candles
   */
  private calculateAllIndicators(candles: HistoricalCandle[]): any {
    const closes = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    
    // Calculate various indicators
    const rsi = ti.RSI.calculate({ values: closes, period: 14 });
    const macd = ti.MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9
    });
    const bbands = ti.BollingerBands.calculate({
      values: closes,
      period: 20,
      stdDev: 2
    });
    const ema9 = ti.EMA.calculate({ values: closes, period: 9 });
    const ema21 = ti.EMA.calculate({ values: closes, period: 21 });
    
    return {
      rsi: rsi.length > 0 ? rsi[rsi.length - 1] : null,
      macd: macd.length > 0 ? macd[macd.length - 1] : null,
      bbands: bbands.length > 0 ? bbands[bbands.length - 1] : null,
      ema9: ema9.length > 0 ? ema9[ema9.length - 1] : null,
      ema21: ema21.length > 0 ? ema21[ema21.length - 1] : null
    };
  }
  
  /**
   * Set the confidence threshold for trading
   */
  setConfidenceThreshold(threshold: number): void {
    if (threshold >= 0 && threshold <= 100) {
      this.confidenceThreshold = threshold;
    }
  }
  
  /**
   * Get the current confidence threshold
   */
  getConfidenceThreshold(): number {
    return this.confidenceThreshold;
  }
  
  /**
   * Check if trading is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// Export a singleton instance
export const tradingService = new TradingService();