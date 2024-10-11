document.addEventListener("DOMContentLoaded", async () => {
  const response = await fetch("/posts");
  const files = await response.json();

  // Sort the files by name (assuming they are named with dates or similar order)
  const sortedFiles = files.sort((a, b) => b.localeCompare(a));

  // Helper function to extract metadata (title and date)
  async function extractMetadata(file) {
    const response = await fetch(`/posts/${file}`);
    const mdContent = await response.text();
    const metadataRegex = /^---\n([\s\S]+?)\n---/;
    const match = metadataRegex.exec(mdContent);

    let metadata = {
      title: file.replace(".md", "").replace(/-/g, " "),
      date: ""
    }; // Default to filename if no metadata

    if (match) {
      const metadataContent = match[1];
      metadataContent.split("\n").forEach(line => {
        const [key, value] = line.split(": ");
        if (key && value) {
          metadata[key.trim()] = value.trim();
        }
      });
    }

    return metadata;
  }

  // Display recent posts on the homepage
  const recentPostsList = document.getElementById("recent-posts-list");
  for (let i = 0; i < Math.min(sortedFiles.length, 10); i++) {
    const file = sortedFiles[i];
    const metadata = await extractMetadata(file);
    const listItem = document.createElement("li");
    listItem.innerHTML = `<a href="/blog/${file.replace(".md", "")}">${
      metadata.title
    } - <em>${metadata.date}</em></a>`;
    recentPostsList.appendChild(listItem);
  }

  // Display full list of posts on the blog page
  const blogList = document.getElementById("blog-list");
  if (blogList) {
    sortedFiles.forEach(async file => {
      const metadata = await extractMetadata(file);
      const listItem = document.createElement("li");
      listItem.innerHTML = `<a href="/blog/${file.replace(".md", "")}">${
        metadata.title
      } - <em>${metadata.date}</em></a>`;
      blogList.appendChild(listItem);
    });
  }
});
