import os from "os";
import fs from "fs";
import path from "path";
import { spawn } from 'child_process';

class GPT4All {

    constructor(systemPrompt = "", modelPath = null, executablePath = null) {
        this._child = null;
        this._onData = new Set();
        this.systemPrompt = systemPrompt;
        this.executablePath = executablePath || path.resolve(os.homedir(), '.nomic/gpt4all');
        this.modelPath = modelPath || path.resolve(os.homedir(), '.nomic/gpt4all-lora-quantized.bin');

        if (!fs.existsSync(this.executablePath)) {
            throw new Error(`Executable not found: ${this.executablePath}`);
        }

        if (!fs.existsSync(this.modelPath)) {
            throw new Error(`Model file not found: ${this.modelPath}`);
        }
    }

    onData(handler) {
        this._onData.add(handler);
    }

    open() {
        this._child = spawn(this.executablePath, ['--model', this.modelPath, '--repeat_penalty', '2.0', '--top_k', '40']);

        this._child.stdout.on('data', (data) => {
            // if no handler is registered, print to stdout
            if (this._onData.size === 0) {
                process.stdout.write(data);
            }

            for (const handler of this._onData) {
                handler(data.toString("utf-8"));
            }
        });

        this._child.stderr.on('data', (data) => {
            process.stdout.write(data);
        });

        this._child.on('close', (code) => {
            console.log(`child process exited with code ${code}`);
        });

        this._child.on('error', (err) => {
            console.log(`child process exited with error ${err}`);
        });
    }

    close() {
        if (this._child !== null) {
            this._child.kill();
            this._child = null;
        }
        this._onData.clear();
    }

    prompt(text) {
        if (this._child === null) {
            this.open();
        }

        // Replace \n with \r in text
        // We have to do so to prevent the model for generating a reply for each line.
        // Not sure using \r is the best way to do this, but it works.
        text = text.replace(/\n/g, "\r");

        if (this.systemPrompt !== "") {
            text = this.systemPrompt + "\r" + text;
            this.systemPrompt = "";
        }

        this._child.stdin.write(this.systemPrompt + "\r" + text);
        this._child.stdin.write("\n");
    }

}

export default GPT4All;


