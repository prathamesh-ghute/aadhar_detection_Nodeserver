const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Set up Multer for handling file uploads in memory
const upload = multer({ storage: multer.memoryStorage() });

// Extract endpoint
app.post('/api/extract', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        console.log(`Received image: ${req.file.originalname}, Size: ${req.file.size} bytes`);

        // Forward the image to the FastAPI Microservice
        const formData = new FormData();
        formData.append('file', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        const pythonApiResponse = await axios.post('http://127.0.0.1:8000/predict', formData, {
            headers: {
                ...formData.getHeaders()
            }
        });
        console.log("pythonApiResponse  ",pythonApiResponse)
        console.log('FastAPI response received.');
        
        // Python API returns { "detections": [...], "annotated_image": "base64..." }
        const detections = pythonApiResponse.data.detections;
        const annotated_image = pythonApiResponse.data.annotated_image;
        console.log("detections  ",detections)
        // ── Map the OCR-extracted data from Python ML server to the UI format ──
        const extracted = pythonApiResponse.data.extracted || {};

        // Helper: convert "DD/MM/YYYY" → "YYYY-MM-DD" for HTML date input
        function formatDobForInput(dob) {
            if (!dob) return '';
            // If already YYYY-MM-DD, return as-is
            if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) return dob;
            // DD/MM/YYYY → YYYY-MM-DD
            const m = dob.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            if (m) return `${m[3]}-${m[2]}-${m[1]}`;
            // If only YYYY (Year of Birth), assume Jan 1st of that year so it displays in date input
            const y = dob.match(/^(\d{4})$/);
            if (y) return `${y[1]}-01-01`;
            // Fallback
            return dob;
        }

        const extractedData = {
            photoUrl: extracted.photo || '',
            name: extracted.name || '',
            dob: formatDobForInput(extracted.dob) || '',
            aadhaarNumber: extracted.aadhaar_number || '',
            gender: extracted.gender || '',
            address: extracted.address || ''
        };

        console.log('Final extracted data sent to UI:', {
            ...extractedData,
            photoUrl: extractedData.photoUrl ? '[base64 image]' : 'none'
        });

        res.json({
            success: true,
            extractedData: extractedData,
            rawDetections: detections
        });

    } catch (error) {
        console.error('Error in /api/extract:', error.message);
        res.status(500).json({ error: 'Failed to process image through AI API' });
    }
});
app.get("/",(req,res) =>{
    res.send("Server is running....")
})

app.listen(PORT, () => {
    console.log(`Express server is running on http://localhost:${PORT}`);
    console.log(`Waiting for FastAPI at http://127.0.0.1:8000/predict`);
});
