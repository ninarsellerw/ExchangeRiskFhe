// App.tsx
import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

// Define types for our data
interface ExchangeData {
  id: string;
  name: string;
  liquidity: number;
  riskScore: number;
  encryptedData: string;
  timestamp: number;
  status: "pending" | "verified" | "rejected";
}

// Language type
type Language = 'en' | 'zh';

// Language resources
const resources = {
  en: {
    title: "ExchangeRiskFHE",
    subtitle: "Confidential Analysis of Systemic Risk in Crypto Exchanges",
    connectWallet: "Connect Wallet",
    disconnect: "Disconnect",
    dashboard: "Dashboard",
    totalExchanges: "Total Exchanges",
    averageRisk: "Average Risk Score",
    highRisk: "High Risk Exchanges",
    verified: "Verified",
    addExchange: "Add Exchange Data",
    refresh: "Refresh",
    exchangeList: "Exchange List",
    name: "Name",
    liquidity: "Liquidity (M)",
    riskScore: "Risk Score",
    status: "Status",
    actions: "Actions",
    noData: "No exchange data available",
    addFirst: "Add First Exchange",
    verify: "Verify",
    reject: "Reject",
    submitting: "Submitting...",
    available: "Check FHE Availability",
    submitData: "Submit Encrypted Data",
    getData: "Retrieve Data",
    fheAvailable: "FHE System Available",
    dataSubmitted: "Data Submitted Successfully",
    dataRetrieved: "Data Retrieved",
    language: "Language",
    riskDistribution: "Risk Distribution",
    liquidityTrend: "Liquidity Trend",
    total: "Total"
  },
  zh: {
    title: "交易所风险FHE分析",
    subtitle: "機密化的加密貨幣交易所系統性風險分析",
    connectWallet: "连接钱包",
    disconnect: "断开连接",
    dashboard: "仪表板",
    totalExchanges: "交易所总数",
    averageRisk: "平均风险分数",
    highRisk: "高风险交易所",
    verified: "已验证",
    addExchange: "添加交易所数据",
    refresh: "刷新",
    exchangeList: "交易所列表",
    name: "名称",
    liquidity: "流动性(百万)",
    riskScore: "风险分数",
    status: "状态",
    actions: "操作",
    noData: "暂无交易所数据",
    addFirst: "添加第一个交易所",
    verify: "验证",
    reject: "拒绝",
    submitting: "提交中...",
    available: "检查FHE可用性",
    submitData: "提交加密数据",
    getData: "获取数据",
    fheAvailable: "FHE系统可用",
    dataSubmitted: "数据提交成功",
    dataRetrieved: "数据获取成功",
    language: "语言",
    riskDistribution: "风险分布",
    liquidityTrend: "流动性趋势",
    total: "总计"
  }
};

const App: React.FC = () => {
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [exchanges, setExchanges] = useState<ExchangeData[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [newExchange, setNewExchange] = useState({
    name: "",
    liquidity: "",
    riskScore: ""
  });
  const [language, setLanguage] = useState<Language>('en');
  const t = resources[language];

  // Calculate statistics
  const totalExchanges = exchanges.length;
  const averageRisk = totalExchanges > 0 
    ? exchanges.reduce((sum, exchange) => sum + exchange.riskScore, 0) / totalExchanges 
    : 0;
  const highRiskCount = exchanges.filter(e => e.riskScore >= 7).length;
  const verifiedCount = exchanges.filter(e => e.status === "verified").length;

  // Risk distribution data for chart
  const riskDistribution = {
    low: exchanges.filter(e => e.riskScore < 4).length,
    medium: exchanges.filter(e => e.riskScore >= 4 && e.riskScore < 7).length,
    high: exchanges.filter(e => e.riskScore >= 7).length
  };

  // Liquidity trend data
  const liquidityTrend = exchanges
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(e => ({ x: new Date(e.timestamp * 1000).toLocaleDateString(), y: e.liquidity }));

  useEffect(() => {
    loadExchanges().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'zh' : 'en');
  };

  const loadExchanges = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("exchange_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing exchange keys:", e);
        }
      }
      
      const list: ExchangeData[] = [];
      
      for (const key of keys) {
        try {
          const exchangeBytes = await contract.getData(`exchange_${key}`);
          if (exchangeBytes.length > 0) {
            try {
              const exchangeData = JSON.parse(ethers.toUtf8String(exchangeBytes));
              list.push({
                id: key,
                name: exchangeData.name,
                liquidity: exchangeData.liquidity,
                riskScore: exchangeData.riskScore,
                encryptedData: exchangeData.data,
                timestamp: exchangeData.timestamp,
                status: exchangeData.status || "pending"
              });
            } catch (e) {
              console.error(`Error parsing exchange data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading exchange ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.timestamp - a.timestamp);
      setExchanges(list);
    } catch (e) {
      console.error("Error loading exchanges:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const handleCheckAvailable = async () => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: language === 'en' ? "Checking FHE availability..." : "检查FHE可用性..."
    });

    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Contract not available");
      
      const isAvailable = await contract.isAvailable();
      
      if (isAvailable) {
        setTransactionStatus({
          visible: true,
          status: "success",
          message: t.fheAvailable
        });
      } else {
        throw new Error("FHE not available");
      }
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Error: " + (e.message || "Unknown error")
      });
    }

    setTimeout(() => {
      setTransactionStatus({ visible: false, status: "pending", message: "" });
    }, 3000);
  };

  const handleSetData = async () => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: language === 'en' ? "Submitting encrypted data..." : "提交加密数据..."
    });

    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Contract not available");
      
      // Generate random exchange data for simulation
      const exchangeId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const exchangeData = {
        name: `Exchange_${Math.floor(Math.random() * 1000)}`,
        liquidity: Math.random() * 100,
        riskScore: Math.floor(Math.random() * 10) + 1,
        data: `FHE-ENCRYPTED-${btoa(JSON.stringify({ simulated: "data" }))}`,
        timestamp: Math.floor(Date.now() / 1000),
        status: "pending"
      };
      
      await contract.setData(
        `exchange_${exchangeId}`, 
        ethers.toUtf8Bytes(JSON.stringify(exchangeData))
      );
      
      // Update keys list
      const keysBytes = await contract.getData("exchange_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(exchangeId);
      
      await contract.setData(
        "exchange_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: t.dataSubmitted
      });
      
      await loadExchanges();
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Error: " + (e.message || "Unknown error")
      });
    }

    setTimeout(() => {
      setTransactionStatus({ visible: false, status: "pending", message: "" });
    }, 3000);
  };

  const handleGetData = async () => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: language === 'en' ? "Retrieving encrypted data..." : "获取加密数据..."
    });

    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Contract not available");
      
      // Just simulate getting data by reloading exchanges
      await loadExchanges();
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: t.dataRetrieved
      });
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Error: " + (e.message || "Unknown error")
      });
    }

    setTimeout(() => {
      setTransactionStatus({ visible: false, status: "pending", message: "" });
    }, 3000);
  };

  const verifyExchange = async (exchangeId: string) => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: language === 'en' ? "Verifying with FHE..." : "使用FHE验证中..."
    });

    try {
      // Simulate FHE processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Contract not available");
      
      const exchangeBytes = await contract.getData(`exchange_${exchangeId}`);
      if (exchangeBytes.length === 0) {
        throw new Error("Exchange not found");
      }
      
      const exchangeData = JSON.parse(ethers.toUtf8String(exchangeBytes));
      const updatedData = {
        ...exchangeData,
        status: "verified"
      };
      
      await contract.setData(
        `exchange_${exchangeId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedData))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: language === 'en' ? "Exchange verified!" : "交易所已验证!"
      });
      
      await loadExchanges();
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Error: " + (e.message || "Unknown error")
      });
    }

    setTimeout(() => {
      setTransactionStatus({ visible: false, status: "pending", message: "" });
    }, 3000);
  };

  const rejectExchange = async (exchangeId: string) => {
    if (!provider) {
      alert("Please connect wallet first");
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: language === 'en' ? "Rejecting with FHE..." : "使用FHE拒绝中..."
    });

    try {
      // Simulate FHE processing time
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Contract not available");
      
      const exchangeBytes = await contract.getData(`exchange_${exchangeId}`);
      if (exchangeBytes.length === 0) {
        throw new Error("Exchange not found");
      }
      
      const exchangeData = JSON.parse(ethers.toUtf8String(exchangeBytes));
      const updatedData = {
        ...exchangeData,
        status: "rejected"
      };
      
      await contract.setData(
        `exchange_${exchangeId}`, 
        ethers.toUtf8Bytes(JSON.stringify(updatedData))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: language === 'en' ? "Exchange rejected!" : "交易所已拒绝!"
      });
      
      await loadExchanges();
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: "Error: " + (e.message || "Unknown error")
      });
    }

    setTimeout(() => {
      setTransactionStatus({ visible: false, status: "pending", message: "" });
    }, 3000);
  };

  const renderRiskDistributionChart = () => {
    return (
      <div className="chart-container">
        <div className="chart-bar">
          <div 
            className="chart-fill low-risk" 
            style={{ width: `${(riskDistribution.low / totalExchanges) * 100}%` }}
          >
            <span className="chart-label">{riskDistribution.low}</span>
          </div>
        </div>
        <div className="chart-bar">
          <div 
            className="chart-fill medium-risk" 
            style={{ width: `${(riskDistribution.medium / totalExchanges) * 100}%` }}
          >
            <span className="chart-label">{riskDistribution.medium}</span>
          </div>
        </div>
        <div className="chart-bar">
          <div 
            className="chart-fill high-risk" 
            style={{ width: `${(riskDistribution.high / totalExchanges) * 100}%` }}
          >
            <span className="chart-label">{riskDistribution.high}</span>
          </div>
        </div>
        <div className="chart-legend">
          <div className="legend-item">
            <div className="legend-color low-risk"></div>
            <span>{language === 'en' ? 'Low Risk' : '低风险'}</span>
          </div>
          <div className="legend-item">
            <div className="legend-color medium-risk"></div>
            <span>{language === 'en' ? 'Medium Risk' : '中风险'}</span>
          </div>
          <div className="legend-item">
            <div className="legend-color high-risk"></div>
            <span>{language === 'en' ? 'High Risk' : '高风险'}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderLiquidityTrendChart = () => {
    if (liquidityTrend.length === 0) {
      return <div className="no-data-chart">{language === 'en' ? 'No data available' : '暂无数据'}</div>;
    }
    
    const maxLiquidity = Math.max(...liquidityTrend.map(item => item.y));
    
    return (
      <div className="trend-chart">
        {liquidityTrend.map((item, index) => (
          <div key={index} className="trend-bar">
            <div 
              className="trend-fill" 
              style={{ height: `${(item.y / maxLiquidity) * 100}%` }}
            ></div>
            <span className="trend-label">{item.y.toFixed(1)}</span>
            <span className="trend-date">{item.x}</span>
          </div>
        ))}
      </div>
    );
  };

  if (loading) return (
    <div className="loading-screen metal-bg">
      <div className="metal-spinner"></div>
      <p>{language === 'en' ? 'Initializing FHE system...' : '初始化FHE系统中...'}</p>
    </div>
  );

  return (
    <div className="app-container metal-theme">
      <header className="app-header metal-header">
        <div className="header-left">
          <div className="logo">
            <div className="logo-icon metal-logo">
              <div className="shield-icon metal-shield"></div>
            </div>
            <h1>{t.title}</h1>
          </div>
          <p className="subtitle">{t.subtitle}</p>
        </div>
        
        <div className="header-right">
          <button className="language-toggle metal-button" onClick={toggleLanguage}>
            {language === 'en' ? '中文' : 'EN'}
          </button>
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <main className="main-content metal-dashboard">
        <div className="dashboard-controls">
          <button className="control-btn metal-button breath" onClick={handleCheckAvailable}>
            <span className="btn-icon">✓</span>
            {t.available}
          </button>
          <button className="control-btn metal-button breath" onClick={handleSetData}>
            <span className="btn-icon">↑</span>
            {t.submitData}
          </button>
          <button className="control-btn metal-button breath" onClick={handleGetData}>
            <span className="btn-icon">↓</span>
            {t.getData}
          </button>
          <button className="control-btn metal-button breath" onClick={loadExchanges} disabled={isRefreshing}>
            <span className="btn-icon">↻</span>
            {isRefreshing ? (language === 'en' ? 'Refreshing...' : '刷新中...') : t.refresh}
          </button>
        </div>
        
        <div className="dashboard-grid">
          <div className="dashboard-card metal-card">
            <h3>{t.dashboard}</h3>
            <div className="stats-grid">
              <div className="stat-item metal-stat">
                <div className="stat-value gold-text">{totalExchanges}</div>
                <div className="stat-label">{t.totalExchanges}</div>
              </div>
              <div className="stat-item metal-stat">
                <div className="stat-value silver-text">{averageRisk.toFixed(1)}</div>
                <div className="stat-label">{t.averageRisk}</div>
              </div>
              <div className="stat-item metal-stat">
                <div className="stat-value copper-text">{highRiskCount}</div>
                <div className="stat-label">{t.highRisk}</div>
              </div>
              <div className="stat-item metal-stat">
                <div className="stat-value titanium-text">{verifiedCount}</div>
                <div className="stat-label">{t.verified}</div>
              </div>
            </div>
          </div>
          
          <div className="dashboard-card metal-card">
            <h3>{t.riskDistribution}</h3>
            {renderRiskDistributionChart()}
          </div>
          
          <div className="dashboard-card metal-card">
            <h3>{t.liquidityTrend}</h3>
            {renderLiquidityTrendChart()}
          </div>
        </div>
        
        <div className="data-section">
          <div className="section-header">
            <h2>{t.exchangeList}</h2>
            <div className="section-actions">
              <button className="metal-button primary breath" onClick={handleSetData}>
                + {t.addExchange}
              </button>
            </div>
          </div>
          
          <div className="data-table metal-card">
            <div className="table-header">
              <div className="header-cell">{t.name}</div>
              <div className="header-cell">{t.liquidity}</div>
              <div className="header-cell">{t.riskScore}</div>
              <div className="header-cell">{t.status}</div>
              <div className="header-cell">{t.actions}</div>
            </div>
            
            {exchanges.length === 0 ? (
              <div className="no-data">
                <div className="no-data-icon">📊</div>
                <p>{t.noData}</p>
                <button className="metal-button primary" onClick={handleSetData}>
                  {t.addFirst}
                </button>
              </div>
            ) : (
              exchanges.map(exchange => (
                <div className="table-row metal-row" key={exchange.id}>
                  <div className="table-cell">{exchange.name}</div>
                  <div className="table-cell">${exchange.liquidity.toFixed(1)}M</div>
                  <div className="table-cell">
                    <span className={`risk-badge risk-${Math.floor(exchange.riskScore / 4)}`}>
                      {exchange.riskScore}
                    </span>
                  </div>
                  <div className="table-cell">
                    <span className={`status-badge status-${exchange.status}`}>
                      {exchange.status}
                    </span>
                  </div>
                  <div className="table-cell">
                    <div className="action-buttons">
                      <button 
                        className="action-btn metal-button small success"
                        onClick={() => verifyExchange(exchange.id)}
                      >
                        {t.verify}
                      </button>
                      <button 
                        className="action-btn metal-button small danger"
                        onClick={() => rejectExchange(exchange.id)}
                      >
                        {t.reject}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-toast metal-toast">
          <div className={`toast-content ${transactionStatus.status}`}>
            <div className="toast-icon">
              {transactionStatus.status === "pending" && <div className="metal-spinner"></div>}
              {transactionStatus.status === "success" && "✓"}
              {transactionStatus.status === "error" && "✕"}
            </div>
            <div className="toast-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
      
      <footer className="app-footer metal-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="shield-icon metal-shield"></div>
              <span>ExchangeRiskFHE</span>
            </div>
            <p>{language === 'en' ? 'Confidential systemic risk analysis using FHE' : '使用FHE进行机密系统风险分析'}</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">{language === 'en' ? 'Documentation' : '文档'}</a>
            <a href="#" className="footer-link">{language === 'en' ? 'Privacy' : '隐私'}</a>
            <a href="#" className="footer-link">{language === 'en' ? 'Terms' : '条款'}</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge metal-badge">
            <span>FHE-Powered</span>
          </div>
          <div className="copyright">
            © {new Date().getFullYear()} ExchangeRiskFHE. {language === 'en' ? 'All rights reserved.' : '保留所有权利。'}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;