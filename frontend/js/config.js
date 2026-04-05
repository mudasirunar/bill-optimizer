// Detect if we are running locally or on the web
const isLocal = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";

// Set the API URL dynamically
const API_BASE_URL = isLocal 
    ? "http://127.0.0.1:10000"  // Your local Flask port
    : "https://bill-optimizer-qz1k.onrender.com"; // Your live Render URL

console.log(`🔌 Connected to Backend at: ${API_BASE_URL}`);