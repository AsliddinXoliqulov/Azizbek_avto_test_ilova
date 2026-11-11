// Umumiy SVG belgilar (hammasi 24x24, chiziqli uslub).
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export const IconHome = (props) => (
  <svg {...base} {...props}>
    <path d="m3 10.5 9-7.2 9 7.2V20a1 1 0 0 1-1 1h-5v-6.5H9V21H4a1 1 0 0 1-1-1z" />
  </svg>
)
export const IconBack = (props) => (
  <svg {...base} {...props}>
    <path d="M19 12H5m6 6-6-6 6-6" />
  </svg>
)
export const IconBook = (props) => (
  <svg {...base} {...props}>
    <path d="M12 7.5c-2.2-1.5-4.5-2-7-2-.9 0-1.7.1-2.5.4v13.4c.8-.3 1.6-.4 2.5-.4 2.7 0 5 .6 7 1.8" />
    <path d="M12 7.5c2.2-1.5 4.5-2 7-2 .9 0 1.7.1 2.5.4v13.4c-.8-.3-1.6-.4-2.5-.4-2.7 0-5 .6-7 1.8" />
    <path d="M12 7.5v13.2" />
  </svg>
)
export const IconExam = (props) => (
  <svg {...base} {...props}>
    <rect x="4" y="3" width="16" height="18" rx="3" />
    <path d="m8.5 12.2 2.4 2.4 4.6-5" />
  </svg>
)
export const IconList = (props) => (
  <svg {...base} {...props}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="1.1" />
    <circle cx="4.5" cy="12" r="1.1" />
    <circle cx="4.5" cy="18" r="1.1" />
  </svg>
)
export const IconGrid = (props) => (
  <svg {...base} {...props}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </svg>
)
export const IconSun = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
  </svg>
)
export const IconMoon = (props) => (
  <svg {...base} {...props}>
    <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
  </svg>
)
export const IconUser = (props) => (
  <svg {...base} {...props}>
    <path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
  </svg>
)
export const IconChevronDown = (props) => (
  <svg {...base} {...props}>
    <path d="m7 10 5 5 5-5" />
  </svg>
)
export const IconWarn = (props) => (
  <svg {...base} {...props}>
    <path d="M12 8v4m0 4h.01M10.3 3.9 1.8 18.2A2 2 0 0 0 3.5 21h17a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0Z" />
  </svg>
)
export const IconBookmark = (props) => (
  <svg {...base} {...props}>
    <path d="M6 3.8A1.8 1.8 0 0 1 7.8 2h8.4A1.8 1.8 0 0 1 18 3.8V22l-6-4-6 4z" />
  </svg>
)
export const IconTrash = (props) => (
  <svg {...base} {...props}>
    <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
  </svg>
)
export const IconLogOut = (props) => (
  <svg {...base} {...props}>
    <path d="M10 17l5-5-5-5m5 5H3m9-9h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" />
  </svg>
)
export const IconGlobe = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3Z" />
  </svg>
)
export const IconClose = (props) => (
  <svg {...base} {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)
export const IconArrowRight = (props) => (
  <svg {...base} {...props}>
    <path d="M5 12h14m-6-6 6 6-6 6" />
  </svg>
)
export const IconCheck = (props) => (
  <svg {...base} {...props}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
)
