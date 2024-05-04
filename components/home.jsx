import React from 'react';
import CreatePost from './create_post';
import Posts from './all_posts';

const Home = () => {
    return (
        <div className="flex justify-center items-center">
            <h1 className="text-6xl">Welcome to the Blog Homepage</h1>
            <hr></hr>
            <Posts/>
        </div>
    );
};

export default Home;