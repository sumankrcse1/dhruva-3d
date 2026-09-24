// Line icons for the legend strip and panel headers. Stroke-based so they
// inherit colour from CSS.

const wrap = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  watch: wrap(`<rect x="7.5" y="7.5" width="9" height="9" rx="3"/><path d="M9.5 7.5 9 4h6l-.5 3.5M9.5 16.5 9 20h6l-.5-3.5"/><path d="M12 10.5v2l1.4.9"/>`),
  efm: wrap(`<path d="M12 21V13"/><path d="M6.5 21h11"/><ellipse cx="12" cy="10.5" rx="5" ry="2.5"/><path d="M7 10.5v-2a5 2.5 0 0 1 10 0v2"/><path d="M4 5.5c1.6-1.4 3.4-1.4 5 0M15 5.5c1.6-1.4 3.4-1.4 5 0"/>`),
  lds: wrap(`<path d="M12 21v-7"/><path d="M8 21h8"/><path d="M9 14V9.5a3 3 0 0 1 6 0V14"/><path d="M12 9.5V8"/><path d="M13.6 2.5 11 6.2h2.2L11.4 9.5"/>`),
  beacon: wrap(`<path d="M8 20h8l-1-7H9l-1 7Z"/><path d="M9.5 13a2.5 2.5 0 0 1 5 0"/><path d="M12 8.5V4"/><path d="M6.5 6.5 4.5 4.5M17.5 6.5l2-2"/><path d="M4 11H2M22 11h-2"/>`),
  translate: wrap(`<path d="M3.5 6.5h8M7.5 4.5v2M9.5 6.5c-.6 4-3 6.6-6 8"/><path d="M5.5 10.5c1.2 2.2 3 3.6 5 4.4"/><path d="M13 20.5l3.6-9 3.6 9M14.6 17.2h4.8"/>`),
  drone: wrap(`<rect x="9.5" y="9.5" width="5" height="5" rx="1.2"/><path d="M9.5 9.5 6 6M14.5 9.5 18 6M9.5 14.5 6 18M14.5 14.5 18 18"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>`),
  satellite: wrap(`<rect x="10" y="10" width="4" height="4" rx="0.6" transform="rotate(45 12 12)"/><path d="m8.4 8.4-3 3 2.1 2.1 3-3M15.6 15.6l3-3-2.1-2.1-3 3"/><path d="M14.8 6.2a5 5 0 0 1 3 3M14.2 3a8.2 8.2 0 0 1 6.8 6.8"/>`),
  airbase: wrap(`<path d="M3 19h18"/><path d="M12 16V8.5"/><path d="m12 4-1.2 4.5h2.4L12 4Z"/><path d="M4.5 16h15l-2.5-4.5h-10L4.5 16Z"/>`),
  sensor: wrap(`<path d="M12 21v-9"/><path d="M8.5 21h7"/><rect x="9.5" y="7.5" width="5" height="4" rx="1"/><path d="M7 9.5c-1.4-1.4-1.4-3.6 0-5M17 4.5c1.4 1.4 1.4 3.6 0 5M4.6 11.9c-2.4-2.4-2.4-6.4 0-8.8M19.4 3.1c2.4 2.4 2.4 6.4 0 8.8"/>`),
  geofence: wrap(`<ellipse cx="12" cy="12.5" rx="8.5" ry="6" stroke-dasharray="3 3"/><path d="M12 9.2v3.6M12 15.2v.2"/>`),
  command: wrap(`<rect x="2.5" y="4.5" width="19" height="12" rx="1.6"/><path d="M8.5 20h7M12 16.5V20"/><path d="M6 12.5l2.5-3 2.5 2 3-4.5 4 5.5"/>`),
};

export function icon(name) {
  return ICONS[name] || ICONS.command;
}
