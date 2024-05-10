import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function Post({ post }) {
    const router = useRouter();
    const { id } = router.query;
    const [postData, setPostData] = useState(null);

    useEffect(() => {
        const fetchPostData = async () => {
            try {
                const response = await fetch(`/api/posts/${id}`);
                const data = await response.json();
                console.log(data);
                setPostData(data);
            } catch (error) {
                console.error('Error fetching post data:', error);
            }
        };

        fetchPostData();
    }, [id]);

    if (!postData) {
        return <div>Loading...</div>;
    }

    return (
        <div>
            <h1>Post {id}</h1>
            <h2>{postData.title}</h2>
            <p>{postData.content}</p>
            {/* Rest of your code */}
        </div>
    );
}