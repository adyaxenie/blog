"use client"
import React, {useEffect} from 'react';
import Image from 'next/image';

const LiveProjects = () => {
    const handleBotClick = () => {
        window.open('https://supbot.io', '_blank');
    };

    const handleDinoClick = () => {
        window.open('https://pdfdino.com', '_blank');
    };

    return (
    <div data-aos="zoom-y-in" className="flex justify-center items-center" id='projects'>
        <div className="w-full max-w-5xl px-5">
            <div className="mb-6 items-center flex text-white">
                <p>Live Projects</p>
                <span className="loading loading-ring loading-sm ml-2"></span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative group">
                    <div className="absolute -inset-1 bg-white opacity-0 group-hover:opacity-50 rounded-lg blur-lg transition-opacity duration-300"></div>
                    <div className="bg-white p-4 card cursor-pointer relative rounded-lg">
                        <div className="relative cursor-pointer" onClick={handleDinoClick}>
                            <div className="w-full h-0 pb-[50%] bg-white overflow-hidden relative">
                                <Image 
                                    className="absolute top-0 left-0 w-full h-full object-contain group-hover:blur-sm" 
                                    src="/pdfdino.PNG" 
                                    alt="PDF Dino"
                                    layout="fill"
                                />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-black text-xl font-bold transition relative z-10">
                                    Go to PDF Dino
                                    <span className="absolute inset-0 rounded blur-md bg-white opacity-80 -z-10"></span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="relative group">
                    <div className="absolute -inset-1 bg-white opacity-0 group-hover:opacity-50 rounded-lg blur-lg transition-opacity duration-300"></div>
                    <div className="bg-white p-4 card cursor-pointer relative rounded-lg">
                        <div className="relative cursor-pointer" onClick={handleBotClick}>
                            <div className="w-full h-0 pb-[50%] bg-white overflow-hidden relative">
                                <Image 
                                    className="absolute top-0 left-0 w-full h-full object-contain group-hover:blur-sm" 
                                    src="/landingpage3.PNG" 
                                    alt="SupBot"
                                    layout="fill"
                                />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-black text-xl font-bold transition relative z-10">
                                    Go to SupBot AI
                                    <span className="absolute inset-0 rounded blur-md bg-white opacity-80 -z-10"></span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    );
};

export default LiveProjects;