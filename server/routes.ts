import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { bitgetService } from "./services/bitget-service";
import { tradingService } from "./services/trading-service";
import { z } from "zod";
import { insertTradingSettingsSchema } from "@shared/schema";

// Middleware to ensure user is authenticated
function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: "Unauthorized" });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // Account balance endpoint
  app.get("/api/balance", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Try to get from bitget first
      try {
        const balance = await bitgetService.getAccountBalance();
        
        // Save the balance to the database
        await storage.saveBalance({
          userId,
          totalBalance: balance.totalBalance,
          availableBalance: balance.availableBalance,
          balanceData: {
            frozenBalance: balance.frozenBalance,
            unrealizedPnl: balance.unrealizedPnl,
            timestamp: Date.now()
          }
        });
        
        res.status(200).json(balance);
      } catch (error) {
        // If bitget fails, get from database
        const latestBalance = await storage.getLatestBalance(userId);
        if (!latestBalance) {
          return res.status(404).json({ error: "No balance information found" });
        }
        
        res.status(200).json({
          totalBalance: latestBalance.totalBalance.toString(),
          availableBalance: latestBalance.availableBalance.toString(),
          frozenBalance: latestBalance.balanceData?.frozenBalance || "0",
          unrealizedPnl: latestBalance.balanceData?.unrealizedPnl || "0",
          timestamp: latestBalance.timestamp.getTime()
        });
      }
    } catch (error) {
      console.error("Error getting balance:", error);
      res.status(500).json({ error: "Failed to get balance information" });
    }
  });

  // Balance history endpoint
  app.get("/api/balance/history", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 30;
      
      const history = await storage.getBalanceHistory(userId, limit);
      res.status(200).json(history);
    } catch (error) {
      console.error("Error getting balance history:", error);
      res.status(500).json({ error: "Failed to get balance history" });
    }
  });

  // Trading settings endpoints
  app.post("/api/trading/settings", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Validate request body
      const validationResult = insertTradingSettingsSchema.safeParse({
        ...req.body,
        userId
      });
      
      if (!validationResult.success) {
        return res.status(400).json({ error: "Invalid settings", details: validationResult.error });
      }
      
      // Check if settings already exist
      const existingSettings = await storage.getTradingSettings(userId);
      
      if (existingSettings) {
        // Update existing settings
        const updatedSettings = await storage.updateTradingSettings(
          existingSettings.id,
          validationResult.data
        );
        
        return res.status(200).json(updatedSettings);
      }
      
      // Create new settings
      const newSettings = await storage.createTradingSettings(validationResult.data);
      res.status(201).json(newSettings);
    } catch (error) {
      console.error("Error creating trading settings:", error);
      res.status(500).json({ error: "Failed to create trading settings" });
    }
  });

  app.get("/api/trading/settings", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const settings = await storage.getTradingSettings(userId);
      
      if (!settings) {
        // Return default settings if none exist
        return res.status(200).json({
          userId,
          symbol: "BTCUSDT",
          timeframe: "1h",
          strategy: "MACD",
          riskPerTrade: "1",
          leverageLevel: 1,
          enabledTrading: false
        });
      }
      
      res.status(200).json(settings);
    } catch (error) {
      console.error("Error getting trading settings:", error);
      res.status(500).json({ error: "Failed to get trading settings" });
    }
  });

  // Trading control endpoints
  app.get("/api/trading/status", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Get trading settings
      const settings = await storage.getTradingSettings(userId);
      const isActive = tradingService.isActive(); // Global trading service status
      const openTrades = await storage.getOpenTrades(userId);
      
      res.status(200).json({
        isActive: isActive,
        enabledInSettings: settings?.enabledTrading || false,
        maxConcurrentTrades: 3, // Hardcoded to 3 as per requirement
        currentOpenTrades: openTrades.length,
        confidenceThreshold: tradingService.getConfidenceThreshold(),
        bitgetConnected: bitgetService.isReady(),
        settings: settings || null
      });
    } catch (error) {
      console.error("Error getting trading status:", error);
      res.status(500).json({ error: "Failed to get trading status" });
    }
  });

  app.post("/api/trading/start", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Make sure trading settings exist
      let settings = await storage.getTradingSettings(userId);
      
      // Create default settings if none exist
      if (!settings) {
        const defaultSettings = {
          userId,
          symbol: "BTCUSDT",
          timeframe: "15m",
          strategy: "ENSEMBLE",
          riskPerTrade: "1",
          leverageLevel: 1,
          enabledTrading: true
        };
        
        settings = await storage.createTradingSettings(defaultSettings);
        console.log("Created default trading settings for user:", userId);
      } else {
        // Enable trading in existing settings
        await storage.updateTradingSettings(settings.id, { enabledTrading: true });
      }
      
      // Start trading
      const success = await tradingService.startTradingForUser(userId);
      
      if (!success) {
        return res.status(500).json({ error: "Failed to start trading" });
      }
      
      res.status(200).json({ message: "Trading started successfully" });
    } catch (error) {
      console.error("Error starting trading:", error);
      res.status(500).json({ error: "Failed to start trading" });
    }
  });

  app.post("/api/trading/stop", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Get trading settings if they exist
      const settings = await storage.getTradingSettings(userId);
      
      // If settings exist, disable trading
      if (settings) {
        await storage.updateTradingSettings(settings.id, { enabledTrading: false });
      }
      
      // Stop trading regardless of settings presence
      const success = tradingService.stopTradingForUser(userId);
      
      res.status(200).json({ message: "Trading stopped successfully" });
    } catch (error) {
      console.error("Error stopping trading:", error);
      res.status(500).json({ error: "Failed to stop trading" });
    }
  });

  // Trades endpoints
  app.get("/api/trades", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const trades = await storage.getTrades(userId);
      
      res.status(200).json(trades);
    } catch (error) {
      console.error("Error getting trades:", error);
      res.status(500).json({ error: "Failed to get trades" });
    }
  });

  app.get("/api/trades/open", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const openTrades = await storage.getOpenTrades(userId);
      
      res.status(200).json(openTrades);
    } catch (error) {
      console.error("Error getting open trades:", error);
      res.status(500).json({ error: "Failed to get open trades" });
    }
  });

  // Market data endpoint
  app.get("/api/market/:symbol", ensureAuthenticated, async (req, res) => {
    try {
      const symbol = req.params.symbol || "BTCUSDT";
      
      const marketData = await bitgetService.getMarketData(symbol);
      res.status(200).json(marketData);
    } catch (error) {
      console.error("Error getting market data:", error);
      res.status(500).json({ error: "Failed to get market data" });
    }
  });

  // Historical data processing endpoint
  app.get("/api/market/:symbol/analysis", ensureAuthenticated, async (req, res) => {
    try {
      const symbol = req.params.symbol || "BTCUSDT";
      const timeframe = req.query.timeframe as string || "1h";
      
      const analysis = await tradingService.processHistoricalData(symbol, timeframe);
      res.status(200).json(analysis);
    } catch (error) {
      console.error("Error processing historical data:", error);
      res.status(500).json({ error: "Failed to process historical data" });
    }
  });
  
  // Get all active trading pairs with their data
  app.get("/api/market/pairs/active", ensureAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const activePairs = tradingService.getActiveTradingPairs(userId);
      
      // Get market data for each pair
      const pairsWithData = await Promise.all(
        activePairs.map(async (pair) => {
          try {
            const marketData = await bitgetService.getMarketData(pair);
            return {
              symbol: pair,
              price: marketData.price,
              change24h: marketData.change24h,
              volume: marketData.volume24h,
              weight: tradingService.getPairWeight(pair)
            };
          } catch (err) {
            return {
              symbol: pair,
              price: "0",
              change24h: "0",
              volume: "0",
              weight: tradingService.getPairWeight(pair)
            };
          }
        })
      );
      
      res.status(200).json(pairsWithData);
    } catch (error) {
      console.error("Error getting active pairs:", error);
      res.status(500).json({ error: "Failed to get active trading pairs" });
    }
  });

  // Set confidence threshold
  app.post("/api/trading/confidence", ensureAuthenticated, async (req, res) => {
    try {
      const { threshold } = req.body;
      
      if (typeof threshold !== 'number' || threshold < 0 || threshold > 100) {
        return res.status(400).json({ error: "Invalid threshold value. Must be between 0 and 100." });
      }
      
      tradingService.setConfidenceThreshold(threshold);
      
      res.status(200).json({ 
        message: "Confidence threshold updated successfully", 
        threshold: tradingService.getConfidenceThreshold() 
      });
    } catch (error) {
      console.error("Error setting confidence threshold:", error);
      res.status(500).json({ error: "Failed to set confidence threshold" });
    }
  });



  const httpServer = createServer(app);

  return httpServer;
}
