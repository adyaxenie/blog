"use client"
import React, {useEffect} from 'react';
import Image from 'next/image';

const LiveProjects = () => {
    const handleClick = () => {
        window.open('https://supbot.io', '_blank');
    };

    return (
        <div data-aos="zoom-y-in" className="justify-center items-center">
            <div className='mx-auto w-full md:w-1/3 card px-5 relative group'>
                <div className='mb-2 items-center flex text-red-500'>
                    <p>Live Project</p>
                    <span className="loading loading-ring loading-sm ml-2"></span>
                </div>
                <div className='cursor-pointer' onClick={handleClick} >
                    <Image 
                        className="rounded-lg cursor-pointer bg-red-500 blur-none group-hover:blur-sm" 
                        src="/landingpage3.PNG" 
                        alt="SupBot" 
                        width={600} 
                        height={300}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-black text-xl font-bold underline transition">Go to SupBot AI</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveProjects;