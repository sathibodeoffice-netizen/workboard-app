import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());

// Serve static files (HTML, CSS, JS) from the current directory
app.use(express.static(__dirname));

// Database Helper
async function readDB() {
    try {
        const data = await fs.readFile(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // If file doesn't exist, return default schema
        const defaultData = { users: [], tasks: [] };
        await fs.writeFile(DB_FILE, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
}

async function writeDB(data) {
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

// =======================
// AUTH ENDPOINT
// =======================
app.post('/api/auth', async (req, res) => {
    try {
        const { email, password, isLogin } = req.body;
        const db = await readDB();

        if (isLogin) {
            const user = db.users.find(u => u.email === email && u.password === password);
            if (user) {
                res.status(200).json({ success: true, uid: user._id });
            } else {
                res.status(401).json({ success: false, message: 'Invalid credentials' });
            }
        } else {
            const existingUser = db.users.find(u => u.email === email);
            if (existingUser) {
                res.status(400).json({ success: false, message: 'User already exists' });
            } else {
                const newUser = { _id: crypto.randomUUID(), email, password };
                db.users.push(newUser);
                await writeDB(db);
                res.status(200).json({ success: true, uid: newUser._id });
            }
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// =======================
// TASKS ENDPOINTS
// =======================
app.get('/api/tasks', async (req, res) => {
    const { uid, mode, department } = req.query;
    try {
        const db = await readDB();
        let tasks = [];
        
        if (mode === 'personal') {
            tasks = db.tasks.filter(t => t.uid === uid && t.mode === 'personal');
        } else if (mode === 'team') {
            tasks = db.tasks.filter(t => t.department === department && t.mode === 'team');
        }
        
        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tasks', async (req, res) => {
    try {
        const newTask = req.body;
        newTask._id = crypto.randomUUID();
        
        const db = await readDB();
        db.tasks.push(newTask);
        await writeDB(db);
        
        res.status(200).json({ success: true, id: newTask._id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/tasks', async (req, res) => {
    try {
        const { id } = req.query;
        const db = await readDB();
        
        db.tasks = db.tasks.filter(t => t._id !== id);
        await writeDB(db);
        
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start Server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
    console.log(`Using local file database (data.json) instead of MongoDB.`);
});
