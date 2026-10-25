const CenterCell = ({ children, className, nowrap = false, value }) => {
    return (
        <div className={`center-content ${nowrap ? "nowrap-content" : ""}${className ? ` ${className}` : ""}`}>
            {children || value}
        </div>
    );
};

export default CenterCell;
