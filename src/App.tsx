import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, Upload, Printer, ChevronRight, Hash, 
  ArrowLeft, Settings, Search,
  CheckCircle2, FileSpreadsheet,
  Table as TableIcon, LayoutDashboard, Edit3, X, Trash,
  Download, Database, Layers, Sparkles, MessageSquare, Loader2,
  TrendingUp, DollarSign, Calendar, PieChart, BarChart3, Calculator,
  Cloud, CloudOff, Save, Archive, Plus, Trash2, MapPin, Package, KeyRound,
  RefreshCw, Plane, Warehouse, DownloadCloud
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, query, orderBy, where, getDocs
} from 'firebase/firestore';

// --- 動態載入 html2pdf.js (用於批次下載 PDF) ---
const loadHtml2Pdf = () => {
  return new Promise((resolve, reject) => {
    if ((window as any).html2pdf) return resolve((window as any).html2pdf);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => resolve((window as any).html2pdf);
    script.onerror = () => reject(new Error('無法載入 PDF 套件'));
    document.head.appendChild(script);
  });
};

// --- 設定區：Firebase 設定 ---
const firebaseConfig = {
  apiKey: "AIzaSyDsGkGsWS4sRIn3o9XzWmqGSbZg4i5Dc9g",
  authDomain: "sa-test-96792.firebaseapp.com",
  projectId: "sa-test-96792",
  storageBucket: "sa-test-96792.firebasestorage.app",
  messagingSenderId: "736271192466",
  appId: "1:736271192466:web:1517c3d40e3e61d1c1b14b",
  measurementId: "G-1X3X3FWSM7"
};
const apiKeyDefault = "AIzaSyD6v4BGNqEzJwAUlSmijajj_jUU715wnXc"; 

// --- 預設的客戶櫃號設定 ---
const DEFAULT_CLIENT_CONFIG = {
  "AP": { startNo: 955, prefix: "AP" },
  "APS": { startNo: 858, prefix: "APS" },
  "CCHHH": { startNo: 138, prefix: "CCHHH" },
  "CH": { startNo: 276, prefix: "CH" },
  "CL": { startNo: 300, prefix: "CL" },
  "CS": { startNo: 125, prefix: "CS" },
  "CSK": { startNo: 586, prefix: "CSK" },
  "DP": { startNo: 424, prefix: "DP" },
  "HEC": { startNo: 22, prefix: "HEC" },
  "HRR": { startNo: 97, prefix: "HRR" },
  "PAT": { startNo: 30, prefix: "PAT" },
  "PCR": { startNo: 251, prefix: "PCR" },
  "PV": { startNo: 211, prefix: "PV" },
  "ROMA": { startNo: 11, prefix: "ROMA" },
  "SPN": { startNo: 127, prefix: "SPN" },
  "SRN": { startNo: 345, prefix: "SRN" },
  "SRR": { startNo: 115, prefix: "SRR" },
  "TC": { startNo: 304, prefix: "TC" },
  "TNC": { startNo: 838, prefix: "TNC" },
  "W": { startNo: 597, prefix: "W" },
  "WL": { startNo: 285, prefix: "WL" },
  "WP": { startNo: 274, prefix: "WP" }
};

// --- AI Modal ---
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
            // ⭐️ 規則：四捨五入金額
            amount: Math.round(parseFloat(amount)), 
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

// --- 請款單模板 ---
const InvoiceTemplate = ({ inv }) => (
    <div className="w-[210mm] bg-white p-[10mm] min-h-[297mm] flex flex-col font-tnr text-black invoice-page mx-auto">
      <div className="text-center mb-4 border-b-[2px] border-double border-black pb-2">
        <h1 className="text-2xl font-bold mb-1 uppercase">EVERISE MATERIAL INT'L LTD</h1>
        <p className="text-xs font-bold">TEL: 886-2-2741-9113 | FAX: 886-2-2727-9021</p>
        <p className="text-xs underline font-bold">E-MAIL: e.material2727@gmail.com</p>
        <div className="inline-block border-[2px] border-black px-8 py-1 font-bold text-2xl mt-2">SHIPPING ADVICE</div>
      </div>
      <div className="grid grid-cols-2 mb-4 text-base">
        <div className="space-y-1">
          <div className="border-b border-black pb-0.5"><span className="font-bold text-sm mr-2">TO:</span><span className="font-bold uppercase text-lg">{inv.client}</span></div>
          <div className="border-b border-black pb-0.5 flex items-end">
              <span className="font-bold text-sm mr-2">FROM:</span>
              <span className="font-bold text-base">{inv.origin === 'China' ? 'China' : 'ER'}</span>
          </div>
        </div>
        <div className="space-y-1 pl-4">
          <div className="border-b border-black pb-0.5 flex justify-between"><span>DATE:</span><span className="font-bold">{inv.date}</span></div>
          <div className="border-b border-black pb-0.5 flex justify-between"><span>C/NO:</span><span className="font-bold text-xl">{inv.cabinetNo}</span></div>
        </div>
      </div>
      <table className="w-full border-t-[2px] border-black">
        <tbody className="divide-y divide-black">
          {inv.items.map((item, idx) => (
            <React.Fragment key={idx}>
              <tr><td colSpan="3" className="pt-2 pb-1 font-bold text-lg">ORDER "{item.product}"</td></tr>
              <tr className="text-sm">
                <td className="w-1/3 py-1 font-bold uppercase">{item.color}</td>
                {/* 單價不四捨五入，保留原樣以供核對，最多顯示兩位小數 */}
                <td className="py-1 text-center font-bold">
                    {item.qtyDetail || item.shippedQty} x {Number(item.price).toLocaleString(undefined, {maximumFractionDigits: 2})} = THB
                </td>
                {/* ⭐️ 規則：算出來的金額四捨五入進位 */}
                <td className="py-1 text-right font-bold text-base">
                    {Math.round(item.shippedQty * item.price).toLocaleString()}
                </td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div className="mt-6 border-t-[4px] border-double border-black pt-4 flex justify-between items-baseline px-2">
        <span className="font-bold text-xl">TOTAL:</span>
        {/* ⭐️ 規則：總金額四捨五入進位 */}
        <span className="font-bold text-3xl">THB {Math.round(inv.total).toLocaleString()}</span>
      </div>
      <div className="mt-auto border-t-2 border-black pt-2 flex justify-between">
        <div className="font-bold underline text-xl tracking-widest uppercase">CASH</div>
        <div className="text-[10px] font-bold uppercase">Shipping Advice Doc.</div>
      </div>
    </div>
);

// --- 批次下載 PDF 的 Modal ---
const BatchDownloadModal = ({ show, onClose, invoices }) => {
    const [selectedMonth, setSelectedMonth] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [progress, setProgress] = useState(0);

    const availableMonths = useMemo(() => {
        const months = new Set();
        invoices.forEach(inv => {
            const parts = inv.date.split(/[-/]/);
            if (parts.length >= 2) {
                const y = parts[0];
                const m = parts[1].padStart(2, '0');
                months.add(`${y}-${m}`);
            }
        });
        return [...months].sort().reverse();
    }, [invoices]);

    useEffect(() => {
        if (availableMonths.length > 0 && !selectedMonth) setSelectedMonth(availableMonths[0]);
    }, [availableMonths, selectedMonth]);

    const targetInvoices = useMemo(() => {
        if (!selectedMonth) return [];
        return invoices.filter(inv => {
            const parts = inv.date.split(/[-/]/);
            if (parts.length >= 2) {
                const y = parts[0];
                const m = parts[1].padStart(2, '0');
                return `${y}-${m}` === selectedMonth;
            }
            return false;
        });
    }, [invoices, selectedMonth]);

    const handleDownload = async () => {
        setIsDownloading(true);
        setProgress(0);
        try {
            const html2pdf = await loadHtml2Pdf();
            for (let i = 0; i < targetInvoices.length; i++) {
                const inv = targetInvoices[i];
                const element = document.getElementById(`pdf-render-${inv.id}`);
                if (!element) continue;

                // 檔名命名邏輯：櫃號.pdf 或 櫃號_CN.pdf
                let safeCab = (inv.cabinetNo || 'Unknown').replace(/[\/\\]/g, '-');
                let filename = inv.origin === 'China' ? `${safeCab}_CN.pdf` : `${safeCab}.pdf`;

                await html2pdf().set({
                    margin: 0,
                    filename: filename,
                    image: { type: 'jpeg', quality: 1 },
                    html2canvas: { scale: 2, useCORS: true },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                }).from(element).save();

                setProgress(i + 1);
                await new Promise(r => setTimeout(r, 600)); 
            }
            alert(`✅ 成功下載 ${targetInvoices.length} 份 PDF！`);
        } catch (error) {
            alert('下載失敗：' + error.message);
        } finally {
            setIsDownloading(false);
            onClose();
        }
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative overflow-hidden">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <DownloadCloud className="w-6 h-6 text-blue-600" /> 批次下載 SA 請款單
                    </h3>
                    {!isDownloading && <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>}
                </div>

                <div className="space-y-4 relative z-10">
                    <div>
                        <label className="block text-sm font-bold text-slate-600 mb-2">選擇要下載的月份：</label>
                        <select 
                            className="w-full border-2 border-slate-200 rounded-lg px-4 py-3 font-bold text-slate-700 outline-none focus:border-blue-500"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            disabled={isDownloading}
                        >
                            {availableMonths.map(m => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm font-medium border border-blue-100">
                        這將會自動幫您把 <strong>{selectedMonth}</strong> 的 <strong>{targetInvoices.length}</strong> 張請款單存成 PDF。<br/><br/>
                        💡 檔名規則：<br/>
                        一般：<span className="font-mono bg-white px-1 rounded">櫃號.pdf</span><br/>
                        中國：<span className="font-mono bg-white px-1 rounded">櫃號_CN.pdf</span>
                    </div>

                    {isDownloading && (
                        <div className="mt-4">
                            <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                                <span>下載進度...</span>
                                <span>{progress} / {targetInvoices.length}</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${(progress / targetInvoices.length) * 100}%` }}></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-8 flex gap-3 relative z-10">
                    {!isDownloading && <button onClick={onClose} className="flex-1 py-3 rounded-lg font-bold text-slate-500 hover:bg-slate-100">取消</button>}
                    <button 
                        onClick={handleDownload} 
                        disabled={isDownloading || targetInvoices.length === 0}
                        className="flex-[2] py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                        {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <DownloadCloud className="w-5 h-5" />}
                        {isDownloading ? '處理中請勿關閉...' : `開始下載 (${targetInvoices.length} 份)`}
                    </button>
                </div>

                <div className="fixed top-0 left-0 -z-50 opacity-0 pointer-events-none w-[210mm]">
                    {targetInvoices.map(inv => (
                        <div id={`pdf-render-${inv.id}`} key={inv.id}>
                            <InvoiceTemplate inv={inv} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const App = () => {
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
  const [showBatchModal, setShowBatchModal] = useState(false);

  const [clientConfig, setClientConfig] = useState(DEFAULT_CLIENT_CONFIG);

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
      if (snap.exists() && snap.data().clientConfig) {
        setClientConfig(snap.data().clientConfig);
      }
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

  const resetConfigToDefaults = async () => {
    if (window.confirm("確定要將所有客戶的櫃號起始值重置為系統預設值嗎？\n(這將根據您提供的 2026 最新數據進行重置)")) {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config'), { clientConfig: DEFAULT_CLIENT_CONFIG }, { merge: true });
      alert("重置完成！");
    }
  };

  const cleanNumber = (str) => {
    if (!str) return 0;
    const match = str.toString().replace(/[^\d.-]/g, '');
    return match ? parseFloat(match) : 0;
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

  const getRollSize = (itemName) => {
    const name = String(itemName || '').toUpperCase();
    if (name.includes('210 PU') || name.includes('210D PU')) return 150;
    if (name.includes('CHACK FACE') || name.includes('CRACKED FACE')) return 40;
    if (name.includes('KEVLAR')) return 40;
    if (name.includes('LACOSTE')) return 40;
    if (name.includes('VACUUM') || name.includes('VACUMN')) return 40;
    if (name.includes('CHECKER')) return 40;
    if (name.includes('385')) return 40;
    if (name.includes('305')) return 40;
    return 50; 
  };

  // --- CSV Import Logic ---
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const rows = event.target.result.split(/\r?\n/).filter(r => r.trim());
        if (rows.length < 1) return;
        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
        
        if (headers.includes('client') && headers.includes('number')) {
            const newConfig = { ...clientConfig };
            rows.slice(1).forEach(r => {
                const [c, n] = r.split(',');
                if (c && n) newConfig[c.toUpperCase().trim()] = { startNo: parseInt(n) || 1, prefix: c.toUpperCase().trim() };
            });
            await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config'), { clientConfig: newConfig }, { merge: true });
            return;
        }

        const isChina = file.name.toLowerCase().includes('china');
        const origin = isChina ? 'China' : 'ER';

        const getIdx = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));
        const idx = {
            date: getIdx(['date', '日期']), client: getIdx(['client', '客戶']),
            product: getIdx(['product', '品名', 'spec']), color: getIdx(['color', '顏色']),
            shipped: getIdx(['quantity', '數量', '出貨']), price: getIdx(['price', '單價']),
            cabinet: getIdx(['cabinet', '櫃號']), order: getIdx(['order', '訂單']),
            status: getIdx(['status', '結案']), note: getIdx(['note', '備註'])
        };

        const promises = rows.slice(1).map((row, rIdx) => {
            const cols = [];
            let cur = '';
            let inQuote = false;
            for (let i = 0; i < row.length; i++) {
                let char = row[i];
                if (char === '"') inQuote = !inQuote;
                else if (char === ',' && !inQuote) {
                    cols.push(cur.trim());
                    cur = '';
                } else cur += char;
            }
            cols.push(cur.trim());

            if (cols.length < 3) return null; 

            const productName = cols[idx.product] || '';
            const matched = vendorRules.find(rule => productName.toUpperCase().includes(rule.keyword));
            
            let qtyRaw = cols[idx.shipped] || '';
            let shippedQty = 0;
            let qtyDetail = qtyRaw;

            if (qtyRaw.includes('=') || qtyRaw.includes('＝')) {
               shippedQty = parseFloat(qtyRaw.split(/=|＝/)[1].replace(/[^\d.-]/g, '')) || 0;
            } else {
               let totalQty = parseFloat(qtyRaw.replace(/[^\d.-]/g, '')) || 0;
               shippedQty = totalQty;
               if (totalQty > 0) {
                 let ypr = getRollSize(productName);
                 let rolls = Math.floor(totalQty / ypr);
                 let remainder = Math.round((totalQty - (rolls * ypr)) * 100) / 100;
                 if (rolls > 0 && remainder > 0) qtyDetail = `${ypr}*${rolls}R+${remainder}=${totalQty}Y`;
                 else if (rolls > 0 && remainder === 0) qtyDetail = `${ypr}*${rolls}R=${totalQty}Y`;
                 else qtyDetail = `${totalQty}Y`;
               }
            }
            
            return saveMasterDataRow({
                id: `${file.name}-${rIdx}-${Date.now()}`,
                date: cols[idx.date] || '',
                client: (cols[idx.client] || 'UNKNOWN').toUpperCase().replace(/"/g, ''),
                product: productName.replace(/"/g, ''),
                color: (cols[idx.color] || '').replace(/"/g, ''),
                shippedQty: shippedQty,
                qtyDetail: qtyDetail,
                price: cleanNumber(cols[idx.price]),
                vendor: matched ? matched.vendor : "待查",
                cabinetNo: cols[idx.cabinet] ? cols[idx.cabinet].replace(/"/g, '') : '',
                orderNo: cols[idx.order] || 'N/A',
                status: cols[idx.status] || '',
                note: cols[idx.note] || '',
                source: file.name,
                origin: origin, 
                timestamp: Date.now()
            });
        });
        await Promise.all(promises.filter(p => p !== null));
        setViewMode('dashboard');
      };
      reader.readAsText(file);
    });
    e.target.value = ''; 
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
        
        // ⭐️ 規則：算出來的營收金額四捨五入進位
        const roundedAmount = Math.round(amount);
        m.total += roundedAmount;
        
        const srcLower = (source || '').toLowerCase();
        if (srcLower === 'china') {
            m.chinaTotal += roundedAmount;
        } else if (srcLower === 'warehouse' || srcLower === 'er') {
            m.warehouseTotal += roundedAmount;
        } else {
            m.otherTotal += roundedAmount;
        }
        
        if (!m.clientMap[client]) m.clientMap[client] = { total: 0, sources: {} };
        m.clientMap[client].total += roundedAmount;
        
        let displaySource = 'Other';
        if (srcLower === 'china') displaySource = 'China';
        else if (srcLower === 'warehouse' || srcLower === 'er') displaySource = 'Warehouse';
        
        m.clientMap[client].sources[displaySource] = (m.clientMap[client].sources[displaySource] || 0) + roundedAmount;
    };

    masterData.forEach(d => {
        const origin = d.origin || 'Warehouse'; 
        process(d.date, d.client, d.shippedQty * d.price, origin);
    });
    
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
    if (searchTerm) d = d.filter(x => x.product.toLowerCase().includes(searchTerm.toLowerCase()) || (x.orderNo||'').toLowerCase().includes(searchTerm.toLowerCase()));
    return d.sort((a,b) => new Date(a.date) - new Date(b.date));
  }, [masterData, activeMasterClient, searchTerm]);

  const groupedInvoices = useMemo(() => {
    const res = {};
    sortedClients.forEach(c => {
        const rows = masterData.filter(d => d.client === c && d.shippedQty > 0);
        const dates = [...new Set(rows.map(r => r.date))].sort((a, b) => new Date(a) - new Date(b));
        
        res[c] = dates.map((date, idx) => {
            const items = rows.filter(r => r.date === date);
            const conf = clientConfig[c] || { startNo: 1, prefix: c };
            const origin = items[0]?.origin || 'ER'; 
            
            return { 
                id: `${c}-${date}`, 
                date, 
                cabinetNo: items[0]?.cabinetNo || `${conf.prefix}#${conf.startNo + idx}`, 
                client: c, 
                items, 
                origin, 
                // ⭐️ 規則：將請款單總金額進行四捨五入進位
                total: items.reduce((s, i) => s + Math.round(i.shippedQty * i.price), 0) 
            };
        });
    });
    return res;
  }, [masterData, clientConfig, sortedClients]);

  const allInvoicesFlat = useMemo(() => Object.values(groupedInvoices).flat(), [groupedInvoices]);

  // --- Components ---
  const Navbar = () => (
    <div className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50 px-6 py-3 flex justify-between items-center print:hidden">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-black text-white flex items-center gap-2"><Database className="w-6 h-6 text-emerald-400" /> EVERISE</h1>
        <div className="flex bg-slate-800 p-1 rounded-lg overflow-x-auto">
          {[
            { id: 'dashboard', label: 'SA 請款單', icon: LayoutDashboard },
            { id: 'trackingTable', label: '客戶訂單總表', icon: FileSpreadsheet },
            { id: 'masterTable', label: '年度明細管理', icon: TableIcon },
            { id: 'revenueStats', label: '營業額統計', icon: TrendingUp }, 
            { id: 'dataManagement', label: '資料來源管理', icon: Archive },
          ].map(tab => (
            <button key={tab.id} onClick={() => setViewMode(tab.id)} className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${viewMode === tab.id ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
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

  const TrackingTableView = () => (
    <div className="p-6 animate-in fade-in duration-500 min-h-screen bg-white">
      <div className="mb-6 flex justify-between items-center print:hidden">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" /> 客戶訂單總表
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
          <button onClick={() => window.print()} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Printer className="w-4 h-4" /> 列印</button>
        </div>
      </div>
      <div className="border border-slate-300 overflow-auto max-h-[80vh]">
        <table className="w-full text-left text-sm border-collapse">
          <thead className="bg-slate-100 sticky top-0 z-10 text-xs font-black text-slate-600 uppercase tracking-wider">
            <tr>
              <th className="p-2 border-b border-r border-slate-300 w-24">下單日期</th>
              <th className="p-2 border-b border-r border-slate-300 w-24">訂單</th>
              <th className="p-2 border-b border-r border-slate-300 w-20">廠商</th>
              <th className="p-2 border-b border-r border-slate-300 w-20">產地</th>
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
                <td className="p-2 border-r border-slate-200 text-xs font-bold text-center">
                    {d.origin === 'China' ? <span className="text-red-500">CN</span> : <span className="text-blue-500">ER</span>}
                </td>
                <td className="p-2 border-r border-slate-200 font-bold text-slate-800">{d.product}</td>
                <td className="p-2 border-r border-slate-200 text-xs">{d.color}</td>
                <td className="p-2 border-r border-slate-200 text-right font-mono">{d.orderQty}</td>
                <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-blue-600">{d.shippedQty}</td>
                <td className="p-2 border-r border-slate-200 text-right font-mono text-red-500 font-bold">{(d.orderQty||0) - d.shippedQty !== 0 ? (d.orderQty||0) - d.shippedQty : ''}</td>
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
                <th className="p-3 w-24">日期</th>
                <th className="p-3 w-20">客戶</th>
                <th className="p-3 w-24">櫃號 (編輯)</th>
                <th className="p-3 w-24">產地 (編輯)</th>
                <th className="p-3">品名 (編輯)</th>
                <th className="p-3 w-24">顏色 (編輯)</th>
                <th className="p-3 w-32 text-right">數量明細 (含算式)</th>
                <th className="p-3 w-20 text-right">單價</th>
                <th className="p-3 w-24">廠商 (編輯)</th>
                <th className="p-3 w-24 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMasterData.map(d => (
                <tr key={d.id} className={`hover:bg-blue-50 ${editingId === d.id ? 'bg-yellow-50' : ''}`}>
                  {editingId === d.id ? (
                    <>
                      <td className="p-2"><input className="border rounded p-1 w-full" defaultValue={d.date} onChange={e => handleEditChange('date', e.target.value)} /></td>
                      <td className="p-2 font-bold">{d.client}</td>
                      <td className="p-2"><input className="border rounded p-1 w-full font-bold text-blue-600" defaultValue={d.cabinetNo} onChange={e => handleEditChange('cabinetNo', e.target.value)} /></td>
                      <td className="p-2">
                          <select className="border rounded p-1 w-full" defaultValue={d.origin || 'ER'} onChange={e => handleEditChange('origin', e.target.value)}>
                              <option value="ER">ER</option>
                              <option value="China">China</option>
                          </select>
                      </td>
                      <td className="p-2"><input className="border rounded p-1 w-full font-bold" autoFocus defaultValue={d.product} onChange={e => handleEditChange('product', e.target.value)} /></td>
                      <td className="p-2"><input className="border rounded p-1 w-full" defaultValue={d.color} onChange={e => handleEditChange('color', e.target.value)} /></td>
                      <td className="p-2"><input className="border rounded p-1 w-full text-right" defaultValue={d.qtyDetail || d.shippedQty} onChange={e => handleEditChange('qtyDetail', e.target.value)} /></td>
                      <td className="p-2"><input className="border rounded p-1 w-full text-right" type="number" defaultValue={d.price} onChange={e => handleEditChange('price', parseFloat(e.target.value))} /></td>
                      <td className="p-2"><input className="border rounded p-1 w-full" defaultValue={d.vendor} onChange={e => handleEditChange('vendor', e.target.value)} /></td>
                      <td className="p-2 text-center flex gap-1 justify-center">
                        <button onClick={saveEdit} className="p-1 bg-green-500 text-white rounded hover:bg-green-600"><CheckCircle2 className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="p-1 bg-slate-300 text-white rounded hover:bg-slate-400"><X className="w-4 h-4" /></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 text-slate-500">{d.date}</td>
                      <td className="p-3 font-bold text-slate-700">{d.client}</td>
                      <td className="p-3 font-bold text-blue-600">{d.cabinetNo || <span className="text-slate-300 italic text-xs">Auto</span>}</td>
                      <td className="p-3 text-xs font-bold">{d.origin === 'China' ? <span className="text-red-500 bg-red-50 px-2 py-1 rounded">China</span> : <span className="text-blue-500 bg-blue-50 px-2 py-1 rounded">ER</span>}</td>
                      <td className="p-3 font-bold text-slate-800">{d.product}</td>
                      <td className="p-3 text-slate-600">{d.color}</td>
                      <td className="p-3 text-right font-mono text-blue-600 font-bold">{d.qtyDetail || d.shippedQty}</td>
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

  const Dashboard = () => {
    return (
      <div className="max-w-7xl mx-auto p-12 min-h-screen bg-slate-50">
        <div className="flex justify-end mb-8 print:hidden">
            <button 
                onClick={() => setShowBatchModal(true)} 
                className="bg-blue-600 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 hover:-translate-y-0.5 transition-all"
            >
                <DownloadCloud className="w-5 h-5" /> 批次下載當月 PDF
            </button>
        </div>

        {sortedClients.length === 0 ? (
          <div className="text-center py-40 border-4 border-dashed border-slate-200 rounded-3xl">
             <LayoutDashboard className="w-20 h-20 text-slate-300 mx-auto mb-4" />
             <p className="text-slate-400 font-bold text-xl">請先匯入 CSV 資料</p>
          </div>
        ) : (
          sortedClients.map(client => {
            const currentInvoices = groupedInvoices[client] || [];
            return (
              <div key={client} className="mb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b-2 border-slate-200 pb-4 gap-4">
                  <div>
                    <div className="flex items-center gap-4 mb-3">
                      <span className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black text-3xl shadow-lg">{client}</span>
                      <h2 className="text-xl font-bold text-slate-400">請款單列表</h2>
                    </div>
                  </div>
                  <button onClick={() => { setActiveClient(client); setViewMode('printAll'); }} className="bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-md hover:bg-emerald-700 hover:-translate-y-0.5 transition-all">
                    <Layers className="w-5 h-5" /> 列印本區所有 SA
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {currentInvoices.map(inv => (
                    <div key={inv.id} onClick={() => { setActiveClient(client); setSelectedInvoiceId(inv.id); setViewMode('preview'); }} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-slate-100 to-transparent rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                      <div className="relative z-10">
                          <div className="flex justify-between items-start mb-4">
                            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-xs font-black shadow-sm border border-blue-200">{inv.cabinetNo}</span>
                            {inv.origin === 'China' ? (
                                <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border border-red-200"><Plane className="w-3 h-3"/> CN</span>
                            ) : (
                                <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">ER</span>
                            )}
                          </div>
                          <div className="text-2xl font-black text-slate-800 mb-1">{inv.date}</div>
                          <div className="text-xs text-slate-400 font-bold flex items-center gap-1">
                              <Package className="w-3 h-3" /> {inv.items.length} 筆明細
                          </div>
                          <div className="mt-6 pt-4 border-t border-slate-100 text-right">
                            <span className="text-2xl font-black text-emerald-600 tracking-tight">
                                <span className="text-xs text-emerald-400 font-normal mr-1">THB</span>
                                {/* ⭐️ 規則：總金額四捨五入進位 */}
                                {Math.round(inv.total).toLocaleString()}
                            </span>
                          </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

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

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      <Navbar />
      <AiModal show={showAiModal} onClose={() => setShowAiModal(false)} prompt={aiPrompt} setPrompt={setAiPrompt} onSend={callGemini} response={aiResponse} loading={isAiLoading} hasKey={!!userApiKey} />
      <ManualRevenueModal show={showRevenueModal} onClose={() => setShowRevenueModal(false)} onSave={addManualRevenue} />
      
      <BatchDownloadModal 
         show={showBatchModal} 
         onClose={() => setShowBatchModal(false)} 
         invoices={allInvoicesFlat} 
      />
      
      <main className="p-0">
        {viewMode === 'dashboard' && <Dashboard />}
        {viewMode === 'trackingTable' && <TrackingTableView />}
        
        {viewMode === 'revenueStats' && (
            <div className="max-w-6xl mx-auto space-y-6 p-6 mt-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-black">年度營業額統計</h2>
                    <button onClick={() => setShowRevenueModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Plus className="w-4 h-4"/>新增營收</button>
                </div>
                
                {revenueData.map((data) => (
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
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `100%` }}></div>
                                </div>
                                
                                <div className="mt-4 space-y-2 border-t border-slate-100 pt-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400 font-bold flex items-center gap-1"><Package className="w-3 h-3" /> 倉庫</span>
                                        <span className="font-mono font-bold text-blue-600">{data.warehouseTotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-400 font-bold flex items-center gap-1"><MapPin className="w-3 h-3" /> 中國</span>
                                        <span className="font-mono font-bold text-red-500">{data.chinaTotal.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 w-full">
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {data.clients.map((client, idx) => (
                                        <div key={idx} className="flex flex-col bg-slate-50 p-2 rounded border border-slate-100 relative group">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <span className="text-xs font-black text-slate-700 truncate">{idx + 1}. {client.client}</span>
                                            </div>
                                            <span className="text-sm font-mono text-emerald-600 font-bold block">{client.amount.toLocaleString()}</span>
                                            
                                            <div className="mt-1 flex h-1.5 w-full rounded-full overflow-hidden bg-slate-200">
                                                {client.sources['Warehouse'] > 0 && <div className="h-full bg-blue-400" style={{ width: `${(client.sources['Warehouse'] / client.amount) * 100}%` }}></div>}
                                                {client.sources['China'] > 0 && <div className="h-full bg-red-400" style={{ width: `${(client.sources['China'] / client.amount) * 100}%` }}></div>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                
                <div className="mt-12 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2"><Edit3 className="w-5 h-5 text-blue-500" /> 手動輸入紀錄明細</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-xs text-slate-500 font-bold border-b border-slate-100">
                                <tr>
                                    <th className="p-3">日期</th>
                                    <th className="p-3">客戶</th>
                                    <th className="p-3">櫃號</th>
                                    <th className="p-3">來源</th>
                                    <th className="p-3 text-right">金額 (THB)</th>
                                    <th className="p-3 text-center">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {manualRevenueData.sort((a,b) => new Date(b.date) - new Date(a.date)).map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50">
                                        <td className="p-3 font-mono text-slate-600">{item.date}</td>
                                        <td className="p-3 font-bold text-slate-800">{item.client}</td>
                                        <td className="p-3 text-slate-600"><span className="bg-slate-100 px-2 py-0.5 rounded text-xs">{item.cabinetNo || '-'}</span></td>
                                        <td className="p-3">{item.source === 'China' ? <span className="text-red-500 font-bold text-xs">China</span> : <span className="text-blue-500 font-bold text-xs">Warehouse</span>}</td>
                                        <td className="p-3 text-right font-mono text-emerald-600 font-bold">{Math.round(item.amount).toLocaleString()}</td>
                                        <td className="p-3 text-center">
                                            <button onClick={() => deleteManualRevenue(item.id)} className="text-red-300 hover:text-red-600 p-1 rounded hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {viewMode === 'preview' && (
            <div className="py-10 bg-slate-200 min-h-screen">
                <div className="max-w-[210mm] mx-auto mb-6 flex justify-between print:hidden px-4">
                    <button onClick={() => setViewMode('dashboard')} className="font-bold flex items-center gap-2 bg-white px-4 py-2 rounded-lg"><ArrowLeft/>返回</button>
                    <button onClick={() => window.print()} className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"><Printer/>列印單張</button>
                </div>
                <div id="print-area">
                    <InvoiceTemplate inv={(groupedInvoices[activeClient] || []).find(i => i.id === selectedInvoiceId)} />
                </div>
            </div>
        )}

        {viewMode === 'printAll' && <PrintAllView />}
        {viewMode === 'masterTable' && <MasterTableView />}

        {viewMode === 'dataManagement' && (
             <div className="p-8 max-w-4xl mx-auto min-h-screen bg-slate-50 mt-6">
                <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3 mb-8">
                    <Archive className="w-8 h-8 text-emerald-600" /> 資料來源管理
                </h2>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-100 text-xs font-bold text-slate-600 border-b border-slate-200">
                            <tr><th className="p-4">來源檔案名稱</th><th className="p-4 text-center">資料筆數</th><th className="p-4 text-right">操作</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                             {[...new Set(masterData.map(d => d.source))].map(source => (
                                 <tr key={source} className="hover:bg-red-50">
                                     <td className="p-4 font-mono text-sm font-bold text-slate-700">{source}</td>
                                     <td className="p-4 text-center"><span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-black">{masterData.filter(d => d.source === source).length} 筆</span></td>
                                     <td className="p-4 text-right"><button onClick={() => deleteBatchBySource(source)} className="text-slate-400 hover:text-red-600 font-bold text-sm flex items-center gap-1 ml-auto"><Trash2 className="w-4 h-4" /> 刪除整批</button></td>
                                 </tr>
                             ))}
                        </tbody>
                    </table>
                </div>
             </div>
        )}
        
        {viewMode === 'settings' && (
            <div className="max-w-md mx-auto space-y-6 mt-12">
                <div className="bg-white p-6 rounded-2xl shadow-sm border">
                    <h3 className="font-black mb-4 flex items-center gap-2"><KeyRound className="text-purple-600"/> Gemini API Key</h3>
                    <input type="password" value={userApiKey} onChange={e => { setUserApiKey(e.target.value); localStorage.setItem('everise_gemini_key', e.target.value); }} className="w-full border p-2 rounded bg-slate-50" placeholder="貼上 API Key"/>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border">
                    <h3 className="font-black mb-4 flex items-center gap-2"><RefreshCw className="text-blue-600"/> 重置櫃號設定</h3>
                    <p className="text-xs text-slate-500 mb-4">如果櫃號錯誤，可點擊下方按鈕強制重置為系統最新的預設值。</p>
                    <button onClick={resetConfigToDefaults} className="w-full bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold py-2 rounded-lg">重置為最新預設值</button>
                </div>
            </div>
        )}
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
        .font-tnr { font-family: 'Times New Roman', Times, serif; }
      `}} />
    </div>
  );
};

export default App;