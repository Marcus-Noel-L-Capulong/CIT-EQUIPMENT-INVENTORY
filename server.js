const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http'); // Required for WebSockets
const { Server } = require('socket.io'); // Import Socket.io

const app = express();
const server = http.createServer(app); // Wrap Express with HTTP
const io = new Server(server, { cors: { origin: '*' } }); // Initialize Socket.io

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); 

// --- DATABASE CONNECTION ---
// ⚠️ IMPORTANT: Replace <db_password> with your actual database password!
// Make sure to remove the < > brackets as well.
const dbURI = 'mongodb+srv://admin:1234@citinventory.ijwwkh8.mongodb.net/cit_vault?appName=CITINVENTORY';

mongoose.connect(dbURI)
    .then(() => console.log('✅ Cloud MongoDB Connected Successfully'))
    .catch(err => console.log('❌ Cloud MongoDB Connection Error:', err));

// --- WEBSOCKET CONNECTION ---
io.on('connection', (socket) => {
    console.log('🔗 A user connected to the live dashboard.');
    socket.on('disconnect', () => console.log('❌ User disconnected.'));
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

// --- API ROUTES ---
app.get('/api/config', async (req, res) => {
    let config = await Config.findOne() || await new Config().save();
    res.json(config);
});

app.put('/api/config', async (req, res) => {
    const config = await Config.findOneAndUpdate({}, req.body, { new: true });
    res.json(config);
});

app.get('/api/items', async (req, res) => res.json(await Item.find()));

app.post('/api/items', async (req, res) => {
    const item = await new Item(req.body).save();
    io.emit('vault_update'); // Tell all screens to refresh!
    res.json(item);
});

app.put('/api/items/:id', async (req, res) => {
    const item = await Item.findByIdAndUpdate(req.params.id, req.body, { new: true });
    io.emit('vault_update'); // Tell all screens to refresh!
    res.json(item);
});

app.delete('/api/items/:id', async (req, res) => {
    await Item.findByIdAndDelete(req.params.id);
    io.emit('vault_update'); // Tell all screens to refresh!
    res.json({ message: 'Deleted' });
});

app.get('/api/logs', async (req, res) => res.json(await Log.find().sort({ _id: -1 })));

app.post('/api/logs', async (req, res) => {
    const log = await new Log(req.body).save();
    io.emit('vault_update'); // Tell all screens to refresh!
    res.json(log);
});

// --- FRONTEND CATCH-ALL ---
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- PORT ---
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Live Server on port ${PORT}`));