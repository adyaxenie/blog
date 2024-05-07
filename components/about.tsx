import React from 'react';
import { FaPython, FaAws, FaReact, FaHtml5, FaBootstrap } from 'react-icons/fa';
import { RiTailwindCssFill } from 'react-icons/ri';
import { SiDjango, SiScikitlearn, SiMysql } from 'react-icons/si';
import { GrHeroku } from 'react-icons/gr';

const About = () => {
    return (
        <div className="justify-center items-center p-10">
            <h1 className="divider text-6xl font-medium w-1/3 md:mx-auto py-20">About</h1>  
            <div className="sm:flex justify-center gap-10">
                <div className="card bg-base-100 shadow-xl w-full md:w-1/3 mx-2 p-5">
                    <div className="card-body">
                        <h2 className="card-title">About Me</h2>
                        <p>Hi there! I&apos;m Adrian, a Software Developer and Product Manager. I like to build things and I&apos;m currently working on a few projects.</p>
                        <p>Some of the technologies I&apos;ve recently been working with include React, Node.js, and MongoDB.</p>
                        <p>Some interests of mine are going skiing during the winter and mountain biking in the summer.</p>
                        <p>Feel free to reach out to me at <strong>adyaxenie@gmail.com</strong></p>   
                    </div>
                </div>
                <div className="card bg-base-100 shadow-xl w-full md:w-1/3 mx-2 p-5">
                    <div className="card-body">
                        <h2 className="card-title">Skills</h2>
                        <div className="grid grid-cols-3 gap-4 py-4">
                            <FaPython className="h-10 w-10" />
                            <FaAws className="h-10 w-10" />
                            <FaReact className="h-10 w-10" />
                            <FaHtml5 className="h-10 w-10" />
                            <RiTailwindCssFill className="h-10 w-10" />
                            <FaBootstrap className="h-10 w-10" />
                            <SiDjango className="h-10 w-10" />
                            <GrHeroku className="h-10 w-10" />
                            <SiScikitlearn className="h-10 w-10" />
                            <SiMysql className="h-10 w-10" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default About;