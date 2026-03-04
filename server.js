require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const compression = require('compression');
const fs = require('fs');
const path = require('path');

// 🚀 USE THE ABSOLUTE PATH TO THE SAFE FOLDER


const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'YOUR_HARDCODED_TOKEN_HERE';
// ⚠️ You will get these two strings from the Meta Developer Dashboard in Step 3
const META_TOKEN = process.env.META_TOKEN||'Test';
const PHONE_ID = process.env.PHONE_ID||'Test';

// server.js
const persistentDataPath = process.env.Data_Path||'/home/u634146251/uploads_data'; 

try {
    if (!fs.existsSync(persistentDataPath)) {
        fs.mkdirSync(persistentDataPath, { recursive: true });
        console.log("✅ Persistent data folder ready.");
    }
} catch (err) {
    // This prevents a 503 error if there is a permission issue
    console.error("⚠️ Startup Warning:", err.message);
}

// --- MIDDLEWARE: Set high limits correctly once ---
app.use(compression());
app.use(bodyParser.json({ limit: '100mb' }));
app.use(bodyParser.urlencoded({ limit: '100mb', extended: true, parameterLimit: 50000 }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
// --- DATABASE CONNECTION ---
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gem_db',
    waitForConnections: true,
    connectionLimit: 50,
    queueLimit: 0
});

// --- MIDDLEWARE ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Access Denied" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid Token" });
        req.user = user;
        next();
    });
}

// --- AUTH ROUTES ---
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        const user = rows[0];
        if (!user) return res.status(400).json({ success: false, message: "User not found" });

        const validPass = await bcrypt.compare(password, user.password_hash);
        if (!validPass) return res.status(400).json({ success: false, message: "Invalid password" });

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '12h' });
        res.json({ success: true, token });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', authenticateToken, async (req, res) => {
    const { username, password, image_url } = req.body; 
    try {
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        await pool.query(
            'INSERT INTO users (username, password_hash, image_url) VALUES (?, ?, ?)', 
            [username, hash, image_url || null] // Use null if no image was sent
        );

        res.json({ message: "User created successfully" });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, username, created_at, image_url FROM users ORDER BY created_at DESC');
        res.json({ data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        if(req.user.id == req.params.id) return res.status(400).json({ error: "Cannot delete yourself" });
        await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
        res.json({ message: "User deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- CATEGORY ROUTES ---
app.get('/api/categories', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM categories ORDER BY name ASC');
        res.json({ data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/categories', authenticateToken, async (req, res) => {
    const { name, image_url, status } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    try {
        const catStatus = status || 'Active';
        await pool.query('INSERT INTO categories (name, image_url, status) VALUES (?, ?, ?)', [name, image_url, catStatus]);
        res.json({ message: "Category created" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
    try {
        const [check] = await pool.query('SELECT COUNT(*) as count FROM gems WHERE category_id = ?', [req.params.id]);
        if (check[0].count > 0) return res.status(400).json({ error: "Cannot delete: Category is in use." });
        
        await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
        res.json({ message: "Category deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- GEM ROUTES ---
app.get('/api/gems', async (req, res) => {
    const { search, category, status, sort, page, limit: queryLimit } = req.query;
    const currentPage = parseInt(page) || 1;
    const limit = parseInt(queryLimit) || 10;
    const offset = (currentPage - 1) * limit;

    try {
        // --- BUILD FILTERS (Common for both steps) ---
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (search) {
            whereClause += ` AND (gems.name LIKE ? OR gems.description LIKE ? OR categories.name LIKE ?)`;
            const q = `%${search}%`;
            params.push(q, q, q);
        }
        if (category && category !== 'All') {
            whereClause += ` AND gems.category_id = ?`;
            params.push(category);
        }
        if (status && status !== 'All') {
            whereClause += ` AND gems.status = ?`;
            params.push(status);
        }

        let orderByClause = 'ORDER BY gems.created_at DESC';
        switch (sort) {
            case 'price_asc': orderByClause = 'ORDER BY gems.price ASC'; break;
            case 'price_desc': orderByClause = 'ORDER BY gems.price DESC'; break;
            case 'weight_asc': orderByClause = 'ORDER BY gems.weight ASC'; break;
            case 'weight_desc': orderByClause = 'ORDER BY gems.weight DESC'; break;
            default: orderByClause = 'ORDER BY gems.created_at DESC'; break;
        }

        // 🚀 OPTIMIZATION STEP 1: Get IDs ONLY (Fast scan)
        // We do NOT touch the heavy 'media' column here.
        const idsSql = `
            SELECT gems.id 
            FROM gems 
            LEFT JOIN categories ON gems.category_id = categories.id 
            ${whereClause}
            ${orderByClause}
            LIMIT ? OFFSET ?
        `;
        
        // Add limit/offset to params for the ID query
        const idsParams = [...params, limit, offset];
        const [idRows] = await pool.query(idsSql, idsParams);

        if (idRows.length === 0) {
            return res.json({ data: [], pagination: { total: 0, currentPage, totalPages: 0 } });
        }

        // Extract just the IDs (e.g., [45, 42, 39])
        const targetIds = idRows.map(row => row.id);

        // 🚀 OPTIMIZATION STEP 2: Fetch Heavy Data for ONLY these 10 IDs
        // Now we can safely use JSON_EXTRACT because it only runs 10 times.
        const detailsSql = `
            SELECT 
                gems.id, gems.name, gems.category_id, gems.weight, 
                gems.dimensions, gems.description, gems.price, gems.status, gems.created_at,
                categories.name as category_name,
                JSON_UNQUOTE(JSON_EXTRACT(media, '$.images[0]')) as image_url
            FROM gems 
            LEFT JOIN categories ON gems.category_id = categories.id 
            WHERE gems.id IN (?)
        `;

        const [gems] = await pool.query(detailsSql, [targetIds]);

        // Re-sort in JavaScript to match the original ID order (since IN clause doesn't preserve order)
        const sortedGems = targetIds.map(id => gems.find(g => g.id === id));

        // --- GET TOTAL COUNT (For Pagination) ---
        // We reuse the WHERE clause and params from Step 1 (excluding limit/offset)
        const countSql = `
            SELECT COUNT(*) as total 
            FROM gems 
            LEFT JOIN categories ON gems.category_id = categories.id 
            ${whereClause}
        `;
        
        const [countResult] = await pool.query(countSql, params);
        const totalItems = countResult[0].total;
        const totalPages = Math.ceil(totalItems / limit);

        res.json({ 
            data: sortedGems,
            pagination: { total: totalItems, currentPage, totalPages }
        });

    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: err.message }); 
    }
});

// --- UPDATED GEM ROUTES ---
app.post('/api/gems', authenticateToken, async (req, res) => {
    const { name, category_id, weight, dimensions, description, price, media, status } = req.body;
    try {
        const mediaJson = JSON.stringify(media || { images: [], video: "" });
        
        // Execute Insert
        const [result] = await pool.query(
            'INSERT INTO gems (name, category_id, weight, dimensions, description, price, media, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [name, category_id, weight, dimensions, description, price, mediaJson, status]
        );
        
        // 🚨 CRITICAL: Return the insertId so the frontend knows which gem to upload images to
        res.json({ message: "Gem created", id: result.insertId });
        
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/gems/:id', authenticateToken, async (req, res) => {
    const { name, category_id, weight, dimensions, description, price, status, media } = req.body;
    try {
        // We use the media object sent from the frontend to keep the order correct
        const mediaJson = JSON.stringify(media || { images: [], video: "" });

        await pool.query(
            'UPDATE gems SET name=?, category_id=?, weight=?, dimensions=?, description=?, price=?, media=?, status=? WHERE id=?',
            [name, category_id, weight, dimensions, description, price, mediaJson, status, req.params.id]
        );
        res.json({ message: "Gem updated" });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

app.put('/api/gems/:id/media', authenticateToken, async (req, res) => {
    const { image, video } = req.body; // 🚀 Destructure both image and video
    try {
        const [rows] = await pool.query('SELECT media FROM gems WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: "Gem not found" });

        let media = rows[0].media;
        if (typeof media === 'string') media = JSON.parse(media);

        // 1. Handle Image Upload
        if (image && image.startsWith('data:image')) {
            const ext = image.split(';')[0].split('/')[1] || 'webp';
            const fileName = `gem_${req.params.id}_${Date.now()}.${ext}`;
            const filePath = path.join(__dirname, 'public/uploads', fileName);
            const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
            
            fs.writeFileSync(filePath, base64Data, 'base64');
            media.images.push(`/uploads/${fileName}`);
            
            if (media.images.length === 1) {
                await pool.query('UPDATE gems SET image_url = ? WHERE id = ?', [`/uploads/${fileName}`, req.params.id]);
            }
        }

        // 2. 🚀 ADD THIS: Handle Video Upload
        if (video && video.startsWith('data:video')) {
            // Detect extension (mp4, mov, etc)
            const ext = video.split(';')[0].split('/')[1] || 'mp4';
            const fileName = `gem_${req.params.id}_video_${Date.now()}.${ext}`;
            const filePath = path.join(__dirname, 'public/uploads', fileName);
            const base64Data = video.replace(/^data:video\/\w+;base64,/, "");
            
            fs.writeFileSync(filePath, base64Data, 'base64');
            media.video = `/uploads/${fileName}`;
        }

        await pool.query('UPDATE gems SET media = ? WHERE id = ?', [JSON.stringify(media), req.params.id]);
        res.json({ success: true });
    } catch (err) { 
        console.error("Upload error:", err);
        res.status(500).json({ error: err.message }); 
    }
});

app.get('/api/gems/:id', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM gems WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: "Gem not found" });
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/gems/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM gems WHERE id = ?', [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/stats', authenticateToken, async (req, res) => {
    try {
        const [stats] = await pool.query(`
            SELECT 
                COUNT(*) as totalGems,
                SUM(CASE WHEN status = 'Available' THEN 1 ELSE 0 END) as availableGems,
                SUM(CASE WHEN status = 'Sold' THEN 1 ELSE 0 END) as soldGems,
                SUM(price) as totalValue
            FROM gems
        `);

        // 2. FAST COUNT: Get total categories
        const [cats] = await pool.query('SELECT COUNT(*) as count FROM categories');

        // 3. FAST RECENT: Select ONLY text columns (Exclude 'media' blob)
        // This prevents loading massive Base64 strings for the dashboard list
        const [recent] = await pool.query(`
            SELECT gems.id, gems.name, gems.price, gems.status, gems.weight, categories.name as category_name 
            FROM gems 
            LEFT JOIN categories ON gems.category_id = categories.id 
            ORDER BY gems.created_at DESC 
            LIMIT 5
        `);

        res.json({ 
            totalGems: stats[0].totalGems || 0,
            availableGems: parseFloat(stats[0].availableGems || 0), // Ensure number
            soldGems: parseFloat(stats[0].soldGems || 0),
            totalValue: parseFloat(stats[0].totalValue || 0),
            totalCategories: cats[0].count || 0,
            recentGems: recent 
        });

    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

//const WHATSAPP_VERIFY_TOKEN = 'maniq_test_token_123';

// 1. GET CHATS FOR FRONTEND
app.get('/api/whatsapp/chats', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM whatsapp_messages ORDER BY created_at ASC');
        const contactsMap = new Map();
        
        rows.forEach(msg => {
            if (!contactsMap.has(msg.phone)) {
                contactsMap.set(msg.phone, { 
                    phone: msg.phone, 
                    name: msg.name || msg.phone, 
                    last_message: msg.message_text, 
                    history: [] 
                });
            }
            contactsMap.get(msg.phone).history.push({
                text: msg.message_text,
                type: msg.msg_type,
                timestamp: msg.created_at
            });
            contactsMap.get(msg.phone).last_message = msg.message_text;
            if (msg.msg_type === 'incoming' && msg.name && msg.name !== 'Unknown') {
                contactsMap.get(msg.phone).name = msg.name;
            }
        });
        
        let contactsArray = Array.from(contactsMap.values());
        contactsArray.sort((a, b) => {
            const lastA = new Date(a.history[a.history.length - 1]?.timestamp || 0);
            const lastB = new Date(b.history[b.history.length - 1]?.timestamp || 0);
            return lastB - lastA;
        });

        res.json({ contacts: contactsArray });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 🚀 2. WEBHOOK VERIFICATION (Re-add this missing route)
app.get('/api/webhook/whatsapp', (req, res) => {

    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === verifyToken) {
        res.status(200).send(req.query['hub.challenge']);
    } else {
        res.sendStatus(403);
    }
});

// 🚀 3. WEBHOOK RECEIVER (Updated to loop through ALL messages)
app.post('/api/webhook/whatsapp', async (req, res) => {
    try {
        const body = req.body;
        const entries = body.entry || [];

        for (const entry of entries) {
            const changes = entry.changes || [];
            for (const change of changes) {
                const value = change.value;
                if (value && value.messages) {
                    // Loop through every message in the batch
                    for (const msgObj of value.messages) {
                        const phone = '+' + msgObj.from;
                        // Find the corresponding contact name if it exists in the payload
                        const contact = value.contacts?.find(c => c.wa_id === msgObj.from);
                        const name = contact?.profile?.name || 'Unknown';
                        
                        const msgType = msgObj.type;
                        let textToSave = '';

                        if (msgType === 'text') {
                            textToSave = msgObj.text?.body || '';
                        } else if (msgType === 'image') {
                            textToSave = '📷 [Image Received]';
                        } else if (msgType === 'sticker') {
                            textToSave = '🌟 [Sticker Received]';
                        } else if (msgType === 'audio' || msgType === 'voice') {
                            textToSave = '🎤 [Voice Note Received]';
                        } else if (msgType === 'reaction') {
                            textToSave = `👍 [Reacted with ${msgObj.reaction?.emoji || 'an emoji'}]`;
                        } else {
                            textToSave = `[${msgType} message received]`;
                        }

                        if (textToSave) {
                            await pool.query(
                                'INSERT INTO whatsapp_messages (phone, name, message_text, msg_type) VALUES (?, ?, ?, ?)',
                                [phone, name, textToSave, 'incoming']
                            );
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error("Webhook processing error:", error.message);
    }
    res.sendStatus(200); 
});

// 3. SEND MESSAGES TO META (Text + Media Support)
app.post('/api/whatsapp/reply', authenticateToken, async (req, res) => {
    const { customerPhone, messageText, mediaBase64, mediaType } = req.body;
    
    

    const formattedPhone = customerPhone.replace('+', '');

    try {
        let payload = {
            messaging_product: "whatsapp",
            to: formattedPhone
        };

        let savedMessageText = messageText || '';

        // Handle Media if it exists
        if (mediaBase64 && mediaType) {
            // Save file locally to public/uploads
            const ext = mediaType.split('/')[1] || 'jpg';
            const fileName = `wa_${Date.now()}.${ext}`;
            const filePath = path.join(__dirname, 'public/uploads', fileName);
            const base64Data = mediaBase64.replace(/^data:(image|video)\/\w+;base64,/, "");
            
            fs.writeFileSync(filePath, base64Data, 'base64');
            
            // Construct Public URL (Meta requires a valid HTTPS URL to download the media)
            const publicUrl = `https://${req.get('host')}/uploads/${fileName}`;

            // Configure Meta Payload
            const typeKey = mediaType.startsWith('video') ? 'video' : 'image';
            payload.type = typeKey;
            payload[typeKey] = { link: publicUrl };
            
            // If there's text, send it as a caption attached to the media
            if (messageText) payload[typeKey].caption = messageText;

            // Update database text
            savedMessageText = typeKey === 'video' ? '🎥 [Video Sent]' : '📷 [Image Sent]';
            if (messageText) savedMessageText += ` - ${messageText}`;

        } else {
            // Standard Text Message
            payload.type = "text";
            payload.text = { body: messageText };
        }

        const response = await fetch(`https://graph.facebook.com/v17.0/${PHONE_ID}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${META_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        // Save our outgoing reply to the database
        await pool.query(
            'INSERT INTO whatsapp_messages (phone, name, message_text, msg_type) VALUES (?, ?, ?, ?)',
            [customerPhone, 'Me', savedMessageText, 'outgoing']
        );

        res.json({ success: true });
    } catch (error) {
        console.error("WhatsApp Send Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// --- LOCAL ORDERS ROUTES ---
// ==========================================

// 1. Get Next Order ID (Auto-generate ORD-01, ORD-02, etc.)
app.get('/api/orders/next-id', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT order_id FROM local_orders ORDER BY id DESC LIMIT 1');
        let nextId = 'ORD-01';
        if (rows.length > 0 && rows[0].order_id) {
            const match = rows[0].order_id.match(/ORD-(\d+)/);
            if (match) {
                const lastNum = parseInt(match[1]);
                nextId = `ORD-${String(lastNum + 1).padStart(2, '0')}`;
            }
        }
        res.json({ nextId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Get All Orders (With Search, Filter, and Sort)
app.get('/api/orders', authenticateToken, async (req, res) => {
    const { search, status, sort } = req.query;
    try {
        let sql = 'SELECT * FROM local_orders WHERE 1=1';
        const params = [];

        // 1. Search Logic
        if (search) {
            sql += ' AND (order_id LIKE ? OR item_name LIKE ? OR item_id LIKE ?)';
            const q = `%${search}%`;
            params.push(q, q, q);
        }

        // 2. Status Filter
        if (status && status !== 'All') {
            sql += ' AND status = ?';
            params.push(status);
        }

        // 3. Sorting
        if (sort === 'oldest') {
            sql += ' ORDER BY created_at ASC';
        } else {
            sql += ' ORDER BY created_at DESC'; // default newest
        }

        const [rows] = await pool.query(sql, params);
        res.json({ data: rows });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. Create Order
app.post('/api/orders', authenticateToken, async (req, res) => {
    const { order_id, item_name, item_id, price, weight, dimensions, status, media } = req.body;
    try {
        const mediaJson = JSON.stringify(media || { images: [] });
        const [result] = await pool.query(
            'INSERT INTO local_orders (order_id, item_name, item_id, price, weight, dimensions, status, media) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [order_id, item_name, item_id, price, weight, dimensions, status, mediaJson]
        );
        res.json({ message: "Order created", id: result.insertId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. Update Order
app.put('/api/orders/:id', authenticateToken, async (req, res) => {
    const { item_name, item_id, price, weight, dimensions, status, media } = req.body;
    try {
        const mediaJson = JSON.stringify(media || { images: [] });
        await pool.query(
            'UPDATE local_orders SET item_name=?, item_id=?, price=?, weight=?, dimensions=?, status=?, media=? WHERE id=?',
            [item_name, item_id, price, weight, dimensions, status, mediaJson, req.params.id]
        );
        res.json({ message: "Order updated" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. Upload Order Media
app.put('/api/orders/:id/media', authenticateToken, async (req, res) => {
    const { image } = req.body;
    try {
        const [rows] = await pool.query('SELECT media FROM local_orders WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: "Order not found" });

        let media = rows[0].media;
        if (typeof media === 'string') media = JSON.parse(media);

        if (image && image.startsWith('data:image')) {
            const ext = image.split(';')[0].split('/')[1] || 'webp';
            const fileName = `order_${req.params.id}_${Date.now()}.${ext}`;
            const filePath = path.join(__dirname, 'public/uploads', fileName);
            const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
            
            fs.writeFileSync(filePath, base64Data, 'base64');
            if(!media.images) media.images = [];
            media.images.push(`/uploads/${fileName}`);
            await pool.query('UPDATE local_orders SET media = ? WHERE id = ?', [JSON.stringify(media), req.params.id]);
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. Delete Order
app.delete('/api/orders/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM local_orders WHERE id = ?', [req.params.id]);
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 7. Get Order Stats
app.get('/api/orders/stats', authenticateToken, async (req, res) => {
    try {
        const [stats] = await pool.query(`
            SELECT 
                COUNT(*) as totalOrders,
                SUM(CASE WHEN status = 'Available' THEN 1 ELSE 0 END) as availableOrders,
                SUM(CASE WHEN status = 'Sold' THEN 1 ELSE 0 END) as soldOrders,
                SUM(CASE WHEN status = 'Intransit' THEN 1 ELSE 0 END) as intransitOrders,
                SUM(price) as totalAmount,
                SUM(CASE WHEN status = 'Available' THEN price ELSE 0 END) as availableAmount,
                SUM(CASE WHEN status = 'Sold' THEN price ELSE 0 END) as soldAmount,
                SUM(CASE WHEN status = 'Intransit' THEN price ELSE 0 END) as intransitAmount
            FROM local_orders
        `);

        res.json({ 
            totalOrders: stats[0].totalOrders || 0,
            availableOrders: parseFloat(stats[0].availableOrders || 0),
            soldOrders: parseFloat(stats[0].soldOrders || 0),
            intransitOrders: parseFloat(stats[0].intransitOrders || 0),
            totalAmount: parseFloat(stats[0].totalAmount || 0),
            availableAmount: parseFloat(stats[0].availableAmount || 0),
            soldAmount: parseFloat(stats[0].soldAmount || 0),
            intransitAmount: parseFloat(stats[0].intransitAmount || 0)
        });

    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
});

// ==========================================
// --- COMPANY PROFILE ROUTES ---
// ==========================================

// 1. Get Company Profile (Public route so login/public pages can see it)
app.get('/api/company', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM company_profile WHERE id = 1');
        if (rows.length === 0) {
            return res.json({ name: 'Maniq Ceylon', logo_url: 'assets/img/Main Logo.webp' });
        }
        res.json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Update Company Profile (Protected)
app.put('/api/company', authenticateToken, async (req, res) => {
    const { name, logoBase64 } = req.body;
    try {
        let logoUrl = null;
        
        // Process new logo upload if provided
        if (logoBase64 && logoBase64.startsWith('data:image')) {
            const ext = logoBase64.split(';')[0].split('/')[1] || 'png';
            const fileName = `company_logo_${Date.now()}.${ext}`;
            const filePath = path.join(__dirname, 'public/uploads', fileName);
            const base64Data = logoBase64.replace(/^data:image\/\w+;base64,/, "");
            
            fs.writeFileSync(filePath, base64Data, 'base64');
            logoUrl = `/uploads/${fileName}`;
        }

        // Update database
        if (logoUrl) {
            await pool.query('UPDATE company_profile SET name = ?, logo_url = ? WHERE id = 1', [name, logoUrl]);
        } else {
            await pool.query('UPDATE company_profile SET name = ? WHERE id = 1', [name]);
        }
        
        res.json({ success: true, logo_url: logoUrl });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});



app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
