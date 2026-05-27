import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { initDb } from './data/db'
import { cronEngine } from './services/cronService'
import { fetchSystemTimeInfo } from './utils/dateFormatter'

// Initialize the database and system timezone offset before rendering
Promise.all([initDb(), fetchSystemTimeInfo()]).then(() => {
  // Start the background cron engine for automatic approvals and periodic operations
  cronEngine.start();

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  )
}).catch(err => {
  console.error("Database initialization failed:", err);
  // Still render to show error if possible
  ReactDOM.createRoot(document.getElementById('root')).render(
    <div style={{ padding: 40, color: 'white', background: '#111', height: '100vh' }}>
      <h1>Mickii Engine Error</h1>
      <p>Database initialization failed. Please check if the tauri-plugin-sql is correctly configured.</p>
      <pre>{err.toString()}</pre>
    </div>
  );
});
