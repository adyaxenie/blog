"use client"
import React from 'react';
import 'daisyui/dist/full.css';
import { FaGithub } from "react-icons/fa";
import { FaLinkedin } from "react-icons/fa";

const Navbar = () => {
    const scrollToSection = (sectionSelect) => {
        const section = document.getElementById(sectionSelect);
        if (section) {
            section.scrollIntoView({ behavior: "smooth" });
        }
    }

    return (
        <div className="navbar bg-base-100 fixed top-0 left-0 right-0 z-50">
        <div className="navbar-start">
            <div className="dropdown">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
            </div>
            <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
                <li><a onClick={() => scrollToSection("landing")}>Home</a></li>
                <li><a onClick={() => scrollToSection("projects")}>Portfolio</a></li>
                <li><a onClick={() => scrollToSection("")}>About</a></li>
            </ul>
            </div>
        </div>
        <div className="navbar-center" onClick={() => scrollToSection("landing")}>
            <a className="btn btn-ghost text-xl" >Adrian Axenie</a>
        </div>
        <div className="navbar-end">
            {/* <button className="btn btn-ghost btn-circle">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button> */}
            <a href="https://www.linkedin.com/in/adrian-axenie/" className="btn btn-ghost btn-circle">
                <FaLinkedin />
            </a>
            <a href="https://github.com/adyaxenie" className="btn btn-ghost btn-circle">
                <FaGithub />
            </a>
        </div>
        </div>
    );
};

export default Navbar;