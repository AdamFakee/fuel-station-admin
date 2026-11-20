/**
 * Safe clipboard copy with fallback for non-secure HTTP contexts where navigator.clipboard is undefined.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // 1. Try modern Clipboard API if supported and in secure context
  try {
    if (window.isSecureContext && typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback if permission denied or browser restricts
  }

  // 2. Fallback using hidden textarea + execCommand('copy') (Works on HTTP / non-secure contexts)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.style.fontSize = '12pt'; // Prevent iOS zooming

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (successful) return true;
  } catch (fallbackErr) {
    console.error('Fallback copy to clipboard failed:', fallbackErr);
  }

  // 3. Last-ditch attempt if navigator.clipboard is present regardless of isSecureContext
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Ignored
  }

  return false;
}
