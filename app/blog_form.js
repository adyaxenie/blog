import React from 'react';

const Blog = (props) => {
    const { title, subtitle, body, image } = props;

    return (
        <div>
            <h1>{title}</h1>
            <h2>{subtitle}</h2>
            {image && <img src={image} alt="Blog Image" />}
            <p>{body}</p>
        </div>
    );
};

export default Blog;
