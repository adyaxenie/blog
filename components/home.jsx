import React from 'react';
import Projects from './projects';

const Home = () => {
    return (
        <div className="justify-center items-center py-20 p-10">
            <h1 className="divider text-6xl font-medium w-1/2 md:mx-auto">Projects</h1>
            <div className="mockup-window border bg-base-300 mt-20">
                <Projects />
            </div>
        </div>
    );
};

export default Home;