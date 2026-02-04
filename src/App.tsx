import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, Upload, Printer, ChevronRight, Hash, 
  ArrowLeft, Settings, Search,
  CheckCircle2, FileSpreadsheet,
  Table as TableIcon, LayoutDashboard, Edit3, X, Trash,
  Download, Database, Layers, Sparkles, MessageSquare, Loader2,
  TrendingUp, BarChart3, Calculator,
  Cloud, CloudOff
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot 
} from 'firebase/firestore';

// --- 獨立的 AI Modal 組件 ---
const AiModal = ({ show, onClose, prompt, setPrompt, onSend, response, loading }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
          <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" /> AI 訂單數據分析
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-slate-50">
          {response ? (
             <div className="prose prose-sm max-w-none bg-white p-6 rounded-xl shadow-sm border border-slate-100">
               <div className="whitespace-pre-wrap leading-relaxed text-slate-700">{response}</div>
             </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>輸入問題，讓 AI 幫您分析當前的訂單數據...</p>
            </div>
          )}
        </div>
        <div className="p-4 bg-white border-t flex gap-2">
          <input 
            type="text" 
            className="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            placeholder="例如：統計本月南泰廠商的出貨總量？"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
            autoFocus
          />
          <button 
            onClick={onSend}
            disabled={loading || !prompt}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
            {loading ? '分析中...' : '送出'}
          </button>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  // --- Gemini API Key ---
  const apiKey = "";

  // --- Firebase Init ---
  const [user, setUser] = useState(null);
  const [dbReady, setDbReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); 

  // --- 您的 Firebase 金鑰設定 (已填入) ---
  const firebaseConfig = {
    apiKey: "AIzaSyDsGgkGsWS4sRIn3o9XzWmqGSbZg4i5Dc9g",
    authDomain: "sa-test-96792.firebaseapp.com",
    projectId: "sa-test-96792",
    storageBucket: "sa-test-96792.firebasestorage.app",
    messagingSenderId: "736271192466",
    appId: "1:736271192466:web:1517c3d40e3e61d1c1b14b",
    measurementId: "G-1X3X3FWSM7"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const appId = 'everise-production-v1'; 

  // --- 核心資料庫 State ---
  const [masterData, setMasterData] = useState([]); 
  const [revenueData, setRevenueData] = useState([]); 
  const [viewMode, setViewMode] = useState('dashboard'); 

  const [activeClient, setActiveClient] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMasterClient, setActiveMasterClient] = useState('ALL');

  // --- 編輯相關狀態 ---
  const [editingId, setEditingId] = useState(null);
  const editValues = useRef({}); 

  // --- AI 助理狀態 ---
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // 客戶設定
  const [clientConfig, setClientConfig] = useState({
    "AP": { startNo: 954, prefix: "AP" },
    "PV": { startNo: 210, prefix: "PV" },
    "DP": { startNo: 423, prefix: "DP" },
    "APS": { startNo: 857, prefix: "APS" }
  });

  const [vendorRules, setVendorRules] = useState([
    { id: 1, keyword: "SANDWICH", vendor: "南泰" },
    { id: 2, keyword: "SPONGE", vendor: "南泰" },
    { id: 3, keyword: "600D", vendor: "龍利達" },
    { id: 4, keyword: "LACOSTE", vendor: "南泰" },
    { id: 5, keyword: "VACUMN", vendor: "龍利達" },
    { id: 6, keyword: "CC", vendor: "南泰" }
  ]);

  // --- Firebase Authentication & Data Sync ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth failed:", err);
      }
    };
    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) setDbReady(true);
    });

    return () => unsubscribeAuth();
  }, []);

  // --- Firebase Data Listeners (Real-time) ---
  useEffect(() => {
    if (!user) return;

    setSyncStatus('syncing');

    // 1. 監聽 Master Data (所有訂單)
    const masterDataRef = collection(db, 'artifacts', appId, 'users', user.uid, 'master_data');
    const unsubMaster = onSnapshot(masterDataRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMasterData(data);
      setSyncStatus('idle');
    }, (error) => {
      console.error("Data sync error:", error);
      setSyncStatus('error');
    });

    // 2. 監聽 Settings (Client Config & Vendor Rules)
    const settingsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config');
    const unsubSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.clientConfig) setClientConfig(data.clientConfig);
      }
      setSyncStatus('idle');
    }, (error) => {
      console.error("Settings sync error:", error);
    });

    return () => {
      unsubMaster();
      unsubSettings();
    };
  }, [user]);

  // --- Firestore Helper Functions ---
  const saveMasterDataRow = async (row) => {
    if (!user) return;
    try {
      const { id, ...data } = row;
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'master_data', id), data);
    } catch (err) {
      console.error("Error saving row:", err);
      setSyncStatus('error');
    }
  };

  const saveClientConfig = async (newConfig) => {
    if (!user) return;
    try {
      setSyncStatus('syncing');
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config'), {
        clientConfig: newConfig
      }, { merge: true });
      setSyncStatus('idle');
    } catch (err) {
      console.error("Error saving config:", err);
      setSyncStatus('error');
    }
  };

  const updateMasterDataRow = async (id, updates) => {
    if (!user) return;
    try {
      setSyncStatus('syncing');
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'master_data', id), updates);
      setSyncStatus('idle');
    } catch (err) {
      console.error("Error updating row:", err);
      setSyncStatus('error');
    }
  };

  const deleteMasterDataRow = async (id) => {
    if (!user) return;
    try {
      setSyncStatus('syncing');
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'master_data', id));
      setSyncStatus('idle');
    } catch (err) {
      console.error("Error deleting row:", err);
      setSyncStatus('error');
    }
  };


  // --- CSV 解析核心 ---
  const parseCSVLine = (line) => {
    const result = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      let char = line[i];
      if (char === '"') inQuote = !inQuote;
      else if (char === ',' && !inQuote) {
        result.push(cur.trim());
        cur = '';
      } else cur += char;
    }
    result.push(cur.trim());
    return result;
  };

  const cleanNumber = (str) => {
    if (!str) return 0;
    const match = str.toString().replace(/[^\d.-]/g, '');
    return match ? parseFloat(match) : 0;
  };

  // 判斷檔案類型的解析器
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setSyncStatus('syncing');

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target.result;
        const rows = text.split(/\r?\n/).filter(r => r.trim());
        if (rows.length < 1) return;

        const headers = parseCSVLine(rows[0]).map(h => h.trim().toLowerCase());
        
        if (headers.includes('請款金額') || headers.includes('客戶總金額') || file.name.includes('營業額')) {
            parseRevenueCSV(file.name, rows, headers);
            return;
        }

        if (headers.includes('client') && (headers.includes('number') || rows[0].includes(',')) && rows[0].length < 50) {
          const newConfig = { ...clientConfig };
          rows.slice(1).forEach(row => {
            const [client, num] = parseCSVLine(row);
            if (client && num) {
              newConfig[client.toUpperCase().trim()] = { startNo: parseInt(num) || 1, prefix: client.toUpperCase().trim() };
            }
          });
          saveClientConfig(newConfig); 
          return;
        }

        parseMasterDataCSV(file, rows, headers);
      };
      reader.readAsText(file);
    });
    e.target.value = '';
  };

  const parseRevenueCSV = (filename, rows, headers) => {
    let year = 0, month = 0;
    const rocMatch = filename.match(/(\d{3})[._](\d{1,2})/);
    if (rocMatch) {
        year = parseInt(rocMatch[1]) + 1911;
        month = parseInt(rocMatch[2]);
    } else {
        const westernYearMatch = filename.match(/20\d{2}/);
        if (westernYearMatch) year = parseInt(westernYearMatch[0]);
        
        const monthMap = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
        const monthNameMatch = filename.toLowerCase().match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
        if (monthNameMatch) month = monthMap[monthNameMatch[1]];
        else {
            const numMonthMatch = filename.match(/[-_ ](\d{1,2})月?/);
            if (numMonthMatch) month = parseInt(numMonthMatch[1]);
        }
    }
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    let clientIdx = -1;
    let amountIdx = -1;
    if (headers.includes('客戶')) {
        clientIdx = headers.indexOf('客戶');
        amountIdx = headers.findIndex(h => h.includes('客戶總金額'));
    } else if (headers.some(h => h.includes('請款金額'))) {
        amountIdx = headers.findIndex(h => h.includes('請款金額'));
        clientIdx = 1; 
    }
    if (amountIdx === -1 || clientIdx === -1) return; 
    let monthlyTotal = 0;
    const clientBreakdown = [];
    rows.slice(1).forEach(row => {
        const cols = parseCSVLine(row);
        if (!cols[clientIdx] || cols[clientIdx].toLowerCase().includes('total') || cols[clientIdx].toLowerCase().includes('er total')) return;
        if (cols[0] && cols[0].toLowerCase().includes('total')) return;
        const clientName = cols[clientIdx].trim();
        const amount = cleanNumber(cols[amountIdx]);
        if (clientName && amount > 0) {
            monthlyTotal += amount;
            clientBreakdown.push({ client: clientName, amount });
        }
    });
    clientBreakdown.sort((a, b) => b.amount - a.amount);
    if (monthlyTotal > 0) {
        setRevenueData(prev => {
            const others = prev.filter(p => p.monthKey !== monthKey);
            return [...others, { monthKey, year, month, total: monthlyTotal, clients: clientBreakdown }].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
        });
        if (viewMode !== 'revenueStats') setViewMode('revenueStats');
    }
  };

  const parseMasterDataCSV = async (file, rows, headers) => {
    const getIdx = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));
    const idx = {
        date: getIdx(['ship date', 'date', '日期', '下單日期']),
        client: getIdx(['client | ลูกค้า', 'client', '客戶', 'ลูกค้า']),
        product: getIdx(['product name', '品名', 'ชื่อสินค้า', 'spec']),
        color: getIdx(['color', '顏色', 'สี', 'item/顏色']),
        orderQty: getIdx(['訂單數量', 'order quantity']), 
        shippedQty: getIdx(['quantity', '數量', 'จำนวน', '實際出貨', '出貨數量']),
        unshipped: getIdx(['未出貨', '訂單未出貨數量', 'balance']),
        price: getIdx(['unit price', '單價', 'ราคา', '客人單價']),
        order: getIdx(['order', '訂單', 'p/o', 'note']),
        cabinet: getIdx(['cabinet', '櫃號', 'c/no']),
        vendor: getIdx(['vendor', '廠商']),
        status: getIdx(['status', '結案', '是否已結案']),
        note: getIdx(['note', '備註'])
    };

    const promises = [];
    
    rows.slice(1).forEach((row, rIdx) => {
        const cols = parseCSVLine(row);
        if (cols.length < 3) return;

        let clientName = cols[idx.client] || (file.name.includes('AP') ? 'AP' : 'Unknown');
        if (file.name.includes('APS')) clientName = 'APS'; 
        
        const productName = cols[idx.product] || '';
        const matchedRule = vendorRules.find(rule => productName.toUpperCase().includes(rule.keyword.toUpperCase()));
        const vendor = idx.vendor !== -1 && cols[idx.vendor] ? cols[idx.vendor] : (matchedRule ? matchedRule.vendor : "待查");

        const data = {
            id: `${file.name}-${rIdx}-${Date.now()}`,
            date: cols[idx.date] || '',
            client: clientName.toUpperCase().trim(),
            product: productName.trim(),
            color: cols[idx.color] || '',
            orderQty: cleanNumber(cols[idx.orderQty]) || cleanNumber(cols[idx.shippedQty]), 
            shippedQty: cleanNumber(cols[idx.shippedQty]),
            unshipped: cleanNumber(cols[idx.unshipped]),
            price: cleanNumber(cols[idx.price]) || cleanNumber(cols[idx.order]?.match(/THB\s*(\d+)/)?.[1]),
            vendor: vendor,
            cabinetNo: cols[idx.cabinet] || '',
            orderNo: cols[idx.order]?.match(/ORD-\d+/) ? cols[idx.order].match(/ORD-\d+/)[0] : (cols[idx.order] || 'N/A'),
            status: cols[idx.status] || '',
            note: cols[idx.note] || '',
            source: file.name,
            timestamp: Date.now()
        };

        promises.push(saveMasterDataRow(data));
    });

    await Promise.all(promises);
    setSyncStatus('idle');
    if (viewMode !== 'revenueStats') setViewMode('dashboard');
  };

  const generateRevenueFromMasterData = () => {
    if (masterData.length === 0) {
        alert("目前沒有訂單資料，請先匯入訂單明細 (Master Data) CSV");
        return;
    }
    const stats = {};
    masterData.forEach(order => {
        if (!order.shippedQty || !order.price) return;
        let dateObj = new Date(order.date);
        if (isNaN(dateObj.getTime())) return;

        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1; 
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        
        if (!stats[monthKey]) {
            stats[monthKey] = { monthKey, year, month, total: 0, clientMap: {} };
        }
        const amount = order.shippedQty * order.price;
        stats[monthKey].total += amount;
        if (!stats[monthKey].clientMap[order.client]) {
            stats[monthKey].clientMap[order.client] = 0;
        }
        stats[monthKey].clientMap[order.client] += amount;
    });

    if (Object.keys(stats).length === 0) {
        alert("無法解析有效日期或金額，請檢查資料格式。");
        return;
    }
    const newRevenueData = Object.values(stats).map(item => {
        const clients = Object.entries(item.clientMap)
            .map(([client, amount]) => ({ client, amount }))
            .sort((a, b) => b.amount - a.amount);
        return { monthKey: item.monthKey, year: item.year, month: item.month, total: item.total, clients };
    }).sort((a, b) => b.monthKey.localeCompare(a.monthKey));

    setRevenueData(newRevenueData);
  };

  const startEditing = (record) => {
    setEditingId(record.id);
    editValues.current = { ...record };
  };

  const handleEditChange = (field, value) => {
    editValues.current[field] = value;
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMasterDataRow(editingId, editValues.current);
    setEditingId(null);
    editValues.current = {};
  };

  const handleDelete = (id) => {
      if(window.confirm("確定要永久刪除此筆資料嗎？")) {
          deleteMasterDataRow(id);
      }
  }

  const sortedClients = useMemo(() => {
    return [...new Set(masterData.map(d => d.client))].sort();
  }, [masterData]);

  const filteredMasterData = useMemo(() => {
    let data = masterData;
    if (activeMasterClient !== 'ALL') {
      data = data.filter(d => d.client === activeMasterClient);
    }
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      data = data.filter(d => 
        d.product.toLowerCase().includes(lowerTerm) || 
        d.orderNo.toLowerCase().includes(lowerTerm) ||
        d.vendor.includes(searchTerm)
      );
    }
    return [...data].sort((a, b) => {
      if (a.client !== b.client) return a.client.localeCompare(b.client);
      return new Date(a.date) - new Date(b.date);
    });
  }, [masterData, activeMasterClient, searchTerm]);

  const groupedInvoices = useMemo(() => {
    const result = {};
    sortedClients.forEach(client => {
      const clientRows = masterData.filter(d => d.client === client && d.shippedQty > 0);
      const dates = [...new Set(clientRows.map(d => d.date))].sort((a, b) => new Date(a) - new Date(b));
      const config = clientConfig[client] || { startNo: 1, prefix: client };
      
      result[client] = dates.map((date, dIdx) => {
        const items = clientRows.filter(r => r.date === date);
        const cabinet = items[0]?.cabinetNo || `${config.prefix}#${config.startNo + dIdx}`;
        return { 
          id: `${client}-${date}`, 
          date, 
          cabinetNo: cabinet, 
          client, 
          items, 
          total: items.reduce((s, i) => s + (i.shippedQty * i.price), 0) 
        };
      });
    });
    return result;
  }, [masterData, clientConfig, sortedClients]);

  // --- Gemini AI (保持不變) ---
  const callGemini = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    setAiResponse('');
    try {
      const dataSummary = filteredMasterData.slice(0, 50).map(d => ({
        date: d.date, client: d.client, product: d.product, qty: d.shippedQty,
      }));
      const revenueSummary = revenueData.slice(0, 6).map(r => 
        `${r.monthKey}: Total ${r.total}, Top Clients: ${r.clients.slice(0,3).map(c=>c.client).join(',')}`
      ).join('; ');
      const systemInstruction = `分析師角色... 資料: ${revenueSummary} \n ${JSON.stringify(dataSummary)}`;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: `${systemInstruction}\n\nQ: ${aiPrompt}` }] }] }) }
      );
      const data = await response.json();
      setAiResponse(data.candidates?.[0]?.content?.parts?.[0]?.text || "No response");
    } catch (e) { setAiResponse(`Error: ${e.message}`); } finally { setIsAiLoading(false); }
  };

  const exportTrackingCSV = () => {
    const headers = ["下單日期", "訂單", "廠商", "品名", "顏色", "訂單數量", "實際出貨", "未出貨", "櫃號", "結案", "備註"];
    const csvRows = [headers.join(",")];
    filteredMasterData.forEach(d => {
      const row = [d.date, d.orderNo, d.vendor, `"${d.product}"`, d.color, d.orderQty, d.shippedQty, d.orderQty - d.shippedQty, d.cabinetNo, d.status, `"${d.note}"`];
      csvRows.push(row.join(","));
    });
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `訂單進度總表_${activeMasterClient}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const StatusIndicator = () => {
    if (syncStatus === 'syncing') return <div className="text-blue-400 flex items-center gap-1 text-xs"><Loader2 className="w-3 h-3 animate-spin" /> 同步中...</div>;
    if (syncStatus === 'error') return <div className="text-red-400 flex items-center gap-1 text-xs"><CloudOff className="w-3 h-3" /> 同步失敗</div>;
    return <div className="text-emerald-400 flex items-center gap-1 text-xs"><Cloud className="w-3 h-3" /> 雲端已備份</div>;
  };

  const Navbar = () => (
    <div className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50 px-6 py-3 flex justify-between items-center print:hidden">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-black text-white tracking-tighter flex items-center gap-2">
          <Database className="w-6 h-6 text-emerald-400" />
          EVERISE <span className="text-xs font-normal text-slate-400">V9.5 Cloud</span>
        </h1>
        <div className="flex bg-slate-800 p-1 rounded-lg overflow-x-auto">
          {[
            { id: 'dashboard', label: 'SA 請款單', icon: LayoutDashboard },
            { id: 'trackingTable', label: '客戶訂單總表', icon: FileSpreadsheet },
            { id: 'masterTable', label: '年度明細管理', icon: TableIcon },
            { id: 'revenueStats', label: '營業額統計', icon: TrendingUp }, 
          ].map(tab => (
            <button key={tab.id} onClick={() => setViewMode(tab.id)} className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${viewMode === tab.id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-3 items-center">
        <StatusIndicator />
        <div className="h-4 w-px bg-slate-700 mx-1"></div>
        <button onClick={() => setShowAiModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors">
          <Sparkles className="w-4 h-4" /> AI 分析
        </button>
        <button onClick={() => setViewMode('settings')} className="p-2 text-slate-400 hover:text-white"><Settings className="w-5 h-5" /></button>
        <label className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg cursor-pointer font-bold text-xs flex items-center gap-2">
          <Upload className="w-4 h-4" /> 匯入 CSV
          <input type="file" accept=".csv" multiple className="hidden" onChange={handleFileUpload} />
        </label>
      </div>
    </div>
  );

  const RevenueStatsView = () => {
    const maxRevenue = Math.max(...revenueData.map(d => d.total), 1);
    return (
        <div className="p-8 max-w-6xl mx-auto min-h-screen bg-slate-50 animate-in fade-in">
            <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                        <TrendingUp className="w-8 h-8 text-emerald-600" /> 年度營業額總表
                    </h2>
                    <p className="text-slate-500 font-bold mt-2">資料來源：雲端 Master Data 自動累計</p>
                </div>
                <div className="flex gap-2">
                   {masterData.length > 0 && (
                     <button onClick={generateRevenueFromMasterData} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-colors">
                       <Calculator className="w-4 h-4" /> 重新計算
                     </button>
                   )}
                </div>
            </div>
            <div className="grid gap-6">
                {revenueData.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                    <BarChart3 className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold">暫無統計數據，請點擊「重新計算」</p>
                  </div>
                ) : (
                  revenueData.map((data) => (
                    <div key={data.monthKey} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                        <div className="p-6 flex flex-col md:flex-row gap-6 items-start">
                            <div className="w-full md:w-48 shrink-0 border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-4">
                                <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">{data.year}</div>
                                <div className="text-4xl font-black text-slate-800">{data.month} <span className="text-lg text-slate-400">月</span></div>
                                <div className="mt-2 text-xl font-black text-emerald-600 flex items-center gap-1">
                                    <span className="text-xs text-emerald-400">THB</span>
                                    {data.total.toLocaleString()}
                                </div>
                                <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden w-full">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(data.total / maxRevenue) * 100}%` }}></div>
                                </div>
                            </div>
                            <div className="flex-1 w-full">
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {data.clients.map((client, idx) => (
                                        <div key={idx} className="flex flex-col bg-slate-50 p-2 rounded border border-slate-100">
                                            <span className="text-xs font-black text-slate-700 truncate">{idx + 1}. {client.client}</span>
                                            <span className="text-sm font-mono text-emerald-600 font-bold">{client.amount.toLocaleString()}</span>
                                            <div className="mt-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${(client.amount / data.total) * 100}%` }}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                  ))
                )}
            </div>
        </div>
    );
  };

  const TrackingTableView = () => (
    <div className="p-6 animate-in fade-in duration-500 min-h-screen bg-white">
      <div className="mb-6 flex justify-between items-center print:hidden">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" /> 客戶訂單進度總表
          </h2>
          <div className="flex flex-wrap gap-2 mt-2">
            {['ALL', ...sortedClients].map(c => (
              <button key={c} onClick={() => setActiveMasterClient(c)} className={`px-3 py-1 rounded border text-xs font-bold ${activeMasterClient === c ? 'bg-slate-900 text-white' : 'bg-white text-slate-500'}`}>{c}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input type="text" placeholder="搜尋..." className="pl-8 pr-4 py-2 border rounded-lg text-sm w-48" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <button onClick={exportTrackingCSV} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Download className="w-4 h-4" /> 匯出</button>
          <button onClick={() => window.print()} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Printer className="w-4 h-4" /> 列印</button>
        </div>
      </div>
      <div className="border border-slate-300 overflow-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-100 sticky top-0 z-10 text-xs font-black text-slate-600 uppercase tracking-wider">
            <tr>
              <th className="p-2 border-b border-r border-slate-300 w-24">下單日期</th>
              <th className="p-2 border-b border-r border-slate-300 w-24">訂單</th>
              <th className="p-2 border-b border-r border-slate-300 w-20">廠商</th>
              <th className="p-2 border-b border-r border-slate-300">品名規格</th>
              <th className="p-2 border-b border-r border-slate-300 w-32">顏色</th>
              <th className="p-2 border-b border-r border-slate-300 w-20 text-right">訂單數</th>
              <th className="p-2 border-b border-r border-slate-300 w-20 text-right">實際出貨</th>
              <th className="p-2 border-b border-r border-slate-300 w-20 text-right">未出貨</th>
              <th className="p-2 border-b border-r border-slate-300 w-20 text-center">櫃號</th>
              <th className="p-2 border-b border-slate-300 w-16 text-center">結案</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredMasterData.map((d, i) => (
              <tr key={d.id} className={`hover:bg-blue-50 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                <td className="p-2 border-r border-slate-200">{d.date}</td>
                <td className="p-2 border-r border-slate-200 font-bold">{d.orderNo}</td>
                <td className="p-2 border-r border-slate-200 text-xs">{d.vendor}</td>
                <td className="p-2 border-r border-slate-200 font-bold text-slate-800">{d.product}</td>
                <td className="p-2 border-r border-slate-200 text-xs">{d.color}</td>
                <td className="p-2 border-r border-slate-200 text-right font-mono">{d.orderQty}</td>
                <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-blue-600">{d.shippedQty}</td>
                <td className="p-2 border-r border-slate-200 text-right font-mono text-red-500 font-bold">{d.orderQty - d.shippedQty !== 0 ? d.orderQty - d.shippedQty : ''}</td>
                <td className="p-2 border-r border-slate-200 text-center text-xs">{d.cabinetNo}</td>
                <td className="p-2 text-center font-bold text-xs">{d.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const MasterTableView = () => (
    <div className="p-6 animate-in fade-in duration-500 min-h-screen bg-slate-50">
      <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><Edit3 className="w-5 h-5 text-blue-600" /> 年度明細編輯 (Master Data)</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
          <input type="text" placeholder="搜尋..." className="pl-9 pr-4 py-2 border rounded-lg text-sm w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[80vh]">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 border-b border-slate-300 sticky top-0 z-10 text-xs font-bold text-slate-600">
              <tr>
                <th className="p-3">日期</th>
                <th className="p-3">客戶</th>
                <th className="p-3">品名 (編輯)</th>
                <th className="p-3">顏色 (編輯)</th>
                <th className="p-3 text-right">出貨量</th>
                <th className="p-3 text-right">單價</th>
                <th className="p-3">廠商 (編輯)</th>
                <th className="p-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMasterData.map(d => (
                <tr key={d.id} className={`hover:bg-blue-50 ${editingId === d.id ? 'bg-yellow-50' : ''}`}>
                  {editingId === d.id ? (
                    <>
                      <td className="p-2"><input className="border rounded p-1 w-full" defaultValue={d.date} onChange={e => handleEditChange('date', e.target.value)} /></td>
                      <td className="p-2 font-bold">{d.client}</td>
                      <td className="p-2"><input className="border rounded p-1 w-full font-bold" autoFocus defaultValue={d.product} onChange={e => handleEditChange('product', e.target.value)} /></td>
                      <td className="p-2"><input className="border rounded p-1 w-full" defaultValue={d.color} onChange={e => handleEditChange('color', e.target.value)} /></td>
                      <td className="p-2"><input className="border rounded p-1 w-full text-right" type="number" defaultValue={d.shippedQty} onChange={e => handleEditChange('shippedQty', parseFloat(e.target.value))} /></td>
                      <td className="p-2"><input className="border rounded p-1 w-full text-right" type="number" defaultValue={d.price} onChange={e => handleEditChange('price', parseFloat(e.target.value))} /></td>
                      <td className="p-2"><input className="border rounded p-1 w-full" defaultValue={d.vendor} onChange={e => handleEditChange('vendor', e.target.value)} /></td>
                      <td className="p-2 text-center flex gap-1 justify-center">
                        <button onClick={saveEdit} className="p-1 bg-green-500 text-white rounded"><CheckCircle2 className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="p-1 bg-slate-300 text-white rounded"><X className="w-4 h-4" /></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 text-slate-500">{d.date}</td>
                      <td className="p-3 font-bold text-blue-600">{d.client}</td>
                      <td className="p-3 font-bold text-slate-800">{d.product}</td>
                      <td className="p-3 text-slate-600">{d.color}</td>
                      <td className="p-3 text-right font-mono">{d.shippedQty}</td>
                      <td className="p-3 text-right font-mono text-emerald-600">{d.price}</td>
                      <td className="p-3 text-slate-400">{d.vendor}</td>
                      <td className="p-3 text-center flex gap-2 justify-center">
                        <button onClick={() => startEditing(d)} className="text-slate-300 hover:text-blue-500"><Edit3 className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(d.id)} className="text-slate-300 hover:text-red-500"><Trash className="w-4 h-4" /></button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const Dashboard = () => (
    <div className="max-w-7xl mx-auto p-12 min-h-screen bg-slate-50">
      {sortedClients.length === 0 ? (
        <div className="text-center py-40 border-4 border-dashed border-slate-200 rounded-3xl">
           <LayoutDashboard className="w-20 h-20 text-slate-300 mx-auto mb-4" />
           <p className="text-slate-400 font-bold text-xl">請先匯入 CSV 資料</p>
        </div>
      ) : (
        sortedClients.map(client => (
          <div key={client} className="mb-20">
            <div className="flex justify-between items-center mb-8 border-b-2 border-slate-200 pb-4">
              <div className="flex items-center gap-4">
                <span className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black text-3xl shadow-lg">{client}</span>
                <h2 className="text-xl font-bold text-slate-400">請款單列表</h2>
              </div>
              <button onClick={() => { setActiveClient(client); setViewMode('printAll'); }} className="bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2 shadow-md hover:bg-emerald-700">
                <Layers className="w-4 h-4" /> 列印本區所有 SA (Print All)
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {groupedInvoices[client].map(inv => (
                <div key={inv.id} onClick={() => { setActiveClient(client); setSelectedInvoiceId(inv.id); setViewMode('preview'); }} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group">
                  <div className="flex justify-between items-start mb-4">
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-xs font-black">{inv.cabinetNo}</span>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-600" />
                  </div>
                  <div className="text-2xl font-black text-slate-800 mb-1">{inv.date}</div>
                  <div className="text-xs text-slate-400 font-bold">{inv.items.length} 筆明細</div>
                  <div className="mt-6 pt-4 border-t border-slate-100 text-right">
                    <span className="text-2xl font-black text-emerald-600">THB {Math.round(inv.total).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );

  // --- Invoice Templates (保持不變) ---
  const InvoiceTemplate = ({ inv }) => (
    <div className="w-[210mm] bg-white p-[15mm] shadow-none min-h-[297mm] flex flex-col font-tnr text-black invoice-page">
      <div className="text-center mb-6 border-b-[3px] border-double border-black pb-4">
        <h1 className="text-4xl font-bold mb-2 tracking-tight uppercase">EVERISE MATERIAL INT'L LTD</h1>
        <div className="flex justify-center gap-6 text-sm font-bold text-black">
          <span>TEL: 886-2-2741-9113</span>
          <span>FAX: 886-2-2727-9021</span>
        </div>
        <p className="text-sm underline font-bold text-black">E-MAIL: e.material2727@gmail.com</p>
        <div className="inline-block border-[3px] border-black px-12 py-2 font-bold text-3xl tracking-[0.2em] mb-2 uppercase text-black mt-4">SHIPPING ADVICE</div>
      </div>
      <div className="grid grid-cols-2 mb-6 text-xl leading-relaxed items-end">
        <div className="space-y-2">
          <div className="flex items-end gap-2 border-b-2 border-black pb-1"><span className="w-16 font-bold text-sm text-black">TO:</span><span className="flex-1 font-bold uppercase text-2xl text-black">{inv.client}</span></div>
          <div className="flex items-end gap-2 border-b-2 border-black pb-1"><span className="w-16 font-bold text-sm text-black">FAX:</span><span className="flex-1"></span></div>
          <div className="flex items-end gap-2 border-b-2 border-black pb-1"><span className="w-16 font-bold text-sm text-black">ATTN:</span><span className="flex-1"></span></div>
        </div>
        <div className="space-y-2 pl-8">
          <div className="flex items-end gap-2 border-b-2 border-black pb-1"><span className="w-20 font-bold text-sm text-black text-right">DATE:</span><span className="flex-1 font-bold text-xl">{inv.date}</span></div>
          <div className="flex items-end gap-2 border-b-2 border-black pb-1"><span className="w-20 font-bold text-sm text-black text-right">C/NO:</span><span className="flex-1 font-bold text-3xl text-black">{inv.cabinetNo}</span></div>
          <div className="flex items-end gap-2 border-b-2 border-black pb-1"><span className="w-20 font-bold text-sm text-black text-right">FROM:</span><span className="flex-1 font-bold text-xl text-center">ER</span></div>
        </div>
      </div>
      <div className="flex-1">
        <table className="w-full border-t-[4px] border-black">
          <tbody className="divide-y-2 divide-black">
            {inv.items.map((item, idx) => (
              <React.Fragment key={idx}>
                <tr>
                  <td colSpan="3" className="pt-6 pb-2">
                    <div className="flex items-baseline gap-4">
                        <span className="font-bold text-3xl leading-none text-black">ORDER "{item.product}"</span>
                    </div>
                  </td>
                </tr>
                <tr className="align-bottom">
                  <td className="w-[35%] py-3 pl-6 text-xl text-black font-bold uppercase">{item.color}</td>
                  <td className="py-3 px-2">
                    <div className="flex items-baseline gap-2 text-lg whitespace-nowrap">
                      <span className="font-bold text-2xl text-black">{item.shippedQty.toLocaleString()} Y</span>
                      <span className="mx-2 text-sm text-black">×</span>
                      <span className="font-bold text-xl text-black">{item.price.toFixed(2)}</span>
                      <span className="ml-4 font-bold text-xl text-black">= THB $</span>
                    </div>
                  </td>
                  <td className="py-3 text-right font-bold text-3xl tabular-nums pr-2 text-black">
                    {(item.shippedQty * item.price).toLocaleString()}
                  </td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
        <div className="mt-10 flex justify-end">
          <div className="w-full border-t-[6px] border-double border-black pt-6 flex justify-between items-baseline px-6 rounded-lg">
            <span className="font-bold text-2xl tracking-tighter uppercase text-black">Total:</span>
            <span className="font-bold text-5xl tabular-nums text-black tracking-tighter">
              THB {Math.round(inv.total).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-16 border-t-4 border-black pt-4 flex justify-between items-center">
        <div className="font-bold underline text-2xl tracking-[0.4em] uppercase text-black px-6 py-1">CASH</div>
        <div className="text-xs font-bold text-black uppercase tracking-widest">Shipping Advice Doc.</div>
      </div>
    </div>
  );

  const PrintAllView = () => (
    <div className="bg-slate-200 min-h-screen py-10 print:bg-white print:p-0 flex flex-col items-center">
      <div className="w-[210mm] mb-6 flex justify-between items-center print:hidden px-4">
        <button onClick={() => setViewMode('dashboard')} className="text-slate-700 flex items-center gap-2 hover:text-blue-700 font-bold"><ArrowLeft className="w-5 h-5" /> 返回儀表板</button>
        <button onClick={() => window.print()} className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-xl"><Printer className="w-5 h-5" /> 列印全部</button>
      </div>
      <div id="print-area">
        {groupedInvoices[activeClient]?.map(inv => (
          <div key={inv.id} className="print-page-break">
            <InvoiceTemplate inv={inv} />
          </div>
        ))}
      </div>
    </div>
  );

  const SingleInvoiceView = () => {
    const list = groupedInvoices[activeClient] || [];
    const inv = list.find(i => i.id === selectedInvoiceId);
    if (!inv) return null;
    return (
      <div className="bg-slate-200 min-h-screen py-10 print:bg-white print:p-0 flex flex-col items-center">
        <div className="w-[210mm] mb-6 flex justify-between items-center print:hidden px-4">
          <button onClick={() => setViewMode('dashboard')} className="text-slate-700 flex items-center gap-2 hover:text-blue-700 font-bold"><ArrowLeft className="w-5 h-5" /> 返回列表</button>
          <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-xl"><Printer className="w-5 h-5" /> 列印此單</button>
        </div>
        <div id="print-area">
          <InvoiceTemplate inv={inv} />
        </div>
      </div>
    );
  };

  const SettingsPanel = () => (
    <div className="max-w-2xl mx-auto p-12">
      <button onClick={() => setViewMode('dashboard')} className="flex items-center gap-3 text-slate-500 mb-8 font-bold"><ArrowLeft className="w-5 h-5" /> 返回</button>
      <div className="bg-white rounded-2xl shadow-lg p-10 border border-slate-200 text-center">
        <Hash className="w-12 h-12 text-blue-500 mx-auto mb-4" />
        <h3 className="text-xl font-black text-slate-800 mb-6">匯入櫃號對照表 (Client Config)</h3>
        <p className="text-slate-400 mb-6">匯入後將自動儲存到雲端，下次開啟無需再次匯入。</p>
        <label className="block w-full py-12 border-2 border-dashed border-blue-200 rounded-xl text-blue-600 font-bold hover:bg-blue-50 transition-all cursor-pointer">
          <Upload className="w-8 h-8 mx-auto mb-2" /> 點此選擇 CSV
          <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFileUpload(e)} />
        </label>
      </div>
    </div>
  );

  return (
    <div className="bg-slate-50 min-h-screen font-sans selection:bg-emerald-100 text-slate-900">
      <Navbar />
      <AiModal show={showAiModal} onClose={() => setShowAiModal(false)} prompt={aiPrompt} setPrompt={setAiPrompt} onSend={callGemini} response={aiResponse} loading={isAiLoading} />
      <main className="pb-40">
        {viewMode === 'dashboard' && <Dashboard />}
        {viewMode === 'masterTable' && <MasterTableView />}
        {viewMode === 'trackingTable' && <TrackingTableView />}
        {viewMode === 'settings' && <SettingsPanel />}
        {viewMode === 'preview' && <SingleInvoiceView />}
        {viewMode === 'printAll' && <PrintAllView />}
        {viewMode === 'revenueStats' && <RevenueStatsView />}
      </main>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
          .bg-slate-200, .bg-slate-50, .shadow-xl, .bg-white { background: white !important; box-shadow: none !important; }
          .print-page-break { page-break-after: always !important; break-after: page !important; min-height: 297mm; }
          .print\\:hidden, nav, button { display: none !important; }
          @page { size: A4; margin: 0; }
        }
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&family=JetBrains+Mono:wght@700;800&display=swap');
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .font-tnr { font-family: 'Times New Roman', Times, serif; }
        body { font-family: 'Noto Sans TC', sans-serif; }
      `}} />
    </div>
  );
};

export default App;