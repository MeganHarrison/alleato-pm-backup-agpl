export const dialogOverlayMotion =
  "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:duration-150 data-[state=closed]:duration-100 data-[state=open]:ease-out data-[state=closed]:ease-in";

// slide-in-from-left-1/2 and slide-in-from-top-[48%] seed the @keyframes enter "from"
// state with --tw-enter-translate-x=-50% and --tw-enter-translate-y=-48%, keeping the
// dialog near its centered position throughout the animation. Without these, tailwindcss-animate
// defaults to translate(0,0) in the "from" frame, overriding translate-x-[-50%] translate-y-[-50%]
// and causing the dialog to flash off-screen at the start of the open animation.
export const dialogContentMotion =
  "data-[state=open]:animate-in data-[state=closed]:animate-out " +
  "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 " +
  "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 " +
  "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] " +
  "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] " +
  "data-[state=open]:duration-200 data-[state=closed]:duration-150 " +
  "data-[state=open]:ease-out data-[state=closed]:ease-in";
