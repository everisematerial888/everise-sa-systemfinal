import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, Upload, Printer, ChevronRight, Hash, 
  ArrowLeft, Settings, Search,
  CheckCircle2, FileSpreadsheet,
  Table as TableIcon, LayoutDashboard, Edit3, X, Trash,
  Download, Database, Layers, Sparkles, MessageSquare, Loader2,
  TrendingUp, DollarSign, Calendar, PieChart, BarChart3, Calculator,
  Cloud, CloudOff, Save, Archive, Plus, Trash2, MapPin, Package, KeyRound,
  RefreshCw, Plane, Warehouse, Filter, AlertTriangle
} from 'lucide-react';

// --- Firebase & Utility Imports (保持原樣) ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';

// --- [新功能] 品名正規化字典 (Normalization Dictionary) ---
// 這裡可以隨時擴充，讓系統認得泰國同事的各種拼法
const ITEM_DICTIONARY = {
  'sandwich270g': 'Sandwich Mesh 270G',
  'sandwich270': 'Sandwich Mesh 270G',
  'sandwichmesh270g': 'Sandwich Mesh 270G',
  'sandwich320g': 'Sandwich Mesh 320G',
  'sandwich320': 'Sandwich Mesh 320G',
  'sandwichmesh320g': 'Sandwich Mesh 320G',
  '210pu': '210D PU Coating',
  // ... 根據你的庫存清單持續增加
};

const normalizeItemName = (name) => {
  if (!name) return "Unknown Item";
  const cleanKey = String(name).toLowerCase().replace(/\s+/g, '');
  return ITEM_DICTIONARY[cleanKey] || name.trim();
};

// --- [核心功能升級] 智慧數量解析大腦 (Data Sanitizer) ---
const parseQuantity = (rawQtyStr, productName) => {
  if (!rawQtyStr) return { display: '', value: 0 };
  let str = String(rawQtyStr).trim().toUpperCase();

  // 1. 處理算式筆記本邏輯 (例如 50*23R+30Y=1180Y)
  if (str.includes('=')) {
    const parts = str.split('=');
    str = parts[parts.length - 1]; // 只取等號後面的結果
  }

  // 2. 清除單位與非數字 (Y, R, B/Y...)
  const cleanNum = str.replace(/[^0-9.-]/g, '');
  const value = parseFloat(cleanNum) || 0;

  // 3. 生成顯示格式 (維持 SA 原本需要的 50*NR 邏輯)
  let yPerRoll = 50; 
  const pName = (productName || '').toUpperCase();
  if (pName.includes('210 PU')) yPerRoll = 150;
  else if (/(CHACK FACE|KEVLAR|LACOSTE|VACUUM|CHECKER|385|305)/.test(pName)) yPerRoll = 40;

  let display = '';
  if (value > 0 && !String(rawQtyStr).includes('*')) {
      const rolls = Math.floor(value / yPerRoll);
      const remainder = value % yPerRoll;
      if (rolls > 0) {
          display = `${yPerRoll}*${rolls}R`;
          if (remainder > 0) display += `+${remainder}`;
          display += `=${value}Y`;
      } else display = `${value}Y`;
  } else {
      display = String(rawQtyStr);
  }

  return { display, value };
};

// --- Firebase Config (保持原樣) ---
const firebaseConfig = {
  apiKey: "AIzaSyDsGkGsWS4sRIn3o9XzWmqGSbZg4i5Dc9g",
  authDomain: "sa-test-96792.firebaseapp.com",
  projectId: "sa-test-96792",
  storageBucket: "sa-test-96792.firebasestorage.app",
  messagingSenderId: "736271192466",
  appId: "1:736271192466:web:1517c3d40e3e61d1c1b14b"
};

const App = () => {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const [user, setUser] = useState(null);
  const [masterData, setMasterData] = useState([]); // 包含出貨、進貨、期初
  const [viewMode, setViewMode] = useState('dashboard');
  const [isUploading, setIsUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 篩選與設定 (保持原樣)
  const [filterMonth, setFilterMonth] = useState('ALL');
  const [filterOrigin, setFilterOrigin] = useState('ALL');
  const [activeMasterClient, setActiveMasterClient] = useState('ALL');
  const [clientConfig, setClientConfig] = useState({});

  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error("Auth Error:", err));
    return onAuthStateChanged(auth, u => setUser(u));
  }, []);

  useEffect(() => {
    if (!user) return;
    const masterRef = collection(db, 'everise_system', 'shared', 'master_data');
    return onSnapshot(masterRef, (snap) => {
      setMasterData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [user]);

  // --- [核心功能升級] 動態庫存計算機 ---
  const stockLevels = useMemo(() => {
    const summary = {};
    masterData.forEach(d => {
      const itemKey = `${normalizeItemName(d.product)}|${(d.color || '').trim()}`;
      if (!summary[itemKey]) summary[itemKey] = { initial: 0, inbound: 0, outbound: 0 };
      
      const qty = parseFloat(d.shippedQty) || 0;
      if (d.dataType === 'initial') summary[itemKey].initial += qty;
      else if (d.dataType === 'inbound') summary[itemKey].inbound += qty;
      else summary[itemKey].outbound += qty;
    });
    return summary;
  }, [masterData]);

  // --- [核心功能升級] 智慧檔案匯入 ---
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setIsUploading(true);

    try {
      for (const file of files) {
        const text = await file.text();
        const rows = text.split(/\r?\n/).filter(r => r.trim());
        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());

        // 判定資料類型
        let dataType = 'outbound'; 
        if (file.name.includes('進貨') || headers.includes('進貨')) dataType = 'inbound';
        if (file.name.includes('庫存總覽') || headers.includes('期初')) dataType = 'initial';

        const getIdx = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));
        const idx = {
          date: getIdx(['date', '日期']), 
          client: getIdx(['client', '客戶']),
          product: getIdx(['product', '品名', 'spec']), 
          color: getIdx(['color', '顏色']),
          shipped: getIdx(['quantity', '數量', '出貨']), 
          price: getIdx(['price', '單價']),
          cabinet: getIdx(['cabinet', '櫃號'])
        };

        const batch = writeBatch(db);
        rows.slice(1).forEach((row, rIdx) => {
          const cols = row.split(',').map(c => c.replace(/"/g, '').trim());
          if (cols.length < 3) return;

          const pName = normalizeItemName(cols[idx.product]);
          const { value, display } = parseQuantity(cols[idx.shipped], pName);

          const docRef = doc(collection(db, 'everise_system', 'shared', 'master_data'));
          batch.set(docRef, {
            date: cols[idx.date] || '',
            client: (cols[idx.client] || 'FACTORY').toUpperCase(),
            product: pName,
            color: cols[idx.color] || '',
            shippedQty: value,
            shippedDisplay: display,
            price: parseFloat(cols[idx.price]) || 0,
            cabinetNo: cols[idx.cabinet] || '',
            dataType: dataType,
            origin: file.name.includes('china') ? 'China' : 'ER',
            source: file.name,
            timestamp: Date.now()
          });
        });
        await batch.commit();
      }
      alert("✅ 數據匯入完成，已自動清洗品名與數量");
    } catch (e) { alert("上傳失敗: " + e.message); }
    finally { setIsUploading(false); }
  };

  // --- UI 組件：庫存總表 (Tracking Table) 升級版 ---
  const TrackingTableView = () => (
    <div className="p-6 animate-in fade-in bg-white min-h-screen">
      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-emerald-600" /> 客戶訂單與動態庫存總表
        </h2>
      </div>
      
      <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider">
            <tr>
              <th className="p-3">日期</th>
              <th className="p-3">客戶</th>
              <th className="p-3">品名規格 (自動正規化)</th>
              <th className="p-3">顏色</th>
              <th className="p-3 text-right">出貨碼數</th>
              <th className="p-3 text-center bg-slate-800">當前真實庫存殘餘</th>
              <th className="p-3 text-center">櫃號</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {masterData.filter(d => d.dataType === 'outbound').map((d) => {
              const itemKey = `${d.product}|${(d.color || '').trim()}`;
              const stock = stockLevels[itemKey] || { initial: 0, inbound: 0, outbound: 0 };
              const currentBalance = stock.initial + stock.inbound - stock.outbound;

              return (
                <tr key={d.id} className="hover:bg-blue-50">
                  <td className="p-3 text-slate-400">{d.date}</td>
                  <td className="p-3 font-black">{d.client}</td>
                  <td className="p-3 font-bold text-slate-800 font-tnr">{d.product}</td>
                  <td className="p-3">{d.color}</td>
                  <td className="p-3 text-right font-mono text-blue-600 font-bold">{d.shippedDisplay || d.shippedQty}</td>
                  <td className="p-3 text-center">
                    <span className={`px-4 py-1 rounded-full font-black font-mono text-lg shadow-inner ${
                      currentBalance < 0 ? 'bg-red-100 text-red-600' : 
                      currentBalance < 500 ? 'bg-orange-100 text-orange-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      {currentBalance.toLocaleString()} Y
                      {currentBalance < 0 && <AlertTriangle className="inline w-4 h-4 ml-1 mb-1" />}
                    </span>
                  </td>
                  <td className="p-3 text-center font-bold text-blue-500">{d.cabinetNo || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // --- 其他視圖、Navbar 等保持你原始程式碼的樣式 (省略部分重複內容以節省空間) ---
  // ... (保留 Navbar, Dashboard, InvoiceTemplate 等邏輯) ...

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      {/* 你的 Navbar */}
      <div className="bg-slate-900 px-6 py-3 flex justify-between items-center text-white sticky top-0 z-50">
        <h1 className="text-xl font-black flex items-center gap-2"><Database className="text-emerald-400" /> EVERISE</h1>
        <div className="flex gap-2">
            <button onClick={() => setViewMode('dashboard')} className={`px-4 py-2 rounded-lg text-xs font-bold ${viewMode === 'dashboard' ? 'bg-emerald-600' : ''}`}>請款單</button>
            <button onClick={() => setViewMode('trackingTable')} className={`px-4 py-2 rounded-lg text-xs font-bold ${viewMode === 'trackingTable' ? 'bg-emerald-600' : ''}`}>訂單與庫存</button>
            <label className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg cursor-pointer text-xs font-bold flex items-center gap-2">
                <Upload className="w-3 h-3" /> 匯出/進貨 CSV
                <input type="file" multiple className="hidden" onChange={handleFileUpload} />
            </label>
        </div>
      </div>

      <main className="p-6">
        {viewMode === 'dashboard' && <h2 className="p-20 text-center text-slate-400 italic font-tnr">請參考原有的請款單儀表板...</h2>}
        {viewMode === 'trackingTable' && <TrackingTableView />}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print { .print\\:hidden { display: none !important; } }
        .font-tnr { font-family: 'Times New Roman', Times, serif; }
      `}} />
    </div>
  );
};

export default App;