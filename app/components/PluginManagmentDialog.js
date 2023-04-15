import { db } from "db";
import TextField from "./TextField";
import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";

const DEFAULT_PLUGINS_SERVER = "https://raw.githubusercontent.com/masasron/zik-plugins/main/plugins.json";

function Plugin(props) {
    const plugin = props.plugin;
    return <div index={props.index} className="plugin">
        <div className="plugin-header">
            <div className="logo">
                <img src={plugin.logo_url} />
            </div>
            <div className="content">
                <h3>
                    {plugin.name_for_human}
                </h3>
                {plugin.installed && <button className="primary gray" onClick={() => uninstallPlugin(plugin.name_for_human)}>
                    Uninstall
                    <span className="material-symbols-outlined">
                        cancel
                    </span>
                </button>}
                {!plugin.installed && <button className="primary" onClick={() => installPlugin(plugin)}>
                    Install Plugin
                    <span className="material-symbols-outlined">
                        download
                    </span>
                </button>}
            </div>
        </div>
        <p>{plugin.description_for_human}</p>
        <div>
            {plugin.legal_info_url && <a target="_blank" rel="noreferrer noopener" href={typeof plugin.legal_info_url === "string" && plugin.legal_info_url.match(/^https?:\/\//i) && plugin.legal_info_url}>
                <span className="material-symbols-outlined">
                    gavel
                </span>
            </a>}
            {plugin.contact_email && <a href={"mailto:" + plugin.contact_email}>
                <span className="material-symbols-outlined">
                    mail
                </span>
            </a>}
        </div>
    </div>
}

async function uninstallPlugin(name) {
    if (confirm(`Are you sure you want to uninstall "${name}"?`)) {
        await db.plugins.where("name_for_human").equals(name).delete();
    }
}

async function installPlugin(plugin) {
    try {
        if (plugin.api.type === "openapi") {
            const response = await fetch(plugin.api.url);
            plugin.openapi_yaml = await response.text();
        }
        await db.plugins.add(plugin);
        return true;
    } catch (error) {
        console.log(error);
        alert("Failed to install plugin, due to: " + error);
        return false;
    }
}

function AddPluginFromURLDialog(props) {
    const [error, setError] = useState("");
    const [plugin, setPlugin] = useState(null);

    async function downloadPlugin(event) {
        setError("");
        setPlugin(null);

        let url;
        try {
            url = new URL(event.target.value);
        } catch {
            return;
        }

        if (!url.pathname.endsWith(".json")) {
            url.pathname = "/.well-known/ai-plugin.json";
        }

        // Ensure the URL is HTTP or HTTPS
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            return;
        }

        let response;
        try {
            response = await fetch(url.toString(), { cache: "no-cache" });
        } catch {
            return;
        }

        if (response.status !== 200) {
            return setError("Failed to download plugin manifest");
        }

        let plugin;
        try {
            plugin = await response.json();
        } catch {
            return setError("Invalid plugin manifest");
        }

        plugin.installed = await db.plugins.where("name_for_human").equals(plugin.name_for_human).count() > 0;
        setPlugin(plugin);
    }

    async function handleInstallation(event) {
        event.preventDefault();

        const exists = await db.plugins.where("name_for_human").equals(plugin.name_for_human).count() > 0;

        if (exists) {
            return uninstallPlugin(plugin.name);
        }

        if (await installPlugin(plugin)) {
            props.updatePage(0);
        }
    }

    return <>
        <header>
            <span onClick={props.onClose} className="material-symbols-outlined">close</span>
            <h1>
                <button style={{ marginRight: 10 }} onClick={() => props.updatePage(0)}>Back</button>
                Add plugin
            </h1>
        </header>
        <div className="dialog-content">
            <form onSubmit={handleInstallation}>
                <TextField label="URL" hint={error} onChange={downloadPlugin} placeholder="https://example.com" type="url" pattern="^https?://.*" title="Must be a valid website URL" />
                {plugin && <div style={{ display: "flex" }}>
                    <Plugin plugin={plugin} />
                </div>}
            </form>
        </div>
    </>
}

function InstalledPluginsList(props) {
    const [plugins, setPlugins] = useState([]);
    const installedPlugins = useLiveQuery(() => db.plugins.toArray());

    useEffect(function () {
        const plugins_server_url = props?.settings?.plugins_server_url || DEFAULT_PLUGINS_SERVER;
        fetch(plugins_server_url + "?r=" + Math.random(), { cache: "no-cache" }).then(response => response.json()).then(p => {
            // Add "installed" property to each plugin
            p = p.map(p => {
                p.installed = installedPlugins?.find(({ name_for_human }) => name_for_human === p.name_for_human) ? true : false;
                return p;
            });

            // Add installed plugins to the p array if they're not already there
            installedPlugins?.forEach(plugin => {
                if (!p.find(({ name }) => name === plugin.name)) {
                    plugin.installed = true;
                    p.push(plugin);
                }
            });

            setPlugins(p);
        }).catch(error => {
            alert("Failed to fetch plugins list, due to: " + error);
        });
    }, [installedPlugins]);

    return <>
        <header>
            <span onClick={props.onClose} className="material-symbols-outlined">close</span>
            <h1>
                Plugins
                <button style={{ marginLeft: 10 }} onClick={() => props.updatePage(1)}>Add from URL</button>
            </h1>
        </header>
        <div className="dialog-content">
            <div className="plugins">
                {plugins && plugins.map((plugin, index) => <Plugin plugin={plugin} index={index} />)}
            </div>
            <hr />
            <small>When using plugins, be aware that a lengthy system prompt may be sent. Please take the time to thoroughly read and understand the plugin code prior to use.</small>
        </div>
    </>
}

export default function PluginManagmentDialog(props) {
    const [page, setPage] = useState(0);

    return <>
        <div className="dialog-container">
            <div className="dialog">
                {page === 0 && <InstalledPluginsList settings={props.settings} onClose={props.onClose} updatePage={setPage} />}
                {page === 1 && <AddPluginFromURLDialog onClose={props.onClose} updatePage={setPage} />}
            </div>
        </div>
    </>
}