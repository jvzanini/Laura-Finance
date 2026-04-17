import { CTAFinal } from "./CTAFinal";
import { FAQ } from "./FAQ";
import { FeatureGrid } from "./FeatureGrid";
import { Hero } from "./Hero";
import { HowItWorks } from "./HowItWorks";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingNavbar } from "./MarketingNavbar";
import { PricingCards } from "./PricingCards";
import { Testimonials } from "./Testimonials";
import { TrustBar } from "./TrustBar";

export function LandingPage() {
    return (
        <div className="relative min-h-screen overflow-x-clip bg-[#0A0A0F] text-white">
            <MarketingNavbar />
            <main>
                <Hero />
                <TrustBar />
                <FeatureGrid />
                <HowItWorks />
                <PricingCards />
                <Testimonials />
                <FAQ />
                <CTAFinal />
            </main>
            <MarketingFooter />
        </div>
    );
}
