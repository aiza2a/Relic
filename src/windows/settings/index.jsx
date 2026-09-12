import ReactDOM from 'react-dom/client';
import 'uno.css';
import '@unocss/reset/tailwind.css';
import '@shared/styles/index.css';
import '@shared/styles/theme-background.css';
import '@shared/i18n';
import { initStores } from '@shared/store';
import App from './App';
const FIRST_LOAD_KEY = 'app_first_load_done';
const isFirstLoad = !sessionStorage.getItem(FIRST_LOAD_KEY);
initStores().then(() => {
  if (import.meta.env.DEV && isFirstLoad) {
    sessionStorage.setItem(FIRST_LOAD_KEY, 'true');
    window.location.reload();
  }
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
});