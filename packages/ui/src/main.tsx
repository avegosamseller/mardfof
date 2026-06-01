import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { setupPhaser } from './game/Game';

const rootElement = document.getElementById('ui-root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<App />);
}

setupPhaser('phaser-container');
