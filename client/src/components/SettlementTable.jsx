import React, { useEffect, useState } from 'react';
import axios from 'axios';

const SettlementTable = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = () => {
    axios.get('http://localhost:5000/api/settlements')
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  // Helper to format currency
  const toCurrency = (num) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(num);
  };

  if (loading) return <div className="text-center py-10 text-gray-500">Loading settlements...</div>;

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Merchant</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Net Settlement</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Gross Amount</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Deductions</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Txn Count</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Credit Date</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.length === 0 ? (
               <tr><td colSpan="7" className="text-center py-8 text-gray-400">No settlement batches found</td></tr>
            ) : (
              data.map((row) => (
                <tr key={row._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{row.merchantName}</div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5">{row.batchId ? row.batchId.substring(0,8) : '-'}</div>
                  </td>
                  
                  {/* Financials */}
                  <td className="px-6 py-4 text-right whitespace-nowrap text-sm text-green-600 font-bold">
                    {toCurrency(row.settlementAmount)}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap text-sm text-gray-500">
                    {toCurrency(row.totalAmount)}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap text-sm text-red-400">
                    -{toCurrency(row.deductedAmount)}
                  </td>

                  {/* Counts */}
                  <td className="px-6 py-4 text-center whitespace-nowrap text-sm text-gray-600">
                    {row.transactionsCount}
                  </td>

                  {/* Dates */}
                  <td className="px-6 py-4 text-center whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {row.createdAt ? new Date(row.createdAt).toLocaleDateString('en-GB') : '-'}
                    </div>
                    <div className="text-xs text-gray-400">{row.dateRange}</div>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 text-center whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border 
                      ${row.payoutStatus === 'Processed' 
                        ? 'bg-green-50 text-green-700 border-green-200' 
                        : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                      {row.payoutStatus}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SettlementTable;