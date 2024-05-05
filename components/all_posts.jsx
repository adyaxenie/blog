"use client"
import Link from 'next/link';
import axios from "axios";
import { useState, useEffect } from 'react';

export default function Posts() {
  const [blogs, setBlogs] = useState([]);

  const grabPosts = async () => {
    try {
        const response = await axios.get("/api/posts/posts");
        console.log("Posts:", response.data);
        setBlogs(response.data);
    } catch (error) {
        console.error("Failed to create post:", error);
    }
  }

  useEffect(() => {
    grabPosts();
  }, []);

  return (
    <div className="grid">
    </div>
  );
}