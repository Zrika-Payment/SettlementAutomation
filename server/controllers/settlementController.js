const fs = require('fs');
const csv = require('csv-parser');
const { v4: uuidv4 } = require('uuid');
const Settlement = require('../models/Settlement');
const mapping = require('../config/fieldMapping');
const { Parser } = require('json2csv');
const path = require('path');


// 1. Helper to clean currency strings safely
const parseCurrency = (value) => {
    if (value === undefined || value === null || value === '') return 0;
    // Remove commas and handle scientific notation
    const cleanValue = value.toString().replace(/,/g, '').trim();
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
};

// NEW: Helper to format number to Indian Rupee with Commas
const formatToRupee = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2
    }).format(amount);
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

            // Create formatted data ONLY for the CSV file
            const formattedForCSV = settlementBatches.map(batch => ({
                ...batch,
                settlementAmount: formatToRupee(batch.settlementAmount),
                totalAmount: formatToRupee(batch.totalAmount),
                deductedAmount: formatToRupee(batch.deductedAmount)
            }));


            // 2. NEW: GENERATE PHYSICAL CSV FILE FOR DOWNLOAD
            const exportDir = path.join(__dirname, '../exports');
            console.log(exportDir);
            if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);

            const fileName = `Settlement_Summary_${Date.now()}.csv`;
            const exportPath = path.join(exportDir, fileName);

            const json2csvParser = new Parser();
            const csvData = json2csvParser.parse(formattedForCSV);
            fs.writeFileSync(exportPath, csvData);
            // Add UTF-8 BOM (Byte Order Mark) to ensure Excel displays symbols like ₹ correctly
            const BOM = '\uFEFF';
            fs.writeFileSync(exportPath, BOM + csvData, 'utf8');
            // Cleanup raw upload
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

            if (fs.existsSync(filePath)) fs.unlinkSync(filePath); // Cleanup

            console.log(`✅ Success: Processed ${rowCount} transactions into ${settlementBatches.length} batches.`);

            res.json({
                message: 'Settlement batches generated successfully',
                batchesCreated: settlementBatches.length,
                totalTransactions: rowCount,
                batchId: fileName
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

// 4. NEW: ADD DOWNLOAD ROUTE HANDLER
exports.downloadSettlement = async (req, res) => {
    try {
        const fileName = req.query.batchId;
        const filePath = path.join(__dirname, '../exports', fileName);

        if (fs.existsSync(filePath)) {
            res.download(filePath, fileName);
        } else {
            res.status(404).json({ error: "File not found or expired." });
        }
    } catch (error) {
        res.status(500).json({ error: "Download failed" });
    }

};

// 5. DAY-WISE EXCEL EXPORT (supports single day via ?date=YYYY-MM-DD or 15-day default)
exports.downloadDaywiseSettlementExcel = async (req, res) => {
    const ExcelJS = require('exceljs');
    try {
        let settlements = [];
        let fileName = '';
        const { date } = req.query;
        console.log('🔍 Download request received. Date query:', date);

        if (date) {
            // User requested a specific day (YYYY-MM-DD)
            const start = new Date(date);
            start.setHours(0,0,0,0);
            const end = new Date(date);
            end.setHours(23,59,59,999);
            console.log('📅 Querying for specific date:', date);
            console.log('⏰ Start time:', start.toISOString());
            console.log('⏰ End time:', end.toISOString());

            settlements = await Settlement.find({
                createdAt: { $gte: start, $lte: end }
            }).sort({ createdAt: 1 });

            console.log('📊 Settlements found for', date + ':', settlements.length);
            if (settlements.length > 0) {
                console.log('📋 Sample settlements:', settlements.slice(0, 3).map(s => ({
                    merchant: s.merchantName,
                    amount: s.settlementAmount,
                    status: s.payoutStatus
                })));
            }

            fileName = `Settlement_${date}.xlsx`;
        } else {
            // Default: last 15 days, grouped by day
            const today = new Date();
            const startDate = new Date(today);
            startDate.setDate(today.getDate() - 14); // 15 days including today
            startDate.setHours(0,0,0,0);
            console.log('📅 Querying for last 15 days');
            console.log('⏰ Start date:', startDate.toISOString().slice(0,10));
            console.log('⏰ End date:', today.toISOString().slice(0,10));

            settlements = await Settlement.find({
                createdAt: { $gte: startDate, $lte: today }
            }).sort({ createdAt: 1 });

            console.log('📊 Total settlements found for last 15 days:', settlements.length);

            fileName = `Daywise_Settlements_Last_15_Days_${today.toISOString().slice(0,10)}.xlsx`;
        }

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Settlements');
        // Header row
        sheet.addRow([
            'Date', 'Merchant Name', 'Batch ID', 'Net Settlement', 'Gross Amount', 'Deductions', 'Txn Count', 'Status', 'Date Range', 'Created At'
        ]);

        // Add data rows
        settlements.forEach(s => {
            const day = s.createdAt ? s.createdAt.toISOString().slice(0,10) : '';
            sheet.addRow([
                day,
                s.merchantName,
                s.batchId,
                s.settlementAmount,
                s.totalAmount,
                s.deductedAmount,
                s.transactionsCount,
                s.payoutStatus,
                s.dateRange,
                s.createdAt ? s.createdAt.toISOString() : ''
            ]);
        });

        // Format header
        sheet.getRow(1).font = { bold: true };
        sheet.columns.forEach(col => { col.width = 18; });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        console.log('📤 Sending Excel file:', fileName, 'with', settlements.length, 'settlements');

        // Write workbook to response
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Excel Export Error:', error);
        res.status(500).json({ error: 'Failed to generate Excel file' });
    }
};

// 6. PROCESS SETTLEMENTS BY DATE
exports.processSettlementsByDate = async (req, res) => {
    try {
        const { date } = req.body; // Expected format: "YYYY-MM-DD"

        if (!date) {
            return res.status(400).json({ error: 'Date parameter is required (format: YYYY-MM-DD)' });
        }

        console.log(`🔄 Processing settlements for date: ${date}`);

        // Parse the date and create date range for the entire day
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

        // Find all settlements created on this date with status "Not Yet Settled"
        const settlementsToProcess = await Settlement.find({
            createdAt: { $gte: startDate, $lte: endDate },
            payoutStatus: 'Not Yet Settled'
        });

        // Also check total settlements for the date to provide better feedback
        const totalSettlementsForDate = await Settlement.countDocuments({
            createdAt: { $gte: startDate, $lte: endDate }
        });

        console.log(`📊 Found ${settlementsToProcess.length} settlements to process for ${date} (total: ${totalSettlementsForDate})`);

        if (settlementsToProcess.length === 0) {
            if (totalSettlementsForDate > 0) {
                // All settlements are already processed
                return res.json({
                    success: true,
                    message: `All settlements for ${date} are already processed`,
                    processed: 0,
                    alreadyProcessed: true,
                    date: date
                });
            } else {
                // No settlements exist for this date
                return res.json({
                    success: true,
                    message: `No settlements found for ${date}`,
                    processed: 0,
                    noSettlements: true,
                    date: date
                });
            }
        }

        // Process each settlement
        const processedSettlements = [];
        let successCount = 0;
        let failureCount = 0;

        for (const settlement of settlementsToProcess) {
            try {
                // Simulate processing delay (1-3 seconds per settlement)
                const processingTime = Math.random() * 2000 + 1000;
                await new Promise(resolve => setTimeout(resolve, processingTime));

                // Simulate 95% success rate
                const isSuccess = Math.random() > 0.05;

                if (isSuccess) {
                    // Update settlement as processed
                    settlement.payoutStatus = 'Processed';
                    settlement.processedAt = new Date();
                    settlement.paymentReference = `PAY_${Date.now()}_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

                    await settlement.save();

                    processedSettlements.push({
                        id: settlement._id,
                        merchantName: settlement.merchantName,
                        settlementAmount: settlement.settlementAmount,
                        paymentReference: settlement.paymentReference,
                        processedAt: settlement.processedAt
                    });

                    successCount++;
                    console.log(`✅ Processed: ${settlement.merchantName} - ₹${settlement.settlementAmount}`);
                } else {
                    failureCount++;
                    console.log(`❌ Failed: ${settlement.merchantName} - Payment declined`);
                }

            } catch (error) {
                console.error(`Error processing settlement ${settlement._id}:`, error);
                failureCount++;
            }
        }

        console.log(`📊 Processing complete for ${date}: ${successCount} successful, ${failureCount} failed`);

        res.json({
            success: true,
            message: `Settlements processed for ${date}`,
            date: date,
            summary: {
                found: settlementsToProcess.length,
                processed: successCount,
                failed: failureCount
            },
            processedSettlements: processedSettlements
        });

    } catch (error) {
        console.error('Date Processing Error:', error);
        res.status(500).json({ error: 'Failed to process settlements by date' });
    }
};

// 7. GET SETTLEMENTS BY DATE WITH STATUS
exports.getSettlementsByDate = async (req, res) => {
    try {
        const { date, status } = req.query; // date format: YYYY-MM-DD, status optional

        if (!date) {
            return res.status(400).json({ error: 'Date parameter is required (format: YYYY-MM-DD)' });
        }

        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        let query = {
            createdAt: { $gte: startDate, $lte: endDate }
        };

        if (status) {
            query.payoutStatus = status;
        }

        const settlements = await Settlement.find(query).sort({ createdAt: 1 });

        console.log(`📊 Found ${settlements.length} settlements for ${date}${status ? ` with status: ${status}` : ''}`);

        res.json({
            success: true,
            date: date,
            status: status || 'all',
            count: settlements.length,
            settlements: settlements
        });

    } catch (error) {
        console.error('Get Settlements by Date Error:', error);
        res.status(500).json({ error: 'Failed to fetch settlements by date' });
    }
};