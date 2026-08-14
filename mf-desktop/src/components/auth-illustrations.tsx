import { cn } from "@/lib/utils";

/**
 * Auth heroes — Illustrator-quality product vectors for Sign in / Sign up.
 * Transparent bg. MasterFabric slate (#1E293B) + soft ash surfaces.
 * No purple / cream / neon; product chrome (boards, issues, invite) as the visual.
 */

const INK = "#1E293B";
const DEEP = "#0F172A";
const PAPER = "#FFFFFF";
const ASH = "#F8FAFC";
const ASH2 = "#F1F5F9";
const MUTED = "#94A3B8";
const LINE = "#E2E8F0";
const LINE2 = "#CBD5E1";
const ACCENT = "#334155";
const OK = "#0F766E";
const SKIN_A = "#E7C6B2";
const SKIN_B = "#D4A574";
const HAIR = "#0F172A";

function SoftShadow({
  x,
  y,
  w,
  h,
  opacity = 0.07,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  opacity?: number;
}) {
  return (
    <ellipse
      cx={x + w / 2}
      cy={y + h / 2}
      rx={w / 2}
      ry={h / 2}
      fill={INK}
      opacity={opacity}
    />
  );
}

function DotGrid({
  x,
  y,
  cols,
  rows,
  gap = 18,
}: {
  x: number;
  y: number;
  cols: number;
  rows: number;
  gap?: number;
}) {
  const dots = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      dots.push(
        <circle
          key={`${r}-${c}`}
          cx={x + c * gap}
          cy={y + r * gap}
          r={1.15}
          fill={LINE2}
          opacity={0.55}
        />,
      );
    }
  }
  return <g aria-hidden>{dots}</g>;
}

/** Flat “person” — head + torso + legs, no awkward stick arms. */
function Person({
  cx,
  cy,
  skin,
  shirt,
  scale = 1,
  facing = 1,
}: {
  cx: number;
  cy: number;
  skin: string;
  shirt: string;
  scale?: number;
  facing?: 1 | -1;
}) {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${facing * scale} ${scale})`}>
      <circle cx={0} cy={-46} r={14} fill={skin} />
      <path
        d="M-13 -52 C-8 -62 8 -62 13 -52 L11 -40 C4 -34 -4 -34 -11 -40Z"
        fill={HAIR}
      />
      <path
        d="M-18 -28 C-6 -36 6 -36 18 -28 L22 22 L-22 22Z"
        fill={shirt}
      />
      <rect x={-16} y={22} width={12} height={34} rx={4} fill={DEEP} />
      <rect x={4} y={22} width={12} height={34} rx={4} fill={DEEP} />
      <ellipse cx={-10} cy={56} rx={9} ry={3.5} fill={INK} opacity={0.12} />
      <ellipse cx={10} cy={56} rx={9} ry={3.5} fill={INK} opacity={0.12} />
    </g>
  );
}

/** Sign-in — returning to an open Project Tracker workspace (list + board). */
export function IllusAuthSignIn({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 560 400"
      className={cn("block overflow-visible", className)}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <DotGrid x={28} y={28} cols={6} rows={5} gap={20} />
      <DotGrid x={420} y={48} cols={5} rows={4} gap={18} />
      <SoftShadow x={70} y={352} w={420} h={34} />

      {/* Soft ambient wash */}
      <circle cx={120} cy={110} r={70} fill={ASH2} opacity={0.7} />
      <circle cx={460} cy={160} r={58} fill={ASH2} opacity={0.55} />

      {/* Main product window */}
      <g>
        <rect
          x={88}
          y={48}
          width={320}
          height={236}
          rx={18}
          fill={PAPER}
          stroke={INK}
          strokeWidth={2.25}
        />
        {/* titlebar */}
        <path
          d="M88 66c0-9.94 8.06-18 18-18h284c9.94 0 18 8.06 18 18v14H88V66Z"
          fill={INK}
        />
        <circle cx={114} cy={66} r={4} fill={MUTED} />
        <circle cx={128} cy={66} r={4} fill={MUTED} />
        <circle cx={142} cy={66} r={4} fill={MUTED} />
        <rect x={168} y={60} width={96} height={10} rx={5} fill={ACCENT} />

        {/* sidebar */}
        <rect x={88} y={80} width={56} height={204} fill={ASH} />
        <rect x={100} y={96} width={32} height={10} rx={3} fill={INK} />
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={100}
            y={120 + i * 28}
            width={32}
            height={8}
            rx={3}
            fill={i === 1 ? INK : LINE2}
            opacity={i === 1 ? 1 : 0.85}
          />
        ))}

        {/* issue rows */}
        {[
          { y: 100, key: "PT-12", done: true },
          { y: 148, key: "PT-18", done: false },
          { y: 196, key: "PT-21", done: false },
        ].map((row) => (
          <g key={row.key}>
            <rect
              x={160}
              y={row.y}
              width={228}
              height={40}
              rx={10}
              fill={ASH}
              stroke={LINE}
            />
            <rect
              x={172}
              y={row.y + 12}
              width={8}
              height={16}
              rx={2}
              fill={row.done ? OK : ACCENT}
            />
            <rect
              x={190}
              y={row.y + 11}
              width={44}
              height={8}
              rx={2}
              fill={INK}
              opacity={0.85}
            />
            <rect
              x={190}
              y={row.y + 24}
              width={110}
              height={6}
              rx={2}
              fill={LINE2}
            />
            <circle
              cx={366}
              cy={row.y + 20}
              r={9}
              fill={row.done ? OK : ASH2}
              stroke={row.done ? OK : LINE2}
            />
            {row.done ? (
              <path
                d={`M${366 - 4.5} ${row.y + 20}l3 3 6-6`}
                stroke={PAPER}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </g>
        ))}

        {/* mini board strip */}
        <g>
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              x={160 + i * 76}
              y={248}
              width={68}
              height={22}
              rx={6}
              fill={i === 1 ? INK : ASH2}
              stroke={i === 1 ? INK : LINE}
            />
          ))}
        </g>
      </g>

      {/* Floating status chip */}
      <g>
        <rect
          x={428}
          y={72}
          width={100}
          height={56}
          rx={14}
          fill={PAPER}
          stroke={INK}
          strokeWidth={2}
        />
        <rect x={444} y={88} width={14} height={14} rx={4} fill={OK} />
        <path
          d="M447.5 95l2.5 2.5 5-5"
          stroke={PAPER}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
        <rect x={466} y={90} width={46} height={7} rx={2} fill={INK} opacity={0.8} />
        <rect x={466} y={104} width={34} height={6} rx={2} fill={LINE2} />
      </g>

      {/* Session lock badge */}
      <g>
        <circle cx={460} cy={200} r={28} fill={INK} />
        <rect
          x={450}
          y={196}
          width={20}
          height={16}
          rx={4}
          fill={PAPER}
        />
        <path
          d="M454 196v-5a6 6 0 0 1 12 0v5"
          stroke={PAPER}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
      </g>

      {/* Person — seated at the workspace */}
      <Person cx={170} cy={318} skin={SKIN_A} shirt={INK} scale={1.05} />
      {/* laptop */}
      <g>
        <rect x={198} y={300} width={64} height={40} rx={4} fill={DEEP} stroke={INK} strokeWidth={1.5} />
        <rect x={206} y={308} width={28} height={4} rx={1} fill={OK} />
        <rect x={206} y={318} width={40} height={3} rx={1} fill={LINE2} opacity={0.7} />
        <rect x={192} y={340} width={76} height={6} rx={2} fill={MUTED} />
      </g>

      {/* Standing collaborator */}
      <Person cx={390} cy={300} skin={SKIN_B} shirt={ACCENT} scale={0.95} />
    </svg>
  );
}

/** Sign-up — creating a MasterFabric account / joining an org workspace. */
export function IllusAuthSignUp({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 560 400"
      className={cn("block overflow-visible", className)}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <DotGrid x={36} y={36} cols={5} rows={4} gap={22} />
      <DotGrid x={430} y={60} cols={4} rows={5} gap={18} />
      <SoftShadow x={60} y={354} w={440} h={34} />

      <circle cx={90} cy={140} r={64} fill={ASH2} opacity={0.75} />
      <circle cx={470} cy={120} r={50} fill={ASH2} opacity={0.55} />

      {/* Invite / create-account card (hero) */}
      <g>
        <rect
          x={140}
          y={56}
          width={280}
          height={210}
          rx={20}
          fill={PAPER}
          stroke={INK}
          strokeWidth={2.25}
        />
        <rect x={140} y={56} width={8} height={210} rx={4} fill={INK} />

        {/* brand mark tile */}
        <rect x={168} y={80} width={44} height={44} rx={12} fill={INK} />
        <rect x={178} y={92} width={8} height={20} rx={2} fill={PAPER} />
        <rect x={190} y={98} width={8} height={14} rx={2} fill={PAPER} opacity={0.75} />
        <rect x={202} y={90} width={8} height={22} rx={2} fill={PAPER} />

        <rect x={228} y={88} width={120} height={12} rx={3} fill={INK} />
        <rect x={228} y={108} width={86} height={8} rx={3} fill={LINE2} />

        {/* form fields */}
        <rect
          x={168}
          y={148}
          width={224}
          height={36}
          rx={10}
          fill={ASH}
          stroke={LINE}
        />
        <rect x={180} y={160} width={72} height={8} rx={2} fill={LINE2} />
        <rect
          x={168}
          y={196}
          width={224}
          height={36}
          rx={10}
          fill={ASH}
          stroke={LINE}
        />
        <rect x={180} y={208} width={96} height={8} rx={2} fill={LINE2} />

        {/* primary CTA */}
        <rect x={168} y={244} width={132} height={36} rx={10} fill={INK} />
        <rect x={188} y={258} width={64} height={8} rx={2} fill={PAPER} opacity={0.9} />
        <path
          d="M268 262h16M278 254v16"
          stroke={PAPER}
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.85}
        />
      </g>

      {/* Team ring — avatars joining */}
      <g>
        <circle
          cx={460}
          cy={170}
          r={54}
          fill="none"
          stroke={LINE2}
          strokeWidth={2}
          strokeDasharray="6 7"
        />
        <circle cx={460} cy={122} r={18} fill={SKIN_A} stroke={INK} strokeWidth={1.5} />
        <path
          d="M446 116 C452 108 468 108 474 116 L472 128 C466 134 454 134 448 128Z"
          fill={HAIR}
        />
        <circle cx={508} cy={170} r={16} fill={SKIN_B} stroke={INK} strokeWidth={1.5} />
        <path
          d="M496 164 C500 156 516 156 520 164 L518 174 C514 180 504 180 500 174Z"
          fill={HAIR}
        />
        <circle cx={460} cy={218} r={16} fill={ASH2} stroke={INK} strokeWidth={1.5} />
        <path
          d="M460 210v16M452 218h16"
          stroke={INK}
          strokeWidth={2.2}
          strokeLinecap="round"
        />
        <circle cx={412} cy={170} r={16} fill={INK} />
        <rect x={404} y={164} width={16} height={12} rx={3} fill={PAPER} opacity={0.9} />
      </g>

      {/* Org chip */}
      <g>
        <rect
          x={36}
          y={200}
          width={108}
          height={72}
          rx={14}
          fill={PAPER}
          stroke={INK}
          strokeWidth={2}
        />
        <rect x={52} y={216} width={28} height={28} rx={8} fill={ASH2} stroke={LINE2} />
        <circle cx={66} cy={226} r={5} fill={MUTED} />
        <ellipse cx={66} cy={236} rx={8} ry={4} fill={MUTED} />
        <rect x={90} y={220} width={38} height={7} rx={2} fill={INK} opacity={0.85} />
        <rect x={90} y={234} width={28} height={6} rx={2} fill={LINE2} />
      </g>

      {/* People celebrating create */}
      <Person cx={210} cy={328} skin={SKIN_A} shirt={OK} scale={1} />
      <Person cx={320} cy={322} skin={SKIN_B} shirt={INK} scale={1.05} facing={-1} />

      {/* Welcome spark */}
      <g>
        <circle cx={268} cy={286} r={16} fill={INK} />
        <path
          d="M268 278v16M260 286h16"
          stroke={PAPER}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export function AuthModeIllustration({
  mode,
  className,
}: {
  mode: "signin" | "signup";
  className?: string;
}) {
  return mode === "signup" ? (
    <IllusAuthSignUp className={className} />
  ) : (
    <IllusAuthSignIn className={className} />
  );
}
