"use client"
import React from "react";

const Landing = () => {
    const scrollToPortfolio = () => {
        const portfolioSection = document.getElementById("projects");
        if (portfolioSection) {
            portfolioSection.scrollIntoView({ behavior: "smooth" });
        }
    };

    const scrollToSection = (sectionSelect) => {
        const section = document.getElementById(sectionSelect);
        if (section) {
            section.scrollIntoView({ behavior: "smooth" });
        }
    }

    return (
        <div className="hero min-h-screen" id="landing">
            <div className="hero-content text-center">
                <div className="max-w-md">
                    <div className="items-center">
                        <h1 className="text-5xl font-bold">Hi there,</h1>
                        <h1 className="text-5xl font-bold">I'm Adrian.</h1>
                    </div>
                    <p className="pt-6">I like to build things.</p>
                    <p className="pb-6">Current Software Developer and Product Manager</p>
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