import { v4 } from "uuid";
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Home() {
    const router = useRouter();

    useEffect(function () {
        router.push(`/chat/${v4()}`);
    }, []);
}