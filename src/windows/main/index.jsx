import ReactDOM from 'react-dom/client';
import { emit } from '@tauri-apps/api/event';
import { subscribeKey } from 'valtio/utils';
import '@unocss/reset/tailwind.css';
import 'uno.css';
import '@shared/styles/index.css';
import '@shared/styles/theme-background.css';
import '@shared/i18n';
import { initStores } from '@shared/store';
import { initClipboardItems } from '@shared/store/clipboardStore';
import { initFavorites } from '@shared/store/favoritesStore';
import { loadGroups, groupsStore } from '@shared/store/groupsStore';
import { navigationStore } from '@shared/store/navigationStore';
import { setupClipboardEventListener, cleanupEventListeners } from '@shared/services/eventListener';
import App from './App';
const FIRST_LOAD_KEY = 'app_first_load_done';
const isFirstLoad = !sessionStorage.getItem(FIRST_LOAD_KEY);
initStores().then(() => {
  if (import.meta.env.DEV && isFirstLoad) {
    sessionStorage.setItem(FIRST_LOAD_KEY, 'true');
    window.location.reload();
  }
  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  return Promise.all([initClipboardItems(), loadGroups().then(() => initFavorites())]);
}).then(() => {
  setupClipboardEventListener();
  subscribeKey(navigationStore, 'activeTab', activeTab => {
    emit('navigation-changed', {
      activeTab,
      currentGroup: groupsStore.currentGroup
    });
  });
  subscribeKey(groupsStore, 'currentGroup', currentGroup => {
    emit('navigation-changed', {
      activeTab: navigationStore.activeTab,
      currentGroup
    });
  });
});
window.addEventListener('beforeunload', cleanupEventListeners);
