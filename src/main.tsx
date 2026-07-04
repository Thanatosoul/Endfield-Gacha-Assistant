import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '@/app/App';
import '@/styles/index.css';

const rootNode = document.getElementById('root');
if (!rootNode) {
  throw new Error('Fatal: #root element not found in DOM.');
}
ReactDOM.createRoot(rootNode).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
