/**
 * MeshField — a decorative liquid-gradient field that gives the glass
 * surfaces something to refract. Instrument blue + healthy green only:
 * coral never appears here, because coral means anomaly.
 *
 * Purely decorative (aria-hidden, pointer-events none). The blobs drift
 * slowly on transform only; prefers-reduced-motion freezes them (see
 * index.css). The field fills its parent, so the caller positions it —
 * usually a relative section or a fixed top band.
 *
 * Variants:
 * - "hero": three blobs for the landing hero.
 * - "page": two blobs, top-anchored, for the app shell.
 * - "band": two wide blobs for a closing band (final CTA).
 */
const BLOBS = {
  hero: [
    {
      id: "a",
      tone: "mesh-blob--blue",
      style: { top: "-18%", right: "-4%", width: 520, height: 520 },
      duration: "26s",
      delay: "0s",
    },
    {
      id: "b",
      tone: "mesh-blob--green",
      style: { top: "38%", left: "-6%", width: 420, height: 420 },
      duration: "34s",
      delay: "-12s",
    },
    {
      id: "c",
      tone: "mesh-blob--blue-soft",
      style: { top: "62%", right: "18%", width: 360, height: 360 },
      duration: "30s",
      delay: "-6s",
    },
  ],
  page: [
    {
      id: "a",
      tone: "mesh-blob--blue",
      style: { top: "-32%", right: "6%", width: 460, height: 460 },
      duration: "28s",
      delay: "0s",
    },
    {
      id: "b",
      tone: "mesh-blob--green",
      style: { top: "-12%", left: "10%", width: 340, height: 340 },
      duration: "36s",
      delay: "-14s",
    },
  ],
  band: [
    {
      id: "a",
      tone: "mesh-blob--blue-soft",
      style: { top: "-40%", left: "4%", width: 480, height: 420 },
      duration: "30s",
      delay: "-8s",
    },
    {
      id: "b",
      tone: "mesh-blob--green",
      style: { top: "-20%", right: "2%", width: 380, height: 380 },
      duration: "34s",
      delay: "-2s",
    },
  ],
};

export default function MeshField({ variant = "page" }) {
  const blobs = BLOBS[variant] || BLOBS.page;
  return (
    <div aria-hidden="true" className="mesh-field">
      {blobs.map((blob) => (
        <div
          key={blob.id}
          className={`mesh-blob ${blob.tone}`}
          style={{
            ...blob.style,
            animationDuration: blob.duration,
            animationDelay: blob.delay,
          }}
        />
      ))}
    </div>
  );
}
