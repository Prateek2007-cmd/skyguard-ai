import { Link } from "react-router-dom";

/**
 * PrimaryLink — a react-router Link styled exactly like Button's primary
 * variant (vermilion, warm shadow, hover lift). The landing page's calls
 * to action are links, not buttons; this keeps them identical to the
 * primary button instead of duplicating its classes at every call site.
 */
const sizes = {
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2",
};

export default function PrimaryLink({
  to,
  size = "md",
  className = "",
  children,
  ...props
}) {
  return (
    <Link
      to={to}
      className={[
        "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium",
        "bg-vermilion-deep text-white shadow-accent",
        "transition-[background-color,transform,box-shadow] duration-150 ease-out",
        "hover:-translate-y-px hover:bg-vermilion-dark",
        "active:translate-y-0 active:scale-[0.98] active:bg-vermilion-dark",
        sizes[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </Link>
  );
}
