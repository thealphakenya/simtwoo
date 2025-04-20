import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Trading settings schema
export const tradingSettings = pgTable("trading_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull().default("BTCUSDT"),
  timeframe: text("timeframe").notNull().default("1h"),
  strategy: text("strategy").notNull().default("MACD"),
  riskPerTrade: decimal("risk_per_trade").notNull().default("1"),
  leverageLevel: integer("leverage_level").notNull().default(1),
  enabledTrading: boolean("enabled_trading").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  tradingParams: jsonb("trading_params").default({})
});

export const insertTradingSettingsSchema = createInsertSchema(tradingSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

export type InsertTradingSettings = z.infer<typeof insertTradingSettingsSchema>;
export type TradingSettings = typeof tradingSettings.$inferSelect;

// Trades schema
export const trades = pgTable("trades", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(), // BUY or SELL
  entryPrice: decimal("entry_price").notNull(),
  exitPrice: decimal("exit_price"),
  quantity: decimal("quantity").notNull(),
  status: text("status").notNull().default("OPEN"), // OPEN, CLOSED, CANCELLED
  pnl: decimal("pnl"),
  pnlPercentage: decimal("pnl_percentage"),
  openedAt: timestamp("opened_at").defaultNow(),
  closedAt: timestamp("closed_at"),
  strategy: text("strategy").notNull(),
  notes: text("notes"),
  orderId: text("order_id").notNull(),
  tradeData: jsonb("trade_data").default({})
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  openedAt: true,
  closedAt: true
});

export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof trades.$inferSelect;

// Account balance snapshot
export const balanceHistory = pgTable("balance_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  totalBalance: decimal("total_balance").notNull(),
  availableBalance: decimal("available_balance").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  balanceData: jsonb("balance_data").default({})
});

export const insertBalanceHistorySchema = createInsertSchema(balanceHistory).omit({
  id: true,
  timestamp: true
});

export type InsertBalanceHistory = z.infer<typeof insertBalanceHistorySchema>;
export type BalanceHistory = typeof balanceHistory.$inferSelect;
