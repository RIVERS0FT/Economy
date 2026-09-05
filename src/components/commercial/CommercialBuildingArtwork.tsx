import { useId } from 'react';

const storefronts: Record<string, { wall: string; trim: string }> = {
  'convenience-store': { wall: '#e4d9bb', trim: '#397b71' },
  'fresh-market': { wall: '#dcc9a2', trim: '#5b8047' },
  restaurant: { wall: '#d8ac83', trim: '#9a5140' },
  'clothing-store': { wall: '#ddd4c8', trim: '#716177' },
  'furniture-showroom': { wall: '#d4c2a8', trim: '#806548' },
  'appliance-store': { wall: '#c7d2d5', trim: '#477d91' },
};

/** Local commercial scenes; no industrial artwork or business-type conversion. */
export function CommercialBuildingArtwork({ commercialTypeId, className = '' }: {
  commercialTypeId: string;
  className?: string;
}) {
  const id = useId();
  const palette = storefronts[commercialTypeId] ?? { wall: '#d3cbbd', trim: '#68766f' };
  return (
    <svg className={`commercial-building-artwork ${className}`.trim()}
      viewBox="0 0 320 400" preserveAspectRatio="xMidYMid slice"
      aria-hidden="true" focusable="false" data-commercial-artwork={commercialTypeId}>
      <defs>
        <linearGradient id={`${id}-sky`} x2="0" y2="1">
          <stop stopColor="#9ec6d7" /><stop offset="1" stopColor="#edf0df" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x2="1" y2="1">
          <stop stopColor="#334f55" /><stop offset="0.55" stopColor="#719193" /><stop offset="1" stopColor="#263c43" />
        </linearGradient>
        <linearGradient id={`${id}-ground`} x2="0" y2="1">
          <stop stopColor="#bec3a5" /><stop offset="1" stopColor="#797f70" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id}-sky)`} d="M0 0h320v400H0z" />
      <circle cx="62" cy="56" r="34" fill="#fff5ce" opacity=".45" />
      <path fill="#b4c5b7" d="M0 111h30V86h39v34h44V95h43v40h69V92h45v19h50v137H0z" />
      <path fill="#879e83" d="M0 161q17-65 42-28 20-50 45 0 30-32 43 17h84q23-75 47-28 31-56 59 25v114H0z" />
      <path fill={`url(#${id}-ground)`} d="M0 234h320v166H0z" />
      <path fill="#d1d0b9" d="m10 310 219-53 91 65v50L0 357z" />
      <path fill="#536359" opacity=".42" d="m33 287 210-4 68 62-208 12z" />
      <path fill="#777669" d="m45 151 221-17 33 25-33 145-221 9z" />
      <path fill={palette.wall} d="M31 156h231v153H31z" />
      <path fill="#a49b83" d="m262 156 27 16v121l-27 16z" />
      <path fill="#e6deca" d="m25 152 234-14 35 21-32 6H25z" />
      <path fill={palette.trim} d="M34 168h225v30H34z" />
      <path fill="#f1e8cd" opacity=".8" d="M57 179h81v5H57zm139 0h37v5h-37z" />
      <path fill="#6d756b" d="M40 211h71v78H40zm91-7h47v100h-47zm65 7h57v78h-57z" />
      <path fill={`url(#${id}-glass)`} d="M44 215h63v69H44zm91-7h39v90h-39zm65 7h49v69h-49z" />
      <path fill="#f3ead2" d="M31 194h231v8H31z" />
      <path fill={palette.trim} d="m31 202-9 20h249l-9-20z" />
      <path fill="#f2e9d1" opacity=".8" d="m48 202-3 20h13l2-20zm41 0-1 20h13v-20zm42 0v20h13v-20zm42 0 1 20h13l-1-20zm42 0 2 20h13l-3-20z" />
      {commercialTypeId === 'fresh-market' ? (
        <g><path fill="#987851" d="M45 259h58v22H45zM200 259h45v22h-45z" />
          {[52, 66, 80, 94, 207, 222, 237].map((x, i) => <circle key={x} cx={x} cy={255} r="6" fill={i % 2 ? '#b8bb54' : '#d59c58'} />)}</g>
      ) : commercialTypeId === 'clothing-store' ? (
        <g fill="#eddfc7"><path d="m62 234-13 11 7 7 7-6v28h21v-28l7 6 7-7-14-11-6 7h-9z" />
          <path d="m215 235-9 11 7 5-8 24h33l-8-24 7-5-9-11-6 7z" fill="#b58d83" /></g>
      ) : commercialTypeId === 'furniture-showroom' ? (
        <g><rect x="48" y="251" width="56" height="24" rx="6" fill="#c5a471" /><path fill="#e3c698" d="M54 242h43v18H54z" />
          <path stroke="#e0cf9e" strokeWidth="4" d="M217 240v36m-10 0h20" /><path fill="#e9d4a4" d="m208 233-5 17h28l-6-17z" /></g>
      ) : commercialTypeId === 'appliance-store' ? (
        <g fill="#d9e0d8"><rect x="51" y="237" width="23" height="40" rx="2" /><path stroke="#647b7d" d="M51 253h23m-5 5v10" />
          <rect x="79" y="251" width="24" height="26" rx="2" /><circle cx="91" cy="265" r="8" fill="#5f808a" />
          <rect x="203" y="239" width="39" height="27" rx="2" /><path fill="#567d86" d="M206 242h33v21h-33z" /><path stroke="#d9e0d8" strokeWidth="3" d="M222 266v9m-11 0h22" /></g>
      ) : commercialTypeId === 'restaurant' ? (
        <g><path fill="#d5b47d" d="M50 255h47v5H50zm151 0h42v5h-42z" /><path stroke="#d5b47d" strokeWidth="4" d="M61 260v18m26-18v18m124-18v18m23-18v18" />
          <ellipse cx="74" cy="253" rx="13" ry="3" fill="#f6eacb" /><path stroke="#d6b98a" strokeWidth="2" d="M74 224v13m147-13v13" /><path fill="#d6b98a" d="m64 239 10-8 10 8zm147 0 10-8 10 8z" /></g>
      ) : (
        <g><path stroke="#c5ae87" strokeWidth="4" d="M49 247h53m-53 15h53m103-15h38m-38 15h38" />
          {[54, 66, 78, 90, 211, 225, 237].map((x, i) => <path key={x} fill={i % 2 ? '#d6bd7b' : '#b97960'} d={`M${x} 234h7v11h-7zm0 17h7v9h-7z`} />)}</g>
      )}
      <path stroke="#d4dfd9" opacity=".38" strokeWidth="2" d="m45 227 57 54m99-54 42 43m-103-39 30 30" />
      <path stroke="#c6c2a6" strokeWidth="3" d="M155 221v77m9-46v10" />
      <path fill="#e0d7bd" d="M28 303h235v8H28zm103 9h48v7h-48z" />
      <path stroke="#72876d" strokeWidth="3" d="M15 288v39m286-60v51" />
      <g fill="#4f7252"><ellipse cx="16" cy="278" rx="17" ry="29" /><ellipse cx="288" cy="261" rx="18" ry="36" /></g>
      <g fill="#70905b"><ellipse cx="11" cy="269" rx="11" ry="18" /><ellipse cx="282" cy="249" rx="12" ry="22" /></g>
      <path fill="#a7906e" d="m3 316 24 2-3 16H6zm274-9h26l-4 17h-21z" />
      <path stroke="#b7b6a2" d="m0 368 320-31m-278 63 61-57m105 57-24-70" />
    </svg>
  );
}
