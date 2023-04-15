class Node {
    constructor(message, role, parent = null) {
        this.role = role;
        this.message = message;
        this.parent = parent;
        this.children = [];
    }

    addChild(message, role) {
        const child = new Node(message, role, this);
        this.children.push(child);
        return child;
    }
}

export default Node;