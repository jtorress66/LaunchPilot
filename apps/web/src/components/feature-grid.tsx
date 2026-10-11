import { features } from "../content/landing";
import { FeatureIcon } from "./feature-icon";
import { SectionHeading } from "./section-heading";

export function FeatureGrid() {
  return (
    <section id="features" className="scroll-mt-20 bg-slate-50 py-20 dark:bg-slate-900/40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Features"
          title="Four channels, one coordinated plan"
          lead="Specialised agents for each channel share one Product Brief, so your message stays consistent everywhere."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
            >
              <FeatureIcon name={feature.icon} />
              <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-slate-600 dark:text-slate-400">{feature.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
