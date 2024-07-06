import React from 'react';
import Home from '../components/home';
import Head from 'next/head';
import Navbar from '../components/navbar';
import Landing from '../components/landing';
import Footer from '../components/footer';
import About from '../components/about';
import Timeline from '../components/timeline';
import LiveProjects from '@/components/live_projects';

export default function Index() {
  return (
    <>
      <Head>
        <title>My Blog</title>
        <meta name="description" content="Welcome to My Blog where I share my thoughts and ideas." />
      </Head>
      <Navbar />
      <Landing id="home" />
      <LiveProjects />
      <div id="projects" className='h-full'>
        <Home />
      </div>
      <div id="timeline" className='h-screen'>
        <Timeline />
      </div>
      <div id="about" className='h-full'>
        <About />
      </div>
      <Footer />
    </>
  );
}