import type { SVGProps } from 'react';
export function Tooth({
  size = 24,
  strokeWidth = 1.5,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number | string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 4C8.5 1.2 3 3 4 8.8c.5 2.8 1.7 10 4 12 .8.7 1.6-4.8 4-7.3 2.4 2.5 3.2 8 4 7.3 2.3-2 3.5-9.2 4-12C21 3 15.5 1.2 12 4Z" />
      <path d="M12 4l2 2" />
    </svg>
  );
}
