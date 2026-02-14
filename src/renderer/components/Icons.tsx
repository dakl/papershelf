import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const defaults: IconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function SearchIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.2" y1="10.2" x2="14" y2="14" />
    </svg>
  );
}

export function DocTextIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M4.5 1.5h4.5l4 4V13a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 013 13V3a1.5 1.5 0 011.5-1.5z" />
      <polyline points="9,1.5 9,5.5 13,5.5" />
      <line x1="5.5" y1="8.5" x2="10.5" y2="8.5" />
      <line x1="5.5" y1="11" x2="10.5" y2="11" />
    </svg>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg {...defaults} stroke="none" fill="currentColor" {...props}>
      <path d="M8 1.5l1.76 3.57 3.94.57-2.85 2.78.67 3.93L8 10.67l-3.52 1.68.67-3.93L2.3 5.64l3.94-.57L8 1.5z" />
    </svg>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="8" cy="8" r="6" />
      <polyline points="8,4.5 8,8 10.5,9.5" />
    </svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M6.5 9.5a3.5 3.5 0 005 0l1.5-1.5a3.5 3.5 0 00-5-5L7 4" />
      <path d="M9.5 6.5a3.5 3.5 0 00-5 0L3 8a3.5 3.5 0 005 5l1-1" />
    </svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M11 2.5l2.5 2.5L5.5 13H3v-2.5L11 2.5z" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M3 4.5h10" />
      <path d="M5.5 4.5V3a1 1 0 011-1h3a1 1 0 011 1v1.5" />
      <path d="M4.5 4.5l.5 8.5a1 1 0 001 1h4a1 1 0 001-1l.5-8.5" />
    </svg>
  );
}
