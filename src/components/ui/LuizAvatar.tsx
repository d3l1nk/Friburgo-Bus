/** Avatar do Luiz: motorista simpático de boné. */
export default function LuizAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Luiz">
      <circle cx="32" cy="32" r="32" fill="#1F6FEB" />
      <circle cx="32" cy="36" r="17" fill="#f1c7a0" />
      <path d="M13 31 Q32 4 51 31 Z" fill="#12335f" />
      <rect x="10" y="29" width="44" height="6" rx="3" fill="#0b2342" />
      <path d="M41 33 h16 a4 3 0 0 1 -4 4 h-12 z" fill="#0b2342" />
      <circle cx="25.5" cy="40" r="2.2" fill="#2a2a2a" />
      <circle cx="38.5" cy="40" r="2.2" fill="#2a2a2a" />
      <path d="M25 47 q7 6 14 0" fill="none" stroke="#7a3b22" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="32" cy="22" r="3" fill="#fbbf24" />
    </svg>
  );
}
