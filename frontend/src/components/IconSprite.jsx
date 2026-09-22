/* Icon sprite ported from design-reference.html (<defs> after <body>).
   Rendered once by Header.jsx — present on every marketing page — so any
   marketing component can reference an icon via:
     <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-x" /></svg>
   `.icon` (stroke:currentColor, 20x20, stroke-width 1.6) is defined in landing.css. */
export default function IconSprite() {
  return (
    <svg className="sr" aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
      <defs>
        <g id="i-seed"><path d="M12 20v-7" /><path d="M12 13c0-3 2-6 6-6 0 4-3 6-6 6Z" /><path d="M12 13c0-3-2-6-6-6 0 4 3 6 6 6Z" /></g>
        <g id="i-lock"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></g>
        <g id="i-receipt"><path d="M5 3v18l2.5-1.6L10 21l2-1.6L14 21l2.5-1.6L19 21V3z" /><path d="M9 8h6M9 12h6" /></g>
        <g id="i-user"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" /></g>
        <g id="i-coin"><circle cx="12" cy="12" r="8" /><path d="M14.5 9.5A3 3 0 0 0 12 8.5c-1.4 0-2.5.8-2.5 1.9 0 2.4 5 1.3 5 3.7 0 1.1-1.1 1.9-2.5 1.9a3 3 0 0 1-2.5-1" /><path d="M12 7v10" /></g>
        <g id="i-check"><path d="M4.5 12.5 9 17l10.5-10.5" /></g>
        <g id="i-shield-check"><path d="M12 3 18.5 5.5V11c0 4.8-3 8-6.5 9.5C8.5 19 5.5 15.8 5.5 11V5.5Z" /><path d="M9 12l2.2 2.2L15 9.8" /></g>
        <g id="i-arrow"><path d="M5 12h13" /><path d="M13 6.5 18.5 12 13 17.5" /></g>
        <g id="i-target"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /></g>
        <g id="i-calendar"><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></g>
        <g id="i-eye"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.5" /></g>
        <g id="i-book"><path d="M4 5a2 2 0 0 1 2-2h4v18H6a2 2 0 0 1-2-2z" /><path d="M20 5a2 2 0 0 0-2-2h-4v18h4a2 2 0 0 0 2-2z" /></g>
        <g id="i-list"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></g>
        <g id="i-chart"><path d="M4 19h16" /><path d="M7 16V9M12 16V5M17 16v-4" /></g>
        <g id="i-home"><path d="M4 11 12 4l8 7" /><path d="M6 10v10h12V10" /></g>
        <g id="i-gift"><rect x="3.5" y="9" width="17" height="11" rx="1.5" /><path d="M3.5 13h17M12 9v11" /><path d="M12 9C10.5 6 9 5 7.5 5a2 2 0 0 0 0 4M12 9c1.5-3 3-4 4.5-4a2 2 0 0 1 0 4" /></g>
        <g id="i-arrow-left"><path d="M19 12H6" /><path d="M11 6.5 5.5 12 11 17.5" /></g>
        <g id="i-share"><path d="M12 15V4" /><path d="M8.5 7.5 12 4l3.5 3.5" /><path d="M6 13v6.5h12V13" /></g>
        <g id="i-search"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></g>
        <g id="i-phone"><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></g>
      </defs>
    </svg>
  )
}
