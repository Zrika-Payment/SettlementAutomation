const fs = require('fs');
const csv = require('csv-parser');
const { v4: uuidv4 } = require('uuid');
const Settlement = require('../models/Settlement');
const mapping = require('../config/fieldMapping');

// 1. Better Currency Parser
const parseCurrency = (value) => {
    if (!value) return 0;
    // Handles commas and scientific notation if any
    const cleanValue = value.toString().replace(/,/g, '');
    return parseFloat(cleanValue) || 0;
};

// 2. Custom Date Parser for "15-01-2026 20:57"
const parseCSVDate = (dateStr) => {
    if (!dateStr) return null;
    try {
        const [datePart] = dateStr.trim().split(' ');
        const [day, month, year] = datePart.split('-');
        const date = new Date(`${year}-${month}-${day}`);
        return isNaN(date.getTime()) ? null : date;
    } catch (e) {
        return null;
    }
};

exports.generateSettlementFromRaw = async (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');

    const filePath = req.file.path;
    const groupedData = {};
    const headerCounts = {};
    let rowCount = 0;

    console.log(`🚀 Starting processing for file: ${req.file.originalname}`);

    const stream = fs.createReadStream(filePath)
        .pipe(csv({
            mapHeaders: ({ header }) => {
                headerCounts[header] = (headerCounts[header] || 0) + 1;
                return headerCounts[header] > 1 ? `${header}_${headerCounts[header]}` : header;
            }
        }));

    stream.on('data', (row) => {
        rowCount++;
        
        // Log progress every 5000 rows to the console
        if (rowCount % 5000 === 0) console.log(`⏳ Processed ${rowCount} rows...`);

        // Check Status (Trim is vital for CSVs)
        const status = row[mapping.rawHeaders.status]?.trim();
        if (status !== 'Success') return;

        const merchant = row[mapping.rawHeaders.merchantName];
        const merchantId = row[mapping.rawHeaders.merchantId];
        const key = `${merchant}_${merchantId}`;

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

        // Calculate Values
        const net = parseCurrency(row[mapping.rawHeaders.netAmount]);
        const gross = parseCurrency(row[mapping.rawHeaders.totalAmount]);
        const tax1 = parseCurrency(row[mapping.rawHeaders.gst1]);
        const tax2 = parseCurrency(row[mapping.rawHeaders.gst2]);

        // Aggregate
        groupedData[key].netAmount += net;
        groupedData[key].grossAmount += gross;
        groupedData[key].deductions += (tax1 + tax2);
        groupedData[key].count += 1;

        // Date Tracking (Memory efficient: only keep the min/max, not the whole array)
        const currentDate = parseCSVDate(row[mapping.rawHeaders.date]);
        if (currentDate) {
            if (!groupedData[key].minDate || currentDate < groupedData[key].minDate) groupedData[key].minDate = currentDate;
            if (!groupedData[key].maxDate || currentDate > groupedData[key].maxDate) groupedData[key].maxDate = currentDate;
        }
    });

    stream.on('end', async () => {
        try {
            const batches = Object.values(groupedData).map(data => {
                // Formatting Date Range safely
                const range = (data.minDate && data.maxDate)
                    ? `${data.minDate.toISOString().split('T')[0]} - ${data.maxDate.toISOString().split('T')[0]}`
                    : "Unknown Range";

                return {
                    batchId: uuidv4(),
                    merchantName: data.merchantName,
                    settlementAmount: Number(data.netAmount.toFixed(2)),
                    totalAmount: Number(data.grossAmount.toFixed(2)),
                    deductedAmount: Number(data.deductions.toFixed(2)),
                    transactionsCount: data.count,
                    dateRange: range,
                    createdAt: new Date(new Date().setDate(new Date().getDate() + 1)), // T+1
                    payoutStatus: 'Not Yet Settled',
                    isPartial: 'No',
                    bankName: mapping.defaults.bankName,
                    accountNumber: mapping.defaults.accountNumber,
                    ifscCode: mapping.defaults.ifsc,
                    paymentMethod: mapping.defaults.paymentMethod
                };
            });

            // If batches are huge, use bulkWrite for better MongoDB performance
            if (batches.length > 0) {
                await Settlement.insertMany(batches);
            }

            fs.unlinkSync(filePath); // Cleanup
            console.log(`✅ Finished! Created ${batches.length} batches from ${rowCount} rows.`);

            res.json({
                success: true,
                message: `Processed ${rowCount} rows into ${batches.length} batches.`,
                totalTransactions: rowCount
            });

        } catch (err) {
            console.error("Aggregation Error:", err);
            res.status(500).json({ error: "Processing failed at database insertion stage." });
        }
    });

    stream.on('error', (err) => {
        console.error("Stream Error:", err);
        res.status(500).json({ error: "Error reading the large file." });
    });
};