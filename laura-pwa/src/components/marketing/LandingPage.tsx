import { CTAFinal } from "./CTAFinal";
import { FAQ } from "./FAQ";
import { Hero } from "./Hero";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingNavbar } from "./MarketingNavbar";
import { PilarAssistente } from "./PilarAssistente";
import { PilarFamilia } from "./PilarFamilia";
import { PilarViagens } from "./PilarViagens";
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
                <PilarAssistente />
                <PilarFamilia />
                <PilarViagens />
                <PricingCards />
                <Testimonials />
                <FAQ />
                <CTAFinal />
            </main>
            <MarketingFooter />
        </div>
    );
}
