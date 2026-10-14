import React, { useState, useEffect } from 'react';
import apiClient from '../../api/apiClient';
import { Database, Link2, ShieldAlert, CheckCircle, RefreshCcw, Plus, Search, QrCode, Download, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const BlockchainLedger: React.FC = () => {
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [integrityStatus, setIntegrityStatus] = useState<any>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [registeredBlock, setRegisteredBlock] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    medicineName: '',
    batchNumber: '',
    manufacturer: '',
    expiryDate: '',
  });

  const fetchLedger = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/blockchain/ledger');
      setLedger(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const checkIntegrity = async () => {
    try {
      const { data } = await apiClient.get('/blockchain/integrity-check');
      setIntegrityStatus(data);
    } catch (err) {
      console.error(err);
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
      alert('Batch successfully registered on the immutable ledger!');
      setShowRegister(false);
      setRegisteredBlock(data);
      setFormData({ medicineName: '', batchNumber: '', manufacturer: '', expiryDate: '' });
      fetchLedger();
      checkIntegrity();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to register batch');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Database className="text-primary-600 mr-3 h-8 w-8" /> 
            Blockchain Ledger
          </h1>
          <p className="text-gray-500 mt-2">Immutable registry of all verified medicine batches.</p>
        </div>
        <div className="flex gap-4">
          <button onClick={checkIntegrity} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center shadow-sm">
            <RefreshCcw size={18} className="mr-2" /> Verify Integrity
          </button>
          <button onClick={() => setShowRegister(!showRegister)} className="bg-primary-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-800 transition-colors flex items-center shadow-sm">
            <Plus size={18} className="mr-2" /> Register Batch
          </button>
        </div>
      </div>

      {integrityStatus && (
        <div className={`p-4 rounded-xl mb-8 flex items-center border ${integrityStatus.isValid ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {integrityStatus.isValid ? <CheckCircle className="mr-3" /> : <ShieldAlert className="mr-3" />}
          <div>
            <h3 className="font-bold">{integrityStatus.isValid ? 'Ledger Intact' : 'Ledger Tampering Detected!'}</h3>
            <p className="text-sm">
              {integrityStatus.isValid 
                ? 'All block hashes mathematically align. No tampering detected.' 
                : `Tampering detected in blocks: ${integrityStatus.tamperedBlocks.join(', ')}`}
            </p>
          </div>
        </div>
      )}

      {showRegister && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8">
          <h2 className="text-xl font-bold mb-4">Register New Batch to Blockchain</h2>
          <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Medicine Name *</label>
              <input required value={formData.medicineName} onChange={e=>setFormData({...formData, medicineName: e.target.value})} type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number *</label>
              <input required value={formData.batchNumber} onChange={e=>setFormData({...formData, batchNumber: e.target.value})} type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer *</label>
              <input required value={formData.manufacturer} onChange={e=>setFormData({...formData, manufacturer: e.target.value})} type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date *</label>
              <input required value={formData.expiryDate} onChange={e=>setFormData({...formData, expiryDate: e.target.value})} type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button type="button" onClick={() => setShowRegister(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg mr-2 font-medium">Cancel</button>
              <button type="submit" className="bg-primary-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-primary-700 shadow-sm">Commit to Ledger</button>
            </div>
          </form>
        </div>
      )}

      {registeredBlock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-5 bg-primary-600 flex justify-between items-center text-white">
              <h3 className="font-bold flex items-center"><QrCode className="mr-2" /> Batch QR Code Generated</h3>
              <button onClick={() => setRegisteredBlock(null)} className="p-1 hover:bg-primary-700 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <div className="p-8 flex flex-col items-center bg-gray-50">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4" id="qr-code-container">
                <QRCodeSVG 
                  value={JSON.stringify({
                    batchNumber: registeredBlock.batchNumber,
                    manufacturer: registeredBlock.manufacturer,
                    medicineName: registeredBlock.medicineName,
                    blockchainHash: registeredBlock.blockchainHash
                  })}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="text-center font-bold text-gray-900">{registeredBlock.medicineName}</p>
              <p className="text-center text-xs text-gray-500 font-mono mt-1">Batch: {registeredBlock.batchNumber}</p>
              
              <button 
                onClick={() => {
                  const svg = document.getElementById('qr-code-container')?.querySelector('svg');
                  if (svg) {
                    const svgData = new XMLSerializer().serializeToString(svg);
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    img.onload = () => {
                      canvas.width = img.width;
                      canvas.height = img.height;
                      ctx?.drawImage(img, 0, 0);
                      const pngFile = canvas.toDataURL('image/png');
                      const downloadLink = document.createElement('a');
                      downloadLink.download = `QR_${registeredBlock.batchNumber}.png`;
                      downloadLink.href = `${pngFile}`;
                      downloadLink.click();
                    };
                    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
                  }
                }}
                className="mt-6 w-full bg-primary-600 text-white font-bold py-3 rounded-xl hover:bg-primary-700 flex items-center justify-center transition-colors"
              >
                <Download size={18} className="mr-2" /> Download QR Code
              </button>
              <p className="mt-3 text-[10px] text-gray-400 text-center max-w-[250px]">
                Attach this QR code to the medicine packaging. Patients can scan this to verify blockchain authenticity.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
          <h3 className="font-bold text-gray-700 flex items-center"><Link2 className="mr-2" size={18}/> Chain Overview</h3>
          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded font-bold">{ledger.length} Blocks</span>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading immutable ledger...</div>
        ) : ledger.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No blocks found in ledger.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b text-xs text-gray-500 uppercase tracking-wider">
                  <th className="p-4 font-bold">Block Time</th>
                  <th className="p-4 font-bold">Medicine</th>
                  <th className="p-4 font-bold">Batch</th>
                  <th className="p-4 font-bold">Hash Signature (SHA-256)</th>
                  <th className="p-4 font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ledger.map((block) => (
                  <tr key={block._id} className="hover:bg-gray-50">
                    <td className="p-4 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(block.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-gray-900 text-sm">{block.medicineName}</p>
                      <p className="text-xs text-gray-500">{block.manufacturer}</p>
                    </td>
                    <td className="p-4 text-sm font-mono">{block.batchNumber}</td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-mono text-primary-600 bg-primary-50 px-2 py-0.5 rounded truncate max-w-[200px]" title={`Current: ${block.blockchainHash}`}>
                          {block.blockchainHash.substring(0, 24)}...
                        </span>
                        <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded truncate max-w-[200px]" title={`Prev: ${block.previousHash}`}>
                          {block.previousHash.substring(0, 24)}...
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                        {block.verificationStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      <p className="mt-8 text-xs text-center text-gray-400 max-w-3xl mx-auto">
        * Academic/Hackathon Notice: This module uses a simulated local immutable ledger (SHA-256 linked blocks). 
        In production, this translates to smart contracts on Hyperledger Fabric, Polygon, or Ethereum testnets. 
        Records written here cannot be manually edited through standard APIs.
      </p>
    </div>
  );
};

export default BlockchainLedger;
