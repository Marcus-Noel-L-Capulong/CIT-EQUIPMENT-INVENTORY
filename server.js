const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- DATABASE CONNECTION ---
const dbURI = 'mongodb+srv://admin:1234@citinventory.ijwwkh8.mongodb.net/cit_vault?appName=CITINVENTORY';

mongoose.connect(dbURI)
    .then(() => console.log('Cloud MongoDB Connected Successfully'))
    .catch(err => console.log('Cloud MongoDB Connection Error:', err));

// --- WEBSOCKET CONNECTION ---
io.on('connection', (socket) => {
    console.log('A user connected to the live dashboard.');
    socket.on('disconnect', () => console.log('User disconnected.'));
});

// --- SCHEMAS ---
const Config = mongoose.model('Config', new mongoose.Schema({
    username: { type: String, default: 'admin' },
    pin: { type: String, default: '1234' }
}));

const Item = mongoose.model('Item', new mongoose.Schema({
    equipment: String, serials: [String], status: String, borrower: String,
    returnDate: String, category: String, description: String, price: Number,
    transactionId: String, purpose: String, repairStatus: String,
    issueDescription: String, reportedBy: String, dateReported: String,
    sentTo: String, repairCost: Number, estimatedReturnDate: String, maintenanceNotes: String
}));

const Log = mongoose.model('Log', new mongoose.Schema({
    action: String, status: String, user: String, timestamp: String
}));

// NEW: Student Registration Schema
const Student = mongoose.model('Student', new mongoose.Schema({
    name: String,
    studentId: { type: String, unique: true },
    password: String
}));

// --- API ROUTES ---
app.get('/api/config', async (req, res) => {
    let config = await Config.findOne() || await new Config().save();
    res.json(config);
});

app.put('/api/config', async (req, res) => {
    const config = await Config.findOneAndUpdate({}, req.body, { new: true });
    res.json(config);
});

// --- STUDENT AUTH ROUTES ---
app.post('/api/students/register', async (req, res) => {
    try {
        const existing = await Student.findOne({ studentId: req.body.studentId });
        if (existing) return res.status(400).json({ error: "Student ID already registered." });
       
        const student = await new Student(req.body).save();
        res.json({ message: "Registered successfully", student });
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

app.post('/api/students/login', async (req, res) => {
    try {
        const student = await Student.findOne({ studentId: req.body.studentId, password: req.body.password });
        if (!student) return res.status(401).json({ error: "Invalid Student ID or Password." });
       
        res.json({ name: student.name, studentId: student.studentId });
    } catch (err) {
        res.status(500).json({ error: "Database error" });
    }
});

// --- ITEM & LOG ROUTES ---
app.get('/api/items', async (req, res) => res.json(await Item.find()));

app.post('/api/items', async (req, res) => {
    const item = await new Item(req.body).save();
    io.emit('vault_update');
    res.json(item);
});

app.put('/api/items/:id', async (req, res) => {
    const item = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
    io.emit('vault_update');
    res.json(item);
});

app.delete('/api/items/:id', async (req, res) => {
    await Item.findByIdAndDelete(req.params.id);
    io.emit('vault_update');
    res.json({ message: 'Deleted' });
});

app.get('/api/logs', async (req, res) => res.json(await Log.find().sort({ _id: -1 })));

app.post('/api/logs', async (req, res) => {
    const log = await new Log(req.body).save();
    io.emit('vault_update');
    res.json(log);
});

// --- FRONTEND CATCH-ALL ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- PORT ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Live Server on port ${PORT}`));