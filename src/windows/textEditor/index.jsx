import { createRoot } from 'react-dom/client';
import App from './App';
import '@shared/i18n';
import '@unocss/reset/tailwind.css';
import 'virtual:uno.css';
import '@shared/styles/index.css';
createRoot(document.getElementById('root')).render(<App />);