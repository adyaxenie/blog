import React from 'react';
import { projectsData } from '../data/projects';

const Projects = () => {
    return (
        <div className="flex flex-col w-full md:px-10 py-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projectsData.map((project, index) => (
                    <div data-aos="fade-up" key={index} className="card bg-base-100 shadow-xl">
                        <div className="card-body">
                            <h2 className="card-title">{project.name}</h2>
                            <p><strong>Tech Stack:</strong> {project.techStack}</p>
                            <p><strong>Description:</strong> {project.description}</p>
                            <p><strong>Challenges:</strong> {project.challenges}</p>
                            <p><strong>Future Ideas:</strong> {project.futureIdeas}</p>
                        </div>
                    </div>
                ))}
            </div>
            <div data-aos="fade-up" id="mention" className="card bg-base-100 shadow-xl w-full md:w-1/3 mx-auto mt-10">
                <div className="card-body">
                    <h2 className="card-title">Honorable Mentions: The 20+ Unfinished Projects</h2>
                </div>
            </div>
        </div>
    );
};

export default Projects;