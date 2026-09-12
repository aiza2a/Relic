import { useState, useEffect } from 'react';
import { useSnapshot } from 'valtio';
import { useTranslation } from 'react-i18next';
import { settingsStore } from '@shared/store/settingsStore';
import { useTheme, applyThemeToBody } from '@shared/hooks/useTheme';
import { useSettingsSync } from '@shared/hooks/useSettingsSync';
import { applyBackgroundImage, clearBackgroundImage } from '@shared/utils/backgroundManager';
import SettingsHeader from './components/SettingsHeader';
import SettingsSidebar from './components/SettingsSidebar';
import TabBar from '@shared/components/ui/TabBar';
import GeneralSection from './sections/GeneralSection';
import AppearanceSection from './sections/AppearanceSection';
import ShortcutsSection from './sections/ShortcutsSection';
import ClipboardSection from './sections/ClipboardSection';
import SyncTransferSection from './sections/SyncTransferSection';
import AIConfigSection from './sections/AIConfigSection';
import TranslationSection from './sections/TranslationSection';
import PreviewSection from './sections/PreviewSection';
import SoundSection from './sections/SoundSection';
import AppFilterSection from './sections/AppFilterSection';
import DataManagementSection from './sections/DataManagementSection';
import AboutSection from './sections/AboutSection';
import ToastContainer from '@shared/components/common/ToastContainer';

function App() {
  const { t } = useTranslation();
  const snap = useSnapshot(settingsStore);
  const {
    theme,
    lightThemeStyle,
    darkThemeStyle,
    backgroundImagePath
  } = snap;
  const {
    effectiveTheme,
    isDark,
    isBackground
  } = useTheme();
  const [activeSection, setActiveSection] = useState('general');
  const [pendingTargetLabel, setPendingTargetLabel] = useState('');

  const [shortcutsTab, setShortcutsTab] = useState('globalHotkey');
  const shortcutsTabs = [
    { id: 'globalHotkey', label: t('settings.shortcuts.tabs.globalHotkey') },
    { id: 'pinOps', label: t('settings.shortcuts.tabs.pinOps') },
    { id: 'navigation', label: t('settings.shortcuts.tabs.navigation') },
    { id: 'quickActions', label: t('settings.shortcuts.tabs.quickActions') },
  ];

  useEffect(() => {
    const mainEl = document.querySelector('.settings-container main');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
  }, [shortcutsTab]);

  const handleSearchNavigate = (section, targetLabel) => {
    setActiveSection(section);
    setPendingTargetLabel(targetLabel || '');
  };

  useEffect(() => {
    if (!pendingTargetLabel) return;

    const anchor = encodeURIComponent(pendingTargetLabel);
    let attempts = 0;
    const maxAttempts = 20;
    const interval = 80;
    let timerId;

    const tryScroll = () => {
      attempts += 1;
      const el = document.querySelector(`[data-setting-anchor="${anchor}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('settings-scroll-highlight');
        setTimeout(() => {
          el.classList.remove('settings-scroll-highlight');
        }, 1600);
        setPendingTargetLabel('');
        clearInterval(timerId);
      } else if (attempts >= maxAttempts) {
        setPendingTargetLabel('');
        clearInterval(timerId);
      }
    };

    tryScroll();
    timerId = setInterval(tryScroll, interval);
    return () => clearInterval(timerId);
  }, [activeSection, pendingTargetLabel]);

  // 监听设置变更事件
  useSettingsSync();

  // 应用主题到body
  useEffect(() => {
    applyThemeToBody(theme, 'settings');
  }, [theme, lightThemeStyle, darkThemeStyle, effectiveTheme]);

  // 应用背景图片（仅在背景主题时）
  useEffect(() => {
    if (isBackground && backgroundImagePath) {
      applyBackgroundImage({
        containerSelector: '.settings-container',
        backgroundImagePath,
        windowName: 'settings'
      });
    } else {
      clearBackgroundImage('.settings-container');
    }
  }, [isBackground, backgroundImagePath]);
  const handleSettingChange = async (key, value) => {
    if (key && typeof key === 'object' && !Array.isArray(key)) {
      await settingsStore.saveSettings(key);
      return;
    }

    await settingsStore.saveSetting(key, value);
  };
  const renderSection = () => {
    const uiAnimationEnabled = snap.uiAnimationEnabled !== false;
    let content;
    switch (activeSection) {
      case 'general':
        content = <GeneralSection settings={snap} onSettingChange={handleSettingChange} />;
        break;
      case 'appearance':
        content = <AppearanceSection settings={snap} onSettingChange={handleSettingChange} />;
        break;
      case 'shortcuts':
        content = <ShortcutsSection settings={snap} onSettingChange={handleSettingChange} activeTab={shortcutsTab} />;
        break;
      case 'clipboard':
        content = <ClipboardSection settings={snap} onSettingChange={handleSettingChange} />;
        break;
      case 'syncTransfer':
        content = <SyncTransferSection settings={snap} onSettingChange={handleSettingChange} />;
        break;
      case 'aiConfig':
        content = <AIConfigSection settings={snap} onSettingChange={handleSettingChange} />;
        break;
      case 'translation':
        content = <TranslationSection settings={snap} onSettingChange={handleSettingChange} />;
        break;
      case 'quickpaste':
        content = <PreviewSection settings={snap} onSettingChange={handleSettingChange} />;
        break;
      case 'sound':
        content = <SoundSection settings={snap} onSettingChange={handleSettingChange} />;
        break;
      case 'appFilter':
        content = <AppFilterSection settings={snap} onSettingChange={handleSettingChange} />;
        break;
      case 'dataManagement':
        content = <DataManagementSection />;
        break;
      case 'about':
        content = <AboutSection settings={snap} onSettingChange={handleSettingChange} />;
        break;
      default:
        content = <GeneralSection settings={snap} onSettingChange={handleSettingChange} />;
    }
    return <div
      key={activeSection}
      className={uiAnimationEnabled ? 'animate-slide-in-left-fast-no-opacity' : ''}
      style={!uiAnimationEnabled ? { transform: 'translateZ(0)' } : {}}
    >
        {content}
      </div>;
  };

  const outerContainerClasses = `
    h-screen w-screen
    ${isDark ? 'dark' : ''}
  `.trim().replace(/\s+/g, ' ');
  const containerClasses = `
    settings-container
    h-full w-full
    flex flex-col
    overflow-hidden
    transition-colors duration-500 ease-in-out
    bg-qc-surface
    ${isBackground ? 'bg-opacity-0' : ''}
  `.trim().replace(/\s+/g, ' ');
  return <div className={outerContainerClasses} style={{
    padding: '5px'
  }}>
      <div className={containerClasses} style={{
      borderRadius: '8px',
      boxShadow: '0 0 5px 1px rgba(0, 0, 0, 0.3), 0 0 3px 0 rgba(0, 0, 0, 0.2)'
    }}>
        <SettingsHeader onNavigate={handleSearchNavigate} />

        <div className="flex-1 flex overflow-hidden">
          <SettingsSidebar activeSection={activeSection} onSectionChange={setActiveSection} />

          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 快捷键页面的 Tab 栏 */}
            {activeSection === 'shortcuts' && (
              <TabBar tabs={shortcutsTabs} activeTab={shortcutsTab} onTabChange={setShortcutsTab} />
            )}
            
            <main className={`flex-1 overflow-y-auto p-6 transition-colors duration-500 ${isBackground ? 'bg-transparent' : 'bg-qc-surface'}`}>
              {renderSection()}
            </main>
          </div>
        </div>

        <ToastContainer />
      </div>
    </div>;
}
export default App;
