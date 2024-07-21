"use client"
import React, {useEffect} from "react";
import AOS from "aos";
import "aos/dist/aos.css";

const Landing = () => {
    const scrollToPortfolio = () => {
        const portfolioSection = document.getElementById("projects");
        if (portfolioSection) {
            portfolioSection.scrollIntoView({ behavior: "smooth" });
        }
    };

    const scrollToSection = (sectionSelect: string) => {
        const section = document.getElementById(sectionSelect);
        if (section) {
            section.scrollIntoView({ behavior: "smooth" });
        }
    };    

    useEffect(() => {
        AOS.init({
        once: true,
        disable: "phone",
        duration: 700,
        easing: "ease-out-cubic",
        });
      }, []);

    return (
        <div className="hero min-h-full py-32" id="landing">
            <div data-aos="fade-left-in" className="hero-content text-center">
                <div className="max-w-md">
                    <div className="items-center">
                        <h1 className="text-5xl font-bold">Hi there,</h1>
                        <h1 className="text-5xl font-bold">I&apos;m Adrian.</h1>
                    </div>
                    <p className="pt-6">I like to build things.</p>
                    <p className="pb-6">Software Developer and Product Manager</p>
                    <button className="btn btn-primary" onClick={scrollToPortfolio}>View Portfolio</button>
                    <div className="flex items-center mt-20 space-x-10">
                        <a className="link" onClick={() => scrollToSection("projects")}>Projects</a>
                        <a className="link" onClick={() => scrollToSection("timeline")}>Experience</a>
                        <a className="link" onClick={() => scrollToSection("about")}>Skills</a>
                        <a className="link" onClick={() => scrollToSection("about")}>About</a>
                    </div>
                </div>
            </div>

        </div>

    );
};

export default Landing;