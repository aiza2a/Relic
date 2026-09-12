import '@tabler/icons-webfont/dist/tabler-icons.min.css';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './SettingsSearch.css';
import { navigationItems } from './SettingsSidebar';

function SettingsSearch({ onNavigate, className = '' }) {
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);
  const closeTimerRef = useRef(null);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase().trim();
    const results = [];

    const bundle = i18n.getResourceBundle(i18n.language, 'translation') || {};
    const settings = bundle.settings || {};
    const sectionsMap = settings.sections || {};
    const visibleSectionIds = new Set((navigationItems || []).map(n => n.id));
    const sectionAliases = {
      webdav: 'syncTransfer',
    };

    const allIds = Array.from(new Set([
      ...Object.keys(settings.sections || {}),
      ...Object.keys(settings).filter(k => k !== 'sections' && typeof settings[k] === 'object')
    ]));

    allIds.forEach(sectionId => {
      const targetSection = visibleSectionIds.has(sectionId) ? sectionId : sectionAliases[sectionId];
      if (!targetSection || !visibleSectionIds.has(targetSection)) return;
      const secObj = settings[sectionId];
      if (!secObj || typeof secObj !== 'object') return;

      Object.keys(secObj).forEach(key => {
        if (!key.endsWith('Desc')) return;
        const base = key.slice(0, -4);
        const labelRaw = secObj[base];
        const descRaw = secObj[key];
        if (typeof labelRaw !== 'string' || typeof descRaw !== 'string') return;

        const sectionNameStr = targetSection === sectionId
          ? (sectionsMap[sectionId] || t(`settings.${sectionId}.title`) || sectionId)
          : `${sectionsMap[targetSection] || targetSection} / ${sectionsMap[sectionId] || t(`settings.${sectionId}.title`) || sectionId}`;
        const labelStr = t(`settings.${sectionId}.${base}`);
        const descStr = t(`settings.${sectionId}.${key}`);

        const rawLabelKey = `settings.${sectionId}.${base}`;
        const rawDescKey = `settings.${sectionId}.${key}`;
        if (labelStr === rawLabelKey || descStr === rawDescKey) return;

        const labelLower = (labelStr || '').toLowerCase();
        const descLower = (descStr || '').toLowerCase();
        const sectionNameLower = (sectionNameStr || '').toLowerCase();

        if (
          labelLower.includes(query) ||
          descLower.includes(query) ||
          sectionNameLower.includes(query)
        ) {
          results.push({
            key: base,
            section: targetSection,
            sectionName: sectionNameStr || '',
            label: labelStr || '',
            description: descStr || '',
            matchType: labelLower.includes(query) ? 'title' : descLower.includes(query) ? 'description' : 'section'
          });
        }
      });
    });

    const unique = [];
    const seen = new Set();
    for (const r of results) {
      const k = `${r.section}::${r.key}`;
      if (!seen.has(k)) {
        seen.add(k);
        unique.push(r);
      }
    }
    return unique;
  }, [searchQuery, t, i18n]);

  useEffect(() => {
    setHighlightedIndex(0);
    setIsOpen(isSearching && searchQuery.trim().length > 0);
  }, [isSearching, searchResults, searchQuery]);

  useEffect(() => {
    const el = document.getElementById(`settings-search-item-${highlightedIndex}`);
    if (el && resultsRef.current) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  // 处理搜索输入
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setIsSearching(value.trim().length > 0);
  };

  const handleFocus = () => {
    if (searchQuery.trim()) setIsOpen(true);
  };

  const handleBlur = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 120);
  };

  const handleKeyDown = (e) => {
    if (!isOpen || searchResults.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % searchResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev - 1 + searchResults.length) % searchResults.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = searchResults[highlightedIndex];
      if (target) {
        handleNavigate(target.section, target.label);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  // 清空搜索
  const clearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
  };

  // 导航到设置项
  const handleNavigate = (section, targetLabel) => {
    onNavigate(section, targetLabel);
    clearSearch();
  };

  // 高亮匹配文本
  const highlightMatch = (text, query) => {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? 
        <mark key={index} className="settings-search-highlight">{part}</mark> : 
        part
    );
  };

  return (
    <div className={`relative ${className}`}>
      {/* 搜索输入框 */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
          <i className="ti ti-search text-qc-fg-subtle text-sm"></i>
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          ref={inputRef}
          placeholder={t('settings.searchPlaceholder')}
          className="relative z-0 w-full h-10 pl-10 pr-10 text-sm border border-qc-border rounded-lg bg-qc-panel text-qc-fg placeholder:text-qc-fg-subtle focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
        />
        {searchQuery && (
          <button
            onClick={clearSearch}
            className="absolute top-0 right-0 h-10 w-10 inline-flex items-center justify-center text-qc-fg-subtle hover:text-qc-fg-muted z-10"
          >
            <i className="ti ti-x text-sm"></i>
          </button>
        )}
      </div>

      {/* 搜索结果 */}
      {isOpen && (
        <div ref={resultsRef} className="absolute top-full left-0 right-0 mt-1 bg-qc-panel border border-qc-border rounded-lg shadow-lg max-h-96 overflow-y-auto z-50 settings-search-results">
          {searchResults.length > 0 ? (
            <div className="py-2">
              {searchResults.map((result, index) => (
                <button
                  key={`${result.section}-${result.key}`}
                  id={`settings-search-item-${index}`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={() => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }}
                  onClick={() => handleNavigate(result.section, result.label)}
                  className={`w-full px-4 py-3 text-left transition-colors border-b border-qc-border last:border-b-0 ${index === highlightedIndex ? 'bg-qc-panel-2' : 'hover:bg-qc-hover'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-qc-fg text-sm">
                          {highlightMatch(result.label, searchQuery)}
                        </span>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full whitespace-nowrap flex-shrink-0">
                          {result.sectionName}
                        </span>
                      </div>
                      <p className="text-xs text-qc-fg-muted line-clamp-2">
                        {highlightMatch(result.description, searchQuery)}
                      </p>
                    </div>
                    <i className="ti ti-chevron-right text-qc-fg-subtle text-sm mt-1"></i>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-qc-fg-muted">
              <i className="ti ti-search-off text-2xl mb-2 block"></i>
              <p className="text-sm">{t('settings.search.noResults')}</p>
              <p className="text-xs mt-1">{t('settings.search.tryAnother')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SettingsSearch;
