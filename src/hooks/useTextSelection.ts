import { useState, useEffect, useCallback } from 'react';

export interface TextSelection {
  text: string;
  x: number;
  y: number;
}

export function useTextSelection(enabled: boolean = true) {
  const [selection, setSelection] = useState<TextSelection | null>(null);

  const handleTextSelection = useCallback(() => {
    if (!enabled) {
      setSelection(null);
      return;
    }

    const sel = window.getSelection();
    const text = sel?.toString().trim();

    if (text && text.length > 0 && text.length < 100) {
      const range = sel?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();

      if (rect) {
        setSelection({
          text,
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
        });
      }
    } else {
      setSelection(null);
    }
  }, [enabled]);

  useEffect(() => {
    document.addEventListener('mouseup', handleTextSelection);
    return () => {
      document.removeEventListener('mouseup', handleTextSelection);
    };
  }, [handleTextSelection]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  return { selection, clearSelection };
}
