document.addEventListener("DOMContentLoaded", async () => {
  const postName = window.location.pathname.split("/blog/")[1];
  const response = await fetch(`/posts/${postName}.md`);

  if (!response.ok) {
    document.getElementById("blog-post").innerHTML = `<h1>Post not found</h1>`;
    return;
  }

  const mdContent = await response.text();

  const metadataRegex = /^---\n([\s\S]+?)\n---/;
  const match = metadataRegex.exec(mdContent);

  let metadata = {};
  let markdownBody = mdContent;

  if (match) {
    const metadataContent = match[1];
    markdownBody = mdContent.slice(match[0].length);

    metadataContent.split("\n").forEach(line => {
      const [key, value] = line.split(": ");
      if (key && value) {
        metadata[key.trim()] = value.trim();
      }
    });
  }

  const blogPostElement = document.getElementById("blog-post");
  if (metadata.title && metadata.date) {
    blogPostElement.innerHTML = `
      <h1>${metadata.title}</h1>
      <p><em>${metadata.date}</em></p>
      <hr>
      ${marked.parse(markdownBody)}
    `;
  } else {
    blogPostElement.innerHTML = marked.parse(markdownBody);
  }

  hljs.highlightAll();

  MathJax.typesetPromise([blogPostElement]);
});