export default function TextField(props) {
    return <div className="text-field-container">
        <label htmlFor={props.name}>{props.label}</label>
        <input {...props} />
        {props.hint && <small>{props.hint}</small>}
    </div>
}