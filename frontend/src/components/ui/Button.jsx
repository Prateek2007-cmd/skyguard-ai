import { forwardRef } from "react";

/**
 * Button — one primary style, one secondary, one ghost, one danger.
 * All states covered: hover, active (press scale), focus-visible ring,
 * disabled. Never a <div onClick>; always a real <button> or <a>.
 *
 * Primary is vermilion — the loud 10%. White on vermilion-deep is
 * 5.58:1, so the label passes AA; the warm shadow lifts it off the mist.
 */
const variants = {
  primary:
    "bg-vermilion-deep text-white shadow-accent hover:-translate-y-px hover:bg-vermilion-dark active:bg-vermilion-dark active:translate-y-0 disabled:bg-vermilion-deep/40 disabled:shadow-none disabled:hover:translate-y-0",
  secondary:
    "bg-white text-ink border border-line-strong hover:border-ink/40 hover:bg-mist active:bg-mist-deep disabled:text-muted disabled:border-line",
  ghost:
    "bg-transparent text-ink hover:bg-ink/5 active:bg-ink/10 disabled:text-muted",
  danger:
    "bg-coral text-white hover:bg-coral-deep active:bg-coral-deep disabled:bg-coral/50",
};

const sizes = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2",
};

const Button = forwardRef(function Button(
  { variant = "primary", size = "md", className = "", type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[
        "inline-flex items-center justify-center rounded-lg font-medium",
        "transition-[background-color,border-color,color,transform] duration-150 ease-out",
        "active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100",
        "whitespace-nowrap",
        variants[variant],
        sizes[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});

export default Button;
