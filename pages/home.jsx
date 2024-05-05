import React from 'react';
import Home from '../components/home';
import Head from 'next/head';
import Navbar from '../components/navbar';
import Projects from '../components/projects';
import Landing from '../components/landing';

export default function Index() {
  return (
    <>
      <Head>
        <title>My Blog</title>
        <meta name="description" content="Welcome to My Blog where I share my thoughts and ideas." />
      </Head>
      <Navbar />
      <Landing id="home" />
      <div id="projects" className='h-screen'>
        <Home />
      </div>
      <div id="experience" className='h-screen'>
      </div>
    </>
  );
}