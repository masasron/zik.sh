import highlight from "highlight.js";
import { useEffect, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import dark from "react-syntax-highlighter/dist/cjs/styles/prism/vs-dark";

dark[`pre[class*="language-"]`].margin = '0px';
dark[`pre[class*="language-"]`].borderRadius = '0px';
dark[`:not(pre) > code[class*="language-"]`].borderRadius = '0px';
dark[`pre[class*="language-"]`].background = '#000';

export default function CodeBlock(props) {
    const [code] = useState(props.code);
    const [copied, setCopied] = useState(null);
    const [language, setLanguage] = useState(props.language);

    if (!props.language) {
        useEffect(function () {
            const result = highlight.highlightAuto(code);
            setLanguage(result ? result.language : "text");
        }, [code]);
    }

    useEffect(function () {
        setCopied(false);
    }, []);

    function handleCopy() {
        if (window.navigator.clipboard) {
            window.navigator.clipboard.writeText(code);
        } else {
            copyText(code);
        }

        setCopied(true);
        setTimeout(function () {
            setCopied(false);
        }, 2000);
    }

    function copyText(text) {
        const el = document.createElement('textarea');
        el.value = text;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        const selected = document.getSelection().rangeCount > 0 ? document.getSelection().getRangeAt(0) : false;
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        if (selected) {
            document.getSelection().removeAllRanges();
            document.getSelection().addRange(selected);
        }
    }

    return <div className="codeblock">
        <header>
            <div className="title">{props.title || language || ""}</div>
            <div style={{ flex: 1 }} />
            <button onClick={handleCopy}>
                {copied !== null && <>
                    {!copied && <span className="material-symbols-outlined">
                        content_paste
                    </span>}
                    {copied && <span className="material-symbols-outlined">
                        check
                    </span>}
                </>}
            </button>
        </header>
        <SyntaxHighlighter
            style={dark}
            PreTag="div"
            children={code}
            language={language}
            {...props}
        />
    </div>
}