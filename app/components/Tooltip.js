const Tooltip = ({ text, children, position = 'bottom' }) => {
    const tooltipClassNames = `tooltip tooltip-${position}`;

    return (
        <span className="tooltip-wrapper">
            {children}
            <span className={tooltipClassNames}>{text}</span>
        </span>
    );
};

export default Tooltip;