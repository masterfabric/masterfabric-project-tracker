import { cn } from "@/lib/utils";

/**
 * Ops / empty scenes — people + product chrome, transparent bg.
 * Slate #1E293B + teal. Sized for centered empty-state heroes.
 */

const INK = "#1E293B";
const DEEP = "#0F172A";
const PAPER = "#FFFFFF";
const ASH = "#F1F5F9";
const MUTED = "#94A3B8";
const LINE = "#CBD5E1";
const TEAL = "#14B8A6";
const TEAL_DEEP = "#0D9488";
const SKIN = "#E8C4B0";
const SKIN_DEEP = "#C9956C";
const HAIR = "#1E293B";

function SoftShadow({
  x,
  y,
  w,
  h,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
}) {
  return (
    <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} fill={INK} opacity="0.06" />
  );
}

/** Welcome — compact Projects board with one collaborator. */
export function IllusWelcomeOps({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 240"
      className={cn("block overflow-visible", className)}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <SoftShadow x={40} y={214} w={280} h={20} />
      {/* Board */}
      <rect x="48" y="24" width="240" height="150" rx="14" fill={DEEP} stroke={INK} strokeWidth="2" />
      <rect x="48" y="24" width="32" height="150" rx="14" fill={INK} />
      <rect x="48" y="40" width="32" height="118" fill={INK} />
      <rect x="56" y="40" width="16" height="16" rx="4" fill={TEAL} />
      <text
        x="92"
        y="52"
        fill={PAPER}
        fontFamily="system-ui,sans-serif"
        fontSize="13"
        fontWeight="700"
      >
        Projects
      </text>
      {[0, 1, 2].map((i) => {
        const x = 92 + i * 60;
        const labels = ["To Do", "Doing", "Done"];
        return (
          <g key={i}>
            <text
              x={x}
              y={74}
              fill={ASH}
              fontFamily="system-ui,sans-serif"
              fontSize="9"
              fontWeight="600"
            >
              {labels[i]}
            </text>
            <rect
              x={x}
              y={82}
              width={52}
              height={32}
              rx={5}
              fill="#0B1220"
              stroke={i === 1 ? TEAL : LINE}
              strokeOpacity={i === 1 ? 0.4 : 0.2}
            />
            <rect x={x} y={82} width={18} height={2.5} fill={TEAL} />
            <circle cx={x + 40} cy={104} r={4} fill={i === 0 ? TEAL : ASH} />
          </g>
        );
      })}
      {/* Person pointing */}
      <g>
        <circle cx="310" cy="120" r="13" fill={SKIN} />
        <path d="M296 112 Q310 102 324 112 L322 126 Q310 132 298 126Z" fill={HAIR} />
        <path d="M292 136 Q310 128 328 136 L332 188 L288 188 Z" fill={TEAL} />
        <path
          d="M292 152 Q270 140 256 128"
          stroke={SKIN}
          strokeWidth="8"
          strokeLinecap="round"
        />
        <rect x="296" y="188" width="10" height="28" rx="3" fill={INK} />
        <rect x="314" y="188" width="10" height="28" rx="3" fill={INK} />
      </g>
      {/* Checklist chip */}
      <rect x="20" y="160" width="64" height="48" rx="8" fill={PAPER} stroke={INK} strokeWidth="1.75" />
      <rect x="30" y="172" width="10" height="10" rx="2" fill={TEAL} />
      <rect x="44" y="174" width="28" height="5" rx="1" fill={LINE} />
      <rect x="30" y="188" width="10" height="10" rx="2" fill={ASH} stroke={LINE} />
      <rect x="44" y="190" width="24" height="5" rx="1" fill={LINE} />
    </svg>
  );
}

/** Empty org — team forming around an organization card. */
export function IllusEmptyOrg({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 240"
      className={cn("block overflow-visible", className)}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <SoftShadow x={40} y={214} w={240} h={18} />
      {/* Org card */}
      <rect x="88" y="36" width="144" height="112" rx="14" fill={PAPER} stroke={INK} strokeWidth="2.5" />
      <rect x="88" y="36" width="144" height="28" rx="14" fill={INK} />
      <rect x="88" y="52" width="144" height="12" fill={INK} />
      <rect x="88" y="36" width="10" height="112" fill={TEAL_DEEP} />
      <circle cx="160" cy="88" r="16" fill={ASH} stroke={LINE} strokeWidth="2" />
      <circle cx="160" cy="84" r="7" fill={MUTED} />
      <ellipse cx="160" cy="98" rx="11" ry="6" fill={MUTED} />
      <rect x="112" y="116" width="96" height="8" rx="2" fill={LINE} />
      <rect x="124" y="130" width="72" height="6" rx="2" fill={LINE} opacity="0.7" />

      {/* Person left */}
      <g>
        <circle cx="56" cy="150" r="14" fill={SKIN} />
        <path d="M42 142 Q56 132 70 142 L68 156 Q56 162 44 156Z" fill={HAIR} />
        <path d="M38 168 Q56 158 74 168 L78 210 L34 210 Z" fill={TEAL} />
        <rect x="44" y="210" width="10" height="24" rx="3" fill={INK} />
        <rect x="58" y="210" width="10" height="24" rx="3" fill={INK} />
      </g>
      {/* Person right */}
      <g>
        <circle cx="264" cy="148" r="14" fill={SKIN_DEEP} />
        <path d="M250 140 Q264 130 278 140 L276 154 Q264 160 252 154Z" fill={HAIR} />
        <path d="M246 166 Q264 156 282 166 L286 210 L242 210 Z" fill={INK} />
        <rect x="252" y="210" width="10" height="24" rx="3" fill={DEEP} />
        <rect x="266" y="210" width="10" height="24" rx="3" fill={DEEP} />
      </g>
      {/* Create mark */}
      <circle cx="248" y="56" r="18" fill={TEAL} />
      <path d="M248 48v16M240 56h16" stroke={PAPER} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/** Empty project — person creating first project board. */
export function IllusEmptyProject({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 240"
      className={cn("block overflow-visible", className)}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <SoftShadow x={36} y={214} w={248} h={18} />
      {/* Project folder / board hybrid */}
      <path
        d="M72 64h48l14 14h100v100H72z"
        fill={PAPER}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect x="72" y="64" width="48" height="14" fill={INK} />
      <rect x="72" y="78" width="162" height="8" fill={TEAL_DEEP} />
      <rect x="92" y="104" width="56" height="36" rx="6" fill={ASH} stroke={LINE} />
      <rect x="92" y="104" width="20" height="3" fill={TEAL} />
      <rect x="160" y="104" width="56" height="36" rx="6" fill={ASH} stroke={LINE} />
      <rect x="160" y="104" width="20" height="3" fill={TEAL} />
      <rect
        x="126"
        y="152"
        width="56"
        height="28"
        rx="6"
        stroke={TEAL}
        strokeWidth="1.75"
        strokeDasharray="4 3"
        fill="none"
      />
      <path d="M154 160v12M148 166h12" stroke={TEAL} strokeWidth="2" strokeLinecap="round" />

      {/* Person holding create */}
      <g>
        <circle cx="268" cy="128" r="14" fill={SKIN} />
        <path d="M254 120 Q268 110 282 120 L280 134 Q268 140 256 134Z" fill={HAIR} />
        <path d="M250 146 Q268 136 286 146 L290 198 L246 198 Z" fill={TEAL} />
        <circle cx="248" cy="108" r="16" fill={INK} />
        <path d="M248 100v16M240 108h16" stroke={TEAL} strokeWidth="2.5" strokeLinecap="square" />
        <path
          d="M250 160 Q236 140 248 116"
          stroke={SKIN}
          strokeWidth="8"
          strokeLinecap="round"
        />
        <rect x="256" y="198" width="10" height="28" rx="3" fill={INK} />
        <rect x="272" y="198" width="10" height="28" rx="3" fill={INK} />
      </g>
    </svg>
  );
}

/** Empty issues — empty kanban with person ready to add first card. */
export function IllusEmptyIssues({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 340 240"
      className={cn("block overflow-visible", className)}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <SoftShadow x={40} y={214} w={260} h={18} />
      <rect x="40" y="28" width="220" height="148" rx="14" fill={DEEP} stroke={INK} strokeWidth="2" />
      {[0, 1, 2].map((i) => {
        const x = 58 + i * 68;
        const labels = ["To Do", "Doing", "Done"];
        return (
          <g key={i}>
            <text
              x={x}
              y={54}
              fill={ASH}
              fontFamily="system-ui,sans-serif"
              fontSize="10"
              fontWeight="600"
            >
              {labels[i]}
            </text>
            {i === 0 ? (
              <>
                <rect
                  x={x}
                  y={66}
                  width={56}
                  height={36}
                  rx={6}
                  stroke={TEAL}
                  strokeWidth="1.75"
                  strokeDasharray="4 3"
                  fill="none"
                />
                <path
                  d={`M${x + 28} 76v16M${x + 20} 84h16`}
                  stroke={TEAL}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </>
            ) : (
              <rect
                x={x}
                y={66}
                width={56}
                height={72}
                rx={8}
                fill="#0B1220"
                stroke={LINE}
                strokeOpacity="0.15"
              />
            )}
          </g>
        );
      })}
      {/* Person with card */}
      <g>
        <circle cx="292" cy="120" r="14" fill={SKIN_DEEP} />
        <path d="M278 112 Q292 102 306 112 L304 126 Q292 132 280 126Z" fill={HAIR} />
        <path d="M274 138 Q292 128 310 138 L314 190 L270 190 Z" fill={TEAL} />
        <rect x="248" y="108" width="40" height="28" rx="5" fill={PAPER} stroke={INK} strokeWidth="1.75" />
        <rect x="248" y="108" width="14" height="3" fill={TEAL} />
        <rect x="254" y="118" width="22" height="4" rx={1} fill={LINE} />
        <path
          d="M274 152 Q260 140 262 122"
          stroke={SKIN_DEEP}
          strokeWidth="8"
          strokeLinecap="round"
        />
        <rect x="280" y="190" width="10" height="28" rx="3" fill={INK} />
        <rect x="296" y="190" width="10" height="28" rx="3" fill={INK} />
      </g>
    </svg>
  );
}

/** Select project — stack of project cards with picker. */
export function IllusSelectProject({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 220"
      className={cn("block overflow-visible", className)}
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <SoftShadow x={40} y={196} w={220} h={16} />
      <rect x="48" y="56" width="88" height="108" rx="10" fill={ASH} stroke={INK} strokeWidth="2" />
      <rect x="96" y="36" width="108" height="132" rx="12" fill={PAPER} stroke={INK} strokeWidth="2.5" />
      <rect x="112" y="56" width="64" height="10" rx="2" fill={INK} />
      <rect x="112" y="76" width="48" height="7" rx="2" fill={LINE} />
      <rect x="112" y="100" width="64" height="28" rx="6" fill={TEAL_DEEP} />
      <text
        x="124"
        y="118"
        fill={PAPER}
        fontFamily="system-ui,sans-serif"
        fontSize="11"
        fontWeight="650"
      >
        Open
      </text>
      <rect x="164" y="60" width="88" height="108" rx="10" fill={ASH} stroke={INK} strokeWidth="2" />
      {/* Person choosing */}
      <g>
        <circle cx="250" cy="150" r="12" fill={SKIN} />
        <path d="M238 144 Q250 134 262 144 L260 156 Q250 160 240 156Z" fill={HAIR} />
        <path d="M234 164 Q250 156 266 164 L268 196 L232 196 Z" fill={TEAL} />
      </g>
    </svg>
  );
}

export function IllusCaughtUp({ className }: { className?: string }) {
  return <IllusWelcomeOps className={className} />;
}

export function IllusFocusNext({ className }: { className?: string }) {
  return <IllusEmptyIssues className={className} />;
}

export function IllusQuietTeam({ className }: { className?: string }) {
  return <IllusEmptyOrg className={className} />;
}
