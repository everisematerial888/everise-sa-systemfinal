import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, Upload, Printer, ChevronRight, Hash, 
  ArrowLeft, Settings, Search, CheckCircle2, FileSpreadsheet,
  Table as TableIcon, LayoutDashboard, Edit3, X, Trash,
  Download, Database, Layers, Sparkles, MessageSquare, Loader2,
  TrendingUp, DollarSign, Calendar, PieChart, BarChart3, Calculator,
  Cloud, CloudOff, Save, Archive, Plus, Trash2, MapPin, Package, KeyRound,
  RefreshCw, Plane, Warehouse, Filter, AlertTriangle, ListOrdered, Link, ShieldAlert, CheckSquare, FileOutput
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';

// --- 動態載入 html2pdf 套件 ---
const loadHtml2Pdf = () => {
    return new Promise((resolve) => {
        if (window.html2pdf) return resolve(window.html2pdf);
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        script.onload = () => resolve(window.html2pdf);
        document.body.appendChild(script);
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

// --- 預設客戶櫃號設定 ---
const DEFAULT_CLIENT_CONFIG = {
  "AP": { startNo: 955, prefix: "AP" }, "APS": { startNo: 860, prefix: "APS" },
  "CCHHH": { startNo: 138, prefix: "CCHHH" }, "CH": { startNo: 276, prefix: "CH" },
  "CL": { startNo: 300, prefix: "CL" }, "CS": { startNo: 125, prefix: "CS" },
  "CSK": { startNo: 586, prefix: "CSK" }, "DP": { startNo: 424, prefix: "DP" },
  "HEC": { startNo: 22, prefix: "HEC" }, "HRR": { startNo: 97, prefix: "HRR" },
  "PAT": { startNo: 29, prefix: "PAT" }, "PCR": { startNo: 251, prefix: "PCR" },
  "PV": { startNo: 211, prefix: "PV" }, "ROMA": { startNo: 11, prefix: "ROMA" },
  "SPN": { startNo: 127, prefix: "SPN" }, "SRN": { startNo: 345, prefix: "SRN" },
  "SRR": { startNo: 115, prefix: "SRR" }, "TC": { startNo: 304, prefix: "TC" },
  "TNC": { startNo: 838, prefix: "TNC" }, "W": { startNo: 597, prefix: "W" },
  "WL": { startNo: 285, prefix: "WL" }, "WP": { startNo: 274, prefix: "WP" }
};

// --- 智能數量解析大腦 ---
const parseQuantity = (rawQtyStr, productName) => {
  if (!rawQtyStr) return { display: '', value: 0 };
  const str = String(rawQtyStr).trim().toUpperCase();

  if (str.includes('=') || str.includes('*')) {
      const match = str.match(/=([\d.]+)\s*Y?/);
      if (match) return { display: str, value: parseFloat(match[1]) };
      const numMatch = str.replace(/[^\d.-]/g, '');
      return { display: str, value: parseFloat(numMatch) || 0 };
  }

  const qty = parseFloat(str.replace(/[^\d.-]/g, ''));
  if (isNaN(qty) || qty === 0) return { display: '0', value: 0 };

  let yPerRoll = 50; 
  const pName = (productName || '').toUpperCase();
  if (pName.includes('210 PU')) yPerRoll = 150;
  else if (/(CHACK FACE|KEVLAR|LACOSTE|VACUUM|CHECKER|385|305)/.test(pName)) yPerRoll = 40;

  const rolls = Math.floor(qty / yPerRoll);
  const remainder = qty % yPerRoll;

  let display = '';
  if (rolls > 0) {
      display = `${yPerRoll}*${rolls}R`;
      if (remainder > 0) display += `+${remainder}`;
      display += `=${qty}Y`;
  } else { display = `${qty}Y`; }

  return { display, value: qty };
};

// ==========================================
//                 App 主程式
// ==========================================
const App = () => {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  // --- 狀態管理 ---
  const [user, setUser] = useState(null);
  const [viewMode, setViewMode] = useState('dashboard'); 
  
  // 資料庫資料
  const [masterData, setMasterData] = useState([]); 
  const [inventoryMaster, setInventoryMaster] = useState([]); 
  const [restockData, setRestockData] = useState([]); // 進貨紀錄
  const [productMappings, setProductMappings] = useState({}); // 品名對應字典
  const [manualRevenueData, setManualRevenueData] = useState([]); 
  const [revenueData, setRevenueData] = useState([]); 
  
  // UI 控制
  const [activeClient, setActiveClient] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProduct, setFilterProduct] = useState('ALL'); // 新增：依品項篩選
  const [editingId, setEditingId] = useState(null);
  const editValues = useRef({}); 
  const [clientConfig, setClientConfig] = useState(DEFAULT_CLIENT_CONFIG);

  // 全局獨立篩選狀態
  const [filterMonth, setFilterMonth] = useState('ALL');
  const [filterOrigin, setFilterOrigin] = useState('ALL');
  const [activeMasterClient, setActiveMasterClient] = useState('ALL');

  // Modals & Loading
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingBase, setIsUploadingBase] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [showAddInvModal, setShowAddInvModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showRevenueModal, setShowRevenueModal] = useState(false); 
  
  // 智能攔截器專用狀態
  const [pendingUploadData, setPendingUploadData] = useState(null);
  const [unmappedItems, setUnmappedItems] = useState([]);
  const [showMappingModal, setShowMappingModal] = useState(false);

  // --- Auth & Data Sync ---
  useEffect(() => {
    signInAnonymously(auth).catch(err => console.error("Auth Error:", err));
    return onAuthStateChanged(auth, u => setUser(u));
  }, [auth]);

  useEffect(() => {
    if (!user) return;
    const unsubMaster = onSnapshot(collection(db, 'everise_system', 'shared', 'master_data'), (snap) => setMasterData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubInv = onSnapshot(collection(db, 'everise_system', 'shared', 'inventory_master'), (snap) => setInventoryMaster(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubRestock = onSnapshot(collection(db, 'everise_system', 'shared', 'restock_data'), (snap) => setRestockData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubRev = onSnapshot(collection(db, 'everise_system', 'shared', 'manual_revenue'), (snap) => setManualRevenueData(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    // 讀取設定與字典
    const unsubSettings = onSnapshot(doc(db, 'everise_system', 'shared', 'settings', 'config'), (snap) => {
      if (snap.exists()) {
          if (snap.data().clientConfig) setClientConfig(snap.data().clientConfig);
          if (snap.data().productMappings) setProductMappings(snap.data().productMappings);
      }
    });

    return () => { unsubMaster(); unsubInv(); unsubRestock(); unsubRev(); unsubSettings(); };
  }, [user, db]);

  // --- Inventory Engine (庫存自動計算核心) ---
  const computedInventory = useMemo(() => {
      if (!inventoryMaster || inventoryMaster.length === 0) return [];

      return inventoryMaster.map(inv => {
          // 計算總出庫 (限泰國倉且未作廢)
          const relatedOut = masterData.filter(d => 
              d.origin === 'ER' && d.status !== '作廢' &&
              d.product.trim().toUpperCase() === inv.product.trim().toUpperCase() && 
              d.color.trim().toUpperCase() === inv.color.trim().toUpperCase()
          );
          const totalShipped = relatedOut.reduce((sum, d) => sum + (d.shippedQty || 0), 0);

          // 計算總入庫與盤點微調
          const relatedIn = restockData.filter(d => 
              d.product.trim().toUpperCase() === inv.product.trim().toUpperCase() && 
              d.color.trim().toUpperCase() === inv.color.trim().toUpperCase()
          );
          const totalRestocked = relatedIn.reduce((sum, d) => sum + (d.amount || 0), 0);

          const currentStock = (inv.initialStock || 0) + totalRestocked - totalShipped;
          
          let stockStatus = 'normal';
          const target = inv.restockTarget || 0;
          if (currentStock < 0) stockStatus = 'negative';
          else if (target > 0 && currentStock < target) stockStatus = 'low';

          return { ...inv, totalShipped, totalRestocked, currentStock, stockStatus };
      });
  }, [inventoryMaster, masterData, restockData]);

  // --- Database Actions ---
  const updateConfig = async (key, data) => {
      await setDoc(doc(db, 'everise_system', 'shared', 'settings', 'config'), { [key]: data }, { merge: true });
  };

  const handleVoidOrder = async (id) => {
      if(window.confirm("確定要【作廢】此筆單據嗎？\n作廢後：\n1. 營收不會計算這筆錢\n2. 扣除的庫存會自動加回泰國倉\n(紀錄會保留並標示作廢)")) {
          await updateDoc(doc(db, 'everise_system', 'shared', 'master_data', id), { status: '作廢', shippedQty: 0, price: 0 });
          alert("已作廢！庫存已安全回補。");
      }
  };

  // --- CSV Import (智能匯入與防呆攔截器) ---
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setIsUploading(true);

    try {
        let allParsedRows = [];
        for (const file of files) {
            const text = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (event) => resolve(event.target.result);
                reader.readAsText(file);
            });

            const rows = text.split(/\r?\n/).filter(r => r.trim());
            if (rows.length < 1) continue;
            const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
            
            // 處理櫃號設定更新
            if (headers.includes('client') && headers.includes('number')) {
                 const newConfig = { ...clientConfig };
                 rows.slice(1).forEach(r => {
                     const [c, n] = r.split(',');
                     if (c && n) newConfig[c.toUpperCase().trim()] = { startNo: parseInt(n) || 1, prefix: c.toUpperCase().trim() };
                 });
                 await updateConfig('clientConfig', newConfig);
                 continue;
            }

            const isChina = file.name.toLowerCase().includes('china');
            const origin = isChina ? 'China' : 'ER';

            const getIdx = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));
            const idx = {
                date: getIdx(['date', '日期']), client: getIdx(['client', '客戶']),
                product: getIdx(['product', '品名', 'spec']), color: getIdx(['color', '顏色']),
                shipped: getIdx(['quantity', '數量', '出貨']), price: getIdx(['price', '單價']),
                cabinet: getIdx(['cabinet', '櫃號']), order: getIdx(['order', '訂單'])
            };

            rows.slice(1).forEach((row, rIdx) => {
                const cols = []; let cur = ''; let inQuote = false;
                for (let i = 0; i < row.length; i++) {
                    let char = row[i];
                    if (char === '"') inQuote = !inQuote;
                    else if (char === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; } 
                    else cur += char;
                }
                cols.push(cur.trim());

                if (cols.length < 3) return;

                let rawProduct = cols[idx.product]?.replace(/"/g, '').toUpperCase().trim() || '';
                let rawColor = cols[idx.color]?.replace(/"/g, '').trim() || '';
                
                // 1. 數量異常檢查
                const parsedQty = parseQuantity(cols[idx.shipped], rawProduct);
                if (parsedQty.value === 0 && cols[idx.shipped]) {
                    alert(`🚨 嚴重警告：系統無法辨識此數量格式 [ ${cols[idx.shipped]} ]\n發生在品項：${rawProduct}\n請修改 CSV 數量格式後再重新匯入！`);
                    throw new Error("數量格式異常，匯入已中斷。");
                }

                allParsedRows.push({
                    _rawProduct: rawProduct, _rawColor: rawColor,
                    id: `${file.name}-${rIdx}-${Date.now()}`,
                    date: cols[idx.date] || '', client: (cols[idx.client] || 'UNKNOWN').toUpperCase().replace(/"/g, ''),
                    shippedQty: parsedQty.value, shippedDisplay: parsedQty.display,
                    price: parseFloat(cols[idx.price]?.replace(/[^\d.-]/g, '')) || 0,
                    cabinetNo: cols[idx.cabinet] ? cols[idx.cabinet].replace(/"/g, '') : '',
                    orderNo: cols[idx.order] || 'N/A', status: '', note: '',
                    source: file.name, origin: origin, timestamp: Date.now()
                });
            });
        }
        
        if(allParsedRows.length === 0) return;

        // 2. 智能品名比對攔截
        const unmapped = [];
        allParsedRows.forEach(row => {
            if (row.origin !== 'ER') return; // 中國直發不需對應庫存
            
            // 檢查字典
            const dictKey = `${row._rawProduct}|${row._rawColor}`;
            if (productMappings[dictKey]) {
                row.product = productMappings[dictKey].product;
                row.color = productMappings[dictKey].color;
                return;
            }
            
            // 檢查標準庫存表
            const exactMatch = inventoryMaster.find(i => i.product.toUpperCase().trim() === row._rawProduct && i.color.toUpperCase().trim() === row._rawColor.toUpperCase());
            if (exactMatch) {
                row.product = exactMatch.product; row.color = exactMatch.color;
            } else {
                // 找不到對應，加入未映射清單
                if (!unmapped.find(u => u.rawKey === dictKey)) {
                    unmapped.push({ rawKey: dictKey, rawProduct: row._rawProduct, rawColor: row._rawColor });
                }
            }
        });

        if (unmapped.length > 0) {
            setUnmappedItems(unmapped);
            setPendingUploadData(allParsedRows);
            setShowMappingModal(true); // 暫停並跳出防呆視窗
        } else {
            await finalizeUpload(allParsedRows, productMappings);
        }

    } catch (error) {
        if(error.message !== "數量格式異常，匯入已中斷。") alert(`❌ 上傳失敗！\n錯誤代碼：${error.message}`);
    } finally {
        setIsUploading(false); e.target.value = ''; 
    }
  };

  // 確認寫入資料庫
  const finalizeUpload = async (rowsToSave, newMappings) => {
      const batch = writeBatch(db);
      rowsToSave.forEach(row => {
          // 確保都有品名顏色
          if(!row.product) row.product = row._rawProduct;
          if(!row.color) row.color = row._rawColor;
          
          const docData = {...row};
          delete docData._rawProduct; delete docData._rawColor;
          batch.set(doc(db, 'everise_system', 'shared', 'master_data', row.id), docData);
      });
      await batch.commit();
      
      if (Object.keys(newMappings).length > Object.keys(productMappings).length) {
          await updateConfig('productMappings', newMappings);
      }
      
      alert("✅ 出貨單匯入成功！系統已同步建立請款單並扣除庫存。");
      setShowMappingModal(false);
      setPendingUploadData(null);
      setViewMode('dashboard');
  };

  // --- 進貨專用 CSV 匯入 ---
  const handleRestockUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
          const text = await new Promise((resolve) => {
              const reader = new FileReader(); reader.onload = (e) => resolve(e.target.result); reader.readAsText(file);
          });
          const rows = text.split(/\r?\n/).filter(r => r.trim());
          const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
          const getIdx = (keys) => headers.findIndex(h => keys.some(k => h.includes(k)));
          const idx = { 
              date: getIdx(['date', '日期']), product: getIdx(['product', '品名']), 
              color: getIdx(['color', '顏色']), qty: getIdx(['quantity', '數量']), note: getIdx(['note', '備註']) 
          };

          if (idx.product === -1 || idx.qty === -1) throw new Error("缺少必要標題：品名、數量");

          const batch = writeBatch(db);
          rows.slice(1).forEach((rowStr) => {
              const cols = rowStr.split(',').map(c => c.trim().replace(/"/g, ''));
              if (!cols[idx.product]) return;
              const newRef = doc(collection(db, 'everise_system', 'shared', 'restock_data'));
              batch.set(newRef, {
                  date: cols[idx.date] || new Date().toISOString().split('T')[0],
                  product: cols[idx.product].toUpperCase(), color: cols[idx.color] || '',
                  amount: parseInt(cols[idx.qty]) || 0, note: cols[idx.note] || '整櫃匯入',
                  timestamp: Date.now()
              });
          });
          await batch.commit();
          alert("✅ 整櫃進貨資料已成功匯入並加總至庫存！");
      } catch (error) { alert(`❌ 匯入失敗：${error.message}`); }
      e.target.value = '';
  };


  // ==========================================
  //                 Modals 區塊
  // ==========================================
  
  // 智能攔截器 Modal
  const MappingModal = () => {
      const [localMappings, setLocalMappings] = useState({});

      if (!showMappingModal) return null;

      const handleMapSelect = (rawKey, invId) => {
          if(!invId) return;
          const target = inventoryMaster.find(i => i.id === invId);
          setLocalMappings(prev => ({ ...prev, [rawKey]: { product: target.product, color: target.color } }));
      };

      const handleConfirm = () => {
          // 檢查是否全部對應完畢
          if (Object.keys(localMappings).length < unmappedItems.length) {
              if(!window.confirm("還有品項未選擇對應！未對應的品項將以「原名」存入且無法扣除庫存。確定繼續？")) return;
          }
          
          const newMappings = { ...productMappings, ...localMappings };
          const processedRows = pendingUploadData.map(row => {
              if (row.origin === 'ER') {
                  const dictKey = `${row._rawProduct}|${row._rawColor}`;
                  if (newMappings[dictKey]) {
                      row.product = newMappings[dictKey].product;
                      row.color = newMappings[dictKey].color;
                  }
              }
              return row;
          });
          
          finalizeUpload(processedRows, newMappings);
      };

      return (
          <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[85vh] flex flex-col">
                  <div className="p-6 bg-red-50 border-b border-red-100">
                      <h3 className="text-xl font-black text-red-700 flex items-center gap-2"><ShieldAlert /> ⚠️ 發現未知品名，請手動對應庫存</h3>
                      <p className="text-sm text-red-600 mt-2 font-bold">泰國端輸入了系統不認識的名稱。請在下方選擇對應的庫存品項，選擇後系統將永久記住此規則。</p>
                  </div>
                  <div className="p-6 overflow-auto flex-1 space-y-4">
                      {unmappedItems.map((item, idx) => (
                          <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
                              <div className="flex-1">
                                  <div className="text-xs text-slate-400 font-bold mb-1">泰國輸入 (錯誤)：</div>
                                  <div className="font-mono text-red-600 font-black">{item.rawProduct} <span className="text-slate-500">({item.rawColor})</span></div>
                              </div>
                              <ArrowLeft className="w-5 h-5 text-slate-300 hidden md:block transform rotate-180" />
                              <div className="flex-1 w-full">
                                  <div className="text-xs text-emerald-600 font-bold mb-1">對應至系統標準庫存：</div>
                                  <select 
                                      className="w-full border-2 border-emerald-200 bg-emerald-50 text-emerald-800 p-2 rounded-lg font-bold"
                                      onChange={(e) => handleMapSelect(item.rawKey, e.target.value)}
                                  >
                                      <option value="">-- 請選擇標準品項 --</option>
                                      {inventoryMaster.sort((a,b)=>a.product.localeCompare(b.product)).map(inv => (
                                          <option key={inv.id} value={inv.id}>{inv.product} - {inv.color}</option>
                                      ))}
                                  </select>
                              </div>
                          </div>
                      ))}
                  </div>
                  <div className="p-6 bg-slate-50 border-t flex justify-end gap-3">
                      <button onClick={() => {setShowMappingModal(false); setPendingUploadData(null);}} className="px-6 py-2 rounded-lg font-bold text-slate-500 hover:bg-slate-200">取消匯入</button>
                      <button onClick={handleConfirm} className="px-8 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-lg">確認對應並繼續匯入</button>
                  </div>
              </div>
          </div>
      );
  };

  // 手動進貨/盤點 Modal
  const RestockModal = ({ show, onClose }) => {
      const [product, setProduct] = useState('');
      const [amount, setAmount] = useState('');
      const [note, setNote] = useState('');
      
      if(!show) return null;
      
      const handleSave = async () => {
          if(!product || !amount) return alert("請填寫品項與數量");
          const [p, c] = product.split('|');
          await addDoc(collection(db, 'everise_system', 'shared', 'restock_data'), {
              date: new Date().toISOString().split('T')[0],
              product: p, color: c || '', amount: parseInt(amount), note, timestamp: Date.now()
          });
          onClose(); alert("✅ 數量已更新！");
      };

      return (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
                  <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-6"><Package /> 手動登記進貨 / 盤點微調</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">選擇品項</label>
                          <select className="w-full border rounded-lg px-3 py-2 font-bold" value={product} onChange={e=>setProduct(e.target.value)}>
                              <option value="">-- 請選擇 --</option>
                              {inventoryMaster.map(inv => <option key={inv.id} value={`${inv.product}|${inv.color}`}>{inv.product} ({inv.color})</option>)}
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">增減數量 (+ 進貨 / - 短少盤虧)</label>
                          <input type="number" className="w-full border rounded-lg px-3 py-2 font-mono text-lg font-bold" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="例如: 5000 或 -50"/>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">備註說明</label>
                          <input type="text" className="w-full border rounded-lg px-3 py-2" value={note} onChange={e=>setNote(e.target.value)} placeholder="例如: 4月船期 或 盤點損耗"/>
                      </div>
                  </div>
                  <div className="mt-8 flex justify-end gap-3">
                      <button onClick={onClose} className="px-6 py-2 rounded-lg font-bold text-slate-500">取消</button>
                      <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold shadow">確認送出</button>
                  </div>
              </div>
          </div>
      );
  };


  // ==========================================
  //                 Views 區塊
  // ==========================================

  // 📦 自訂月結匯出中心 (備份神器)
  const MonthlyExportView = () => {
      const [exportMonth, setExportMonth] = useState('ALL');
      const [selectedItems, setSelectedItems] = useState([]);
      
      const handleToggleAll = (e) => {
          if (e.target.checked) setSelectedItems(inventoryMaster.map(i => i.id));
          else setSelectedItems([]);
      };

      const handleExport = () => {
          if (selectedItems.length === 0) return alert("請至少勾選一個品項！");
          
          const csvRows = ["品名,顏色,匯出月份,期初(或累積)庫存,期間入庫量,期間出庫量,期末結算庫存"];
          
          inventoryMaster.filter(inv => selectedItems.includes(inv.id)).forEach(inv => {
              // 篩選指定月份的紀錄
              const isTargetMonth = (dateStr) => exportMonth === 'ALL' || dateStr?.startsWith(exportMonth);
              
              const mOut = masterData.filter(d => d.origin === 'ER' && d.status !== '作廢' && d.product === inv.product && d.color === inv.color);
              const mIn = restockData.filter(d => d.product === inv.product && d.color === inv.color);
              
              // 計算該月之前的累積 (作為期初)
              const outBefore = mOut.filter(d => exportMonth !== 'ALL' && d.date < exportMonth + '-01').reduce((s, d)=>s+d.shippedQty, 0);
              const inBefore = mIn.filter(d => exportMonth !== 'ALL' && d.date < exportMonth + '-01').reduce((s, d)=>s+d.amount, 0);
              const stockBeforeMonth = (inv.initialStock || 0) + inBefore - outBefore;

              // 計算該月期間的變動
              const outDuring = mOut.filter(d => isTargetMonth(d.date)).reduce((s, d)=>s+d.shippedQty, 0);
              const inDuring = mIn.filter(d => isTargetMonth(d.date)).reduce((s, d)=>s+d.amount, 0);
              
              const finalStock = stockBeforeMonth + inDuring - outDuring;

              csvRows.push(`${inv.product},${inv.color},${exportMonth},${stockBeforeMonth},${inDuring},${outDuring},${finalStock}`);
          });

          const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `庫存月結備份_${exportMonth}_${new Date().toISOString().split('T')[0]}.csv`;
          link.click();
      };

      return (
          <div className="p-8 max-w-5xl mx-auto min-h-screen bg-slate-50 animate-in fade-in">
              <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
                  <h2 className="text-3xl font-black text-slate-800 mb-2 flex items-center gap-3"><FileOutput className="w-8 h-8 text-blue-600" /> 月結備份匯出中心</h2>
                  <p className="text-slate-500 mb-8 font-bold">請定期至此處將庫存明細打包匯出至您的電腦或 Google Drive 永久備份。</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="col-span-1 border-r border-slate-100 pr-8">
                          <h4 className="font-black text-slate-700 mb-4">1. 選擇結算月份</h4>
                          <select value={exportMonth} onChange={e=>setExportMonth(e.target.value)} className="w-full border-2 border-slate-200 p-3 rounded-xl font-bold bg-slate-50">
                              <option value="ALL">全部累積至今</option>
                              {availableMonths.map(m => <option key={m} value={m}>{m} 月</option>)}
                          </select>
                          
                          <button onClick={handleExport} className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black text-lg shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-2">
                              <Download /> 一鍵匯出 CSV 備份
                          </button>
                      </div>
                      
                      <div className="col-span-2">
                          <div className="flex justify-between items-center mb-4">
                              <h4 className="font-black text-slate-700">2. 勾選需匯出結算的品項</h4>
                              <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                                  <input type="checkbox" onChange={handleToggleAll} checked={selectedItems.length === inventoryMaster.length && inventoryMaster.length > 0}/> 全選
                              </label>
                          </div>
                          <div className="h-[400px] overflow-auto border-2 border-slate-100 rounded-xl bg-slate-50 p-4 space-y-2">
                              {inventoryMaster.map(inv => (
                                  <label key={inv.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:border-blue-300">
                                      <input type="checkbox" className="w-5 h-5 text-blue-600" 
                                          checked={selectedItems.includes(inv.id)} 
                                          onChange={(e) => {
                                              if(e.target.checked) setSelectedItems([...selectedItems, inv.id]);
                                              else setSelectedItems(selectedItems.filter(id => id !== inv.id));
                                          }} 
                                      />
                                      <span className="font-bold text-slate-700">{inv.product}</span>
                                      <span className="text-sm text-slate-500 border-l border-slate-200 pl-3">{inv.color}</span>
                                  </label>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  const InventoryOverviewView = () => {
      const filteredInv = computedInventory.filter(inv => 
          (filterProduct === 'ALL' || inv.product === filterProduct) &&
          (inv.product.toLowerCase().includes(searchTerm.toLowerCase()) || inv.color.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      const uniqueProducts = [...new Set(inventoryMaster.map(i => i.product))].sort();

      return (
          <div className="p-6 animate-in fade-in duration-500 min-h-screen bg-slate-50">
              <div className="mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 print:hidden">
                  <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                      <Package className="w-6 h-6 text-blue-600" /> 老闆專屬庫存總覽
                  </h2>
                  <div className="flex flex-wrap gap-2">
                      <select value={filterProduct} onChange={e=>setFilterProduct(e.target.value)} className="border border-slate-300 rounded-lg px-3 font-bold text-sm bg-white">
                          <option value="ALL">所有品項</option>
                          {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                          <input type="text" placeholder="關鍵字搜尋..." className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm w-40" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                      </div>
                      <button onClick={() => window.print()} className="bg-slate-800 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm"><Printer className="w-4 h-4"/> 列印</button>
                      <button onClick={() => setViewMode('monthlyExport')} className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm shadow-sm"><FileDown className="w-4 h-4"/> 備份匯出中心</button>
                      <button onClick={() => setShowAddInvModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm shadow-sm"><Plus className="w-4 h-4" /> 新增品項</button>
                  </div>
              </div>

              <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden" id="print-area">
                  <table className="w-full text-left text-sm border-collapse">
                      <thead className="bg-slate-800 text-white sticky top-0 z-10 text-xs font-bold tracking-wider">
                          <tr>
                              <th className="p-4 w-1/4">品名 (Product)</th>
                              <th className="p-4 w-40">顏色 (Color)</th>
                              <th className="p-4 text-center text-slate-300 w-24">2025 出貨量</th>
                              <th className="p-4 text-center text-blue-300 w-24">2026 已出貨</th>
                              <th className="p-4 text-center text-emerald-300 w-28">當前實際庫存</th>
                              <th className="p-4 text-center text-yellow-300 w-24">安全水位</th>
                              <th className="p-4 text-center text-indigo-300 w-24">建議補貨量</th>
                              <th className="p-4 text-center w-32">庫存狀態</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                          {filteredInv.map((inv, i) => {
                              let rowBg = i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
                              if (inv.stockStatus === 'negative') rowBg = 'bg-red-50/80';
                              else if (inv.stockStatus === 'low') rowBg = 'bg-yellow-50/80';

                              let numColor = 'text-emerald-600';
                              if (inv.stockStatus === 'negative') numColor = 'text-red-600';
                              else if (inv.stockStatus === 'low') numColor = 'text-yellow-600';

                              return (
                                  <tr key={inv.id} className={`hover:bg-slate-50 transition-colors ${rowBg}`}>
                                      <td className="p-4 font-black text-slate-700">{inv.product}</td>
                                      <td className="p-4 text-slate-600">{inv.color}</td>
                                      <td className="p-4 text-center font-mono text-slate-400">{inv.shipped2025.toLocaleString()}</td>
                                      <td className="p-4 text-center font-mono font-bold text-blue-600">{inv.totalShipped.toLocaleString()}</td>
                                      <td className={`p-4 text-center font-mono font-black text-lg ${numColor}`}>{inv.currentStock.toLocaleString()}</td>
                                      <td className="p-4 text-center font-mono font-bold text-slate-500">{inv.restockTarget > 0 ? inv.restockTarget.toLocaleString() : '-'}</td>
                                      <td className="p-4 text-center font-mono font-black text-indigo-600">{inv.suggestedRestock > 0 ? inv.suggestedRestock.toLocaleString() : '-'}</td>
                                      <td className="p-4 text-center">
                                          {inv.stockStatus === 'negative' ? (
                                              <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-black border border-red-200 animate-pulse"><AlertTriangle className="w-3 h-3" /> 欠貨/負數</span>
                                          ) : inv.stockStatus === 'low' ? (
                                              <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-black border border-yellow-200"><AlertTriangle className="w-3 h-3" /> 需補貨</span>
                                          ) : (
                                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold border border-emerald-100"><CheckCircle2 className="w-3 h-3" /> 充足</span>
                                          )}
                                      </td>
                                  </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };

  const InventoryLogView = () => {
      const [logFilterProduct, setLogFilterProduct] = useState('ALL');
      const uniqueProducts = [...new Set(masterData.map(i => i.product))].sort();

      const logData = filteredMasterData.filter(d => 
          d.origin === 'ER' && d.status !== '作廢' &&
          (logFilterProduct === 'ALL' || d.product === logFilterProduct)
      );

      return (
          <div className="p-6 animate-in fade-in duration-500 min-h-screen bg-white">
              <div className="mb-6 flex justify-between items-center print:hidden">
                  <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                      <ListOrdered className="w-6 h-6 text-indigo-600" /> 出庫流水紀錄 (Log)
                  </h2>
                  <div className="flex gap-2">
                     <select value={logFilterProduct} onChange={e=>setLogFilterProduct(e.target.value)} className="border border-slate-300 rounded-lg px-3 font-bold text-sm bg-slate-50">
                          <option value="ALL">全部品項</option>
                          {uniqueProducts.map(p => <option key={p} value={p}>{p}</option>)}
                     </select>
                     <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input type="text" placeholder="搜尋客戶或櫃號..." className="pl-8 pr-4 py-2 border rounded-lg text-sm w-48 bg-slate-50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                     </div>
                  </div>
              </div>
              
              <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-sm border-collapse">
                      <thead className="bg-indigo-50 sticky top-0 z-10 text-xs font-black text-indigo-900 uppercase tracking-wider border-b border-indigo-100">
                          <tr>
                              <th className="p-3 w-28">扣帳日期</th>
                              <th className="p-3 w-24">出貨客戶</th>
                              <th className="p-3">品名</th>
                              <th className="p-3 w-32">顏色</th>
                              <th className="p-3 w-32 text-right text-red-600">扣除數量 (-Y)</th>
                              <th className="p-3 w-32 text-center">對應 SA 櫃號</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {logData.map((d) => (
                              <tr key={d.id} className="hover:bg-indigo-50/30 transition-colors">
                                  <td className="p-3 font-mono text-slate-500">{d.date}</td>
                                  <td className="p-3 font-black text-slate-700">{d.client}</td>
                                  <td className="p-3 font-bold text-slate-800">{d.product}</td>
                                  <td className="p-3 text-slate-600">{d.color}</td>
                                  <td className="p-3 text-right font-mono font-black text-red-500">-{d.shippedQty}</td>
                                  <td className="p-3 text-center text-xs font-bold text-indigo-600 bg-indigo-50/50 rounded">
                                      {d.cabinetNo || allGroupedInvoices[d.client]?.find(inv => inv.date === d.date)?.cabinetNo || '-'}
                                  </td>
                              </tr>
                          ))}
                          {logData.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-slate-400">目前沒有出庫紀錄</td></tr>}
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };


  // --- 舊有的 Views (Dashboard, MasterTable, InvoiceTemplate) ---
  const Dashboard = () => {
    const dashboardClients = Object.keys(displayedGroupedInvoices).sort();
    return (
      <div className="max-w-7xl mx-auto p-12 min-h-screen bg-slate-50">
        {dashboardClients.length === 0 ? (
          <div className="text-center py-40 border-4 border-dashed border-slate-200 rounded-3xl">
             <LayoutDashboard className="w-20 h-20 text-slate-300 mx-auto mb-4" />
             <p className="text-slate-400 font-bold text-xl">當前篩選條件下沒有任何 SA 單據</p>
          </div>
        ) : (
          dashboardClients.map(client => {
            const currentInvoices = displayedGroupedInvoices[client] || [];
            const config = clientConfig[client] || { startNo: 1, prefix: client };
            const nextStartNo = config.startNo + currentInvoices.length;

            return (
              <div key={client} className="mb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 border-b-2 border-slate-200 pb-4 gap-4">
                  <div>
                    <div className="flex items-center gap-4 mb-3">
                      <span className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black text-3xl shadow-lg">{client}</span>
                      <h2 className="text-xl font-bold text-slate-400">請款單列表</h2>
                    </div>
                    <div className="bg-white border border-slate-300 rounded-lg p-3 flex items-center gap-4 shadow-sm">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current</span>
                            <span className="font-mono font-black text-xl text-slate-700">#{config.startNo}</span>
                        </div>
                        <div className="h-8 w-px bg-slate-200"></div>
                        <button onClick={() => {
                            if (window.confirm(`確認要更新 ${client} 的起始櫃號嗎？下次將從 [ ${nextStartNo} ] 開始。`)) {
                                updateConfig('clientConfig', { ...clientConfig, [client]: { ...config, startNo: nextStartNo } });
                            }
                        }} className="bg-slate-100 hover:bg-slate-800 hover:text-white text-slate-600 px-3 py-1.5 rounded-md text-xs font-bold transition-colors">
                            設定下次從 #{nextStartNo} 開始 <ChevronRight className="w-3 h-3 inline" />
                        </button>
                    </div>
                  </div>
                  <button onClick={() => { setActiveClient(client); setViewMode('printAll'); }} className="bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold shadow-md hover:bg-emerald-700 transition-all flex items-center gap-2"><Layers className="w-5 h-5"/> 列印此畫面所有 SA</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {currentInvoices.map(inv => (
                    <div key={inv.id} onClick={() => { setActiveClient(client); setSelectedInvoiceId(inv.id); setViewMode('preview'); }} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-xl cursor-pointer group relative overflow-hidden">
                      <div className="flex justify-between items-start mb-4">
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-md text-xs font-black shadow-sm">{inv.cabinetNo}</span>
                        {inv.origin === 'China' ? <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold">CN</span> : <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold">ER</span>}
                      </div>
                      <div className="text-2xl font-black text-slate-800 mb-1">{inv.date}</div>
                      <div className="text-xs text-slate-400 font-bold flex items-center gap-1"><Package className="w-3 h-3" /> {inv.items.length} 筆明細</div>
                      <div className="mt-6 pt-4 border-t border-slate-100 text-right">
                        <span className="text-2xl font-black text-emerald-600 tracking-tight"><span className="text-xs text-emerald-400 mr-1">THB</span>{Math.round(inv.total).toLocaleString()}</span>
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

  const MasterTableView = () => (
    <div className="p-6 animate-in fade-in duration-500 min-h-screen bg-slate-50">
      <div className="mb-6 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><Edit3 className="w-5 h-5 text-blue-600" /> 年度明細與作廢管理</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4" />
          <input type="text" placeholder="搜尋..." className="pl-9 pr-4 py-2 border rounded-lg text-sm w-64" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 border-b border-slate-300 sticky top-0 z-10 text-xs font-bold text-slate-600">
              <tr>
                <th className="p-3 w-24">日期</th><th className="p-3 w-20">客戶</th><th className="p-3 w-24">櫃號</th>
                <th className="p-3 w-16">產地</th><th className="p-3">品名</th><th className="p-3 w-24">顏色</th>
                <th className="p-3 w-24 text-right">出貨量</th><th className="p-3 w-16 text-center">狀態</th>
                <th className="p-3 w-32 text-center">操作 (安全還原)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMasterData.map(d => (
                <tr key={d.id} className={`hover:bg-blue-50 ${d.status === '作廢' ? 'opacity-50 bg-slate-50' : ''} ${editingId === d.id ? 'bg-yellow-50' : ''}`}>
                  {editingId === d.id ? (
                    <>
                      <td className="p-2"><input className="border rounded p-1 w-full" defaultValue={d.date} onChange={e => handleEditChange('date', e.target.value)} /></td>
                      <td className="p-2 font-bold">{d.client}</td>
                      <td className="p-2"><input className="border rounded p-1 w-full font-bold text-blue-600" defaultValue={d.cabinetNo} onChange={e => handleEditChange('cabinetNo', e.target.value)} /></td>
                      <td className="p-2 text-xs font-bold">{d.origin}</td>
                      <td className="p-2"><input className="border rounded p-1 w-full font-bold" autoFocus defaultValue={d.product} onChange={e => handleEditChange('product', e.target.value)} /></td>
                      <td className="p-2"><input className="border rounded p-1 w-full" defaultValue={d.color} onChange={e => handleEditChange('color', e.target.value)} /></td>
                      <td className="p-2"><input className="border rounded p-1 w-full text-right" type="text" defaultValue={d.shippedDisplay || d.shippedQty} onChange={e => handleEditChange('shippedDisplay', e.target.value)} /></td>
                      <td className="p-2 text-center">{d.status}</td>
                      <td className="p-2 text-center flex gap-1 justify-center">
                        <button onClick={saveEdit} className="p-1 bg-green-500 text-white rounded"><CheckCircle2 className="w-4 h-4" /></button>
                        <button onClick={() => setEditingId(null)} className="p-1 bg-slate-300 text-white rounded"><X className="w-4 h-4" /></button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-3 text-slate-500">{d.date}</td>
                      <td className="p-3 font-bold text-slate-700">{d.client}</td>
                      <td className="p-3 font-bold text-blue-600">{d.cabinetNo || '-'}</td>
                      <td className="p-3 text-xs font-bold">{d.origin === 'China' ? <span className="text-red-500">CN</span> : <span className="text-blue-500">ER</span>}</td>
                      <td className={`p-3 font-bold ${d.status === '作廢' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{d.product}</td>
                      <td className="p-3 text-slate-600">{d.color}</td>
                      <td className="p-3 text-right font-mono font-bold text-blue-600">{d.shippedQty}</td>
                      <td className="p-3 text-center">
                          {d.status === '作廢' && <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-xs font-bold">已作廢</span>}
                      </td>
                      <td className="p-3 text-center flex gap-2 justify-center">
                        {d.status !== '作廢' && (
                            <>
                                <button onClick={() => startEditing(d)} className="text-slate-300 hover:text-blue-500" title="編輯明細"><Edit3 className="w-4 h-4" /></button>
                                <button onClick={() => handleVoidOrder(d.id)} className="text-red-400 hover:text-red-600 font-bold text-xs bg-red-50 px-2 rounded border border-red-100 hover:bg-red-100" title="作廢此單並回補庫存">作廢回補</button>
                            </>
                        )}
                        {d.status === '作廢' && <button onClick={() => handleDelete(d.id)} className="text-slate-300 hover:text-red-500" title="永久刪除"><Trash className="w-4 h-4" /></button>}
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

  const InvoiceTemplate = ({ inv }) => (
    <div className="w-[210mm] bg-white p-[10mm] min-h-[297mm] flex flex-col font-tnr text-black mx-auto">
      <div className="text-center mb-4 border-b-[2px] border-double border-black pb-2">
        <h1 className="text-2xl font-bold mb-1 uppercase">EVERISE MATERIAL INT'L LTD</h1>
        <p className="text-xs font-bold">TEL: 886-2-2741-9113 | FAX: 886-2-2727-9021</p>
        <p className="text-xs underline font-bold">E-MAIL: e.material2727@gmail.com</p>
        <div className="inline-block border-[2px] border-black px-8 py-1 font-bold text-2xl mt-2">SHIPPING ADVICE</div>
      </div>
      <div className="grid grid-cols-2 mb-4 text-base">
        <div className="space-y-1">
          <div className="border-b border-black pb-0.5"><span className="font-bold text-sm mr-2">TO:</span><span className="font-bold uppercase text-lg">{inv.client}</span></div>
          <div className="border-b border-black pb-0.5"><span className="font-bold text-sm mr-2">FROM:</span><span className="font-bold text-base">{inv.origin === 'China' ? 'China' : 'ER'}</span></div>
        </div>
        <div className="space-y-1 pl-4">
          <div className="border-b border-black pb-0.5 flex justify-between"><span>DATE:</span><span className="font-bold">{inv.date}</span></div>
          <div className="border-b border-black pb-0.5 flex justify-between"><span>C/NO:</span><span className="font-bold text-xl">{inv.cabinetNo}</span></div>
        </div>
      </div>
      <table className="w-full border-t-[2px] border-black">
        <tbody className="divide-y divide-black">
          {inv.items.filter(i => i.status !== '作廢').map((item, idx) => (
            <React.Fragment key={idx}>
              <tr><td colSpan="3" className="pt-2 pb-1 font-bold text-lg">ORDER "{item.product}"</td></tr>
              <tr className="text-sm">
                <td className="w-1/3 py-1 font-bold uppercase">{item.color}</td>
                <td className="py-1 text-center font-mono">{item.shippedDisplay || item.shippedQty + ' Y'} x {Math.round(item.price)} = THB</td>
                <td className="py-1 text-right font-bold text-base">{(Math.round(item.shippedQty * Math.round(item.price))).toLocaleString()}</td>
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div className="mt-6 border-t-[4px] border-double border-black pt-4 flex justify-between items-baseline px-2">
        <span className="font-bold text-xl">TOTAL:</span><span className="font-bold text-3xl">THB {Math.round(inv.total).toLocaleString()}</span>
      </div>
      <div className="mt-auto border-t-2 border-black pt-2 flex justify-between"><div className="font-bold underline text-xl tracking-widest uppercase">CASH</div><div className="text-[10px] font-bold uppercase">Shipping Advice Doc.</div></div>
    </div>
  );

  return (
    <div className="bg-slate-50 min-h-screen font-sans text-slate-800">
      
      {/* 導覽列 */}
      <div className="bg-slate-900 border-b border-slate-700 sticky top-0 z-50 px-6 py-3 flex justify-between items-center print:hidden">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-black text-white flex items-center gap-2"><Database className="w-6 h-6 text-emerald-400" /> EVERISE</h1>
          <div className="flex bg-slate-800 p-1 rounded-lg overflow-x-auto">
            {[
              { id: 'dashboard', label: 'SA 請款單', icon: LayoutDashboard },
              { id: 'inventoryOverview', label: '庫存總覽', icon: Package },
              { id: 'inventoryLog', label: '庫存流水', icon: ListOrdered },
              { id: 'masterTable', label: '年度明細編輯', icon: TableIcon },
              { id: 'revenueStats', label: '營業額統計', icon: TrendingUp }, 
              { id: 'dataManagement', label: '進階管理', icon: Settings },
            ].map(tab => (
              <button key={tab.id} onClick={() => setViewMode(tab.id)} className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${viewMode === tab.id ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>
                <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 items-center">
          
          <button onClick={() => setShowRestockModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-2 shadow-sm transition-all"><Plus className="w-4 h-4"/>單筆進貨微調</button>

          <label className={`bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg cursor-pointer font-bold text-xs flex items-center gap-2 shadow-sm transition-all`}>
            <Upload className="w-4 h-4" /> 整櫃入庫 (CSV)
            <input type="file" accept=".csv" className="hidden" onChange={handleRestockUpload} />
          </label>

          <label className={`ml-4 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg cursor-pointer font-bold text-xs flex items-center gap-2 shadow-sm transition-all ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isUploading ? '處理中...' : '匯入出貨單 (扣庫存)'}
            <input type="file" accept=".csv" multiple className="hidden" onChange={handleFileUpload} disabled={isUploading} />
          </label>
        </div>
      </div>

      <AiModal show={showAiModal} onClose={() => setShowAiModal(false)} prompt={aiPrompt} setPrompt={setAiPrompt} onSend={callGemini} response={aiResponse} loading={isAiLoading} hasKey={!!userApiKey} />
      <ManualRevenueModal show={showRevenueModal} onClose={() => setShowRevenueModal(false)} onSave={addManualRevenue} />
      <AddInventoryModal show={showAddInvModal} onClose={() => setShowAddInvModal(false)} onSave={handleAddInventoryItem} />
      <RestockModal show={showRestockModal} onClose={() => setShowRestockModal(false)} />
      <MappingModal />
      
      {/* 智慧全局篩選列：只在需要過濾的頁面顯示 */}
      {['dashboard', 'masterTable'].includes(viewMode) && (
          <div className="bg-white border-b border-slate-200 px-6 py-2 flex gap-4 items-center print:hidden shadow-sm sticky top-[60px] z-40">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-400">全局篩選：</span>
              <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="border border-slate-300 rounded-md text-sm font-bold py-1 px-2"><option value="ALL">所有月份</option>{availableMonths.map(m => <option key={m} value={m}>{m}</option>)}</select>
              <select value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)} className="border border-slate-300 rounded-md text-sm font-bold py-1 px-2"><option value="ALL">所有產地</option><option value="China">China (直發)</option><option value="ER">ER (倉庫)</option></select>
              <select value={activeMasterClient} onChange={e => setActiveMasterClient(e.target.value)} className="border border-slate-300 rounded-md text-sm font-bold py-1 px-2"><option value="ALL">所有客戶</option>{sortedClients.map(c => <option key={c} value={c}>{c}</option>)}</select>

              {viewMode === 'dashboard' && (
                  <div className="ml-auto">
                      <button onClick={downloadBatchPdfs} disabled={isDownloadingPdf} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm">
                          {isDownloadingPdf ? <Loader2 className="w-3 h-3 animate-spin"/> : <Download className="w-3 h-3"/>}
                          {isDownloadingPdf ? '產生中...' : '批次下載當前 SA (PDF)'}
                      </button>
                  </div>
              )}
          </div>
      )}

      {/* 隱藏的 PDF 渲染容器 */}
      <div className="absolute top-[-9999px] left-[-9999px] opacity-0 pointer-events-none z-[-50]">
          {Object.values(displayedGroupedInvoices).flat().map(inv => (<div key={inv.id} id={`invoice-capture-${inv.id}`}><InvoiceTemplate inv={inv} /></div>))}
      </div>

      <main>
        {viewMode === 'dashboard' && <Dashboard />}
        {viewMode === 'inventoryOverview' && <InventoryOverviewView />}
        {viewMode === 'inventoryLog' && <InventoryLogView />}
        {viewMode === 'monthlyExport' && <MonthlyExportView />}
        {viewMode === 'masterTable' && <MasterTableView />}

        {viewMode === 'revenueStats' && (
            <div className="max-w-6xl mx-auto space-y-6 p-6">
                <div className="flex justify-between items-center"><h2 className="text-3xl font-black">年度營業額統計</h2><button onClick={() => setShowRevenueModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2"><Plus className="w-4 h-4"/>新增營收</button></div>
                {revenueData.map((data) => (
                    <div key={data.monthKey} className="bg-white rounded-xl shadow-sm border p-6 flex flex-col md:flex-row gap-6 items-start">
                        <div className="w-full md:w-48 shrink-0 border-b md:border-b-0 md:border-r border-slate-100 pr-4">
                            <div className="text-sm font-bold text-slate-400 uppercase">{data.year}</div><div className="text-4xl font-black text-slate-800">{data.month} <span className="text-lg text-slate-400">月</span></div>
                            <div className="mt-2 text-xl font-black text-emerald-600 flex items-center gap-1"><span className="text-xs text-emerald-400">THB</span>{data.total.toLocaleString()}</div>
                            <div className="mt-4 space-y-2 border-t border-slate-100 pt-2 text-sm">
                                <div className="flex justify-between"><span className="text-slate-400 font-bold flex items-center gap-1"><Package className="w-3 h-3" /> 倉庫</span><span className="font-mono font-bold text-blue-600">{data.warehouseTotal.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-slate-400 font-bold flex items-center gap-1"><MapPin className="w-3 h-3" /> 中國</span><span className="font-mono font-bold text-red-500">{data.chinaTotal.toLocaleString()}</span></div>
                            </div>
                        </div>
                        <div className="flex-1 w-full grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {data.clients.map((client, idx) => (
                                <div key={idx} className="bg-slate-50 p-2 rounded border border-slate-100"><span className="text-xs font-black truncate">{idx + 1}. {client.client}</span><span className="text-sm font-mono text-emerald-600 font-bold block">{client.amount.toLocaleString()}</span></div>
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
                <div id="print-area"><InvoiceTemplate inv={(allGroupedInvoices[activeClient] || []).find(i => i.id === selectedInvoiceId)} /></div>
            </div>
        )}

        {viewMode === 'printAll' && (
            <div className="bg-slate-200 min-h-screen py-10 print:bg-white print:p-0 flex flex-col items-center">
              <div className="w-[210mm] mb-6 flex justify-between items-center print:hidden px-4"><button onClick={() => setViewMode('dashboard')} className="text-slate-700 font-bold"><ArrowLeft className="w-5 h-5" /> 返回儀表板</button><button onClick={() => window.print()} className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"><Printer className="w-5 h-5" /> 列印全部</button></div>
              <div id="print-area">{displayedGroupedInvoices[activeClient]?.map(inv => <div key={inv.id} className="print-page-break"><InvoiceTemplate inv={inv} /></div>)}</div>
            </div>
        )}

        {viewMode === 'dataManagement' && (
             <div className="p-8 max-w-5xl mx-auto min-h-screen bg-slate-50 space-y-8 animate-in fade-in">
                
                <div className="bg-white rounded-2xl shadow-sm border p-6">
                    <h3 className="font-black mb-4 flex items-center gap-2 text-xl"><TableIcon className="text-blue-600"/> 基礎設定與初始化</h3>
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex justify-between items-center">
                        <div>
                            <h4 className="font-bold text-blue-900">匯入初始庫存表 (Inventory Baseline)</h4>
                            <p className="text-xs text-blue-600 mt-1">上傳老闆的格式 CSV 檔，這將會覆蓋現有的安全水位與初始庫存計算基準。</p>
                        </div>
                        <label className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer font-bold text-sm shadow-sm transition-all ${isUploadingBase ? 'opacity-50 pointer-events-none' : ''}`}>
                            {isUploadingBase ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 inline mr-2" />}建檔匯入
                            <input type="file" accept=".csv" className="hidden" onChange={handleInventoryBaseUpload} disabled={isUploadingBase} />
                        </label>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border p-6">
                    <h3 className="font-black mb-4 flex items-center gap-2 text-xl"><Archive className="text-emerald-600"/> 歷史資料管理 (Data Source)</h3>
                    <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden">
                        <thead className="bg-slate-100 text-xs font-bold text-slate-600 border-b border-slate-200">
                            <tr><th className="p-4">來源檔案名稱 (Source)</th><th className="p-4 text-center">資料筆數</th><th className="p-4 text-right">操作</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                             {[...new Set(masterData.map(d => d.source))].map(source => (
                                 <tr key={source} className="hover:bg-red-50 transition-colors">
                                     <td className="p-4 font-mono text-sm font-bold text-slate-700">{source}</td>
                                     <td className="p-4 text-center"><span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-black">{masterData.filter(d => d.source === source).length} 筆</span></td>
                                     <td className="p-4 text-right"><button onClick={() => deleteBatchBySource(source)} className="text-red-400 hover:text-red-700 font-bold text-sm flex items-center gap-1 ml-auto"><Trash2 className="w-4 h-4" /> 刪除整批</button></td>
                                 </tr>
                             ))}
                        </tbody>
                    </table>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border">
                        <h3 className="font-black mb-4 flex items-center gap-2"><KeyRound className="text-purple-600"/> Gemini API Key</h3>
                        <input type="password" value={userApiKey} onChange={e => { setUserApiKey(e.target.value); localStorage.setItem('everise_gemini_key', e.target.value); }} className="w-full border p-2 rounded bg-slate-50" placeholder="貼上 API Key"/>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border">
                        <h3 className="font-black mb-4 flex items-center gap-2"><RefreshCw className="text-orange-500"/> 字典與設定重置</h3>
                        <button onClick={resetConfigToDefaults} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-lg transition-colors mb-2">重置客戶櫃號至預設</button>
                        <button onClick={() => {if(window.confirm("確定清空品名對應字典？下次匯入時可能需要重新手動對應品名。")) updateConfig('productMappings', {});}} className="w-full bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold py-2 rounded-lg transition-colors">清空品名智能對應字典</button>
                    </div>
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