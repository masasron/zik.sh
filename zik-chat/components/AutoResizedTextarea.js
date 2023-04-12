import React, { useState, useRef, useEffect } from "react";

function AutoResizedTextarea(props) {
    const textareaRef = useRef(null);
    const [loading, setLoading] = useState(props.loading);
    const [value, setValue] = useState(props.defaultValue || "");

    useEffect(function () {
        setLoading(props.loading);
    }, [props.loading]);

    useEffect(function () {
        if (textareaRef.current) {
            textareaRef.current.focus();
            handleResize();
        }

        window.addEventListener("textarea-resize", handleResize);

        return function () {
            window.removeEventListener("textarea-resize", handleResize);
        }
    }, []);

    function handleResize() {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = "auto";
            textarea.style.height = textarea.scrollHeight + "px";
        }
    }

    function handleKeyDown(event) {
        if (event.keyCode === 13 && !event.shiftKey) {
            event.preventDefault();
            if (loading) {
                return;
            }
            props.onMessage(event.target.value);
            clear();
        }
    }

    function handleSubmit(event) {
        event.preventDefault();
        if (loading) {
            return;
        }
        props.onMessage(value);
        clear();
    }

    function clear() {
        setValue("");
    }

    return <>
        <textarea
            value={value}
            onChange={event => setValue(event.target.value)}
            ref={textareaRef}
            onInput={handleResize}
            onKeyDown={handleKeyDown}
            placeholder={props.placeholder || ""}
            autoComplete={props.autoComplete || ""}
        />
        <span className={`material-symbols-outlined ${value.trim().length > 0 ? "active" : ""} ${loading ? "loading" : ""}`} onClick={handleSubmit}>{!loading ? "send" : "sync"}</span>
    </>;
}

export default AutoResizedTextarea;