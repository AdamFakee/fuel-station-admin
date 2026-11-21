/**
 * Nền động dạng các khối vuông bo góc trôi nhẹ và xoay chậm (màu thương hiệu).
 * Vị trí, kích thước, độ trễ được cố định sẵn (không dùng Math.random) để server và client render giống nhau.
 * Hiệu ứng tắt khi người dùng bật "giảm chuyển động" (xem `.login-block` trong globals.css).
 */

interface Block {
  /** Vị trí ngang, % chiều rộng. */
  left: number;
  /** Cạnh khối, px. */
  size: number;
  /** Thời gian một vòng trôi, giây. */
  duration: number;
  /** Độ trễ bắt đầu (âm để khối đã ở giữa đường đi ngay khi vào trang), giây. */
  delay: number;
  /** Màu từ biến CSS của thương hiệu. */
  color: 'indigo' | 'cyan' | 'orange';
}

const BLOCKS: Block[] = [
  { left: 4, size: 64, duration: 26, delay: -4, color: 'indigo' },
  { left: 12, size: 28, duration: 19, delay: -12, color: 'cyan' },
  { left: 21, size: 96, duration: 34, delay: -20, color: 'cyan' },
  { left: 30, size: 40, duration: 22, delay: -8, color: 'orange' },
  { left: 38, size: 72, duration: 30, delay: -26, color: 'indigo' },
  { left: 47, size: 24, duration: 17, delay: -3, color: 'cyan' },
  { left: 55, size: 56, duration: 28, delay: -15, color: 'orange' },
  { left: 63, size: 88, duration: 36, delay: -30, color: 'indigo' },
  { left: 71, size: 32, duration: 21, delay: -9, color: 'cyan' },
  { left: 79, size: 68, duration: 27, delay: -18, color: 'cyan' },
  { left: 87, size: 44, duration: 24, delay: -6, color: 'orange' },
  { left: 94, size: 80, duration: 32, delay: -22, color: 'indigo' },
];

export function AnimatedBlocksBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {BLOCKS.map((block, index) => (
        <span
          key={index}
          className={`login-block login-block-${block.color}`}
          style={{
            left: `${block.left}%`,
            width: block.size,
            height: block.size,
            animationDuration: `${block.duration}s`,
            animationDelay: `${block.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
