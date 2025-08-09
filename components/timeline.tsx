import React from 'react';

const Timeline = () => {
  return (
    <div data-aos="fade-up" className="justify-center items-center p-10">
      <ul className="timeline timeline-snap-icon max-md:timeline-compact timeline-vertical p-5">
        
        {/* Voter.Vote */}
        <li>
          <hr />
          <div className="timeline-middle">
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20" className="h-5 w-5">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="timeline-start md:text-end mb-10">
            <time className="font-mono italic">May 2023 - Present</time>
            <div className="text-lg font-black">Product Manager – Voter.Vote</div>
            <ul>
              <li>Lead product development for political outreach platform handling millions of voters.</li>
              <li>Full-stack from backend architecture to frontend design (React, Django, AWS, Heroku).</li>
              <li>Integrated third-party tools to streamline campaign workflows.</li>
            </ul>
          </div>
          <hr />
        </li>

        {/* San Jose State University */}
        <li>
          <hr />
          <div className="timeline-middle">
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 20" className="h-5 w-5">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="timeline-end mb-10">
            <time className="font-mono italic">Aug 2019 - May 2023</time>
            <div className="text-lg font-black">San Jose State University</div>
            <div className="subheading mb-3">BBA – Entrepreneurship</div>
            <p>Dean&apos;s Scholar (2022), Ideas Entrepreneurial Club</p>
          </div>
          <hr />
        </li>

      </ul>
    </div>
  );
};

export default Timeline;
