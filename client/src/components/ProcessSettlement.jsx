import React, { useState } from 'react';
import axios from 'axios';
import SettlementTable from './SettlementTable';
import ProcessByDate from './ProcessByDate';
import QueryByDate from './QueryByDate';
import { useNavigate } from 'react-router-dom';
function ProcessSettlement() {

    const navigate = useNavigate();
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0); // Tracking progress
    const [refreshKey, setRefreshKey] = useState(0);

    // NEW: State for active tab
    const [activeTab, setActiveTab] = useState('upload');

    // NEW: State to track if a batch is ready to be downloaded
    const [lastProcessedBatch, setLastProcessedBatch] = useState(null);

    const refreshTable = () => setRefreshKey(prev => prev + 1);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setUploadProgress(0); // Reset progress on new file
        setLastProcessedBatch(null); // Reset download button when new file is selected
    };

    const onLogout = () => {
        // Clear your auth state/tokens here
        localStorage.removeItem('userToken');

        // Redirect to the AuthPage
        navigate('/');
    };
    const handleUpload = async () => {
        if (!file) return alert("Please select a file (Report_matched.csv)");

        const formData = new FormData();
        formData.append('file', file);
        setLoading(true);
        setLastProcessedBatch(null); // Hide download button while processing

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

            // --- DEBUGGING LOGS (Check Console F12) ---
            console.log("Server Response:", res.data);

            // matches the backend response: { batchesCreated: X, totalTransactions: Y }
            alert(`Success! Processed ${res.data.totalTransactions} transactions into ${res.data.batchesCreated} settlement batches.`);

            setFile(null);
            setUploadProgress(0);
            setRefreshKey(prev => prev + 1);
            // Check if the backend actually sent a batchId, otherwise fallback to true to force button to show
            const idToSave = res.data.batchId || res.data.filename || "Settlement_Output.csv";
            console.log("Enabling Download Button with ID:", idToSave);
            setLastProcessedBatch(idToSave);
        } catch (error) {
            console.error(error);
            const errorMsg = error.response?.data?.error || "Upload Failed or Server Timeout";
            alert(`Error: ${errorMsg}`);
        } finally {
            setLoading(false);
        }
    };
    // NEW: Function to handle the file download
    const handleDownloadReport = async () => {
        try {
            // NOTE: Ensure your backend has a GET route for this
            const response = await axios.get('http://localhost:5000/api/download-settlement', {
                responseType: 'blob', // IMPORTANT: This tells axios to treat response as binary data
                params: { batchId: lastProcessedBatch } // Optional: Pass ID if backend needs it
            });

            // Create a URL for the blob
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;

            // Extract filename from header or set default
            const contentDisposition = response.headers['content-disposition'];
            let filename = 'Settlement_Batch_Output.csv';
            if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (fileNameMatch && fileNameMatch.length === 2) filename = fileNameMatch[1];
            }

            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();

            // Cleanup
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error("Download failed", error);
            alert("Failed to download the report.");
        }
    };

    // State for date picker
    const [selectedDate, setSelectedDate] = useState('');
    // Calculate min and max date for last 15 days
    const todayStr = new Date().toISOString().slice(0, 10);
    const minDateObj = new Date();
    minDateObj.setDate(minDateObj.getDate() - 14);
    const minDateStr = minDateObj.toISOString().slice(0, 10);

    // Handler for downloading 15-day or single-day Excel
    const handleDownloadDaywiseExcel = async () => {
        try {
            let url = 'http://localhost:5000/api/download-daywise-excel';
            let params = {};
            if (selectedDate) {
                params.date = selectedDate;
            }
            const response = await axios.get(url, {
                responseType: 'blob',
                params
            });
            const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            // Try to get filename from header
            const contentDisposition = response.headers['content-disposition'];
            let filename = selectedDate ? `Settlement_${selectedDate}.xlsx` : 'Daywise_Settlements_Last_15_Days.xlsx';
            if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename="?([^";]+)"?/);
                if (fileNameMatch && fileNameMatch.length === 2) filename = fileNameMatch[1];
            }
            link.href = blobUrl;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            alert('Failed to download Excel file.');
        }
    };



    return (
        <div className="min-h-screen bg-gray-50 p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Settlement Automation</h1>
                <p className="text-gray-500 mb-8">Upload raw 'Report_matched.csv' to generate settlement batches.</p>
                <div className="w-full flex flex-wrap gap-4 justify-start p-4">
                    <button
                        onClick={onLogout}
                        className="flex items-center px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-lg transition-colors duration-200 border border-red-200"
                    >
                        <svg
                            className="w-4 h-4 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                    </button>
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                            min={minDateStr}
                            max={todayStr}
                        />
                        <button
                            onClick={handleDownloadDaywiseExcel}
                            className="flex items-center px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-lg transition-colors duration-200 border border-blue-200"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                            {selectedDate ? `Download ${selectedDate} Excel` : 'Download 15-Day Daywise Excel'}
                        </button>
                        <span className="text-xs text-gray-500 ml-2">({minDateStr} to {todayStr})</span>
                    </div>
                </div>

                {/* Menu Bar */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('upload')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                        Upload & Generate
                    </button>
                    <button
                        onClick={() => setActiveTab('process')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'process' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                        Process by Date
                    </button>
                    <button
                        onClick={() => setActiveTab('query')}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTab === 'query' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                    >
                        Query by Date
                    </button>
                </div>

                {activeTab === 'upload' && (
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
                            {/* NEW: Download Success Section */}
                            {!loading && lastProcessedBatch && (
                                <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between animate-fade-in">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="text-sm text-green-800 font-medium">Settlement processed successfully!</span>
                                    </div>
                                    <button
                                        onClick={handleDownloadReport}
                                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Download Batch Report
                                    </button>
                                </div>
                            )}
                        </div></div>
                )}

                {activeTab === 'process' && <ProcessByDate onRefreshTable={refreshTable} />}

                {activeTab === 'query' && <QueryByDate />}

                <SettlementTable key={refreshKey} />
            </div>
        </div>

    );
}

export default ProcessSettlement;