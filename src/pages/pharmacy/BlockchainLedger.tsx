import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import {
  Database,
  Link2,
  ShieldAlert,
  CheckCircle2,
  RefreshCcw,
  Plus,
  Search,
  QrCode,
  Download,
  X,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Check
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';

const BlockchainLedger: React.FC = () => {
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [integrityStatus, setIntegrityStatus] = useState<any>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [registeredBlock, setRegisteredBlock] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectBlock, setInspectBlock] = useState<any>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    medicineName: '',
    batchNumber: '',
    manufacturer: '',
    expiryDate: ''
  });

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/blockchain/ledger');
      setLedger(data);
    } catch (err) {
      toast.error('Failed to retrieve blockchain blocks');
    } finally {
      setLoading(false);
    }
  };

  const checkIntegrity = async () => {
    try {
      const { data } = await apiClient.get('/blockchain/integrity-check');
      setIntegrityStatus(data);
      if (data.isValid) {
        toast.success('Blockchain cryptographic integrity verified: 100% valid');
      } else {
        toast.error('Blockchain tampering detected!');
      }
    } catch (err) {
      toast.error('Failed to run chain integrity audit');
    }
  };

  useEffect(() => {
    fetchLedger();
    checkIntegrity();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await apiClient.post('/blockchain/register-batch', formData);
      toast.success('Batch registered on the immutable cryptographic ledger!');
      setShowRegister(false);
      setRegisteredBlock(data);
      setFormData({ medicineName: '', batchNumber: '', manufacturer: '', expiryDate: '' });
      fetchLedger();
      checkIntegrity();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to register batch');
    }
  };

  const handleFillDemo = () => {
    setFormData({
      medicineName: 'Augmentin 625 Duo',
      batchNumber: 'B-AUG-' + Math.floor(100 + Math.random() * 900),
      manufacturer: 'GlaxoSmithKline Pharmaceuticals',
      expiryDate: '2026-11-30'
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    toast.success('Hash copied to clipboard!');
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const filteredBlocks = ledger.filter(block => {
    const q = searchQuery.toLowerCase();
    const dataStr = JSON.stringify(block.data || {}).toLowerCase();
    const hashStr = (block.hash || '').toLowerCase();
    const prevHashStr = (block.previousHash || '').toLowerCase();
    return dataStr.includes(q) || hashStr.includes(q) || prevHashStr.includes(q);
  });

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Database className="text-blue-600 h-7 w-7" />
              Cryptographic Blockchain Ledger
            </h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              SHA-256 Proof of Authenticity
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Tamper-proof, immutable ledger tracking medicine manufacture, lot genesis, and anti-counterfeit proofs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={checkIntegrity}
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors flex items-center shadow-xs"
          >
            <RefreshCcw size={15} className="mr-1.5 text-blue-600" /> Verify Chain Integrity
          </button>
          <button
            onClick={() => setShowRegister(true)}
            className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors flex items-center shadow-xs"
          >
            <Plus size={16} className="mr-1.5" /> Commit New Batch
          </button>
        </div>
      </div>

      {/* Integrity Status Card */}
      {integrityStatus && (
        <div
          className={`p-4 rounded-2xl flex items-center border shadow-xs ${
            integrityStatus.isValid
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {integrityStatus.isValid ? (
            <CheckCircle2 className="mr-3 text-emerald-600 shrink-0 w-6 h-6" />
          ) : (
            <ShieldAlert className="mr-3 text-rose-600 shrink-0 w-6 h-6" />
          )}
          <div className="flex-1 text-xs">
            <h3 className="font-extrabold text-sm">
              {integrityStatus.isValid
                ? 'Chain Consensus: Intact & Cryptographically Valid'
                : 'Warning: Tampering Detected in Block Chain!'}
            </h3>
            <p className="mt-0.5 opacity-90">
              {integrityStatus.isValid
                ? 'All SHA-256 block hashes mathematically align with their parent blocks. Genesis integrity is verified.'
                : `Tampering detected in blocks: ${integrityStatus.tamperedBlocks?.join(', ') || 'Unknown'}`}
            </p>
          </div>
          <div className="text-right text-[11px] font-mono text-emerald-700 font-bold hidden sm:block">
            {ledger.length} Verified Blocks
          </div>
        </div>
      )}

      {/* Register Batch Modal */}
      {showRegister && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-xl p-6 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Commit Batch to Blockchain</h2>
              </div>
              <button
                onClick={() => setShowRegister(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 flex items-center justify-between bg-blue-50/70 p-3 rounded-xl border border-blue-100 text-xs">
              <span className="text-blue-800 font-medium">Testing quickly? Auto-fill clinical batch details:</span>
              <button
                type="button"
                onClick={handleFillDemo}
                className="px-2.5 py-1 bg-blue-600 text-white rounded-lg font-bold text-[11px] hover:bg-blue-700"
              >
                ⚡ Pre-fill Sample Batch
              </button>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Medicine Name *</label>
                  <input
                    required
                    value={formData.medicineName}
                    onChange={e => setFormData({ ...formData, medicineName: e.target.value })}
                    type="text"
                    placeholder="e.g. Augmentin 625 Duo"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Batch Number *</label>
                  <input
                    required
                    value={formData.batchNumber}
                    onChange={e => setFormData({ ...formData, batchNumber: e.target.value })}
                    type="text"
                    placeholder="e.g. B-AUG-625"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-mono font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Manufacturer *</label>
                  <input
                    required
                    value={formData.manufacturer}
                    onChange={e => setFormData({ ...formData, manufacturer: e.target.value })}
                    type="text"
                    placeholder="e.g. GlaxoSmithKline"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Expiry Date *</label>
                  <input
                    required
                    value={formData.expiryDate}
                    onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
                    type="date"
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRegister(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs hover:bg-blue-700 shadow-xs"
                >
                  Commit to Immutable Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Inspection Modal */}
      {(registeredBlock || inspectBlock) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-slate-200">
            <div className="p-5 bg-gradient-to-r from-blue-600 to-indigo-600 flex justify-between items-center text-white">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <QrCode className="w-4 h-4" /> Batch Cryptographic Stamp
              </h3>
              <button
                onClick={() => {
                  setRegisteredBlock(null);
                  setInspectBlock(null);
                }}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center bg-white text-center">
              <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-xs mb-4">
                <QRCodeSVG
                  value={JSON.stringify((registeredBlock || inspectBlock)?.data || {})}
                  size={190}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="font-bold text-sm text-slate-900">
                {(registeredBlock || inspectBlock)?.data?.medicineName || 'Medicine Batch'}
              </p>
              <p className="text-xs font-mono text-slate-500 mt-0.5">
                Batch: {(registeredBlock || inspectBlock)?.data?.batchNumber}
              </p>
              <p className="text-[11px] text-slate-400 mt-2 max-w-xs font-mono break-all">
                Block Hash: {(registeredBlock || inspectBlock)?.hash?.substring(0, 24)}...
              </p>
              <button
                onClick={() => {
                  setRegisteredBlock(null);
                  setInspectBlock(null);
                  toast.success('Batch stamp confirmed!');
                }}
                className="mt-5 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Close & Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search blocks by medicine, batch, or cryptographic hash..."
            className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>
        <div className="text-xs text-slate-500 font-semibold">
          Showing <span className="text-slate-900 font-bold">{filteredBlocks.length}</span> verified blocks
        </div>
      </div>

      {/* Blockchain Timeline Cards */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs font-semibold shadow-xs">
          Reading distributed ledger blocks...
        </div>
      ) : filteredBlocks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <Database className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No blocks found matching query</h3>
          <p className="text-xs text-slate-500 mt-1">Try another batch name or clear search filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredBlocks.map((block, idx) => {
            const isGenesis = block.index === 0 || block.previousHash === '0';
            const medData = block.data || {};

            return (
              <div
                key={block._id || block.hash || idx}
                className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:border-blue-300 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-black text-sm border border-blue-100">
                      #{block.index ?? idx}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-sm text-slate-900">
                          {medData.medicineName || (isGenesis ? 'Genesis Block' : 'Medicine Lot')}
                        </h3>
                        {isGenesis && (
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                            Genesis Root
                          </span>
                        )}
                        {medData.batchNumber && (
                          <span className="bg-slate-100 text-slate-700 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-slate-200">
                            Batch: {medData.batchNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Timestamp:{' '}
                        {block.timestamp
                          ? new Date(block.timestamp).toLocaleString()
                          : 'Recorded at network launch'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInspectBlock(block)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Inspect QR Stamp</span>
                    </button>
                  </div>
                </div>

                {/* Hashes Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs font-mono">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider mb-1">
                      Current Block Hash (SHA-256)
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-blue-700 font-bold truncate text-[11px]">{block.hash}</span>
                      <button
                        onClick={() => copyToClipboard(block.hash)}
                        className="text-slate-400 hover:text-blue-600 shrink-0"
                        title="Copy Hash"
                      >
                        {copiedHash === block.hash ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Layers className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider mb-1">
                      Previous Block Parent Hash
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-600 font-medium truncate text-[11px]">
                        {block.previousHash || '0 (Genesis Root)'}
                      </span>
                      <Link2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BlockchainLedger;
