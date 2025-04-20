import { 
  users, type User, type InsertUser,
  tradingSettings, type TradingSettings, type InsertTradingSettings,
  trades, type Trade, type InsertTrade,
  balanceHistory, type BalanceHistory, type InsertBalanceHistory
} from "@shared/schema";
import session from "express-session";
import Decimal from "decimal.js";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

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
  
  sessionStore: any; // Session store for authentication
}

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: any;
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true,
      tableName: 'session'
    });
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }
  
  // Trading settings methods
  async getTradingSettings(userId: number): Promise<TradingSettings | undefined> {
    const [settings] = await db
      .select()
      .from(tradingSettings)
      .where(eq(tradingSettings.userId, userId));
    return settings;
  }
  
  async createTradingSettings(settings: InsertTradingSettings): Promise<TradingSettings> {
    const [newSettings] = await db
      .insert(tradingSettings)
      .values({
        ...settings,
        symbol: settings.symbol || 'BTCUSDT',
        timeframe: settings.timeframe || '1h',
        strategy: settings.strategy || 'MACD',
        riskPerTrade: settings.riskPerTrade || '1',
        leverageLevel: settings.leverageLevel || 1,
        enabledTrading: settings.enabledTrading || false,
        tradingParams: settings.tradingParams || {}
      })
      .returning();
    return newSettings;
  }
  
  async updateTradingSettings(id: number, settings: Partial<TradingSettings>): Promise<TradingSettings | undefined> {
    const [updatedSettings] = await db
      .update(tradingSettings)
      .set({
        ...settings,
        updatedAt: new Date()
      })
      .where(eq(tradingSettings.id, id))
      .returning();
    return updatedSettings;
  }
  
  // Trades methods
  async getTrades(userId: number): Promise<Trade[]> {
    const userTrades = await db
      .select()
      .from(trades)
      .where(eq(trades.userId, userId))
      .orderBy(desc(trades.openedAt));
    return userTrades;
  }
  
  async getOpenTrades(userId: number): Promise<Trade[]> {
    const openTrades = await db
      .select()
      .from(trades)
      .where(
        and(
          eq(trades.userId, userId),
          eq(trades.status, 'OPEN')
        )
      )
      .orderBy(desc(trades.openedAt));
    return openTrades;
  }
  
  async createTrade(trade: InsertTrade): Promise<Trade> {
    const now = new Date();
    const [newTrade] = await db
      .insert(trades)
      .values({
        ...trade,
        openedAt: now,
        tradeData: trade.tradeData || {}
      })
      .returning();
    return newTrade;
  }
  
  async updateTrade(id: number, updates: Partial<Trade>): Promise<Trade | undefined> {
    const [updatedTrade] = await db
      .update(trades)
      .set({
        ...updates,
        closedAt: updates.status === "CLOSED" ? new Date() : undefined
      })
      .where(eq(trades.id, id))
      .returning();
    return updatedTrade;
  }
  
  // Balance methods
  async getLatestBalance(userId: number): Promise<BalanceHistory | undefined> {
    const [latestBalance] = await db
      .select()
      .from(balanceHistory)
      .where(eq(balanceHistory.userId, userId))
      .orderBy(desc(balanceHistory.timestamp))
      .limit(1);
    return latestBalance;
  }
  
  async getBalanceHistory(userId: number, limit = 30): Promise<BalanceHistory[]> {
    const history = await db
      .select()
      .from(balanceHistory)
      .where(eq(balanceHistory.userId, userId))
      .orderBy(desc(balanceHistory.timestamp))
      .limit(limit);
    return history;
  }
  
  async saveBalance(balance: InsertBalanceHistory): Promise<BalanceHistory> {
    const [newBalance] = await db
      .insert(balanceHistory)
      .values({
        ...balance,
        timestamp: new Date(),
        balanceData: balance.balanceData || {}
      })
      .returning();
    return newBalance;
  }
}

export const storage = new DatabaseStorage();
