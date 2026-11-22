/**
 * Chọn một phần tử trên màn hình để góp ý: rê chuột thì phần tử được tô khung, bấm là chọn, Esc là hủy.
 * Thông tin thu được (selector, nội dung, tên thành phần React...) đủ để người xử lý biết chính xác chỗ nào.
 *
 * Mọi phần tử của chính chức năng góp ý gắn thuộc tính `data-feedback-ui` để không bị chọn nhầm.
 */

export interface PickedElement {
  selector: string;
  tag: string;
  text: string;
  html: string;
  role?: string;
  aria_label?: string;
  test_id?: string;
  /** Chuỗi thành phần React từ trong ra ngoài, ví dụ "StatusBadge < TableCell < ReceiptTable". */
  component?: string;
  rect: { x: number; y: number; width: number; height: number };
}

/** Tên thành phần của React / Next / Radix không có ích cho người xử lý nên bỏ khỏi chuỗi. */
const FRAMEWORK_NAME = /^(Primitive|Slot|Fragment|SegmentViewNode|Inner|Outer|Redirect|Render|Template|Scroll|Focus|Dismissable|Presence|Portal|ErrorBoundary|HTTPAccess|Router|AppRouter|Root)|(Context|Provider|Boundary|Handler|Router|Primitive)$/;

const IGNORE_ATTR = 'data-feedback-ui';
const MAX_TEXT = 200;
const MAX_HTML = 1500;

function isFeedbackUi(element: Element | null): boolean {
  return !!element?.closest(`[${IGNORE_ATTR}]`);
}

/** Đường dẫn CSS ngắn gọn tới phần tử (dừng ở phần tử có id hoặc data-testid). */
function buildSelector(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current && current.tagName !== 'HTML' && parts.length < 6) {
    const tag = current.tagName.toLowerCase();
    const testId = current.getAttribute('data-testid');
    if (current.id) {
      parts.unshift(`${tag}#${CSS.escape(current.id)}`);
      break;
    }
    if (testId) {
      parts.unshift(`${tag}[data-testid="${testId}"]`);
      break;
    }
    const parent: Element | null = current.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const sameTag = Array.from(parent.children).filter((child) => child.tagName === current!.tagName);
    parts.unshift(sameTag.length > 1 ? `${tag}:nth-of-type(${sameTag.indexOf(current) + 1})` : tag);
    current = parent;
  }
  return parts.join(' > ');
}

/** Tên các thành phần React bao quanh phần tử (đọc từ fiber nội bộ của React; không có thì bỏ qua). */
function reactComponentChain(element: Element): string | undefined {
  const key = Object.keys(element).find((k) => k.startsWith('__reactFiber$'));
  if (!key) return undefined;
  const names: string[] = [];
  let fiber = (element as unknown as Record<string, unknown>)[key] as
    | { type?: unknown; return?: unknown }
    | null
    | undefined;
  while (fiber && names.length < 6) {
    const type = fiber.type as { displayName?: string; name?: string } | string | undefined;
    if (typeof type === 'function' || (typeof type === 'object' && type !== null)) {
      const name = (type as { displayName?: string; name?: string }).displayName || (type as { name?: string }).name;
      if (name && /^[A-Z]/.test(name) && !names.includes(name) && !FRAMEWORK_NAME.test(name)) {
        names.push(name);
      }
    }
    fiber = fiber.return as typeof fiber;
  }
  return names.length ? names.join(' < ') : undefined;
}

export function describeElement(element: Element): PickedElement {
  const rect = element.getBoundingClientRect();
  const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
  const html = element.outerHTML.replace(/\s+/g, ' ');
  return {
    selector: buildSelector(element),
    tag: element.tagName.toLowerCase(),
    text: text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text,
    html: html.length > MAX_HTML ? `${html.slice(0, MAX_HTML)}…` : html,
    role: element.getAttribute('role') || undefined,
    aria_label: element.getAttribute('aria-label') || undefined,
    test_id: element.getAttribute('data-testid') || undefined,
    component: reactComponentChain(element),
    rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
  };
}

interface PickerHandlers {
  onPick: (picked: PickedElement) => void;
  onCancel: () => void;
}

/** Bắt đầu chế độ chọn; trả về hàm dừng. */
export function startElementPicker({ onPick, onCancel }: PickerHandlers): () => void {
  const highlight = document.createElement('div');
  highlight.setAttribute(IGNORE_ATTR, 'true');
  Object.assign(highlight.style, {
    position: 'fixed',
    zIndex: '2147483646',
    pointerEvents: 'none',
    border: '2px solid #1f4e79',
    background: 'rgba(63, 107, 128, 0.12)',
    borderRadius: '4px',
    transition: 'all 60ms ease-out',
    display: 'none',
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(highlight);
  document.body.style.cursor = 'crosshair';

  let hovered: Element | null = null;

  const move = (event: MouseEvent) => {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (!target || isFeedbackUi(target)) {
      highlight.style.display = 'none';
      hovered = null;
      return;
    }
    hovered = target;
    const rect = target.getBoundingClientRect();
    Object.assign(highlight.style, {
      display: 'block',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  };

  const click = (event: MouseEvent) => {
    if (isFeedbackUi(event.target as Element)) return;
    // Chặn thao tác thật của phần tử (bấm nút, mở liên kết...) vì lúc này chỉ để chọn.
    event.preventDefault();
    event.stopPropagation();
    // Lấy phần tử ngay tại điểm bấm (không dựa vào lần rê chuột trước, vì bàn phím hoặc cảm ứng có thể bấm mà không rê).
    const target = document.elementFromPoint(event.clientX, event.clientY) ?? hovered ?? (event.target as Element);
    stop();
    onPick(describeElement(target));
  };

  const keydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      stop();
      onCancel();
    }
  };

  function stop() {
    document.removeEventListener('mousemove', move, true);
    document.removeEventListener('click', click, true);
    document.removeEventListener('keydown', keydown, true);
    document.body.style.cursor = '';
    highlight.remove();
  }

  document.addEventListener('mousemove', move, true);
  document.addEventListener('click', click, true);
  document.addEventListener('keydown', keydown, true);
  return stop;
}
