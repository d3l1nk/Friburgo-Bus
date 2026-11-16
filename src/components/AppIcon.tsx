/** Ícone oficial: ônibus com balão de interrogação sobre fundo azul. */
export default function AppIcon({ size = 48, rounded = true }: { size?: number; rounded?: boolean }) {
  const B = '#1F6FEB';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Where is my bus?">
      <rect width="100" height="100" rx={rounded ? 22 : 0} fill={B} />
      <g transform="translate(9 9) scale(.82)">
        <rect x="30" y="19" width="26" height="8" rx="3.5" fill="#fff" />
        <rect x="12" y="25" width="62" height="54" rx="11" fill="#fff" />
        <rect x="19" y="32" width="48" height="23" rx="5" fill={B} />
        <rect x="19" y="58" width="48" height="4" rx="2" fill={B} opacity=".25" />
        <circle cx="26" cy="68" r="4.6" fill={B} />
        <circle cx="60" cy="68" r="4.6" fill={B} />
        <rect x="18" y="77" width="12" height="10" rx="3.5" fill="#fff" />
        <rect x="56" y="77" width="12" height="10" rx="3.5" fill="#fff" />
        <path d="M64 42 L61 56 L75 46 Z" fill="#fff" stroke={B} strokeWidth="3.5" strokeLinejoin="round" />
        <circle cx="76" cy="26" r="21" fill="#fff" stroke={B} strokeWidth="4.5" />
        <path d="M69.5 20.5 a7 7 0 1 1 10.5 6 c-3.2 1.9 -3.8 3.2 -3.8 6.2" fill="none" stroke={B} strokeWidth="5" strokeLinecap="round" />
        <circle cx="76.2" cy="39" r="3.2" fill={B} />
      </g>
    </svg>
  );
}
