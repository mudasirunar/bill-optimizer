// Detect if we are running locally or on the web
const isLocal = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";

// Set the API URL dynamically
const API_BASE_URL = isLocal 
    ? "http://127.0.0.1:5001"  
    : "https://bill-optimizer-qz1k.onrender.com"; // 🔄 REPLACE this Render URL with your new host URL (e.g., DigitalOcean Droplet IP or App Platform domain)

console.log(`🔌 Connected to Backend at: ${API_BASE_URL}`);