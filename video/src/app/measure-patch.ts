/**
 * ══ THE CAMERA'S ZOOM LEAKS INTO SELF-MEASURING COMPONENTS ══════════════════════════
 *
 * The camera frames the world by putting a CSS `scale` on an ancestor of everything. That is the
 * right way to build it — one transform, no re-layout, sub-pixel-smooth moves — but it has one
 * consequence that is invisible until a real component measures itself:
 *
 *   **`getBoundingClientRect()` returns SCREEN pixels, so it includes every ancestor transform.**
 *
 * `SessionTrend` measures its own container to size its plot (`session-trend.tsx:297`) and then
 * lays the polyline out in those units. Inside a 2.38× push-in it measured 718 × 2.38 ≈ 1706,
 * built a 1706-wide plot, and rendered it into a 718-wide box — so the gridlines ran out through
 * the card's right edge and **the descending tail of beat 11's trend was pushed off the plot
 * entirely.** The symptom looked like the descent had not been wired up; the descent was fine
 * and the graph was three times too wide.
 *
 * Every consumer of `getBoundingClientRect` in this bundle wants LAYOUT pixels, not screen
 * pixels — `SessionTrend`'s width, `OtpBoxes.meltTogether`'s box offsets
 * (`otp-boxes.tsx:143`), and the measurement harness. So the fix is applied once, here, rather
 * than worked around per component: divide the camera's current zoom back out.
 *
 * ── WHY THERE IS NO CSS FIX ─────────────────────────────────────────────────────────
 *
 * Worth recording, because it looks like there should be. Let the ancestor scale be `Z`, and try
 * to compensate with a wrapper of CSS width `w` and its own `scale(k)`:
 *
 *   for the component to MEASURE 720:   w · Z · k = 720
 *   for it to RENDER at 720 world px:   w · k     = 720
 *
 * Dividing gives `Z = 1`. The two requirements are the same equation whenever the camera is
 * doing anything at all, so no arrangement of wrappers, widths or counter-scales can satisfy
 * both. Measuring in screen space and drawing in world space are the same degree of freedom.
 *
 * ── AND THE CAMERA WAS NOT THE ONLY SCALE IN THE CHAIN ──────────────────────────────
 *
 * **The trend's plot was 42% of its card, and it is this same bug one level deeper.** The film
 * draws `<SessionTrend/>` at a natural width and scales the wrapper down (`geometry.ts` § TREND),
 * so the chain above a self-measuring component is `CAMERA.zoom × TREND_SCALE`, not
 * `CAMERA.zoom`. Dividing out only the camera left the second factor in: the component measured
 *
 *     720 (layout content width) × 0.4167 = 300
 *
 * and drew a 300-wide SVG inside a 720-wide box. Two consequences, both confirmed on the render
 * rather than reasoned about: at 300 the gutters collapse to their MIN values (84 / 24) so
 * `plotWidth` is 192 instead of 520, and `capByLegibility = floor(192/24)+1 = 9` silently drops
 * a window. The predicted gridline edge was 594px into the crop and the measured one was 595.
 *
 * It cannot be fixed by publishing a second module-level number the way `CAMERA.zoom` is,
 * because a scale wrapper is a property of a SUBTREE — two of them could be on screen at once,
 * and a component outside one must not have it divided out. So the wrapper DECLARES itself with
 * `data-measure-scale` and the patch walks up from the element being measured. A `.closest()`
 * per call is cheap, and it is only ever reached inside a camera (the early return below).
 *
 * ── SCOPE ───────────────────────────────────────────────────────────────────────────
 *
 * Patching a DOM primitive is a big hammer, so it is kept as small as it can be: it is a single
 * multiplication, it is a no-op at zoom 1 (so the probe and the Studio's own chrome are
 * untouched), and `apps/web` is not modified — which is the constraint this whole pass runs
 * under. `x`/`y` are divided too so that offset arithmetic stays self-consistent: `meltTogether`
 * takes differences between rects and writes the result back as a CSS `translateX`, which is a
 * layout-space value, so the difference has to be in layout space as well.
 */

/** Set by `Camera` every render. 1 means "no camera", which is the identity case. */
export const CAMERA = { zoom: 1 };

/**
 * The attribute a scaled subtree declares itself with. Put it on the SAME element that carries
 * the `scale`, with the scale factor as its value.
 */
export const MEASURE_SCALE_ATTR = "data-measure-scale";

let patched = false;

export function patchMeasurementForCamera(): void {
  if (patched || typeof Element === "undefined") return;
  patched = true;

  const original = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function patchedRect(this: Element): DOMRect {
    const r = original.call(this);
    let z = CAMERA.zoom || 1;
    // Any scale wrapper between this element and the camera is part of the chain too — see the
    // note above. `closest` includes the element itself, which is deliberate: the wrapper that
    // carries the scale is also the element whose own box a caller might measure. The walk runs
    // at zoom 1 as well, so that **the probe measures what the film draws** — a probe that
    // measured an unscaled trend while the beats rendered a scaled one is precisely the class of
    // divergence `SwapProbe.tsx` exists to prevent, and it costs one ancestor walk beside a call
    // that already flushes layout.
    const scoped = this.closest?.(`[${MEASURE_SCALE_ATTR}]`);
    if (scoped) {
      const extra = Number(scoped.getAttribute(MEASURE_SCALE_ATTR));
      if (Number.isFinite(extra) && extra > 0) z *= extra;
    }
    if (z === 1) return r;
    const x = r.x / z;
    const y = r.y / z;
    const w = r.width / z;
    const h = r.height / z;
    // A plain object would break `DOMRect` consumers that read `toJSON` or the aliases, so a
    // real one is constructed.
    return new DOMRect(x, y, w, h);
  };
}
