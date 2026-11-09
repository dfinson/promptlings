# Motionite provenance and production inputs

Source: https://github.com/nxrskyaa/motionite

Revision: `7b7d4dbdc0a725b362317683711d77195336b34a`.

The included upstream files are unchanged. `UPSTREAM.json` lists their original
paths and SHA-256 checksums. `LICENSE` contains the MIT software/documentation
grant, font notice and separate image/Remotion terms. Every bundled font has its
upstream SIL OFL notice in `examples/public/fonts/licenses`.

Preview PNGs under upstream `assets` and `examples/stills`, and NxrLabs product
images under `examples/public/img`, are deliberately omitted. Their copyright
notice does not grant redistribution permission. The preserved upstream docs
still contain links to those previews. They are not local resources in this
distribution. Use the style descriptions and source, or separately authorized
previews, when choosing a style. Do not download those images automatically.

NxrStyle 12's source expects `img/nxr-console.png` and `img/nxr-cart-1.png`
through `img/nxr-cart-7.png`. Supply your own rights-cleared assets in the
production project and adapt the component to them before using that example.
Other styles draw their example art in code. Use actual product assets for a
real subject, as the upstream workflow requires.

The example package pins Remotion, React and TypeScript in its package manifest
and lockfile. They are not installed or licensed by this vendored copy.
Remotion's runtime terms are separate from the MIT grant on this skill. Verify
those terms for your intended use before installing production dependencies.
Copy the needed example source and fonts with their notices into a separate
production workspace. Never install dependencies or render into this skill.

The upstream still-render helper is preserved at `scripts/render-stills.sh`.
Its relative `examples` path is intact. It requires Bash, Node.js and the
example project's dependencies. Native Windows commands can render selected
stills directly using the upstream `npx remotion still` invocation.

Technical Demo's entry agent owns the integration policy: approved specialist
audio and real capture, one combined final review, and further revision only for
specific defects or user feedback. It supersedes the upstream fixed three-round
critique count without editing the upstream source or duplicating its workflow.
