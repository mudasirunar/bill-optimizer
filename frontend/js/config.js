// Detect if we are running locally or on the web
const isLocal = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";

// Set the API URL dynamically
const API_BASE_URL = isLocal 
    ? "http://127.0.0.1:5000"  // FIXED: Changed from 10000 to 5000 to match your Flask log
    : "https://bill-optimizer-qz1k.onrender.com"; 

console.log(`🔌 Connected to Backend at: ${API_BASE_URL}`);