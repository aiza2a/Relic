import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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

  // 更新内容统计
  useEffect(() => {
    if (!editorRef.current) return;
    const text = editorRef.current.value;
    const chars = text.length;
    const lines = text.split('\n').length;
    onStatsChange({
      chars,
      lines
    });
  }, [content, onStatsChange]);
  const handleTextChange = e => {
    onContentChange(e.target.value);
  };
  return <div className="flex-1 flex flex-col overflow-hidden">
      <textarea ref={editorRef} value={content} onChange={handleTextChange} placeholder={t('textEditor.placeholder')} className={`
          flex-1 w-full p-4
          bg-qc-surface
          text-qc-fg
          resize-none
          focus:outline-none
          font-mono text-sm
          ${wordWrap ? '' : 'whitespace-nowrap overflow-x-auto'}
        `.trim().replace(/\s+/g, ' ')} spellCheck={false} />
    </div>;
}
export default TextEditor;