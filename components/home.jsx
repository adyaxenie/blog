import React from 'react';
import Posts from './all_posts';
import Projects from './projects';

const Home = () => {
    return (
        <div className="justify-center items-center py-20 p-10">
            <h1 className="divider text-6xl font-medium">Projects</h1>
            <Projects />
        </div>
    );
};

export default Home;