import { cn } from "@/lib/utils";

/** Official MasterFabric geometric mark — matches masterfabric.co /assets/masterfabric-logo.svg */
export function MasterfabricMark({
  className,
  title = "MasterFabric",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 192 152"
      className={cn("shrink-0 text-[#1E293B]", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <path
        d="M96.7465 -0.00150013L82.6484 14.084L177.184 108.536L191.282 94.4501L96.7465 -0.00150013Z"
        fill="currentColor"
      />
      <path
        d="M14.0981 110.627L0 96.541L94.5359 2.08942L108.634 16.1749L14.0981 110.627Z"
        fill="currentColor"
      />
      <path
        d="M55.0082 151.505L40.9102 137.42L135.446 42.9683L149.544 57.0538L55.0082 151.505Z"
        fill="currentColor"
      />
      <path
        d="M59.7973 41.5083L45.6992 55.5938L140.235 150.045L154.333 135.96L59.7973 41.5083Z"
        fill="currentColor"
      />
    </svg>
  );
}
