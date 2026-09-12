import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { useSnapshot } from 'valtio';
import { settingsStore } from '@shared/store/settingsStore';
import { useTheme } from '@shared/hooks/useTheme';

function TextEditor({
  content,
  onContentChange,
  onStatsChange,
  wordWrap
}) {
  const {
    t
  } = useTranslation();
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const wrapCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());
  const {
    theme,
    systemIsDark
  } = useSnapshot(settingsStore);
  const { isDark } = useTheme();
  const getCustomTheme = dark => EditorView.theme({
    '&': {
      height: '100%',
      backgroundColor: 'var(--qc-surface)',
      color: 'var(--qc-fg)'
    },
    '.cm-scroller': {
      overflow: 'auto',
      height: '100%'
    },
    '.cm-content': {
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      fontSize: '14px',
      lineHeight: '1.6',
      padding: '16px',
      color: 'var(--qc-fg)'
    },
    '.cm-gutters': {
      backgroundColor: 'color-mix(in srgb, var(--qc-panel) 85%, transparent)',
      color: 'var(--qc-fg-muted)',
      backdropFilter: 'blur(var(--theme-superbg-blur-10, 10px))',
      WebkitBackdropFilter: 'blur(var(--theme-superbg-blur-10, 10px))',
      border: 'none'
    },
    '.cm-gutterElement': {
      color: 'var(--qc-fg-muted)'
    },
    '.cm-activeLine': {
      backgroundColor: 'color-mix(in srgb, var(--qc-accent, #3b82f6) 14%, transparent)',
      backdropFilter: 'blur(var(--theme-superbg-blur-10, 10px))',
      WebkitBackdropFilter: 'blur(var(--theme-superbg-blur-10, 10px))',
      borderRadius: '8px'
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'color-mix(in srgb, var(--qc-accent, #3b82f6) 10%, transparent)',
      backdropFilter: 'blur(var(--theme-superbg-blur-10, 10px))',
      WebkitBackdropFilter: 'blur(var(--theme-superbg-blur-10, 10px))',
      color: 'var(--qc-fg)'
    },
    '.cm-line': {
      color: 'var(--qc-fg)'
    },
    '.cm-cursor': {
      borderLeftColor: 'var(--qc-fg)'
    },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'color-mix(in srgb, var(--qc-accent, #3b82f6) 28%, transparent)'
    }
  }, {
    dark
  });

  // 初始化编辑器
  useEffect(() => {
    if (!editorRef.current) return;
    const startState = EditorState.create({
      doc: content || '',
      extensions: [lineNumbers(), highlightActiveLine(), history(), themeCompartment.current.of([getCustomTheme(isDark)]), wrapCompartment.current.of(wordWrap ? EditorView.lineWrapping : []), keymap.of([...defaultKeymap, ...historyKeymap]), EditorView.updateListener.of(update => {
        if (update.docChanged) {
          const newContent = update.state.doc.toString();
          onContentChange(newContent);
          const chars = newContent.length;
          const lines = update.state.doc.lines;
          onStatsChange({
            chars,
            lines
          });
        }
      })]
    });
    const view = new EditorView({
      state: startState,
      parent: editorRef.current
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // 更新内容
  useEffect(() => {
    if (!viewRef.current) return;
    const currentContent = viewRef.current.state.doc.toString();
    if (currentContent !== content) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: content || ''
        }
      });
    }
  }, [content]);

  // 更新换行设置
  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      effects: wrapCompartment.current.reconfigure(wordWrap ? EditorView.lineWrapping : [])
    });
  }, [wordWrap]);

  // 更新主题设置
  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      effects: themeCompartment.current.reconfigure([getCustomTheme(isDark)])
    });
  }, [isDark]);
  return <div className="text-editor-workspace flex-1 overflow-hidden p-3">
      <div className="text-editor-editor-shell h-full w-full overflow-hidden">
        <div ref={editorRef} className="text-editor-codemirror h-full w-full" />
      </div>
    </div>;
}
export default TextEditor;
