const fs = require('fs');
const csv = require('csv-parser');
const { v4: uuidv4 } = require('uuid');
const Settlement = require('../models/Settlement');
const mapping = require('../config/fieldMapping');

// 1. Helper to clean currency strings safely
const parseCurrency = (value) => {
    if (value === undefined || value === null || value === '') return 0;
    // Remove commas and handle scientific notation
    const cleanValue = value.toString().replace(/,/g, '').trim();
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
};

// 2. Custom Date Parser for "15-01-2026 20:57"
const parseCSVDate = (dateStr) => {
    if (!dateStr) return null;
    try {
        // Split "15-01-2026 20:57" into ["15-01-2026", "20:57"]
        const [datePart] = dateStr.trim().split(' ');
        const [day, month, year] = datePart.split('-');
        // Format as YYYY-MM-DD for standard JS parsing
        const date = new Date(`${year}-${month}-${day}`);
        return isNaN(date.getTime()) ? null : date;
    } catch (e) {
        return null;
    }
};

exports.generateSettlementFromRaw = async (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');

    const filePath = req.file.path;
    const headerCounts = {};
    const groupedData = {}; // We only store the totals per merchant, not every row
    let rowCount = 0;

    console.log(`🚀 Starting processing: ${req.file.originalname}`);

    // Create a read stream to process row-by-row (efficient for large files)
    const stream = fs.createReadStream(filePath)
        .pipe(csv({
            mapHeaders: ({ header }) => {
                headerCounts[header] = (headerCounts[header] || 0) + 1;
                return headerCounts[header] > 1 ? `${header}_${headerCounts[header]}` : header;
            }
        }));

    stream.on('data', (row) => {
        rowCount++;

        // 1. Status Check (Trim handles hidden spaces in CSV)
        const status = row[mapping.rawHeaders.status]?.trim();
        if (status !== 'Success') return;

        const merchant = row[mapping.rawHeaders.merchantName];
        const merchantId = row[mapping.rawHeaders.merchantId];

        if (!merchant || !merchantId) return; // Skip malformed rows

        const key = `${merchant}_${merchantId}`;

        // 2. Initialize Bucket
        if (!groupedData[key]) {
            groupedData[key] = {
                merchantName: merchant,
                netAmount: 0,
                grossAmount: 0,
                deductions: 0,
                count: 0,
                minDate: null,
                maxDate: null
            };
        }

        // 3. Aggregate Math Immediately
        const net = parseCurrency(row[mapping.rawHeaders.netAmount]);
        const gross = parseCurrency(row[mapping.rawHeaders.totalAmount]);
        const tax1 = parseCurrency(row[mapping.rawHeaders.gst1]);
        const tax2 = parseCurrency(row[mapping.rawHeaders.gst2]);

        groupedData[key].netAmount += net;
        groupedData[key].grossAmount += gross;
        groupedData[key].deductions += (tax1 + tax2);
        groupedData[key].count += 1;

        // 4. Date Tracking (Memory efficient: only store min/max)
        const rowDate = parseCSVDate(row[mapping.rawHeaders.date]);
        if (rowDate) {
            if (!groupedData[key].minDate || rowDate < groupedData[key].minDate) groupedData[key].minDate = rowDate;
            if (!groupedData[key].maxDate || rowDate > groupedData[key].maxDate) groupedData[key].maxDate = rowDate;
        }

        // Log progress for very large files
        if (rowCount % 5000 === 0) console.log(`⏳ Processed ${rowCount} rows...`);
    });

    stream.on('end', async () => {
        try {

            // Transform grouped results into Database Format
            const settlementBatches = Object.values(groupedData).map(data => {

                // Format Date Range safely
                const dateRange = (data.minDate && data.maxDate)
                    ? `${data.minDate.toISOString().split('T')[0]} - ${data.maxDate.toISOString().split('T')[0]}`
                    : "Date Unknown";

                // T+1 Logic
                const today = new Date();
                const tPlusOne = new Date(today);
                tPlusOne.setDate(today.getDate() + 1);

                return {
                    batchId: uuidv4(),
                    merchantName: data.merchantName,
                    settlementAmount: parseFloat(data.netAmount.toFixed(2)),
                    totalAmount: parseFloat(data.grossAmount.toFixed(2)),
                    deductedAmount: parseFloat(data.deductions.toFixed(2)),
                    transactionsCount: data.count,
                    dateRange: dateRange,
                    createdAt: tPlusOne,
                    payoutStatus: 'Not Yet Settled',
                    isPartial: 'No',
                    bankName: mapping.defaults.bankName,
                    accountNumber: mapping.defaults.accountNumber,
                    ifscCode: mapping.defaults.ifsc,
                    paymentMethod: mapping.defaults.paymentMethod
                };
            });

            // Save to DB
            if (settlementBatches.length > 0) {
                // OPTION A: Delete existing 'Not Yet Settled' records for these specific merchants 
                // so you don't have duplicates in the table.
                const merchantNames = settlementBatches.map(b => b.merchantName);
                await Settlement.deleteMany({
                    merchantName: { $in: merchantNames },
                    payoutStatus: 'Not Yet Settled'
                });
                await Settlement.insertMany(settlementBatches);
            }

            if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // Cleanup

            console.log(`✅ Success: Processed ${rowCount} transactions into ${settlementBatches.length} batches.`);

            res.json({
                message: 'Settlement batches generated successfully',
                batchesCreated: settlementBatches.length,
                totalTransactions: rowCount
            });

        } catch (error) {
            console.error("Aggregation Error:", error);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            res.status(500).json({ error: 'Error processing raw file' });
        }
    });

    stream.on('error', (err) => {
        console.error("Stream Error:", err);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ error: 'File reading failed' });
    });
};

exports.getSettlements = async (req, res) => {
    try {
        const settlements = await Settlement.find().sort({ createdAt: -1 });
        res.json(settlements);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};