import { v4 } from "uuid";

class ConversationNode {
    constructor(role, message, childrenIndex = 0, children = [], parent = null, id = null) {
        this.id = id || v4();
        this.role = role;
        this.message = message;
        this.childrenIndex = childrenIndex;
        this.children = children;
        this.parent = parent;
        this.parent_id = parent?.id || null;
    }

    toJSON() {
        return {
            id: this.id,
            role: this.role,
            message: this.message,
            childrenIndex: this.childrenIndex,
            children: this.children.map(child => child.toJSON()),
            parent_id: this.parent?.id || null
        };
    }
}

class Conversation {

    constructor() {
        this.root = new ConversationNode("system", "Date and time: " + new Date().toLocaleString());
        this.currentNode = this.root;
    }

    setSystemMessage(message) {
        this.root.message = message;
        return this;
    }

    userSend(message) {
        const newNode = new ConversationNode(
            "user",
            message,
            0,
            [],
            this.currentNode
        );
        this.currentNode.children.push(newNode);
        this.currentNode.childrenIndex = this.currentNode.children.length - 1;
        this.currentNode = newNode;
        return newNode;
    }

    assistantSend(message) {
        const newNode = new ConversationNode(
            "assistant",
            message,
            0,
            [],
            this.currentNode
        );
        this.currentNode.children.push(newNode);
        this.currentNode.childrenIndex = this.currentNode.children.length - 1;
        this.currentNode = newNode;
        return newNode;
    }

    regenerateReplyTo(targetNode, message) {
        const newNode = new ConversationNode(
            "assistant",
            message,
            0,
            [],
            targetNode
        );
        targetNode.children.push(newNode);
        targetNode.childrenIndex = targetNode.children.length - 1;
        this.currentNode = newNode;
        return newNode;
    }

    edit(targetNode, newMessage) {
        let newNode = new ConversationNode(
            "user",
            newMessage,
            0,
            [],
            targetNode.parent
        );

        targetNode.parent.children.push(newNode);
        targetNode.parent.childrenIndex = targetNode.parent.children.length - 1;

        this.currentNode = newNode;
        return newNode;
    }

    changeConversationPath(targetNode, index) {
        if (targetNode && index >= 0 && index < targetNode.children.length) {
            targetNode.childrenIndex = index;
            this.currentNode = targetNode.children[index];
        }
    }

    flatten() {
        const nodes = [];

        let currentNode = this.root;
        while (currentNode) {
            nodes.push({
                role: currentNode.role,
                content: currentNode.message,
                childrenLength: currentNode?.parent?.children.length,
                childrenIndex: currentNode?.parent?.childrenIndex,
                ref: currentNode
            });
            currentNode = currentNode.children[currentNode.childrenIndex];
        }

        // Set currentNode to the last node
        this.currentNode = nodes[nodes.length - 1].ref;

        return nodes;
    }

    toJSON() {
        return this.root.toJSON();
    }

    load(data) {
        function buildConversationTree(nodeData, idToNodeMap) {
            const newNode = new ConversationNode(
                nodeData.role,
                nodeData.message,
                nodeData.childrenIndex,
                [],
                idToNodeMap.get(nodeData.parent_id),
                nodeData.id
            );

            idToNodeMap.set(nodeData.id, newNode);
            newNode.children = nodeData.children.map(childData => buildConversationTree(childData, idToNodeMap));
            return newNode;
        }

        const idToNodeMap = new Map();
        this.root = buildConversationTree(data, idToNodeMap);

        // Set the current node to the last node in the root's children
        this.currentNode = this.root.children[this.root.childrenIndex];
    }
}

export default Conversation;