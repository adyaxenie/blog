import React from "react";

const Landing = () => {
    return (
        <div className="hero min-h-screen">
        <div className="hero-content text-center">
            <div className="max-w-md">
            <div className="items-center">
                {/* <img className="mask mask-triangle-4" src="https://media.licdn.com/dms/image/C5603AQGppshaSro93Q/profile-displayphoto-shrink_200_200/0/1642718343858?e=1720656000&v=beta&t=BOjpdRB3cD1yw1XsJdzBM5CWw6cSSUULKMgNXg8EPpE" /> */}
                {/* <div>            */}
                    <h1 className="text-5xl font-bold">Hi there,{''}</h1>
                    <h1 className="text-5xl font-bold">im Adrian.</h1>
                {/* </div> */}
            </div>
            <p className="pt-6">I like to build things.</p>
            <p className="pb-6">Current Software Developer and Product Manager</p>
            <button className="btn btn-primary">View Portfolio</button>
            </div>
        </div>
        </div>
    );
}

export default Landing;