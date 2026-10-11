import { ApprovalSection } from "../components/approval-section";
import { EarlyAccess } from "../components/early-access";
import { FeatureGrid } from "../components/feature-grid";
import { Footer } from "../components/footer";
import { Header } from "../components/header";
import { Hero } from "../components/hero";
import { HowItWorks } from "../components/how-it-works";

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <FeatureGrid />
        <ApprovalSection />
        <EarlyAccess />
      </main>
      <Footer />
    </>
  );
}
