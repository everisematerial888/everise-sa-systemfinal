import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, Upload, Printer, ChevronRight, Hash, 
  ArrowLeft, Settings, Search,
  CheckCircle2, FileSpreadsheet,
  Table as TableIcon, LayoutDashboard, Edit3, X, Trash,
  Download, Database, Layers, Sparkles, MessageSquare, Loader2,
  TrendingUp, DollarSign, Calendar, PieChart, BarChart3, Calculator,
  Cloud, CloudOff, Save, Archive, Plus, Trash2, MapPin, Package, KeyRound
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, writeBatch
} from 'firebase/firestore';

// --- 設定區：請在此填入您的 Firebase 設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyDsGkGsWS4sRIn3o9XzWmqGSbZg4i5Dc9g",
  authDomain: "sa-test-96792.firebaseapp.com",
  projectId: "sa-test-96792",
  storageBucket: "sa-test-96792.firebasestorage.app",
  messagingSenderId: "736271192466",
  appId: "1:736271192466:web:1517c3d40e3e61d1c1b14b",
  measurementId: "G-1X3X3FWSM7"
};

const apiKeyDefault = ""; 

// --- 獨立的 AI Modal 組件 ---
const AiModal = ({ show, onClose, prompt, setPrompt, onSend, response, loading, hasKey }) => {
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
          {!hasKey && (
            <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex gap-2 items-start">
              <KeyRound className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-bold">尚未設定 Gemini API Key</p>
                <p>請前往「設定」頁面輸入您的 API Key 才能使用 AI 分析功能。</p>
              </div>
            </div>
          )}
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
            className="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:bg-slate-100"
            placeholder="例如：統計本月南泰廠商的出貨總量？"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && hasKey && onSend()}
            disabled={!hasKey}
            autoFocus
          />
          <button 
            onClick={onSend}
            disabled={loading || !prompt || !hasKey}
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

// --- Manual Revenue Modal ---
const ManualRevenueModal = ({ show, onClose, onSave }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [client, setClient] = useState('');
    const [cabinetNo, setCabinetNo] = useState('');
    const [amount, setAmount] = useState('');
    const [source, setSource] = useState('China');
    const [note, setNote] = useState('');

    if (!show) return null;

    const handleSubmit = () => {
        if (!amount || !client || !date) {
            alert("請填寫完整資訊 (日期、客戶、金額)");
            return;
        }
        onSave({ 
            date, 
            client: client.toUpperCase(), 
            cabinetNo: cabinetNo || 'N/A',
            amount: parseFloat(amount), 
            source, 
            note 
        });
        setClient('');
        setCabinetNo('');
        setAmount('');
        setNote('');
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-emerald-600" /> 新增額外營收
                    </h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">出貨日期</label>
                            <input type="date" className="w-full border rounded-lg px-3 py-2 font-mono" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-slate-500 mb-1">出貨來源</label>
                             <select className="w-full border rounded-lg px-3 py-2 bg-slate-50" value={source} onChange={e => setSource(e.target.value)}>
                                 <option value="China">China (中國直送)</option>
                                 <option value="Warehouse">Warehouse (倉庫)</option>
                                 <option value="Other">Other (其他)</option>
                             </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">客戶名稱</label>
                            <input type="text" className="w-full border rounded-lg px-3 py-2 font-bold uppercase" value={client} onChange={e => setClient(e.target.value)} placeholder="例如：APS" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">客戶櫃號/單號</label>
                            <input type="text" className="w-full border rounded-lg px-3 py-2" value={cabinetNo} onChange={e => setCabinetNo(e.target.value)} placeholder="例如：SRR#114" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">出貨金額 (THB)</label>
                        <input type="number" className="w-full border rounded-lg px-3 py-2 font-mono text-xl text-emerald-600 font-bold bg-emerald-50 border-emerald-200" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">備註 (來源說明)</label>
                        <input type="text" className="w-full border rounded-lg px-3 py-2" value={note} onChange={e => setNote(e.target.value)} placeholder="例如：C4 SHINY" />
                    </div>
                </div>
                <div className="mt-8 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-3 rounded-lg font-bold text-slate-500 hover:bg-slate-100">關閉</button>
                    <button onClick={handleSubmit} className="flex-[2] py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200">儲存並新增下一筆</button>
                </div>
            </div>
        </div>
    );
};

const App = () => {
  // --- Firebase Init ---
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const appId = 'default-app-id'; 

  // --- State ---
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [masterData, setMasterData] = useState([]); 
  const [manualRevenueData, setManualRevenueData] = useState([]); 
  const [revenueData, setRevenueData] = useState([]); 
  const [viewMode, setViewMode] = useState('dashboard'); 
  const [activeClient, setActiveClient] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMasterClient, setActiveMasterClient] = useState('ALL');
  const [editingId, setEditingId] = useState(null);
  const editValues = useRef({}); 

  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('everise_gemini_key') || '');
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false); 

  const [clientConfig, setClientConfig] = useState({
    "AP": { startNo: 954, prefix: "AP" },
    "PV": { startNo: 210, prefix: "PV" },
    "DP": { startNo: 423, prefix: "DP" },
    "APS": { startNo: 857, prefix: "APS" }
  });

  const [vendorRules] = useState([
    { id: 1, keyword: "SANDWICH", vendor: "南泰" },
    { id: 2, keyword: "SPONGE", vendor: "南泰" },
    { id: 3, keyword: "600D", vendor: "龍利達" },
    { id: 4, keyword: "LACOSTE", vendor: "南泰" },
    { id: 5, keyword: "VACUMN", vendor: "龍利達" },
    { id: 6, keyword: "CC", vendor: "南泰" }
  ]);

  // --- Auth & Data Sync ---
  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error("Auth Error:", err));
    return onAuthStateChanged(auth, u => setUser(u));
  }, [auth]);

  useEffect(() => {
    if (!user) return;
    setSyncStatus('syncing');
    const masterRef = collection(db, 'artifacts', appId, 'users', user.uid, 'master_data');
    const unsubMaster = onSnapshot(masterRef, (snap) => {
      setMasterData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setSyncStatus('idle');
    });

    const settingsRef = doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config');
    const unsubSettings = onSnapshot(settingsRef, (snap) => {
      if (snap.exists() && snap.data().clientConfig) setClientConfig(snap.data().clientConfig);
    });

    const revRef = collection(db, 'artifacts', appId, 'users', user.uid, 'manual_revenue');
    const unsubRev = onSnapshot(revRef, (snap) => {
        setManualRevenueData(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubMaster(); unsubSettings(); unsubRev(); };
  }, [user, db, appId]);

  // --- Actions ---
  const saveMasterDataRow = async (row) => {
    const { id, ...data } = row;
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'master_data', id), data);
  };

  const updateMasterDataRow = async (id, updates) => {
    await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'master_data', id), updates);
  };

  const deleteMasterDataRow = async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'master_data', id));
  };

  const deleteBatchBySource = async (sourceName) => {
      if (!window.confirm(`警告：確定刪除來自 "${sourceName}" 的所有資料？`)) return;
      setSyncStatus('syncing');
      const targets = masterData.filter(d => d.source === sourceName);
      for (let i = 0; i < targets.length; i += 400) {
          const batch = writeBatch(db);
          targets.slice(i, i + 400).forEach(d => {
              batch.delete(doc(db, 'artifacts', appId, 'users', user.uid, 'master_data', d.id));
          });
          await batch.commit();
      }
      setSyncStatus('idle');
  };

  const addManualRevenue = async (data) => {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'manual_revenue'), { ...data, timestamp: Date.now() });
  };

  const deleteManualRevenue = async (id) => {
      if(window.confirm("確定刪除此筆營收紀錄？")) await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'manual_revenue', id));
  };

  const cleanNumber = (str) => {
    if (!str) return 0;
    const match = str.toString().replace(/[^\d.-]/g, '');
    return match ? parseFloat(match) : 0;
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const rows = event.target.result.split(/\r?\n/).filter(r => r.trim());
        if (rows.length < 1) return;
        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
        
        // 判斷是否為設定檔
        if (headers.includes('client') && headers.includes('number')) {
            const newConfig = { ...clientConfig };
            rows.slice(1).forEach(r => {
                const [c, n] = r.split(',');
                if (c && n) newConfig[c.toUpperCase().trim()] = { startNo: parseInt(n) || 1, prefix: c.toUpperCase().trim() };
            });
            await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config'), { clientConfig: newConfig }, { merge: true });
            return;
        }

        // 解析訂單數據
        const getIdx = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));
        const idx = {
            date: getIdx(['date', '日期']), client: getIdx(['client', '客戶']),
            product: getIdx(['product', '品名', 'spec']), color: getIdx(['color', '顏色']),
            shipped: getIdx(['quantity', '數量', '出貨']), price: getIdx(['price', '單價']),
            cabinet: getIdx(['cabinet', '櫃號']), order: getIdx(['order', '訂單']),
            status: getIdx(['status', '結案']), note: getIdx(['note', '備註'])
        };

        const promises = rows.slice(1).map((row, rIdx) => {
            const cols = row.split(',').map(c => c.replace(/^"|"$/g, '').trim());
            const productName = cols[idx.product] || '';
            const matched = vendorRules.find(rule => productName.toUpperCase().includes(rule.keyword));
            return saveMasterDataRow({
                id: `${file.name}-${rIdx}-${Date.now()}`,
                date: cols[idx.date] || '',
                client: (cols[idx.client] || 'UNKNOWN').toUpperCase(),
                product: productName,
                color: cols[idx.color] || '',
                shippedQty: cleanNumber(cols[idx.shipped]),
                price: cleanNumber(cols[idx.price]),
                vendor: matched ? matched.vendor : "待查",
                cabinetNo: cols[idx.cabinet] || '',
                orderNo: cols[idx.order] || 'N/A',
                status: cols[idx.status] || '',
                note: cols[idx.note] || '',
                source: file.name,
                timestamp: Date.now()
            });
        });
        await Promise.all(promises);
        setViewMode('dashboard');
      };
      reader.readAsText(file);
    });
  };

  // --- Revenue Logic ---
  useEffect(() => {
    const stats = {};
    const process = (date, client, amount, source) => {
        const d = new Date(date);
        if (isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (!stats[key]) stats[key] = { monthKey: key, year: d.getFullYear(), month: d.getMonth() + 1, total: 0, warehouseTotal: 0, chinaTotal: 0, otherTotal: 0, clientMap: {} };
        const m = stats[key];
        m.total += amount;
        if (source === 'Warehouse') m.warehouseTotal += amount;
        else if (source === 'China') m.chinaTotal += amount;
        else m.otherTotal += amount;
        if (!m.clientMap[client]) m.clientMap[client] = { total: 0, sources: {} };
        m.clientMap[client].total += amount;
        m.clientMap[client].sources[source] = (m.clientMap[client].sources[source] || 0) + amount;
    };

    masterData.forEach(d => process(d.date, d.client, d.shippedQty * d.price, "Warehouse"));
    manualRevenueData.forEach(d => process(d.date, d.client, d.amount, d.source || "China"));

    setRevenueData(Object.values(stats).map(m => ({
        ...m, clients: Object.entries(m.clientMap).map(([client, data]) => ({ client, amount: data.total, sources: data.sources })).sort((a,b) => b.amount - a.amount)
    })).sort((a,b) => b.monthKey.localeCompare(a.monthKey)));
  }, [masterData, manualRevenueData]);

  // --- AI ---
  const callGemini = async () => {
    const keyToUse = userApiKey || apiKeyDefault;
    if (!aiPrompt.trim() || !keyToUse) return;
    setIsAiLoading(true);
    try {
      const dataSummary = filteredMasterData.slice(0, 50).map(d => ({ date: d.date, client: d.client, product: d.product, qty: d.shippedQty, price: d.price }));
      const revenueSummary = revenueData.slice(0, 6).map(r => `${r.monthKey}: ${r.total} THB`).join('\n');
      const systemPrompt = `您是專業分析師。單位均為泰銖(THB)。營收摘要：\n${revenueSummary}\n明細參考：${JSON.stringify(dataSummary)}`;
      
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${keyToUse}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\n\n問題：${aiPrompt}` }] }] })
      });
      const data = await res.json();
      setAiResponse(data.candidates?.[0]?.content?.parts?.[0]?.text || "無回應");
    } catch (e) { setAiResponse("錯誤：" + e.message); }
    finally { setIsAiLoading(false); }
  };

  // --- Computed ---
  const sortedClients = useMemo(() => [...new Set(masterData.map(d => d.client))].sort(), [masterData]);
  const filteredMasterData = useMemo(() => {
    let d = masterData;
    if (activeMasterClient !== 'ALL') d = d.filter(x => x.client === activeMasterClient);
    if (searchTerm) d = d.filter(x => x.product.toLowerCase().includes(searchTerm.toLowerCase()) || x.orderNo.toLowerCase().includes(searchTerm.toLowerCase()));
    return d.sort((a,b) => new Date(a.date) - new Date(b.date));
  }, [masterData, activeMasterClient, searchTerm]);

  const groupedInvoices = useMemo(() => {
    const res = {};
    sortedClients.forEach(c => {
        const rows = masterData.filter(d => d.client === c && d.shippedQty > 0);
        const dates = [...new Set(rows.map(r => r.date))].sort();
        res[c] = dates.map((date, idx) => {
            const items = rows.filter(r => r.date === date);
            const conf = clientConfig[c] || { startNo: 1, prefix: c };
            return { id: `${c}-${date}`, date, cabinetNo: items[0]?.cabinetNo || `${conf.prefix}#${conf.startNo + idx}`, client: c, items, total: items.reduce((s, i) => s + (i.shippedQty * i.price), 0) };
        });
    });
    return res;
  }, [masterData, clientConfig, sortedClients]);

  // --- UI Components ---
  const Navbar = () => (
    <div className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50 px-6 py-3 flex justify-between items-center print:hidden">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-black text-white flex items-center gap-2"><Database className="w-6 h-6 text-emerald-400" /> EVERISE</h1>
        <div className="flex bg-slate-800 p-1 rounded-lg">
          {[
            { id: 'dashboard', label: 'SA 請款單', icon: LayoutDashboard },
            { id: 'trackingTable', label: '客戶訂單總表', icon: FileSpreadsheet },
            { id: 'masterTable', label: '年度明細管理', icon: TableIcon },
            { id: 'revenueStats', label: '營業額統計', icon: TrendingUp }, 
            { id: 'dataManagement', label: '資料來源管理', icon: Archive },
          ].map(tab => (
            <button key={tab.id} onClick={() => setViewMode(tab.id)} className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${viewMode === tab.id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-3 items-center">
        <button onClick={() => setShowAiModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-colors"><Sparkles className="w-4 h-4" /> AI 分析</button>
        <button onClick={() => setViewMode('settings')} className="p-2 text-slate-400 hover:text-white"><Settings className="w-5 h-5" /></button>
        <label className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg cursor-pointer font-bold text-xs flex items-center gap-2">
          <Upload className="w-4 h-4" /> 匯入 CSV
          <input type="file" accept=".csv" multiple className="hidden" onChange={handleFileUpload} />
        </label>
      </div>
    </div>
  );

  const InvoiceTemplate = ({ inv }) => (
    <div className="w-[210mm] bg-white p-[15mm] min-h-[297mm] flex flex-col font-tnr text-black invoice-page mx-auto">
      <div className="text-center mb-6 border-b-[3px] border-double border-black pb-4">
        <h1 className="text-4xl font-bold mb-2 uppercase">EVERISE MATERIAL INT'L LTD</h1>
        <p className="text-sm font-bold">TEL: 886-2-2741-9113 | FAX: 886-2-2727-9021</p>
        <p className="text-sm underline font-bold">E-MAIL: e.material2727@gmail.com</p>
        <div className="inline-block border-[3px] border-black px-12 py-2 font-bold text-3xl mt-4">SHIPPING ADVICE</div>
      </div>
      <div className="grid grid-cols-2 mb-6 text-xl">
        <div className="space-y-2">
          <div className="border-b-2 border-black pb-1"><span className="font-bold text-sm mr-2">TO:</span><span className="font-bold uppercase text-2xl">{inv.client}</span></div>
          <div className="border-b-2 border-black pb-1"><span className="font-bold text-sm mr-2">FAX:</span></div>
        </div>
        <div className="space-y-2 pl-8">
          <div className="border-b-2 border-black pb-1 flex justify-between"><span>DATE:</span><span className="font-bold">{inv.date}</span></div>
          <div className="border-b-2 border-black pb-1 flex justify-between"><span>C/NO:</span><span className="font-bold text-2xl">{inv.cabinetNo}</span></div>
        </div>
      </div>
      <table className="w-full border-t-[4px] border-black">
        <tbody className="divide-y-2 divide-black">
          {inv.items.map((item, idx) => (
            <React.Fragment key={idx}>
              <tr><td colSpan="3" className="pt-6 pb-2 font-bold text-2xl">ORDER "{item.product}"</td></tr>
              <tr className="text-xl">
                <td className="w-1/3 py-2 font-bold uppercase">{item.color}</td>
                <td className="py-2 text-center">{item.shippedQty} Y x {item.price.toFixed(2)} = THB</td>
                <td className="py-2 text-right font-bold text-2xl">{(item.shippedQty * item.price).toLocaleString()}</td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div className="mt-10 border-t-[6px] border-double border-black pt-6 flex justify-between items-baseline px-4">
        <span className="font-bold text-2xl">TOTAL:</span>
        <span className="font-bold text-5xl">THB {Math.round(inv.total).toLocaleString()}</span>
      </div>
      <div className="mt-auto border-t-4 border-black pt-4 flex justify-between">
        <div className="font-bold underline text-2xl tracking-widest uppercase">CASH</div>
        <div className="text-xs font-bold uppercase">Shipping Advice Doc.</div>
      </div>
    </div>
  );

  // --- Main Render Logic ---
  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <AiModal show={showAiModal} onClose={() => setShowAiModal(false)} prompt={aiPrompt} setPrompt={setAiPrompt} onSend={callGemini} response={aiResponse} loading={isAiLoading} hasKey={!!userApiKey} />
      <ManualRevenueModal show={showRevenueModal} onClose={() => setShowRevenueModal(false)} onSave={addManualRevenue} />
      
      <main className="p-6">
        {viewMode === 'dashboard' && (
            <div className="max-w-7xl mx-auto space-y-12">
                {sortedClients.map(c => (
                    <div key={c}>
                        <h2 className="text-3xl font-black mb-6 flex items-center gap-4">
                            <span className="bg-slate-900 text-white px-4 py-1 rounded-lg">{c}</span>
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {groupedInvoices[c]?.map(inv => (
                                <div key={inv.id} onClick={() => { setActiveClient(c); setSelectedInvoiceId(inv.id); setViewMode('preview'); }} className="bg-white p-6 rounded-2xl shadow-sm border hover:shadow-lg cursor-pointer transition-all">
                                    <div className="flex justify-between mb-4"><span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">{inv.cabinetNo}</span><ChevronRight className="w-4 h-4 text-slate-300"/></div>
                                    <div className="text-xl font-black">{inv.date}</div>
                                    <div className="mt-4 text-right text-emerald-600 font-black text-xl">THB {Math.round(inv.total).toLocaleString()}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )}

        {viewMode === 'revenueStats' && (
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-black">年度營業額統計</h2>
                    <button onClick={() => setShowRevenueModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Plus className="w-4 h-4"/>新增營收</button>
                </div>
                {revenueData.map(r => (
                    <div key={r.monthKey} className="bg-white p-6 rounded-2xl shadow-sm border grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div>
                            <div className="text-slate-400 font-bold">{r.year}</div>
                            <div className="text-4xl font-black">{r.month} 月</div>
                            <div className="text-emerald-600 font-black text-xl mt-2">THB {r.total.toLocaleString()}</div>
                        </div>
                        <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {r.clients.map(c => (
                                <div key={c.client} className="bg-slate-50 p-3 rounded-lg border">
                                    <div className="text-xs font-bold text-slate-500 truncate">{c.client}</div>
                                    <div className="font-bold text-emerald-600">{c.amount.toLocaleString()}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        )}

        {viewMode === 'preview' && (
            <div className="py-10 bg-slate-200 min-h-screen">
                <div className="max-w-[210mm] mx-auto mb-6 flex justify-between print:hidden">
                    <button onClick={() => setViewMode('dashboard')} className="font-bold flex items-center gap-2"><ArrowLeft/>返回</button>
                    <button onClick={() => window.print()} className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"><Printer/>列印</button>
                </div>
                <div id="print-area">
                    <InvoiceTemplate inv={(groupedInvoices[activeClient] || []).find(i => i.id === selectedInvoiceId)} />
                </div>
            </div>
        )}

        {viewMode === 'masterTable' && (
            <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b font-bold text-xs">
                        <tr><th className="p-3">日期</th><th className="p-3">客戶</th><th className="p-3">品名</th><th className="p-3 text-right">出貨量</th><th className="p-3 text-right">單價</th><th className="p-3 text-center">操作</th></tr>
                    </thead>
                    <tbody className="text-sm divide-y">
                        {filteredMasterData.map(d => (
                            <tr key={d.id} className="hover:bg-slate-50">
                                <td className="p-3">{d.date}</td><td className="p-3 font-bold">{d.client}</td><td className="p-3">{d.product}</td>
                                <td className="p-3 text-right">{d.shippedQty}</td><td className="p-3 text-right">{d.price}</td>
                                <td className="p-3 text-center">
                                    <button onClick={() => deleteMasterDataRow(d.id)} className="text-red-400 hover:text-red-600"><Trash className="w-4 h-4"/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
        
        {viewMode === 'settings' && (
            <div className="max-w-md mx-auto space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border">
                    <h3 className="font-black mb-4 flex items-center gap-2"><KeyRound className="text-purple-600"/> Gemini API Key</h3>
                    <input type="password" value={userApiKey} onChange={e => { setUserApiKey(e.target.value); localStorage.setItem('everise_gemini_key', e.target.value); }} className="w-full border p-2 rounded bg-slate-50" placeholder="貼上 API Key"/>
                </div>
            </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; }
          @page { size: A4; margin: 0; }
        }
        .font-tnr { font-family: 'Times New Roman', serif; }
      `}} />
    </div>
  );
};

export default App;