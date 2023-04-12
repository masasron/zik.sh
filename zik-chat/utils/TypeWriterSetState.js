const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export default async function TypeWriterSetState(newState, setState) {
    for (let i = 0; i < newState.length; i++) {
        setState(oldState => oldState + newState[i]);
        await delay(50);
    }
}