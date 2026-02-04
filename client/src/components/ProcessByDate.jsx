import React, { useState } from 'react';
import axios from 'axios';

const ProcessByDate = ({ onRefreshTable }) => {
    const [processDate, setProcessDate] = useState('');
    const [processingByDate, setProcessingByDate] = useState(false);
    const [processResult, setProcessResult] = useState(null);

    const todayStr = new Date().toISOString().slice(0, 10);

    const handleProcessByDate = async () => {
        if (!processDate) {
            alert('Please select a date to process settlements');
            return;
        }

        setProcessingByDate(true);
        setProcessResult(null);

        try {
            const response = await axios.post('http://localhost:5000/api/settlements/process-by-date', {
                date: processDate
            });

            setProcessResult(response.data);

            if (response.data.alreadyProcessed) {
                alert(`All settlements for ${processDate} are already processed.`);
            } else if (response.data.noSettlements) {
                alert(`No settlements found for ${processDate}.`);
            } else {
                alert(`Processing complete! ${response.data.summary.processed} settlements processed successfully.`);
                // Refresh the settlement table only if settlements were actually processed
                onRefreshTable();
            }

        } catch (error) {
            console.error('Process by date error:', error);
            const errorMsg = error.response?.data?.error || 'Failed to process settlements';
            alert(`Error: ${errorMsg}`);
        } finally {
            setProcessingByDate(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Process Settlements by Date</h2>
            <p className="text-gray-600 mb-4">Mark all unsettled settlements for a specific date as processed</p>

            <div className="flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
                    <input
                        type="date"
                        value={processDate}
                        onChange={e => setProcessDate(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-500"
                        max={todayStr}
                    />
                </div>
                <button
                    onClick={handleProcessByDate}
                    disabled={processingByDate || !processDate}
                    className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                    {processingByDate ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Process Settlements
                        </>
                    )}
                </button>
            </div>

            {/* Process Result Display */}
            {processResult && (
                <div className={`mt-4 p-4 border rounded-lg ${
                    processResult.alreadyProcessed ? 'bg-yellow-50 border-yellow-200' :
                    processResult.noSettlements ? 'bg-gray-50 border-gray-200' :
                    'bg-green-50 border-green-200'
                }`}>
                    <h3 className={`font-medium mb-2 ${
                        processResult.alreadyProcessed ? 'text-yellow-800' :
                        processResult.noSettlements ? 'text-gray-800' :
                        'text-green-800'
                    }`}>
                        Results for {processResult.date}
                    </h3>
                    
                    {processResult.alreadyProcessed ? (
                        <p className="text-yellow-700">All settlements for this date are already processed.</p>
                    ) : processResult.noSettlements ? (
                        <p className="text-gray-700">No settlements found for this date.</p>
                    ) : (
                        <>
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-green-600">{processResult.summary.found}</div>
                                    <div className="text-gray-600">Found</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-blue-600">{processResult.summary.processed}</div>
                                    <div className="text-gray-600">Processed</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-2xl font-bold text-red-600">{processResult.summary.failed}</div>
                                    <div className="text-gray-600">Failed</div>
                                </div>
                            </div>
                            {processResult.processedSettlements.length > 0 && (
                                <div className="mt-3">
                                    <p className="text-sm text-gray-600 mb-2">Processed Settlements:</p>
                                    <div className="max-h-32 overflow-y-auto">
                                        {processResult.processedSettlements.map((settlement, index) => (
                                            <div key={index} className="text-xs text-gray-500 py-1">
                                                {settlement.merchantName} - ₹{settlement.settlementAmount} ({settlement.paymentReference})
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProcessByDate;