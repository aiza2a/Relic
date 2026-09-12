import { createRoot } from 'react-dom/client';
import '@shared/i18n';
import '@unocss/reset/tailwind.css';
import 'virtual:uno.css';
import '@shared/styles/index.css';
import '@shared/styles/theme-background.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);

