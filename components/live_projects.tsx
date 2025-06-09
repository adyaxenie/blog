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
    <div data-aos="zoom-y-in" className="flex justify-center items-center">
        <div className="w-full max-w-5xl px-5">
            <div className="mb-4 items-center flex text-red-500">
                <p>Live Projects</p>
                <span className="loading loading-ring loading-sm ml-2"></span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-br from-red-500 to-purple-500 opacity-0 group-hover:opacity-50 rounded-lg blur-lg transition-opacity duration-300"></div>
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
                                <p className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-purple-500 text-xl font-bold underline transition">Go to PDF Dino</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-br from-red-500 to-purple-500 opacity-0 group-hover:opacity-50 rounded-lg blur-lg transition-opacity duration-300"></div>
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
                                <p className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-purple-500 text-xl font-bold underline transition">Go to SupBot AI</p>
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