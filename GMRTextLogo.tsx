export default function GMRTextLogo() {
  return (
    <div className="flex flex-col leading-none select-none">

      {/* TOP TEXT */}
      <div className="flex items-end font-extrabold">

        {/* G */}
        <span className="text-[44px] text-[#0b2e59]">G</span>

        {/* M - Split Color */}
        <span
          className="text-[44px] font-extrabold mx-1"
          style={{
            background: "linear-gradient(65deg, #d9231a 50%, #f4a000 50%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          M
        </span>

        {/* R */}
        <span className="text-[44px] text-[#0b2e59]">R</span>

      </div>

      {/* SUBTITLE */}
      <span className="text-[12px] tracking-[3px] text-[#0b2e59] font-semibold">
        NEXUS PORTAL
      </span>

    </div>
  );
}