/**
 * BrandWordmark — the OpenRadio logo image acts as the "O" of "Open",
 * followed by "pen" + orange "Radio". Used everywhere except the footer.
 */
export function BrandWordmark({
  textClass = "font-black text-[26px] tracking-tight text-gray-900",
  imgClass = "h-[1.15em] w-auto",
  accentClass = "text-[#f97316]",
}: {
  textClass?: string;
  imgClass?: string;
  accentClass?: string;
}) {
  return (
    <span className={`inline-flex items-center leading-none ${textClass}`}>
      <img
        src="/logo-transparent.png"
        alt="O"
        className={`${imgClass} object-contain inline-block mr-[0.04em]`}
      />
      <span>pen</span>
      <span className={accentClass}>Radio</span>
    </span>
  );
}
