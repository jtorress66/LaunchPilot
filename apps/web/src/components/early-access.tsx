import Link from "next/link";

export function EarlyAccess() {
  return (
    <section id="early-access" className="scroll-mt-20 px-4 pb-24 sm:px-6">
      <div className="mx-auto max-w-4xl rounded-3xl bg-brand-600 px-6 py-14 text-center text-white shadow-xl sm:px-12">
        <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Spend your week building. Let LaunchPilot market it.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-brand-100">
          We&apos;re onboarding a small group of SaaS founders. Tell us about your product and
          we&apos;ll reach out when your seat is ready.
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-block rounded-lg bg-white px-6 py-3 font-semibold text-brand-700 shadow-sm hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Create your free account
        </Link>
      </div>
    </section>
  );
}
