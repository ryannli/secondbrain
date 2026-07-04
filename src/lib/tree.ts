import { TreeNode, SourceSummary, NotebookDocument } from "./types";

interface TreeItem {
  id: string;
  name: string;
  folder?: string;
  createdAt?: string;
}

/**
 * Build a tree structure from items and folders
 * Works for both Library sources and Notebook documents
 */
export function buildTree<T extends TreeItem>(
  items: T[],
  folders: string[],
  itemType: "source" | "document",
  getItemData: (item: T) => { source?: SourceSummary; document?: NotebookDocument }
): TreeNode[] {
  const tree: TreeNode[] = [];
  const folderNodes = new Map<string, TreeNode>();

  // Create folder nodes
  for (const folderPath of folders) {
    const parts = folderPath.split("/");
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!folderNodes.has(currentPath)) {
        const node: TreeNode = {
          type: "folder",
          name: part,
          path: currentPath,
          children: [],
        };
        folderNodes.set(currentPath, node);

        if (parentPath) {
          const parent = folderNodes.get(parentPath);
          parent?.children?.push(node);
        } else {
          tree.push(node);
        }
      }
    }
  }

  // Add items to appropriate folders
  for (const item of items) {
    const itemData = getItemData(item);
    const itemNode: TreeNode = {
      type: itemType,
      name: item.name,
      path: item.folder ? `${item.folder}/${item.id}` : item.id,
      ...itemData,
    };

    if (item.folder) {
      const folderNode = folderNodes.get(item.folder);
      if (folderNode) {
        folderNode.children?.push(itemNode);
      } else {
        tree.push(itemNode);
      }
    } else {
      tree.push(itemNode);
    }
  }

  // Sort: folders first (alphabetically), then items by time (newest first)
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type === "folder" && b.type !== "folder") return -1;
      if (a.type !== "folder" && b.type === "folder") return 1;
      if (a.type === "folder") return a.name.localeCompare(b.name);

      const timeA = new Date(
        a.source?.meta.createdAt || a.document?.createdAt || 0
      ).getTime();
      const timeB = new Date(
        b.source?.meta.createdAt || b.document?.createdAt || 0
      ).getTime();
      return timeB - timeA;
    });
    for (const node of nodes) {
      if (node.children) sortNodes(node.children);
    }
  };
  sortNodes(tree);

  return tree;
}
