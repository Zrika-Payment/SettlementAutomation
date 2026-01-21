import React, { useState } from 'react';
import axios from 'axios';
import SettlementTable from './components/SettlementTable';

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0); // Tracking progress
  const [refreshKey, setRefreshKey] = useState(0); 

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setUploadProgress(0); // Reset progress on new file
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a file (Report_matched.csv)");
    
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);

    try {
      const res = await axios.post('http://localhost:5000/api/generate-settlement', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        // IMPORTANT: Handle large file upload progress
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        },
        // Increase timeout to 10 minutes for massive files
        timeout: 600000 
      });
      
      // matches the backend response: { batchesCreated: X, totalTransactions: Y }
      alert(`Success! Processed ${res.data.totalTransactions} transactions into ${res.data.batchesCreated} settlement batches.`);
      
      setFile(null); 
      setUploadProgress(0);
      setRefreshKey(prev => prev + 1); 
    } catch (error) {
      console.error(error);
      const errorMsg = error.response?.data?.error || "Upload Failed or Server Timeout";
      alert(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Settlement Automation</h1>
        <p className="text-gray-500 mb-8">Upload raw 'Report_matched.csv' to generate settlement batches.</p>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="flex flex-col gap-4">
            <div className="flex gap-4 items-center w-full">
              <div className="relative flex-grow">
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={handleFileChange} 
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2.5 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100 cursor-pointer border border-gray-300 rounded-lg"
                />
              </div>
              <button 
                onClick={handleUpload}
                disabled={loading || !file}
                className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm whitespace-nowrap"
              >
                {loading ? 'Processing...' : 'Generate Settlements'}
              </button>
            </div>

            {/* Progress Bar UI */}
            {loading && (
              <div className="w-full mt-2">
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium text-blue-700">
                    {uploadProgress < 100 ? `Uploading: ${uploadProgress}%` : 'Finalizing Settlement Calculations...'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>

        <SettlementTable key={refreshKey} />
      </div>
    </div>
  );
}

export default App;