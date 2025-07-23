import React from 'react';

const Timeline = () => {
    return (
        <div data-aos="fade-up" className="justify-center items-center p-10">
            <h1 className="divider text-6xl font-medium w-1/3 md:mx-auto py-10">Experience</h1>
            
            <ul className="timeline timeline-snap-icon max-md:timeline-compact timeline-vertical p-5">
            <li>
                    <hr />
                    <div className="timeline-middle">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                    </div>
                    <div className="timeline-end mb-10">
                        <time className="font-mono italic">May 2023 - Present</time>
                        <div className="text-lg font-black">Product Manager at Voter.Vote</div>
                        <ul>
                            <li>Lead product development for political outreach platform that handles millions of voters across hundreds of campaigns.</li>
                            <li>Backend architecture to frontend design and deployment (React, Django, Heroku, AWS).</li>
                            <li>Integrate third-party software solutions to enhance user capabilities and streamline campaign workflows.</li>
                        </ul>
                    </div>
                    <hr />
                </li>
                <li>
                    <hr />
                    <div className="timeline-middle">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                    </div>
                    <div className="timeline-start md:text-end mb-10">
                        <time className="font-mono italic">August 2019 - May 2023</time>
                        <div className="text-lg font-black">San Jose State University</div>
                        <div className="subheading mb-3">Bachelor of Business Administration</div>
                        <p>Concentration in Entrepreneurship</p>
                        <p>Dean&apos;s Scholar (2022), Member of Ideas Entrepreneurial Club</p>
                    </div>
                    <hr />
                </li>
                {/* <li>
                    <hr />
                    <div className="timeline-middle">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>
                    </div>
                    <div className="timeline-end mb-10">
                        <time className="font-mono italic">August 2015 - May 2019</time>
                        <div className="text-lg font-black">Leigh High School</div>
                        <div className="subheading mb-3">Project Lead The Way Engineering</div>
                        <p>4 Year Scholar in Engineering - Capstone Projects</p>
                        <p>Learned basics of mechanical, computer and electrical engineering through PLTW program.</p>
                    </div>
                    <hr />
                </li> */}
            </ul>
        </div>
)}

export default Timeline;