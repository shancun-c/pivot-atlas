// Local geometric icons: consistent 24px grid, currentColor, no external runtime.
const paths={
 globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6h14M5 18h14"/>',
 chart:'<path d="M4 3v18h17M8 15v-5m5 8V6m5 8V3"/><path d="M6 10h4m1-4h4m1 8h4"/>',
 star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
 database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
 refresh:'<path d="M20 9a8 8 0 0 0-14-4L3 8m0-5v5h5M4 15a8 8 0 0 0 14 4l3-3m0 5v-5h-5"/>',
 search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18M7 15h3m4 0h3m-10 3h3"/>',
 layers:'<path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 17l10 5 10-5"/>',
 building:'<path d="M3 21h18M5 21V9h6v12m0-16h8v16M13 9h3m-3 4h3m-9 0h1m-1 4h1m5 0h3"/>',
 bond:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6m-6 4h6m-6 4h3m3 0v3"/>',
 commodity:'<path d="m6 6 12 0 4 12H2Zm0 0 3 12m9-12-3 12M2 21h20"/>',
 crypto:'<circle cx="12" cy="12" r="9"/><path d="M9 7h4a2.5 2.5 0 0 1 0 5H9m0 0h5a2.5 2.5 0 0 1 0 5H9V7m2-2v2m3-2v2m-3 10v2m3-2v2"/>',
 currency:'<path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/>',
 compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-3 5-5 3 3-5Z"/>',
 check:'<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01"/>'
};
export const icon=(name,extra='')=>`<svg class="ui-icon ${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name]||paths.globe}</svg>`;
export const marketIcon=g=>({'港股':'building','美股':'chart','A股':'building','亚太及新兴':'globe','国债收益率':'bond','境内商品':'commodity','境外商品':'commodity','外汇':'currency','加密货币':'crypto'}[g]||'globe');
