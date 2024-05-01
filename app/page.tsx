import Image from "next/image";
import "daisyui/dist/full.css";

export default function Home() {
  return (
    <details className="dropdown">
      <summary className="m-1 btn">open or close</summary>
      <ul className="p-2 shadow menu dropdown-content z-[1] bg-base-100 w-52">
        <li><a>Item 1</a></li>
        <li><a>Item 2</a></li>
      </ul>
    </details>
  );
}
