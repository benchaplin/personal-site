document.addEventListener("DOMContentLoaded", async () => {
  const response = await fetch("/posts");
  const htmlContent = await response.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");

  const links = Array.from(doc.querySelectorAll("a")).map(a => a.getAttribute("href"));
  const files = links.filter(file => file.endsWith(".md"));

  const sortedFiles = files.sort((a, b) => b.localeCompare(a));

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

  const blogList = document.getElementById("blog-list");
  if (blogList) {
    sortedFiles.forEach(async file => {
      const metadata = await extractMetadata(file);
      const listItem = document.createElement("li");
      listItem.innerHTML = `<a href="/blog/${file.replace(".md", "")}">${metadata.title} (<em>${metadata.date}</em>)</a>`;
      blogList.appendChild(listItem);
    });
  }
});