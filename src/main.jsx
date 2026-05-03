import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import './theme.css';

// Vite injects BASE_URL — '/' in dev, '/ppw-fascia-app/' (or whatever the
// repo slug is) in a GitHub Pages production build. Strip the trailing
// slash so React Router treats it cleanly as a basename.
const basename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
