import React from "react";

/**
 * ── THE CHARACTER BASE ──────────────────────────────────────────────────────
 *
 * `av2-base.svg`, sitting next to this file, inlined as React. Provenance, the MIT
 * licence it ships under and the measured landmark table are in `NOTICE.md` — read
 * that before touching anything here.
 *
 * **The appearance is locked and chosen.** Skin tone, hair and shirt are Mohamed's
 * picks. Do not re-export, re-pick or "improve" them.
 *
 * ── WHY IT IS FLATTENED ─────────────────────────────────────────────────────
 *
 * The export wraps every region in the Avataaars idiom: define a path in `<defs>`,
 * build a `<mask>` from it, then fill a full-bleed `<rect>` through that mask. Six
 * paths become about thirty elements and a dozen ids.
 *
 * That idiom cannot survive being drawn twice, and the rig has to draw it twice — once
 * for the body and once, clipped to the head, inside the group that carries the tilt,
 * the sink and the nod (the head must move against the shoulders, and the export is one
 * skin path from skull to waist). Two instances means duplicate ids in one document,
 * where every `href` silently resolves to whichever copy React rendered first.
 *
 * So the masks are flattened to their equivalent: fill the path with the colour
 * directly. The two `mask`-clipped shapes that genuinely need clipping — the neck shadow
 * and the collar shadow — keep it, as `clipPath`, with ids passed in from the caller so
 * the two instances never collide.
 *
 * **The path data is byte-identical to the export.** Only the wrapping changed, and the
 * one deliberate value change below.
 *
 * ── THE ONE DELIBERATE DELTA ────────────────────────────────────────────────
 *
 * `NOSE_OPACITY` is 0.27, not the export's 0.16. At 0.16 against the mouth's 0.7 the
 * nose is about four times fainter and does not read at beat 8's framing, let alone on a
 * phone. Everything else matches the file.
 */

/** Skin. `Skin/Brown` in the export. */
export const SKIN = "#EDB98A";
/** `Top/Short-Hair/Short-Flat`, `HairColor/BrownDark`. */
export const HAIR = "#4A312C";
/** `Clothing/Shirt-Crew-Neck`, `Colors/Blue03`. The shoulder extension matches it. */
export const SHIRT = "#25557C";

/**
 * Raised from the export's 0.16 — see the header. Picked off a render at beat 8's tight
 * framing rather than off the 0.25–0.30 range the handover suggested.
 */
const NOSE_OPACITY = 0.27;

/** Body, head, ears and neck as one outline. Group-local; the caller translates by (32, 36). */
const BODY_D =
  "M124,144.610951 L124,163 L128,163 L128,163 C167.764502,163 200,195.235498 200,235 L200,244 " +
  "L0,244 L0,235 C-4.86974701e-15,195.235498 32.235498,163 72,163 L72,163 L76,163 L76,144.610951 " +
  "C58.7626345,136.422372 46.3722246,119.687011 44.3051388,99.8812385 C38.4803105,99.0577866 34,94.0521096 34,88 " +
  "L34,74 C34,68.0540074 38.3245733,63.1180731 44,62.1659169 L44,56 L44,56 " +
  "C44,25.072054 69.072054,5.68137151e-15 100,0 L100,0 L100,0 " +
  "C130.927946,-5.68137151e-15 156,25.072054 156,56 L156,62.1659169 " +
  "C161.675427,63.1180731 166,68.0540074 166,74 L166,88 C166,94.0521096 161.51969,99.0577866 155.694861,99.8812385 " +
  "C153.627775,119.687011 141.237365,136.422372 124,144.610951 Z";

/** The crescent under the jaw. Masked to the body in the export; clipped here. */
const NECK_SHADOW_D =
  "M156,79 L156,102 C156,132.927946 130.927946,158 100,158 C69.072054,158 44,132.927946 44,102 " +
  "L44,79 L44,94 C44,124.927946 69.072054,150 100,150 C130.927946,150 156,124.927946 156,94 L156,79 Z";

/** Crew neck. Group-local; the caller translates by (0, 170). */
const SHIRT_D =
  "M165.960472,29.2949161 C202.936473,32.3249982 232,63.2942856 232,101.051724 L232,110 L32,110 " +
  "L32,101.051724 C32,62.9525631 61.591985,31.7649812 99.0454063,29.2195264 " +
  "C99.0152598,29.5931145 99,29.9692272 99,30.3476251 C99,42.2107177 113.998461,51.8276544 132.5,51.8276544 " +
  "C151.001539,51.8276544 166,42.2107177 166,30.3476251 C166,29.9946691 165.986723,29.6437014 165.960472,29.2949161 Z";

/** `Top/Short-Hair/Short-Flat`. Group-local; the caller translates by (-1, 0). */
const HAIR_D =
  "M180.14998,39.9204083 C177.390206,37.1003988 174.185913,34.7068297 171.069252,32.3065503 " +
  "C170.381566,31.777442 169.682843,31.2610833 169.010544,30.7118441 C168.857687,30.5870323 167.291999,29.4657388 167.104691,29.0530544 " +
  "C166.653816,28.0602634 166.915042,28.8332916 166.977255,27.6485857 C167.055857,26.150508 170.11064,21.9193194 167.831176,20.9490079 " +
  "C166.828413,20.522232 165.039628,21.6579526 164.077671,22.0330592 C162.196235,22.7671676 160.291721,23.3932399 158.346734,23.9330847 " +
  "C159.278588,22.0763407 161.055333,18.3594977 157.71591,19.3543018 C155.114345,20.1293431 152.690052,22.1219709 150.075777,23.0594018 " +
  "C150.940735,21.6415124 154.399901,17.2479341 151.274209,17.0023366 C150.301549,16.925839 147.471201,18.7503735 146.423952,19.1395717 " +
  "C143.287223,20.3054888 140.083264,21.0590571 136.789999,21.6525844 C125.59203,23.6707114 112.497238,23.0953019 102.1368,28.1934632 " +
  "C94.1494796,32.1236942 86.262502,38.2220278 81.648386,45.987539 C77.2011742,53.472559 75.537818,61.6641751 74.6069673,70.2412987 " +
  "C73.9239644,76.535909 73.8684412,83.0425652 74.1878671,89.3599905 C74.2922241,91.4297869 74.5250203,100.970847 77.5319724,98.0813859 " +
  "C79.0300967,96.641688 79.019059,90.8282073 79.3963495,88.8604076 C80.1472513,84.9452748 80.870057,81.0126951 82.122006,77.2227096 " +
  "C84.3282191,70.5439339 86.9307879,63.4296587 92.4269209,58.8297383 C95.9539853,55.8782066 98.4307906,51.8889248 101.806002,48.9112229 " +
  "C103.322188,47.5738572 102.165231,47.7130963 104.602902,47.888571 C106.240504,48.006337 107.885464,48.0512961 109.52641,48.0942421 " +
  "C113.322394,48.1928837 117.124399,48.16772 120.921387,48.1811407 C128.56821,48.208653 136.179243,48.316689 143.818708,47.9164188 " +
  "C147.213653,47.7385955 150.617965,47.6423024 154.00388,47.3282597 C155.895349,47.152785 159.251496,45.9405668 160.808488,46.8669256 " +
  "C162.233362,47.7144383 163.71309,50.4817719 164.736257,51.615144 C167.153525,54.2935659 170.035717,56.3392052 172.862385,58.5354911 " +
  "C178.756547,63.114945 181.732392,68.8666908 183.522515,76.023241 C185.305949,83.1532854 184.805905,89.76815 187.013456,96.78479 " +
  "C187.401784,98.0184813 188.428965,100.14498 189.695296,98.2389151 C189.930434,97.8849461 189.869559,95.9390277 189.869559,94.819339 " +
  "C189.869559,90.2995934 191.014141,86.9083772 190.999758,82.3591197 C190.943566,68.5271489 190.49637,50.4908308 180.14998,39.9204083 Z";

/** `Nose/Default`. Group-local; the caller translates by (104, 122). */
const NOSE_D = "M16,8 C16,12.418278 21.372583,16 28,16 L28,16 C34.627417,16 40,12.418278 40,8";

/**
 * The base, in the export's own `0 0 264 280` space, **split into the two things that
 * move independently**.
 *
 * The export is a single skin path running from skull to waist, and the rig needs the head
 * to tilt, sink and nod against shoulders that do not — so it draws this twice, `head`
 * inside the transform and `body` outside it, with the caller clipping them to either side
 * of the neck at y ≈ 187.
 *
 * The split is by *ownership*, not by geometry alone. The neck shadow goes with the
 * **head**: it is the shading that separates the jaw from the throat, it runs from y 115
 * to 194 so almost all of it is above the split anyway, and it has to travel with the
 * chin or the head detaches from its own shadow when it tilts. It must also be drawn in
 * exactly one half — drawn in both, its alpha doubles in the overlap band and leaves a
 * visible line across his throat.
 *
 * The skin path itself *is* drawn in both, which is free — it is opaque, so the overlap
 * is a no-op — and it is what lets the two clips overlap by a couple of units and absorb
 * the head's whole range of motion without ever opening a gap.
 *
 * `uid` disambiguates the clip paths, because two live instances must not share ids.
 */
export const CharacterBase: React.FC<{ uid: string; part: "head" | "body" }> = ({ uid, part }) => (
  <>
    <defs>
      {part === "head" ? (
        <clipPath id={`${uid}-skin`}>
          <path d={BODY_D} transform="translate(32, 36)" />
        </clipPath>
      ) : (
        <clipPath id={`${uid}-shirt`}>
          <path d={SHIRT_D} transform="translate(0, 170)" />
        </clipPath>
      )}
    </defs>

    {/* Skin: head, ears, neck and the shoulders the shirt covers. Drawn in both halves. */}
    <path d={BODY_D} transform="translate(32, 36)" fill={SKIN} />

    {part === "body" ? (
      <>
        {/*
         * Crew neck, plus the soft shadow the export puts across the chest.
         *
         * The stroke is not decoration — it closes a seam. The export's skin path and its
         * shirt path trace *almost* the same shoulder arc, the skin's running one to two
         * units outside the shirt's. Against the export's transparent background that
         * sliver is simply part of the silhouette and invisible; against the rig's
         * shoulder extension it becomes a skin-coloured hairline drawn across the whole
         * shoulder. Stroking the shirt in its own colour swallows it.
         */}
        <path d={SHIRT_D} transform="translate(0, 170)" fill={SHIRT} stroke={SHIRT} strokeWidth={3} />
        <g clipPath={`url(#${uid}-shirt)`} opacity={0.6}>
          <ellipse cx={132.5} cy={201.8476251} rx={39.6351047} ry={26.9138272} fill="#000000" fillOpacity={0.16} />
        </g>
      </>
    ) : (
      <>
        {/* The jaw's shadow on the throat. Travels with the head; see the header. */}
        <g clipPath={`url(#${uid}-skin)`}>
          <path d={NECK_SHADOW_D} transform="translate(32, 36)" fill="#000000" fillOpacity={0.1} />
        </g>

        {/* The nose, at the raised opacity. The rig owns everything else on the face. */}
        <path d={NOSE_D} transform="translate(104, 122)" fill="#000000" fillOpacity={NOSE_OPACITY} />

        {/* Hair last, so it sits over the forehead exactly as the export has it. */}
        <path d={HAIR_D} transform="translate(-1, 0)" fill={HAIR} />
      </>
    )}
  </>
);
