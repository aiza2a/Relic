import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, ViewPlugin } from '@codemirror/view';
import {
  TEXT_PREVIEW_FONT,
  TEXT_PREVIEW_LINE_HEIGHT,
  TEXT_PREVIEW_VERTICAL_PADDING,
} from '../textMeasure';

const TEXT_PREVIEW_FONT_SIZE = 14;
const TEXT_PREVIEW_CONTENT_PADDING_Y = TEXT_PREVIEW_VERTICAL_PADDING / 2;
const requestHeightOverflowMeasureEffect = Symbol('requestHeightOverflowMeasure');

function createEditorTheme(isDark, isBackground) {
  const textColor = isBackground ? '#ffffff' : 'var(--qc-fg)';
  const textBlendMode = 'normal';

  return EditorView.theme(
    {
      '&': {
        height: '100%',
        backgroundColor: 'transparent',
        color: textColor,
        mixBlendMode: textBlendMode,
      },
      '.cm-scroller': {
        overflow: 'auto',
        fontFamily: TEXT_PREVIEW_FONT.replace(/^14px\s+/, ''),
        fontSize: `${TEXT_PREVIEW_FONT_SIZE}px`,
        lineHeight: `${TEXT_PREVIEW_LINE_HEIGHT}px`,
      },
      '.cm-content': {
        padding: `${TEXT_PREVIEW_CONTENT_PADDING_Y}px 12px`,
        color: textColor,
      },
      '.cm-line': {
        backgroundColor: 'transparent',
        padding: '0',
        textShadow: 'none',
      },
      '&.cm-focused': {
        outline: 'none',
      },
      '.cm-activeLine, .cm-activeLineGutter': {
        backgroundColor: 'transparent',
      },
      '.cm-selectionBackground, ::selection': {
        backgroundColor: 'color-mix(in srgb, var(--qc-active) 75%, transparent)',
      },
    },
    { dark: isDark },
  );
}

const TextPreview = forwardRef(function TextPreview(
  {
    content,
    isDark,
    isBackground,
    onHeightOverflowChange,
    onScrollabilityChange,
  },
  ref,
) {
  const editorRootRef = useRef(null);
  const editorViewRef = useRef(null);
  const themeCompartmentRef = useRef(new Compartment());
  const measurePluginRef = useRef(null);
  const onHeightOverflowChangeRef = useRef(onHeightOverflowChange);
  const onScrollabilityChangeRef = useRef(onScrollabilityChange);

  useImperativeHandle(
    ref,
    () => ({
      scrollBy(delta) {
        editorViewRef.current?.scrollDOM?.scrollBy({ top: delta, behavior: 'auto' });
      },
      hasVerticalOverflow() {
        const scrollDOM = editorViewRef.current?.scrollDOM;
        if (!scrollDOM) {
          return false;
        }
        return (scrollDOM.scrollHeight - scrollDOM.clientHeight) > 2;
      },
    }),
    [],
  );

  useEffect(() => {
    onHeightOverflowChangeRef.current = onHeightOverflowChange;
    onScrollabilityChangeRef.current = onScrollabilityChange;
  }, [onHeightOverflowChange, onScrollabilityChange]);

  useEffect(() => {
    const root = editorRootRef.current;
    if (!root || editorViewRef.current) {
      return undefined;
    }

    measurePluginRef.current = ViewPlugin.fromClass(class {
      update(update) {
        if (update.docChanged || update.geometryChanged) {
          update.view[requestHeightOverflowMeasureEffect]?.();
        }
      }
    });

    const view = new EditorView({
      state: EditorState.create({
        doc: content || '',
        extensions: [
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          EditorView.lineWrapping,
          measurePluginRef.current,
          themeCompartmentRef.current.of(createEditorTheme(isDark, isBackground)),
        ],
      }),
      parent: root,
    });

    editorViewRef.current = view;

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === (content || '')) return;

    view.dispatch({
      changes: {
        from: 0,
        to: current.length,
        insert: content || '',
      },
    });
  }, [content]);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartmentRef.current.reconfigure(createEditorTheme(isDark, isBackground)),
    });
  }, [isDark, isBackground]);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return undefined;

    let observer = null;
    let previousOverflowHeight = null;
    const measureRequest = {
      read() {
        const scrollDOM = view.scrollDOM;
        return Math.ceil(
          Math.max(0, (Number(scrollDOM?.scrollHeight) || 0) - (Number(scrollDOM?.clientHeight) || 0)),
        );
      },
      write(nextOverflowHeight) {
        if (nextOverflowHeight === previousOverflowHeight) {
          return;
        }
        previousOverflowHeight = nextOverflowHeight;
        onHeightOverflowChangeRef.current?.(nextOverflowHeight);
      },
    };

    const requestHeightMeasure = () => {
      view.requestMeasure(measureRequest);
    };

    view[requestHeightOverflowMeasureEffect] = requestHeightMeasure;
    requestHeightMeasure();

    if (typeof ResizeObserver !== 'undefined') {
      let previousContentSize = { width: 0, height: 0 };
      observer = new ResizeObserver((entries) => {
        const rect = entries?.[0]?.contentRect;
        const nextWidth = Math.round(Number(rect?.width) || 0);
        const nextHeight = Math.round(Number(rect?.height) || 0);
        if (
          nextWidth <= 0
          || (nextWidth === previousContentSize.width && nextHeight === previousContentSize.height)
        ) {
          return;
        }
        previousContentSize = { width: nextWidth, height: nextHeight };
        requestHeightMeasure();
      });
      observer.observe(view.contentDOM);
    } else {
      window.addEventListener('resize', requestHeightMeasure);
    }

    return () => {
      delete view[requestHeightOverflowMeasureEffect];
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener('resize', requestHeightMeasure);
      }
    };
  }, [content, isDark, isBackground]);

  useEffect(() => {
    const view = editorViewRef.current;
    const scrollDOM = view?.scrollDOM;
    if (!scrollDOM) {
      onScrollabilityChangeRef.current?.(false);
      return undefined;
    }

    let rafId = 0;
    let observer = null;
    let previousValue = null;

    const measure = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const nextValue = (scrollDOM.scrollHeight - scrollDOM.clientHeight) > 2;
        if (nextValue === previousValue) {
          return;
        }
        previousValue = nextValue;
        onScrollabilityChangeRef.current?.(nextValue);
      });
    };

    measure();

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(scrollDOM);
      const contentElement = scrollDOM.querySelector('.cm-content');
      if (contentElement) {
        observer.observe(contentElement);
      }
    } else {
      window.addEventListener('resize', measure);
    }

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener('resize', measure);
      }
    };
  }, [content, isDark, isBackground]);

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <div ref={editorRootRef} className="w-full h-full" />
    </div>
  );
});

export default TextPreview;
