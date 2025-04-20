import { 
  users, type User, type InsertUser,
  tradingSettings, type TradingSettings, type InsertTradingSettings,
  trades, type Trade, type InsertTrade,
  balanceHistory, type BalanceHistory, type InsertBalanceHistory
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import Decimal from "decimal.js";

const MemoryStore = createMemoryStore(session);

// modify the interface with any CRUD methods
// you might need
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Trading settings methods
  getTradingSettings(userId: number): Promise<TradingSettings | undefined>;
  createTradingSettings(settings: InsertTradingSettings): Promise<TradingSettings>;
  updateTradingSettings(id: number, settings: Partial<TradingSettings>): Promise<TradingSettings | undefined>;
  
  // Trade methods
  getTrades(userId: number): Promise<Trade[]>;
  getOpenTrades(userId: number): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;
  updateTrade(id: number, updates: Partial<Trade>): Promise<Trade | undefined>;
  
  // Balance methods
  getLatestBalance(userId: number): Promise<BalanceHistory | undefined>;
  getBalanceHistory(userId: number, limit?: number): Promise<BalanceHistory[]>;
  saveBalance(balance: InsertBalanceHistory): Promise<BalanceHistory>;
  
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private tradingSettingsMap: Map<number, TradingSettings>;
  private tradesMap: Map<number, Trade>;
  private balanceHistoryMap: Map<number, BalanceHistory>;
  
  currentId: number;
  settingsId: number;
  tradeId: number;
  balanceId: number;
  sessionStore: session.SessionStore;

  constructor() {
    this.users = new Map();
    this.tradingSettingsMap = new Map();
    this.tradesMap = new Map();
    this.balanceHistoryMap = new Map();
    
    this.currentId = 1;
    this.settingsId = 1;
    this.tradeId = 1;
    this.balanceId = 1;
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24 hours
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Trading settings methods
  async getTradingSettings(userId: number): Promise<TradingSettings | undefined> {
    return Array.from(this.tradingSettingsMap.values()).find(
      (settings) => settings.userId === userId
    );
  }
  
  async createTradingSettings(settings: InsertTradingSettings): Promise<TradingSettings> {
    const id = this.settingsId++;
    const now = new Date();
    const newSettings: TradingSettings = { 
      ...settings, 
      id, 
      createdAt: now, 
      updatedAt: now,
      tradingParams: settings.tradingParams || {}
    };
    this.tradingSettingsMap.set(id, newSettings);
    return newSettings;
  }
  
  async updateTradingSettings(id: number, settings: Partial<TradingSettings>): Promise<TradingSettings | undefined> {
    const existingSettings = this.tradingSettingsMap.get(id);
    if (!existingSettings) {
      return undefined;
    }
    
    const updatedSettings: TradingSettings = {
      ...existingSettings,
      ...settings,
      updatedAt: new Date()
    };
    
    this.tradingSettingsMap.set(id, updatedSettings);
    return updatedSettings;
  }
  
  // Trades methods
  async getTrades(userId: number): Promise<Trade[]> {
    return Array.from(this.tradesMap.values()).filter(
      (trade) => trade.userId === userId
    );
  }
  
  async getOpenTrades(userId: number): Promise<Trade[]> {
    return Array.from(this.tradesMap.values()).filter(
      (trade) => trade.userId === userId && trade.status === "OPEN"
    );
  }
  
  async createTrade(trade: InsertTrade): Promise<Trade> {
    const id = this.tradeId++;
    const now = new Date();
    const newTrade: Trade = {
      ...trade,
      id,
      openedAt: now,
      closedAt: undefined,
      tradeData: trade.tradeData || {}
    };
    this.tradesMap.set(id, newTrade);
    return newTrade;
  }
  
  async updateTrade(id: number, updates: Partial<Trade>): Promise<Trade | undefined> {
    const existingTrade = this.tradesMap.get(id);
    if (!existingTrade) {
      return undefined;
    }
    
    const updatedTrade: Trade = {
      ...existingTrade,
      ...updates,
      closedAt: updates.status === "CLOSED" ? new Date() : existingTrade.closedAt
    };
    
    this.tradesMap.set(id, updatedTrade);
    return updatedTrade;
  }
  
  // Balance methods
  async getLatestBalance(userId: number): Promise<BalanceHistory | undefined> {
    const userBalances = Array.from(this.balanceHistoryMap.values())
      .filter(balance => balance.userId === userId)
      .sort((a, b) => {
        if (a.timestamp > b.timestamp) return -1;
        if (a.timestamp < b.timestamp) return 1;
        return 0;
      });
      
    return userBalances.length > 0 ? userBalances[0] : undefined;
  }
  
  async getBalanceHistory(userId: number, limit = 30): Promise<BalanceHistory[]> {
    return Array.from(this.balanceHistoryMap.values())
      .filter(balance => balance.userId === userId)
      .sort((a, b) => {
        if (a.timestamp > b.timestamp) return -1;
        if (a.timestamp < b.timestamp) return 1;
        return 0;
      })
      .slice(0, limit);
  }
  
  async saveBalance(balance: InsertBalanceHistory): Promise<BalanceHistory> {
    const id = this.balanceId++;
    const newBalance: BalanceHistory = {
      ...balance,
      id,
      timestamp: new Date(),
      balanceData: balance.balanceData || {}
    };
    this.balanceHistoryMap.set(id, newBalance);
    return newBalance;
  }
}

export const storage = new MemStorage();
