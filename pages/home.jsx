import React from 'react';
import Navbar from '../components/navbar';
import Home from '../components/home';
import Head from 'next/head';

export default function Index() {
    return (
        <>
            <Head>
                <title>My Blog</title>
                <meta name="description" content="Welcome to My Blog where I share my thoughts and ideas." />
            </Head>
            <Navbar />
            <Home />
        </>
    );
}