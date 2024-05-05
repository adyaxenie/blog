import React from 'react';
import { projectsData } from '../data/projects';

const Projects = () => {
    return (
        <div className="flex flex-col w-full p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projectsData.map((project, index) => (
                    <div key={index} className="card bg-base-100 shadow-xl">
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
        </div>
    );
};

export default Projects;