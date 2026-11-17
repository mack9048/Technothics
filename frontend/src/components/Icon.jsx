// Stroke icons (24×24). Paths taken from the Technothics design.
const P = {
  bell: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  export: ['M12 3v12', 'm7 8 5-5 5 5', 'M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4'],
  settings: ['M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1'],
  wrench: ['M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z'],
  expand: ['M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7'],
  plus: ['M12 5v14M5 12h14'],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'm9 12 2 2 4-4'],
  back: ['m15 18-6-6 6-6'],
  chev: ['m9 18 6-6-6-6'],
  phone: ['M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z'],
  pin: ['M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z'],
  receive: ['M12 4v12M6 10l6 6 6-6M5 20h14'],
  pay: ['M12 20V8M6 14l6-6 6 6M5 4h14'],
  transfer: ['M7 4 3 8l4 4M3 8h18M17 20l4-4-4-4M21 16H3'],
  receipt: ['M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2z', 'M8 8h8M8 12h8M8 16h5'],
  file: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6M8 13h8M8 17h5'],
  users: ['M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M16 3.1a4 4 0 0 1 0 7.8M22 21v-2a4 4 0 0 0-3-3.9'],
  cart: ['M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6'],
  truck: ['M1 3h15v13H1zM16 8h4l3 3v5h-7'],
  box: ['M21 8 12 3 3 8v8l9 5 9-5z', 'm3 8 9 5 9-5M12 13v8'],
  chip: ['M9 9h6v6H9zM9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4'],
  book: ['M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z'],
  list: ['M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'],
  pen: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
  scale: ['M12 3v18M5 21h14M3 7h18', 'm6 7-3 7a3 3 0 0 0 6 0zM18 7l-3 7a3 3 0 0 0 6 0z'],
  trend: ['m22 7-8.5 8.5-5-5L2 17', 'M16 7h6v6'],
  bank: ['M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l9 5H3z'],
  calendar: ['M16 2v4M8 2v4M3 10h18M9 16l2 2 4-4'],
  hash: ['M4 9h16M4 15h16M10 3 8 21M16 3l-2 18'],
  pie: ['M21.2 15.9A10 10 0 1 1 8 2.8', 'M22 12A10 10 0 0 0 12 2v10z'],
  clock: ['M12 6v6l4 2'],
  cash: ['M6 12h.01M18 12h.01'],
};

const EXTRA = {
  settings: <circle cx="12" cy="12" r="3" />,
  pin: <circle cx="12" cy="10" r="2.5" />,
  users: <circle cx="9" cy="7" r="4" />,
  cart: <><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /></>,
  truck: <><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></>,
  chip: <rect x="5" y="5" width="14" height="14" rx="2" />,
  calendar: <rect x="3" y="4" width="18" height="18" rx="2" />,
  clock: <circle cx="12" cy="12" r="10" />,
  cash: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2" /></>,
};

export default function Icon({ name, size = 20, stroke = 2, ...rest }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {EXTRA[name]}
      {(P[name] || []).map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
