import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { useTheme } from '@shared/hooks/useTheme';
import HtmlPreview from '../../preview/views/HtmlPreview';

function HtmlEditor({
  content,
  onContentChange,
  onStatsChange,
  wordWrap,
}) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const editorRef = useRef(null);
  const viewRef = useRef(null);
  const wrapCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());

  const getCustomTheme = (dark) => EditorView.theme(
    {
      '&': {
        height: '100%',
        backgroundColor: 'var(--qc-surface)',
        color: 'var(--qc-fg)',
      },
      '.cm-scroller': {
        overflow: 'auto',
        height: '100%',
      },
      '.cm-content': {
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
        fontSize: '13px',
        lineHeight: '1.6',
        padding: '12px',
        color: 'var(--qc-fg)',
      },
      '.cm-gutters': {
        backgroundColor: 'color-mix(in srgb, var(--qc-panel) 85%, transparent)',
        color: 'var(--qc-fg-muted)',
        border: 'none',
      },
      '.cm-gutterElement': {
        color: 'var(--qc-fg-muted)',
      },
      '.cm-activeLine': {
        backgroundColor: 'color-mix(in srgb, var(--qc-accent, #3b82f6) 14%, transparent)',
        borderRadius: '8px',
      },
      '.cm-activeLineGutter': {
        backgroundColor: 'color-mix(in srgb, var(--qc-accent, #3b82f6) 10%, transparent)',
        color: 'var(--qc-fg)',
      },
      '.cm-cursor': {
        borderLeftColor: 'var(--qc-fg)',
      },
      '&.cm-focused .cm-selectionBackground, ::selection': {
        backgroundColor: 'color-mix(in srgb, var(--qc-accent, #3b82f6) 28%, transparent)',
      },
    },
    { dark },
  );

  useEffect(() => {
    if (!editorRef.current) return;

    const initialContent = content || '';
    const startState = EditorState.create({
      doc: initialContent,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        themeCompartment.current.of([getCustomTheme(isDark)]),
        wrapCompartment.current.of(wordWrap ? EditorView.lineWrapping : []),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          const newContent = update.state.doc.toString();
          onContentChange(newContent);
          onStatsChange({
            chars: newContent.length,
            lines: update.state.doc.lines,
          });
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    viewRef.current = view;
    onStatsChange({
      chars: initialContent.length,
      lines: initialContent.split('\n').length || 1,
    });

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!viewRef.current) return;
    const currentContent = viewRef.current.state.doc.toString();
    if (currentContent === content) return;
    viewRef.current.dispatch({
      changes: {
        from: 0,
        to: currentContent.length,
        insert: content || '',
      },
    });
  }, [content]);

  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      effects: wrapCompartment.current.reconfigure(wordWrap ? EditorView.lineWrapping : []),
    });
  }, [wordWrap]);

  useEffect(() => {
    if (!viewRef.current) return;
    viewRef.current.dispatch({
      effects: themeCompartment.current.reconfigure([getCustomTheme(isDark)]),
    });
  }, [isDark]);

  return (
    <div className="text-editor-workspace flex-1 min-h-0 min-w-0 overflow-hidden p-3">
      <div className="text-editor-html-layout h-full min-h-0 min-w-0 flex gap-3">
        <section className="text-editor-pane w-1/2 min-w-0 min-h-0 flex flex-col">
          <header className="text-editor-pane-header h-9 px-3 flex items-center text-xs font-medium text-qc-fg-muted border-b border-qc-border bg-qc-surface/80">
            {t('textEditor.htmlSource', 'HTML 源码')}
          </header>
          <div className="text-editor-editor-shell flex-1 min-h-0 min-w-0">
            <div ref={editorRef} className="text-editor-codemirror h-full w-full" />
          </div>
        </section>

        <section className="text-editor-pane w-1/2 min-w-0 min-h-0 flex flex-col">
          <header className="text-editor-pane-header h-9 px-3 flex items-center text-xs font-medium text-qc-fg-muted border-b border-qc-border bg-qc-surface/80">
            {t('textEditor.htmlPreview', '预览')}
          </header>
          <div className="text-editor-preview-shell flex-1 min-h-0 min-w-0 bg-qc-surface">
            <HtmlPreview htmlContent={content || ''} />
          </div>
        </section>
      </div>
    </div>
  );
}

export default HtmlEditor;
