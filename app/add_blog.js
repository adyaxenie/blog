import React, { useState } from 'react';
import axios from 'axios';

const AddBlog = () => {
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [content, setContent] = useState('');
    const [image, setImage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            // Send a POST request to your backend API to save the blog to the database
            await axios.post('/api/blogs', { title, subtitle, content, image });

            // Clear the form after successful submission
            setTitle('');
            setSubtitle('');
            setContent('');
            setImage('');

            // Display a success message to the user
            alert('Blog added successfully!');
        } catch (error) {
            // Handle any errors that occur during the submission
            console.error('Error adding blog:', error);
            alert('An error occurred while adding the blog. Please try again.');
        }
    };

    return (
        <div>
            <h2>Add Blog</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="title">Title:</label>
                    <input
                        type="text"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                </div>
                <div>
                    <label htmlFor="subtitle">Subtitle:</label>
                    <input
                        type="text"
                        id="subtitle"
                        value={subtitle}
                        onChange={(e) => setSubtitle(e.target.value)}
                    />
                </div>
                <div>
                    <label htmlFor="content">Content:</label>
                    <textarea
                        id="content"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    ></textarea>
                </div>
                <div>
                    <label htmlFor="image">Image:</label>
                    <input
                        type="text"
                        id="image"
                        value={image}
                        onChange={(e) => setImage(e.target.value)}
                    />
                </div>
                <button type="submit">Add Blog</button>
            </form>
        </div>
    );
};

export default AddBlog;