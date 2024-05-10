"use client"
import React, { useState } from 'react';
import Link from 'next/link';
import axios from 'axios';

const Blog = () => {
  const [posts, setPosts] = useState([]);

  const fetchPosts = async () => {
    const res = await axios.get('/api/posts');
    const postsData = await res.data;
    console.log(postsData);
    setPosts(postsData);
  };

  useState(() => {
    fetchPosts();
  }, []);

  return (
    <div>
      <h1>Blog Posts</h1>
      <ul>
        {posts.map(post => (
          <li key={post._id}>
            <Link href={`/posts/${post._id}`}>
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Blog;