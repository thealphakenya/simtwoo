import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Chart.js type declaration
declare global {
  interface Window {
    Chart: any;
  }
}
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Activity,
  Briefcase,
  CandlestickChart,
  Clock,
  DollarSign,
  LineChart,
  LogOut,
  PieChart,
  Settings,
  TrendingUp,
  Users,
  AlertTriangle,
  Bot,
  MessageCircle,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

// Types
interface Trade {
  id: number;
  symbol: string;
  side: string;
  entryPrice: string;
  exitPrice?: string;
  quantity: string;
  status: string;
  pnl?: string;
  pnlPercentage?: string;
  openedAt: string;
  closedAt?: string;
  strategy: string;
}

interface TradingSettings {
  id: number;
  userId: number;
  symbol: string;
  timeframe: string;
  strategy: string;
  riskPerTrade: string;
  leverageLevel: number;
  enabledTrading: boolean;
}

interface Balance {
  totalBalance: string;
  availableBalance: string;
  frozenBalance: string;
  unrealizedPnl: string;
}

interface MarketData {
  symbol: string;
  price: string;
  timestamp: number;
  volume24h: string;
  change24h: string;
}

export default function DashboardPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [confidence, setConfidence] = useState(70);
  const chartRef = useRef(null);
  const [prices, setPrices] = useState<{[key: string]: string}>({
    BTCUSDT: "Loading...",
    ETHUSDT: "Loading...",
    BNBUSDT: "Loading...",
    XRPUSDT: "Loading...",
    DOGEUSDT: "Loading..."
  });
  const [darkMode, setDarkMode] = useState(true);
  
  // Fetch balance data
  const {
    data: balanceData,
    isLoading: isBalanceLoading,
    error: balanceError,
  } = useQuery<Balance>({
    queryKey: ["/api/balance"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch market data for BTC
  const {
    data: marketData,
    isLoading: isMarketLoading,
    error: marketError,
  } = useQuery<MarketData>({
    queryKey: ["/api/market/BTCUSDT"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch open trades
  const {
    data: openTrades,
    isLoading: isTradesLoading,
    error: tradesError,
  } = useQuery<Trade[]>({
    queryKey: ["/api/trades/open"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  // Fetch trading settings
  const {
    data: tradingSettings,
    isLoading: isSettingsLoading,
    error: settingsError,
  } = useQuery<TradingSettings>({
    queryKey: ["/api/trading/settings"],
  });

  // Fetch trading status
  const {
    data: tradingStatus,
    isLoading: isStatusLoading,
    error: statusError,
  } = useQuery<any>({
    queryKey: ["/api/trading/status"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Update trading settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<TradingSettings>) => {
      const res = await apiRequest("POST", "/api/trading/settings", settings);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading/settings"] });
      toast({
        title: "Settings updated",
        description: "Your trading settings have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Start trading mutation
  const startTradingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trading/start", {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading/status"] });
      toast({
        title: "Trading started",
        description: "Automated trading has been started successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start trading",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Stop trading mutation
  const stopTradingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trading/stop", {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading/status"] });
      toast({
        title: "Trading stopped",
        description: "Automated trading has been stopped.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to stop trading",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update confidence threshold mutation
  const updateConfidenceMutation = useMutation({
    mutationFn: async (threshold: number) => {
      const res = await apiRequest("POST", "/api/trading/confidence", { threshold });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading/status"] });
      toast({
        title: "Confidence threshold updated",
        description: "The trading confidence threshold has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update confidence threshold",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle logout
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Handle settings update
  const handleUpdateSettings = (field: string, value: string | number | boolean) => {
    if (tradingSettings) {
      updateSettingsMutation.mutate({
        ...tradingSettings,
        [field]: value,
      });
    }
  };

  // Handle start/stop trading
  const handleToggleTrading = () => {
    if (tradingStatus?.isActive) {
      stopTradingMutation.mutate();
    } else {
      startTradingMutation.mutate();
    }
  };

  // Handle confidence threshold update
  const handleUpdateConfidence = () => {
    updateConfidenceMutation.mutate(confidence);
  };

  // Format currency
  const formatCurrency = (value: string | undefined) => {
    if (!value) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(parseFloat(value));
  };

  // Format percentage
  const formatPercentage = (value: string | undefined) => {
    if (!value) return "0.00%";
    return `${parseFloat(value).toFixed(2)}%`;
  };

  // Format date
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleString();
  };

  // Calculate PnL color
  const getPnlColor = (pnl: string | undefined) => {
    if (!pnl) return "text-gray-500";
    return parseFloat(pnl) >= 0 ? "text-green-500" : "text-red-500";
  };
  
  // Update market data to refresh prices
  useEffect(() => {
    if (marketData?.price) {
      setPrices(prevPrices => ({
        ...prevPrices,
        [marketData.symbol]: formatCurrency(marketData.price)
      }));
    }
  }, [marketData]);
  
  // Function to fetch all symbols' prices
  const fetchAllPrices = async () => {
    try {
      const symbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"];
      const newPrices: {[key: string]: string} = {};
      
      for (const symbol of symbols) {
        if (symbol === "BTCUSDT" && marketData?.price) {
          newPrices[symbol] = formatCurrency(marketData.price);
          continue;
        }
        
        try {
          const res = await fetch(`/api/market/${symbol}`);
          if (res.ok) {
            const data = await res.json();
            newPrices[symbol] = formatCurrency(data.price);
          } else {
            newPrices[symbol] = "Error";
          }
        } catch (err) {
          newPrices[symbol] = "Error";
        }
      }
      
      setPrices(newPrices);
    } catch (error) {
      console.error("Failed to fetch prices:", error);
    }
  };
  
  // Fetch all prices on component mount
  useEffect(() => {
    fetchAllPrices();
    const interval = setInterval(fetchAllPrices, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);
  
  // Initialize chart
  useEffect(() => {
    if (chartRef.current && typeof window !== 'undefined' && window.Chart) {
      // Prepare data for the chart - use random data initially
      // In a real app, this would be historical price data from your API
      const labels = Array.from({length: 24}, (_, i) => `${i}:00`);
      const data = Array.from({length: 24}, () => 50000 + Math.random() * 5000);
      
      const mockData = {
        labels,
        datasets: [{
          label: 'BTC Price',
          data,
          borderColor: darkMode ? '#3b82f6' : '#1e40af',
          backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(30, 64, 175, 0.1)',
          fill: true,
          tension: 0.4
        }]
      };
      
      const config = {
        type: 'line',
        data: mockData,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              mode: 'index',
              intersect: false
            }
          },
          scales: {
            x: {
              grid: {
                display: false
              }
            },
            y: {
              beginAtZero: false,
              grid: {
                color: darkMode ? 'rgba(200, 200, 200, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              }
            }
          }
        }
      };
      
      const myChart = new window.Chart(chartRef.current, config);
      
      return () => {
        myChart.destroy();
      };
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white py-4 shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <CandlestickChart className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Crypto Trading Dashboard</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">{user?.username}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Price Data Header */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <h2 className="text-xl font-bold">Live Prices:</h2>
            </div>
            <div className="flex flex-wrap gap-4">
              {Object.entries(prices).map(([symbol, price]) => (
                <div key={symbol} className="flex items-center space-x-2">
                  <span className="font-medium">{symbol}:</span>
                  <span>{price}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center mt-4 md:mt-0">
              <label className="inline-flex items-center cursor-pointer">
                <span className="mr-2 text-sm font-medium">
                  {darkMode ? 'Dark Mode' : 'Light Mode'}
                </span>
                <Switch 
                  checked={darkMode} 
                  onCheckedChange={setDarkMode} 
                />
              </label>
            </div>
          </div>
        </div>
        
        {/* Price Chart */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="h-[300px] w-full">
            <canvas ref={chartRef} className="w-full h-full"></canvas>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center">
              <div className={`h-3 w-3 rounded-full ${tradingStatus?.isActive ? "bg-green-500" : "bg-red-500"} mr-2`}></div>
              <span className="text-sm font-medium">
                AI Status: {tradingStatus?.isActive ? "ACTIVE — Monitoring..." : "INACTIVE"}
              </span>
            </div>
            <div className="text-sm font-medium">
              Balance: {formatCurrency(balanceData?.totalBalance)}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">Navigation</h2>
              </div>
              <div className="p-2">
                <ul className="space-y-1">
                  <li>
                    <button
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md ${
                        activeTab === "overview"
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                      onClick={() => setActiveTab("overview")}
                    >
                      <PieChart className="h-5 w-5" />
                      <span>Overview</span>
                    </button>
                  </li>
                  <li>
                    <button
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md ${
                        activeTab === "trading"
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                      onClick={() => setActiveTab("trading")}
                    >
                      <Activity className="h-5 w-5" />
                      <span>Trading</span>
                    </button>
                  </li>
                  <li>
                    <button
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md ${
                        activeTab === "settings"
                          ? "bg-blue-50 text-blue-600"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                      onClick={() => setActiveTab("settings")}
                    >
                      <Settings className="h-5 w-5" />
                      <span>Settings</span>
                    </button>
                  </li>
                </ul>
              </div>
            </div>

            {/* Balance Card */}
            <Card className="mt-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <Briefcase className="h-5 w-5 mr-2 text-blue-500" />
                  Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isBalanceLoading ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-10 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </div>
                ) : balanceError ? (
                  <div className="text-red-500 text-sm">Failed to load balance data</div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(balanceData?.totalBalance)}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-xs">
                        <span className="text-gray-500 block">Available</span>
                        <span className="font-medium">{formatCurrency(balanceData?.availableBalance)}</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-gray-500 block">Frozen</span>
                        <span className="font-medium">{formatCurrency(balanceData?.frozenBalance)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Market Data Card */}
            <Card className="mt-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <LineChart className="h-5 w-5 mr-2 text-blue-500" />
                  Market Data
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isMarketLoading ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-10 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </div>
                ) : marketError ? (
                  <div className="text-red-500 text-sm">Failed to load market data</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{marketData?.symbol}</span>
                      <Badge variant={parseFloat(marketData?.change24h || "0") >= 0 ? "default" : "destructive"}>
                        {parseFloat(marketData?.change24h || "0").toFixed(2)}%
                      </Badge>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {formatCurrency(marketData?.price)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Volume 24h: {parseFloat(marketData?.volume24h || "0").toLocaleString()}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Trading Status Card */}
            <Card className="mt-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <Activity className="h-5 w-5 mr-2 text-blue-500" />
                  Trading Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isStatusLoading ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-6 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ) : statusError ? (
                  <div className="text-red-500 text-sm">Failed to load status</div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <Badge 
                        variant={tradingStatus?.isActive ? "default" : "outline"}
                        className="mr-2"
                      >
                        {tradingStatus?.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        Confidence: {tradingStatus?.confidenceThreshold}%
                      </span>
                    </div>
                    <Button 
                      variant={tradingStatus?.isActive ? "destructive" : "default"}
                      className="w-full"
                      onClick={handleToggleTrading}
                      disabled={startTradingMutation.isPending || stopTradingMutation.isPending}
                    >
                      {startTradingMutation.isPending || stopTradingMutation.isPending ? (
                        "Processing..."
                      ) : tradingStatus?.isActive ? (
                        "Stop Trading"
                      ) : (
                        "Start Trading"
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Trading Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-500">+$0.00</div>
                      <p className="text-gray-500 text-sm">Total profit & loss</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Active Trades</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-gray-900">
                        {isTradesLoading ? (
                          <div className="animate-pulse h-8 w-16 bg-gray-200 rounded"></div>
                        ) : (
                          openTrades?.length || 0
                        )}
                      </div>
                      <p className="text-gray-500 text-sm">Currently open positions</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Trading Bot</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-2">
                        <div className={`h-3 w-3 rounded-full ${tradingStatus?.isActive ? "bg-green-500" : "bg-gray-300"}`}></div>
                        <span className="font-medium">{tradingStatus?.isActive ? "Active" : "Inactive"}</span>
                      </div>
                      <p className="text-gray-500 text-sm mt-1">
                        {tradingStatus?.isActive 
                          ? `Strategy: ${tradingSettings?.strategy || "MACD"}`
                          : "Trading bot is currently inactive"
                        }
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Recent Trades */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Trades</CardTitle>
                    <CardDescription>Your most recent trading activity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isTradesLoading ? (
                      <div className="animate-pulse space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="h-12 bg-gray-200 rounded"></div>
                        ))}
                      </div>
                    ) : openTrades?.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p>No trades have been executed yet.</p>
                        <p className="text-sm">Start trading to see your activity here.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableCaption>List of your recent trades</TableCaption>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Symbol</TableHead>
                            <TableHead>Side</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>P&L</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {openTrades?.map((trade) => (
                            <TableRow key={trade.id}>
                              <TableCell className="font-medium">{trade.symbol}</TableCell>
                              <TableCell>
                                <Badge 
                                  variant={trade.side === "buy" ? "default" : "destructive"}
                                >
                                  {trade.side.toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell>{formatCurrency(trade.entryPrice)}</TableCell>
                              <TableCell>{parseFloat(trade.quantity).toFixed(5)}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {trade.status}
                                </Badge>
                              </TableCell>
                              <TableCell className={getPnlColor(trade.pnl)}>
                                {trade.pnl ? formatCurrency(trade.pnl) : "-"}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center">
                                  <Clock className="h-3 w-3 mr-1 text-gray-400" />
                                  <span className="text-xs">{formatDate(trade.openedAt)}</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Trading Tab */}
            {activeTab === "trading" && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Trading Bot Configuration</CardTitle>
                    <CardDescription>Control your automated trading settings</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Trading Pair</label>
                        <Select 
                          defaultValue={tradingSettings?.symbol || "BTCUSDT"}
                          onValueChange={(value) => handleUpdateSettings("symbol", value)}
                          disabled={tradingStatus?.isActive}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select trading pair" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="BTCUSDT">BTC/USDT</SelectItem>
                            <SelectItem value="ETHUSDT">ETH/USDT</SelectItem>
                            <SelectItem value="BNBUSDT">BNB/USDT</SelectItem>
                            <SelectItem value="XRPUSDT">XRP/USDT</SelectItem>
                            <SelectItem value="DOGEUSDT">DOGE/USDT</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Timeframe</label>
                        <Select 
                          defaultValue={tradingSettings?.timeframe || "1h"}
                          onValueChange={(value) => handleUpdateSettings("timeframe", value)}
                          disabled={tradingStatus?.isActive}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select timeframe" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="15m">15 Minutes</SelectItem>
                            <SelectItem value="1h">1 Hour</SelectItem>
                            <SelectItem value="4h">4 Hours</SelectItem>
                            <SelectItem value="1d">1 Day</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Model</label>
                        <Select 
                          defaultValue={tradingSettings?.strategy || "ENSEMBLE"}
                          onValueChange={(value) => handleUpdateSettings("strategy", value)}
                          disabled={tradingStatus?.isActive}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select model" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ENSEMBLE">Ensemble (All Models)</SelectItem>
                            <SelectItem value="LSTM">LSTM</SelectItem>
                            <SelectItem value="MACD">MACD</SelectItem>
                            <SelectItem value="RSI">RSI</SelectItem>
                            <SelectItem value="BOLLINGER">Bollinger Bands</SelectItem>
                            <SelectItem value="EMA">EMA Cross</SelectItem>
                            <SelectItem value="RL">Reinforcement Learning</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Risk Per Trade (%)</label>
                        <div className="flex space-x-2">
                          <Input 
                            type="number" 
                            value={tradingSettings?.riskPerTrade || "1"} 
                            onChange={(e) => handleUpdateSettings("riskPerTrade", e.target.value)}
                            min="0.1"
                            max="10"
                            step="0.1"
                            disabled={tradingStatus?.isActive}
                          />
                          <span className="flex items-center text-gray-500">%</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">
                          Confidence Threshold: {confidence}%
                        </span>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={handleUpdateConfidence}
                        >
                          Update
                        </Button>
                      </div>
                      <Slider
                        defaultValue={[confidence]}
                        max={100}
                        step={1}
                        onValueChange={(values) => setConfidence(values[0])}
                      />
                      <p className="text-xs text-gray-500">
                        Set the minimum confidence level (0-100%) required before executing trades. 
                        Higher values require stronger signals but may result in fewer trades.
                      </p>
                    </div>

                    <div className="space-y-2 mt-6">
                      <h3 className="text-sm font-medium text-gray-700">Trading Mode</h3>
                      <div className="flex space-x-3">
                        <Button variant="outline" className="flex-1">Virtual Account</Button>
                        <Button variant="outline" className="flex-1">Real Account</Button>
                      </div>
                    </div>

                    <div className="space-y-2 mt-6">
                      <h3 className="text-sm font-medium text-gray-700">Manual Trading</h3>
                      <div className="flex space-x-3">
                        <Select defaultValue="market">
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Order type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="market">Market</SelectItem>
                            <SelectItem value="limit">Limit</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input 
                          type="number" 
                          placeholder="Amount" 
                          className="flex-1"
                          min="0.001"
                          step="0.001"
                        />
                        <Button variant="default" className="bg-green-600 hover:bg-green-700">Buy</Button>
                        <Button variant="destructive">Sell</Button>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="border-t border-gray-100 pt-4">
                    <Button 
                      className="w-full"
                      variant={tradingStatus?.isActive ? "destructive" : "default"}
                      onClick={handleToggleTrading}
                      disabled={startTradingMutation.isPending || stopTradingMutation.isPending}
                    >
                      {startTradingMutation.isPending || stopTradingMutation.isPending ? (
                        "Processing..."
                      ) : tradingStatus?.isActive ? (
                        "Stop Trading Bot"
                      ) : (
                        "Start Auto Trading"
                      )}
                    </Button>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Bot className="h-5 w-5 mr-2 text-blue-500" />
                      AI Strategy Weights
                    </CardTitle>
                    <CardDescription>Adjust the importance of each model in the ensemble</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium">LSTM Model</span>
                          <span>33%</span>
                        </div>
                        <Slider defaultValue={[33]} max={100} step={1} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium">Trading AI</span>
                          <span>33%</span>
                        </div>
                        <Slider defaultValue={[33]} max={100} step={1} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium">Reinforcement Learning</span>
                          <span>34%</span>
                        </div>
                        <Slider defaultValue={[34]} max={100} step={1} className="h-2" />
                      </div>
                      
                      <Button variant="outline" className="w-full mt-4">
                        Update Strategy
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Performance Monitoring</CardTitle>
                    <CardDescription>Track your trading bot performance</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium">Success Rate</span>
                          <span>0%</span>
                        </div>
                        <Progress value={0} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium">Profit Factor</span>
                          <span>0.00</span>
                        </div>
                        <Progress value={0} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="font-medium">Average Trade</span>
                          <span>$0.00</span>
                        </div>
                        <Progress value={0} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center">
                      <MessageCircle className="h-5 w-5 mr-2 text-blue-500" />
                      Chat with AI
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 rounded-md p-4 h-48 overflow-y-auto mb-4">
                      <div className="flex flex-col space-y-3">
                        <div className="bg-blue-100 text-blue-900 rounded-md p-2 max-w-[80%] self-start">
                          Hello! I'm your AI trading assistant. How can I help you today?
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Input 
                        type="text" 
                        placeholder="Ask AI..." 
                        className="flex-1"
                      />
                      <Button variant="outline">Send</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center">
                      <AlertTriangle className="h-5 w-5 mr-2 text-red-500" />
                      Emergency Controls
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button variant="destructive" className="w-full">Emergency Stop All Trading</Button>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center">
                      <Bot className="h-5 w-5 mr-2 text-blue-500" />
                      P2P Trading Bot
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Status</p>
                          <p className="mt-1">Not Running</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Balance</p>
                          <p className="mt-1">Loading...</p>
                        </div>
                      </div>
                      <Button variant="outline" className="w-full">Start P2P Bot</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === "settings" && (
              <Card>
                <CardHeader>
                  <CardTitle>Trading Settings</CardTitle>
                  <CardDescription>Configure your trading preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Leverage Level</label>
                      <Select 
                        defaultValue={tradingSettings?.leverageLevel?.toString() || "1"}
                        onValueChange={(value) => handleUpdateSettings("leverageLevel", parseInt(value))}
                        disabled={tradingStatus?.isActive}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select leverage" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1x (No Leverage)</SelectItem>
                          <SelectItem value="2">2x</SelectItem>
                          <SelectItem value="3">3x</SelectItem>
                          <SelectItem value="5">5x</SelectItem>
                          <SelectItem value="10">10x</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        Higher leverage increases both potential profits and risks.
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">API Connection</h3>
                    <div className="flex items-center space-x-2">
                      <div className={`h-3 w-3 rounded-full ${tradingStatus?.bitgetConnected ? "bg-green-500" : "bg-red-500"}`}></div>
                      <span className="font-medium">
                        {tradingStatus?.bitgetConnected ? "Connected to Bitget API" : "Not connected to Bitget API"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      {tradingStatus?.bitgetConnected 
                        ? "Your Bitget API connection is working properly." 
                        : "Please check your API credentials and make sure they are correct."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}