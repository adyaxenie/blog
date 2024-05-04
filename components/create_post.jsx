"use client"

import axios from "axios";

export default function CreatePost() {
    const handleClick = async () => {
        const postData = {
            title: "New Insights in React Development",
            content: "Discover the latest trends and techniques in building efficient React applications.",
            author: { name: "Chris Adams", userId: "1" },
            tags: ["React", "Web Development"],
            published: true,
            comments: []
        };

        try {
            const response = await axios.post("/api/posts/create", postData);
            console.log("Post created:", response.data);
        } catch (error) {
            console.error("Failed to create post:", error);
        }
    }

    return (
        <button onClick={handleClick}>Create Post</button>
    );
}