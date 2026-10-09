import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/manrope';
import '@fontsource-variable/dm-sans';
import { App } from './App';
import { installGhostScrollbars } from './ghostScrollbars';
import './style.css';
installGhostScrollbars();
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
