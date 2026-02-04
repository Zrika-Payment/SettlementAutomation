import React, { useState } from 'react';
import axios from 'axios';

const QueryByDate = () => {
    const [queryDate, setQueryDate] = useState('');
    const [queryStatus, setQueryStatus] = useState('');
    const [queryResult, setQueryResult] = useState(null);
    const [querying, setQuerying] = useState(false);

    const todayStr = new Date().toISOString().slice(0, 10);

    const handleQueryByDate = async () => {
        if (!queryDate) {
            alert('Please select a date to query settlements');
            return;
        }

        setQuerying(true);
        setQueryResult(null);

        try {
            const params = { date: queryDate };
            if (queryStatus) params.status = queryStatus;

            const response = await axios.get('http://localhost:5000/api/settlements/by-date', { params });
            setQueryResult(response.data);

        } catch (error) {
            console.error('Query by date error:', error);
            const errorMsg = error.response?.data?.error || 'Failed to query settlements';
            alert(`Error: ${errorMsg}`);
        } finally {
            setQuerying(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Query Settlements by Date</h2>
            <p className="text-gray-600 mb-4">View settlements created on a specific date with optional status filter</p>

            <div className="flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
                    <input
                        type="date"
                        value={queryDate}
                        onChange={e => setQueryDate(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500"
                        max={todayStr}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status Filter</label>
                    <select
                        value={queryStatus}
                        onChange={e => setQueryStatus(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-500"
                    >
                        <option value="">All Statuses</option>
                        <option value="Not Yet Settled">Not Yet Settled</option>
                        <option value="Processed">Processed</option>
                    </select>
                </div>
                <button
                    onClick={handleQueryByDate}
                    disabled={querying || !queryDate}
                    className="flex items-center px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                    {querying ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Querying...
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            Query Settlements
                        </>
                    )}
                </button>
            </div>

            {/* Query Result Display */}
            {queryResult && (
                <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <h3 className="font-medium text-purple-800 mb-2">
                        Settlements for {queryResult.date} {queryResult.status !== 'all' ? `(${queryResult.status})` : ''}
                    </h3>
                    <div className="text-center mb-4">
                        <span className="text-3xl font-bold text-purple-600">{queryResult.count}</span>
                        <span className="text-gray-600 ml-2">settlements found</span>
                    </div>
                    {queryResult.settlements.length > 0 && (
                        <div className="max-h-48 overflow-y-auto">
                            <div className="space-y-2">
                                {queryResult.settlements.slice(0, 10).map((settlement, index) => (
                                    <div key={settlement._id || index} className="flex justify-between items-center bg-white p-3 rounded border">
                                        <div>
                                            <div className="font-medium text-gray-800">{settlement.merchantName}</div>
                                            <div className="text-sm text-gray-500">
                                                {new Date(settlement.createdAt).toLocaleDateString()} • 
                                                Batch: {settlement.batchId?.substring(0, 8)}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-medium text-green-600">₹{settlement.settlementAmount?.toLocaleString()}</div>
                                            <div className={`text-xs px-2 py-1 rounded-full ${
                                                settlement.payoutStatus === 'Processed' 
                                                    ? 'bg-green-100 text-green-700' 
                                                    : 'bg-yellow-100 text-yellow-700'
                                            }`}>
                                                {settlement.payoutStatus}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {queryResult.settlements.length > 10 && (
                                    <div className="text-center text-sm text-gray-500 py-2">
                                        ... and {queryResult.settlements.length - 10} more settlements
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default QueryByDate;