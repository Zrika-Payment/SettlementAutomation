const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const settlementController = require('./controllers/settlementController');
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });

// Middleware
app.use(cors());
app.use(express.json());

// DEBUGGING: Add this line to check if the function exists
console.log("Controller Function Check:", settlementController.generateSettlementFromRaw);
// If this prints 'undefined', your controller file is not saving/exporting correctly.

// DB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

// Routes
//app.post('/api/upload-recon', upload.single('file'), settlementController.processReconciliationFile);
// In server.js
app.post('/api/generate-settlement', upload.single('file'), settlementController.generateSettlementFromRaw);
app.get('/api/settlements', settlementController.getSettlements);
// --- ROUTE 2: DOWNLOAD FILE ---
app.get('/api/download-settlement', settlementController.downloadSettlement); // Add this

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));