import { createRoot } from 'react-dom/client';
import '@shared/i18n';
import '@unocss/reset/tailwind.css';
import 'virtual:uno.css';
import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import '@shared/styles/index.css';
import '@shared/styles/theme-background.css';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);
