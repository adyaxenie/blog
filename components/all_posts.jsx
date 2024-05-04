"use client"
import Link from 'next/link';
import axios from "axios";
import { use, useEffect } from 'react';

export default function Posts() {
  const grabPosts = async () => {
    try {
        const response = await axios.get("/api/posts/posts");
        console.log("Posts:", response.data);
    } catch (error) {
        console.error("Failed to create post:", error);
    }
  }

  useEffect(() => {
    grabPosts();
  }, []);

  return (
    <></>
  );
}