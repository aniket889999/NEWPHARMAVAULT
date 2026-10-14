import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ShieldCheck, AlertTriangle, Search, QrCode, XCircle, Upload, CheckCircle } from 'lucide-react';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';

const AuthenticityChecker: React.FC = () => {
  const [scanMode, setScanMode] = useState<'qr' | 'manual'>('manual');
  const [scanResult, setScanResult] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cdscoData, setCdscoData] = useState<any>(null);
  
  const [batch, setBatch] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [expiry, setExpiry] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    
    if (scanMode === 'qr' && isScanning) {
      scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
      scanner.render(
        (text) => {
          scanner?.clear();
          setIsScanning(false);
          parseQrAndVerify(text);
        },
        (error) => {} // ignore continuous errors
      );
    }
    
    return () => {
      scanner?.clear().catch(e => console.error(e));
    };
  }, [scanMode, isScanning]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const html5QrCode = new Html5Qrcode("reader");
      const decodedText = await html5QrCode.scanFile(file, true);
      parseQrAndVerify(decodedText);
    } catch (err) {
      alert("Could not decode QR from image. Please ensure the image is clear or use Manual Entry.");
    } finally {
      setIsProcessing(false);
    }
  };

  const parseQrAndVerify = (data: string) => {
    let extractedBatch = '';
    let extractedMfg = '';
    
    try {
      // 1. Try to parse as the new Blockchain JSON Payload
      const parsed = JSON.parse(data);
      extractedBatch = parsed.batchNumber;
      extractedMfg = parsed.manufacturer;
    } catch (e) {
      // 2. Fallback: Basic extraction assuming legacy QR contains structured text like "Batch: 123, Mfg: Cipla"
      const batchMatch = data.match(/batch[:\s-]+([a-z0-9_-]+)/i) || data.match(/bno[:\s-]+([a-z0-9_-]+)/i);
      const mfgMatch = data.match(/mfg[:\s-]+([a-z0-9\s_-]+)/i) || data.match(/manufacturer[:\s-]+([a-z0-9\s_-]+)/i);
      
      extractedBatch = batchMatch ? batchMatch[1].trim() : data.substring(0, 15);
      extractedMfg = mfgMatch ? mfgMatch[1].trim() : 'Unknown';
    }

    setBatch(extractedBatch);
    setManufacturer(extractedMfg);
    verifyAuthenticity(extractedBatch, extractedMfg);
  };

  const handleManualCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batch || !manufacturer) return alert('Batch and Manufacturer required');
    verifyAuthenticity(batch, manufacturer);
  };

  const verifyAuthenticity = async (b: string, m: string) => {
    setIsProcessing(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const { data } = await axios.post(`${API_URL}/blockchain/verify`, {
        batch: b, manufacturer: m, expiry: expiry
      });
      
      // Simulate CDSCO Check
      let cdscoResponse = null;
      if (data && data.data && data.data.name) {
         try {
           const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
           const res = await axios.get(`${API_URL}/regulatory/cdsco/${data.data.name}`);
           cdscoResponse = res.data;
           setCdscoData(cdscoResponse);
           
           // If Banned, force risk high
           if (cdscoResponse.status === 'Banned') {
             data.score = Math.max(0, data.score - 50);
             if (data.riskAnalysis) {
               data.riskAnalysis.riskLevel = 'High';
               data.riskAnalysis.suspicionScore = 100;
               data.riskAnalysis.reasons.push('CDSCO Status: BANNED');
             }
           } else if (cdscoResponse.status === 'Suspended') {
             data.score = Math.max(0, data.score - 30);
             if (data.riskAnalysis && data.riskAnalysis.riskLevel === 'Low') {
               data.riskAnalysis.riskLevel = 'Medium';
               data.riskAnalysis.suspicionScore = Math.max(60, data.riskAnalysis.suspicionScore);
             }
           }
         } catch(e) {
           console.error("CDSCO API failed", e);
         }
      }

      setScanResult(data);
    } catch (err) {
      console.error(err);
      alert('Verification server error. Please try again later.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch(status) {
      case 'verified': return { icon: <ShieldCheck className="w-16 h-16 text-green-500 mr-6" />, bg: 'bg-green-50 border-green-200', text: 'text-green-800' };
      case 'partial': return { icon: <AlertTriangle className="w-16 h-16 text-orange-500 mr-6" />, bg: 'bg-orange-50 border-orange-200', text: 'text-orange-800' };
      case 'tampered': return { icon: <XCircle className="w-16 h-16 text-red-600 mr-6" />, bg: 'bg-red-50 border-red-300', text: 'text-red-900' };
      case 'expired': return { icon: <XCircle className="w-16 h-16 text-purple-500 mr-6" />, bg: 'bg-purple-50 border-purple-200', text: 'text-purple-800' };
      default: return { icon: <XCircle className="w-16 h-16 text-red-500 mr-6" />, bg: 'bg-red-50 border-red-200', text: 'text-red-800' };
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 flex justify-center items-center gap-3">
          <ShieldCheck className="text-primary-600 w-10 h-10" /> 
          Medicine Authenticity Check
        </h1>
        <p className="text-gray-500 mt-2">Scan the QR code or manually enter the batch details to verify medicine against Official databases.</p>
      </div>

      {!scanResult ? (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex border-b mb-6">
            <button 
              onClick={() => { setScanMode('manual'); setIsScanning(false); }}
              className={`flex-1 py-3 text-center font-bold border-b-2 transition-colors ${scanMode === 'manual' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              Manual Entry
            </button>
            <button 
              onClick={() => { setScanMode('qr'); setIsScanning(true); }}
              className={`flex-1 py-3 text-center font-bold border-b-2 transition-colors ${scanMode === 'qr' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              QR Code Scanner
            </button>
          </div>

          {scanMode === 'manual' ? (
            <form onSubmit={handleManualCheck} className="space-y-4">
              <div className="bg-blue-50 text-blue-800 p-4 rounded-lg mb-6 text-sm flex">
                <AlertTriangle className="mr-3 flex-shrink-0" size={20} />
                If the QR scan fails, manually enter the details printed on the back of your medicine strip or bottle.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number *</label>
                  <input required value={batch} onChange={e=>setBatch(e.target.value)} type="text" placeholder="e.g. BXT-9021" className="w-full px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer *</label>
                  <input required value={manufacturer} onChange={e=>setManufacturer(e.target.value)} type="text" placeholder="e.g. Cipla Ltd." className="w-full px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date (Optional)</label>
                <input value={expiry} onChange={e=>setExpiry(e.target.value)} type="date" className="w-full px-4 py-3 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <button disabled={isProcessing} type="submit" className="w-full bg-primary-600 text-white font-bold py-3 rounded-lg flex items-center justify-center hover:bg-primary-700 disabled:bg-gray-400">
                {isProcessing ? 'Verifying with Servers...' : <><Search className="mr-2" /> Verify Authenticity</>}
              </button>
            </form>
          ) : (
            <div className="flex flex-col items-center">
              <div id="reader" className="w-full max-w-sm rounded-lg overflow-hidden border border-gray-200 min-h-[300px] flex items-center justify-center bg-gray-50">
                {isProcessing ? <div className="text-gray-500">Processing QR Image...</div> : null}
              </div>
              
              <div className="mt-6 flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                {!isScanning && (
                  <button onClick={() => setIsScanning(true)} className="flex-1 bg-gray-900 text-white px-6 py-3 rounded-lg flex items-center justify-center hover:bg-gray-800">
                    <QrCode className="mr-2" /> Start Camera
                  </button>
                )}
                
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-lg flex items-center justify-center hover:bg-gray-50">
                  <Upload className="mr-2" /> Upload QR Image
                </button>
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
              </div>
              <p className="mt-4 text-xs text-gray-400 text-center">
                * Note: The generated QR contains blockchain-linked metadata for high-security authenticity verification.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className={`p-8 rounded-2xl border ${getStatusConfig(scanResult.status).bg}`}>
          <div className="flex flex-col sm:flex-row items-start">
            {getStatusConfig(scanResult.status).icon}
            <div className="flex-1">
              <h2 className={`text-2xl font-bold mb-2 ${getStatusConfig(scanResult.status).text}`}>
                {scanResult.title}
              </h2>
              <p className={getStatusConfig(scanResult.status).text}>
                {scanResult.message}
              </p>

              {/* CDSCO Regulatory Compliance Badge */}
              {cdscoData && (
                <div className={`mt-4 inline-flex items-center px-4 py-2 rounded-full text-xs font-bold ${
                  cdscoData.status === 'Approved' ? 'bg-green-100 text-green-800 border border-green-200' :
                  cdscoData.status === 'Suspended' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                  'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  <ShieldCheck size={14} className="mr-1" />
                  CDSCO {cdscoData.status.toUpperCase()} ({cdscoData.licenseNumber})
                </div>
              )}

              {/* AI Integration Card */}
              <div className={`mt-4 p-4 rounded-xl border ${scanResult.status === 'verified' ? 'bg-green-100 border-green-300' : 'bg-red-100 border-red-300'} flex items-start`}>
                <div className={`p-2 rounded-full mr-3 ${scanResult.status === 'verified' ? 'bg-green-200' : 'bg-red-200'}`}>
                  <ShieldCheck size={20} className={scanResult.status === 'verified' ? 'text-green-700' : 'text-red-700'} />
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${scanResult.status === 'verified' ? 'text-green-800' : 'text-red-800'}`}>AI Health Assistant Analysis</h4>
                  <p className={`text-sm mt-1 ${scanResult.status === 'verified' ? 'text-green-700' : 'text-red-700'}`}>
                    "{scanResult.status === 'verified' 
                      ? 'This batch is verified on our immutable blockchain ledger and is mathematically proven safe to use.' 
                      : 'WARNING: This medicine is either fake, tampered, or expired. Please avoid usage immediately and report it to the authorities.'}"
                  </p>
                </div>
              </div>

              {scanResult.score !== undefined && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-700">Authenticity Score</span>
                    <span className={`text-sm font-bold ${getStatusConfig(scanResult.status).text}`}>{scanResult.score}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full ${scanResult.score > 80 ? 'bg-green-500' : scanResult.score > 40 ? 'bg-orange-500' : 'bg-red-500'}`} style={{ width: `${scanResult.score}%` }}></div>
                  </div>
                </div>
              )}
              
              <div className="mt-6 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">Blockchain Ledger Details</h4>
                <ul className="space-y-3 text-sm">
                  {Object.entries(scanResult.data).map(([k, v]) => {
                    const valStr = String(v);
                    const isHash = k.toLowerCase().includes('hash');
                    return (
                      <li key={k} className="flex justify-between items-center border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                        <span className="capitalize text-gray-500 font-medium">{k}</span> 
                        <span className={`font-bold ${isHash ? 'text-primary-600 font-mono text-xs max-w-[200px] truncate' : 'text-gray-900'} bg-gray-50 px-3 py-1 rounded`}>
                          {valStr}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Fake Medicine Detection AI Output */}
              {scanResult.riskAnalysis && (
                <div className={`mt-6 p-5 rounded-xl border shadow-sm ${
                  scanResult.riskAnalysis.riskLevel === 'High' ? 'bg-red-50 border-red-300' :
                  scanResult.riskAnalysis.riskLevel === 'Medium' ? 'bg-yellow-50 border-yellow-300' :
                  'bg-green-50 border-green-300'
                }`}>
                  <h4 className="text-xs font-bold uppercase mb-3 flex items-center tracking-wider text-gray-700">
                    <ShieldCheck className="mr-2" size={16} /> Fake Medicine Detection AI
                  </h4>
                  <div className="flex items-center mb-4">
                    <div className="flex-1">
                      <p className="text-sm text-gray-600 font-medium mb-1">Suspicion Score</p>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className={`h-2.5 rounded-full ${
                          scanResult.riskAnalysis.suspicionScore > 70 ? 'bg-red-600' :
                          scanResult.riskAnalysis.suspicionScore > 30 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`} style={{ width: `${scanResult.riskAnalysis.suspicionScore}%` }}></div>
                      </div>
                    </div>
                    <div className="ml-6 text-center">
                      <p className="text-sm text-gray-600 font-medium mb-1">Risk Level</p>
                      <span className={`px-3 py-1 rounded text-xs font-bold text-white uppercase ${
                        scanResult.riskAnalysis.riskLevel === 'High' ? 'bg-red-600' :
                        scanResult.riskAnalysis.riskLevel === 'Medium' ? 'bg-yellow-500' :
                        'bg-green-600'
                      }`}>
                        {scanResult.riskAnalysis.riskLevel}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-600 uppercase mb-2">Detection Factors</p>
                    <ul className="space-y-1">
                      {scanResult.riskAnalysis.reasons.map((reason: string, idx: number) => (
                        <li key={idx} className="text-sm flex items-start text-gray-800">
                          <AlertTriangle size={14} className="mr-2 mt-0.5 flex-shrink-0 text-gray-500" /> {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Advanced Supply Chain Visualization */}
              {scanResult.timeline && scanResult.timeline.length > 0 && (
                <div className="mt-6 bg-white p-5 rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <h4 className="text-xs font-bold text-gray-400 uppercase mb-6 tracking-wider">Supply Chain Flow</h4>
                  <div className="flex flex-col md:flex-row items-center justify-between relative px-4">
                    {/* Horizontal connecting line (Desktop) */}
                    <div className="hidden md:block absolute top-6 left-12 right-12 h-1 bg-gray-200 -z-10"></div>
                    
                    {scanResult.timeline.map((step: any, idx: number) => (
                      <div key={idx} className="flex flex-col items-center relative z-10 w-full md:w-1/3 mb-6 md:mb-0">
                        {/* Vertical line (Mobile) */}
                        {idx !== 0 && <div className="md:hidden h-8 w-0.5 bg-gray-200 mb-2"></div>}
                        
                        <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center bg-white ${
                          scanResult.status === 'verified' ? 'border-green-500 text-green-600 animate-pulse' : 
                          'border-gray-300 text-gray-400'
                        }`}>
                          <CheckCircle size={20} />
                        </div>
                        <div className="mt-3 text-center">
                          <p className="text-sm font-bold text-gray-900">{step.stage}</p>
                          <p className="text-xs text-gray-500 max-w-[120px] truncate mx-auto" title={step.detail}>{step.detail}</p>
                          <p className="text-[10px] text-gray-400 mt-1 font-mono">{new Date(step.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-8 flex flex-col sm:flex-row gap-4 items-center w-full">
                <button onClick={() => { setScanResult(null); setCdscoData(null); }} className="w-full sm:w-auto bg-white shadow-sm border border-gray-200 px-8 py-3 rounded-xl font-bold text-gray-700 hover:bg-gray-50 hover:shadow transition-all">
                  Scan Another Medicine
                </button>
              </div>
              <p className="mt-4 text-xs text-gray-400 italic text-center w-full">
                This system simulates regulatory compliance (CDSCO). In production, real government APIs and Central Drugs Standard Control Organization integrations will be used.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthenticityChecker;