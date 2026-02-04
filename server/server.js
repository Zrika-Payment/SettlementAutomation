const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
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


// User Schema & Model
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// --- ROUTES ---

// 1. SIGNUP ROUTE
app.post('/api/signup', async (req, res) => {
  try {
    console.log('API called');
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create and save user
    const newUser = new User({
      email,
      password: hashedPassword
    });

    await newUser.save();
    res.status(201).json({ message: "User registered successfully!" });

  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// 2. LOGIN ROUTE
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Compare password with hashed password in DB
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Login success
    res.status(200).json({
      message: "Login successful!",
      user: { id: user._id, email: user.email }
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Routes
//app.post('/api/upload-recon', upload.single('file'), settlementController.processReconciliationFile);
// In server.js
app.post('/api/generate-settlement', upload.single('file'), settlementController.generateSettlementFromRaw);

app.get('/api/settlements', settlementController.getSettlements);
// --- ROUTE 2: DOWNLOAD FILE ---
app.get('/api/download-settlement', settlementController.downloadSettlement); // Add this

// --- ROUTE 3: DOWNLOAD 15-DAY DAYWISE EXCEL ---
app.get('/api/download-daywise-excel', settlementController.downloadDaywiseSettlementExcel);

// --- ROUTE 4: PROCESS SETTLEMENTS BY DATE ---
app.post('/api/settlements/process-by-date', settlementController.processSettlementsByDate);

// --- ROUTE 5: GET SETTLEMENTS BY DATE ---
app.get('/api/settlements/by-date', settlementController.getSettlementsByDate);

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));










