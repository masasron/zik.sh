import TextField from "./TextField";

export default function SettingsDialog(props) {
    const settings = JSON.parse(localStorage.getItem("settings"));

    function handleSubmit(event) {
        event.preventDefault();
        // store the form data in the local storage
        const settingsObject = {};
        const formData = new FormData(event.target);
        for (const [key, value] of formData) {
            settingsObject[key] = value;
        }

        settingsObject.initials = getInitials(settingsObject.full_name || "");
        localStorage.setItem("settings", JSON.stringify(settingsObject));
        handleClose();
    }

    function getInitials(fullName) {
        if (!fullName) {
            return "U";
        }
        const names = fullName.split(" ");
        if (names.length === 1) {
            return names[0].charAt(0).toUpperCase();
        }
        return names[0].charAt(0) + names[names.length - 1].charAt(0).toUpperCase();
    }

    function handleClose() {
        props.onClose();
    }

    return <>
        <div className="dialog-container">
            <div className="dialog">
                <header>
                    <span onClick={handleClose} className="material-symbols-outlined">close</span>
                    <h1>Settings</h1>
                </header>
                <div className="dialog-content">
                    <form onSubmit={handleSubmit}>
                        <TextField type="text" defaultValue={settings?.full_name} label="Full Name" name="full_name" placeholder="John Doe" hint="Will only be used to generate initials for the profile picture" />
                        <TextField defaultChecked={settings?.show_system_messages} label="Show system messages" name="show_system_messages" id="show_system_messages" type="checkbox" hint="Show system messages sent by active plugins" />
                        <h3>Models</h3>
                        {!settings?.openai_api_key && <div className="alert warning">
                            If you don't have an API key, you can get one for free at <a href="https://platform.openai.com/" target="_blank" rel="noreferrer">openai.com</a>
                        </div>}
                        <TextField defaultValue={settings?.openai_api_key} label="OpenAI API Key" name="openai_api_key" autoComplete="off" placeholder="API Key" type="password" hint="Used for GPT-3.5 and GPT-4 and for generating titles" />
                        <TextField defaultValue={settings?.gpt4all_server_url} label="GPT4All Server URL" name="gpt4all_server_url" autoComplete="off" placeholder="http://localhost:3001" type="url" hint="Enter GPT4All server url with server-sent events support" />
                        <h3>Plugins</h3>
                        <TextField pattern="^https?://.*/plugins.json" label="Plugins Server URL" title="URL must point to a plugins.json file." defaultValue={settings?.plugins_server_url || "https://raw.githubusercontent.com/masasron/zik-plugins/main/plugins.json"} name="plugins_server_url" autoComplete="off" placeholder="http://localhost:8080/plugins.json" type="url" hint="Set a custom plugins server" />
                        <hr />
                        <button className="primary" type="submit">Save Changes</button>
                    </form>
                </div>
            </div>
        </div>
    </>
}