import React, { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css'

console.log('Starting main.tsx execution...');

try {
  const rootElement = document.getElementById('root');
  console.log('Root element:', rootElement);

  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    )
    console.log('Render called');
  } else {
    console.error('Failed to find root element');
  }
} catch (error) {
  console.error('Error in main.tsx:', error);
};
