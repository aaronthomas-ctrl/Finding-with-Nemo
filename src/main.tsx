import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.addEventListener('unhandledrejection', (event) => {
  const isViteOrEmpty = !event.reason || 
    (typeof event.reason === 'object' && Object.keys(event.reason).length === 0) || 
    (event.reason.message && event.reason.message.includes('test'));
    
  if (isViteOrEmpty) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
