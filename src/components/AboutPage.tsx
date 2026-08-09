function PanelHeader({ title }: { title: string }) {
  return (
    <div
      className="flex h-6 items-center px-1.5"
      style={{ background: "linear-gradient(to right, #000080, #1084D0)" }}
    >
      <h2 className="text-2xs font-bold text-white">{title}</h2>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 font-heading text-2xs uppercase tracking-wide text-win-navy">
      {children}
    </h3>
  );
}

export function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-[720px] flex-1 p-3">
      <section aria-label="About PitchModel" className="bevel-out bg-win-face">
        <PanelHeader title="ABOUT.TXT — README" />

        <div className="flex flex-col gap-4 bg-win-paper p-4 text-sm leading-relaxed text-win-black">
          <div>
            <SectionHeading>What is this?</SectionHeading>
            <p>
              PitchModel guesses what pitch a pitcher is about to throw next,
              before they throw it. You give it the pitcher, the batter, and
              the current game situation (the count, the outs, who&apos;s on
              base), and it tells you the pitch it thinks is most likely to
              come next — plus how confident it is.
            </p>
          </div>

          <div>
            <SectionHeading>Where the data comes from</SectionHeading>
            <p>
              Every pitch thrown in a Major League Baseball game gets tracked
              automatically by MLB&apos;s own cameras and sensors (this system
              is called &quot;Statcast&quot;). For every single pitch, MLB
              records things like: who threw it, who it was thrown to, what
              type of pitch it was, and the exact game situation it happened
              in — the count, the inning, the outs, the runners on base, and
              more.
            </p>
            <p className="mt-2">
              PitchModel is built on top of millions of these real, historical
              pitches. It&apos;s not making anything up — every prediction is
              based on what pitchers have actually thrown in real games,
              in similar situations, in the past.
            </p>
          </div>

          <div>
            <SectionHeading>How it makes a prediction</SectionHeading>
            <p>
              PitchModel doesn&apos;t use any secret formula or gut feeling.
              Instead, it does something pretty simple:
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>
                It looks at the current situation — this pitcher, this
                batter, this count, these runners, etc.
              </li>
              <li>
                It searches through its huge pile of historical pitches for
                the ones that look the most similar to right now.
              </li>
              <li>
                It checks what pitch actually got thrown in each of those
                similar past situations.
              </li>
              <li>
                Whichever pitch shows up the most often in those matches is
                the one it predicts — and how often it shows up becomes the
                confidence percentage.
              </li>
            </ol>
          </div>

          <div>
            <SectionHeading>The method: &quot;KNN&quot;</SectionHeading>
            <p>
              The technique behind step 2 and 3 above has a name: <strong>
              K-Nearest Neighbors</strong>, or <strong>KNN</strong> for short.
              It sounds technical, but the idea is very simple. Break the name
              into pieces:
            </p>
            <ul className="mt-2 space-y-2 pl-5">
              <li>
                <strong>&quot;Neighbors&quot;</strong> — past pitches from
                real games that happened in a situation similar to the one
                happening right now.
              </li>
              <li>
                <strong>&quot;Nearest&quot;</strong> — not identical, just the
                closest match. A 2-1 count with a runner on first is a
                &quot;near neighbor&quot; of a 2-1 count with a runner on
                second, even though they&apos;re not exactly the same.
              </li>
              <li>
                <strong>&quot;K&quot;</strong> — just a number: how many of
                those close matches to look at. PitchModel looks at a set
                number of the closest matches it can find (its &quot;K&quot;)
                rather than just one.
              </li>
            </ul>

            <div className="mt-3 bevel-in bg-win-black p-3">
              <p className="font-mono-retro text-2xs leading-relaxed text-win-green">
                EXAMPLE — 0-BALL, 2-STRIKE COUNT, RUNNER ON 2ND:
                <br />
                PitchModel finds the 50 most similar historical pitches
                to this exact situation.
                <br />
                <br />
                → 41 of those 50 were sliders
                <br />
                → 6 were fastballs
                <br />
                → 3 were changeups
                <br />
                <br />
                PREDICTION: SLIDER (82% CONFIDENCE)
              </p>
            </div>

            <p className="mt-3">
              That&apos;s really it. No black box, no magic — just: &quot;find
              the most similar situations that have actually happened before,
              and see what was thrown.&quot; The more of those similar
              &quot;neighbors&quot; agree with each other, the higher the
              confidence percentage you&apos;ll see.
            </p>
          </div>

          <div>
            <SectionHeading>One extra wrinkle</SectionHeading>
            <p>
              While a session is active, PitchModel also pays a little extra
              attention to pitches it has personally watched this pitcher
              throw earlier in the same session — on top of the historical
              data — since that&apos;s the freshest evidence of what he&apos;s
              doing today.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
