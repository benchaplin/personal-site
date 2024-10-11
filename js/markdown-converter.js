document.addEventListener("DOMContentLoaded", async () => {
  const postName = window.location.pathname.split("/blog/")[1];
  const response = await fetch(`/posts/${postName}.md`);
  const mdContent = await response.text();

  // Extract metadata (YAML front matter) from the markdown content
  const metadataRegex = /^---\n([\s\S]+?)\n---/;
  const match = metadataRegex.exec(mdContent);

  let metadata = {};
  let markdownBody = mdContent;

  if (match) {
    const metadataContent = match[1];
    markdownBody = mdContent.slice(match[0].length); // Strip the metadata section

    metadataContent.split("\n").forEach(line => {
      const [key, value] = line.split(": ");
      if (key && value) {
        metadata[key.trim()] = value.trim();
      }
    });
  }

  // Display the title and date in the post template
  const blogPostElement = document.getElementById("blog-post");
  if (metadata.title && metadata.date) {
    blogPostElement.innerHTML = `
        <h1>${metadata.title}</h1>
        <p><em>${metadata.date}</em></p>
        <hr>
        ${marked(markdownBody)}
      `;
  } else {
    blogPostElement.innerHTML = marked(markdownBody);
  }
});
