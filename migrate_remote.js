const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST, 
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

async function startMigration() {
    try {
        console.log("🔗 Connected to remote database...");
        const [gems] = await pool.query('SELECT id, media FROM gems');
        console.log(`📦 Found ${gems.length} gems. Starting download...`);

        for (const gem of gems) {
            let media = gem.media;
            if (typeof media === 'string') {
                try { media = JSON.parse(media); } catch (e) { continue; }
            }

            if (!media) continue;

            // 1. HANDLE IMAGES
            const localImagePaths = [];
            if (media.images && Array.isArray(media.images)) {
                for (let i = 0; i < media.images.length; i++) {
                    const imgData = media.images[i];
                    if (imgData.startsWith('data:image')) {
                        const fileName = `gem_${gem.id}_img_${i}_${Date.now()}.jpg`;
                        const filePath = path.join(uploadDir, fileName);
                        fs.writeFileSync(filePath, imgData.replace(/^data:image\/\w+;base64,/, ""), 'base64');
                        localImagePaths.push(`/uploads/${fileName}`);
                    } else {
                        localImagePaths.push(imgData);
                    }
                }
            }

            // 2. 🚀 NEW: HANDLE VIDEOS
            let localVideoPath = media.video || "";
            if (localVideoPath.startsWith('data:video')) {
                const videoExt = localVideoPath.split(';')[0].split('/')[1] || 'mp4';
                const videoName = `gem_${gem.id}_video_${Date.now()}.${videoExt}`;
                const videoPath = path.join(uploadDir, videoName);
                
                console.log(`🎥 Downloading video for Gem ID: ${gem.id}...`);
                fs.writeFileSync(videoPath, localVideoPath.replace(/^data:video\/\w+;base64,/, ""), 'base64');
                localVideoPath = `/uploads/${videoName}`;
            }

            // 3. UPDATE REMOTE DB
            const updatedMedia = JSON.stringify({ 
                images: localImagePaths, 
                video: localVideoPath 
            });

            await pool.query(
                'UPDATE gems SET media = ?, image_url = ? WHERE id = ?',
                [updatedMedia, localImagePaths[0] || "", gem.id]
            );
            console.log(`✅ Gem ${gem.id}: Migration successful.`);
        }

        console.log("🎉 All Images and Videos are now in /public/uploads");
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration Error:", err.message);
        process.exit(1);
    }
}

startMigration();