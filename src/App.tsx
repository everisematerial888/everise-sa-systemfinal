import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, Upload, Printer, ChevronRight, Hash, 
  ArrowLeft, Settings, Search,
  CheckCircle2, FileSpreadsheet,
  Table as TableIcon, LayoutDashboard, Edit3, X, Trash,
  Download, Database, Layers, Sparkles, MessageSquare, Loader2,
  TrendingUp, BarChart3, Calculator,
  Cloud, CloudOff, LogOut, Lock, Globe, Container, PlusCircle, Save, History, Trash2, PieChart
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, query, orderBy, where, getDocs
} from 'firebase/firestore';

// --- AI Modal ---
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
            placeholder="輸入問題..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
          />
          <button onClick={onSend} disabled={loading || !prompt} className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />} 送出
          </button>
        </div>
      </div>
    </div>
  );
};

// --- 手動新增 Modal ---
const ManualAddModal = ({ show, onClose, onSave }) => {
  const [containerNo, setContainerNo] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  if (!show) return null;
  const handleSubmit = async () => {
    if (!containerNo || !amount) return alert('請填寫完整');
    setLoading(true); await onSave(containerNo, amount); setLoading(false);
    setContainerNo(''); setAmount(''); onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">手動新增中國直出</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div><label className="block text-sm font-medium mb-1">櫃號</label><input type="text" className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500" value={containerNo} onChange={e => setContainerNo(e.target.value)} /></div>
          <div><label className="block text-sm font-medium mb-1">金額</label><input type="number" className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500" value={amount} onChange={e => setAmount(e.target.value)} /></div>
        </div>
        <div className="p-4 bg-slate-50 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg">取消</button>
          <button onClick={handleSubmit} disabled={loading} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 儲存</button>
        </div>
      </div>
    </div>
  );
};

// --- SA 請款單預覽 Modal ---
const SaPreviewModal = ({ show, onClose, client, orders }) => {
  if (!show || !client) return null;
  const total = orders.reduce((sum, o) => sum + (Number(o['總價']) || (Number(o['數量'])*Number(o['單價']))), 0);
  
  return (
    <div className="fixed inset-0 bg-black/80 z-[200] flex flex-col items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl h-[90vh] overflow-y-auto rounded-lg shadow-2xl p-8 print:p-0 print:w-full print:h-auto print:shadow-none">
        <div className="flex justify-between items-start mb-8 print:hidden">
          <h2 className="text-2xl font-bold text-slate-800">請款單預覽</h2>
          <div className="flex gap-2">
            <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"><Printer className="w-4 h-4"/> 列印</button>
            <button onClick={onClose} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300"><X className="w-4 h-4"/></button>
          </div>
        </div>

        <div className="border-2 border-slate-800 p-8 min-h-[800px] relative">
          <div className="text-center mb-8 border-b-2 border-slate-800 pb-4">
            <h1 className="text-4xl font-black tracking-widest text-slate-900 mb-2">EVERISE</h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Billing Statement / Invoice</p>
          </div>
          
          <div className="flex justify-between mb-8">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Bill To:</p>
              <h3 className="text-xl font-bold text-slate-800">{client}</h3>
              <p className="text-sm text-slate-500 mt-1">Date: {new Date().toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Invoice Total:</p>
              <h3 className="text-3xl font-black text-emerald-600">USD {total.toLocaleString()}</h3>
            </div>
          </div>

          <table className="w-full text-sm mb-8">
            <thead className="border-b-2 border-slate-800 text-slate-600">
              <tr>
                <th className="py-2 text-left">Date</th>
                <th className="py-2 text-left">Order / Container</th>
                <th className="py-2 text-left">Item</th>
                <th className="py-2 text-right">Qty</th>
                <th className="py-2 text-right">Unit Price</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {orders.map((order, idx) => (
                <tr key={idx}>
                  <td className="py-3 text-slate-500">{order['日期']}</td>
                  <td className="py-3 font-mono font-bold text-slate-700">
                    {order['單號']}<br/><span className="text-xs text-slate-400">{order['櫃號']} {order['出貨地'] === 'CN' ? '(CN)' : ''}</span>
                  </td>
                  <td className="py-3 text-slate-600">{order['品名'] || 'General Item'}</td>
                  
                  {/* 印出自動換算後的明細，例如: 50*2R+45=145Y */}
                  <td className="py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                    {order['數量明細'] || Number(order['數量']).toLocaleString()}
                  </td>
                  
                  <td className="py-3 text-right">{Number(order['單價']).toFixed(2)}</td>
                  <td className="py-3 text-right font-bold text-slate-800">
                    {(Number(order['總價']) || (Number(order['數量'])*Number(order['單價']))).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end border-t-2 border-slate-800 pt-4">
            <div className="w-1/3">
              <div className="flex justify-between py-2 font-bold text-lg">
                <span>Total:</span><span>USD {total.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="absolute bottom-8 left-8 right-8 text-center text-xs text-slate-400">Thank you for your business.</div>
        </div>
      </div>
    </div>
  );
};

const App = () => {
  // --- 🚨 記得填回您的 AI Key 🚨 ---
  const apiKey = "AIzaSyD6v4BGNqEzJwAUlSmijajj_jUU715wnXc";  

  // --- 🚨 記得填回您的 Firebase Config 🚨 ---
  const firebaseConfig = {
    apiKey: "AIzaSyDsGkGsWS4sRIn3o9XzWmqGSbZg4i5Dc9g",
    authDomain: "sa-test-96792.firebaseapp.com",
    projectId: "sa-test-96792",
    storageBucket: "sa-test-96792.firebasestorage.app",
    messagingSenderId: "736271192466",
    appId: "1:736271192466:web:1517c3d40e3e61d1c1b14b",
    measurementId: "G-1X3X3FWSM7"
  };