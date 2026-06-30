document.addEventListener("DOMContentLoaded", async () => {
  const response = await fetch("/posts");
  const htmlContent = await response.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, "text/html");

  const links = Array.from(doc.querySelectorAll("a")).map(a => a.getAttribute("href"));
  const files = links.filter(href => href.endsWith(".md")).map(href => href.split("/").pop());

  async function extractMetadata(file) {
    const response = await fetch(`/posts/${file}`);
    const mdContent = await response.text();
    const metadataRegex = /^---\n([\s\S]+?)\n---/;
    const match = metadataRegex.exec(mdContent);

    let metadata = {
      title: file.replace(".md", "").replace(/-/g, " "),
      date: ""
    };

    if (match) {
      const metadataContent = match[1];
      metadataContent.split("\n").forEach(line => {
        const [key, value] = line.split(": ");
        if (key && value) {
          metadata[key.trim()] = value.trim();
        }
      });
    }

    return { ...metadata, url: `/blog/${file.replace(".md", "")}`, external: false };
  }

  const localPosts = await Promise.all(files.map(extractMetadata));

  let externalPosts = [];
  try {
    const extResponse = await fetch("/external-posts.json");
    const extData = await extResponse.json();
    externalPosts = extData.map(p => ({ ...p, external: true }));
  } catch (_) {}

  const allPosts = [...localPosts, ...externalPosts].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  const isHomePage = window.location.pathname.endsWith("index.html") || window.location.pathname === "/";
  const postsToShow = isHomePage ? allPosts.slice(0, 10) : allPosts;

  const blogList = document.getElementById("blog-list");
  if (blogList) {
    for (const post of postsToShow) {
      const listItem = document.createElement("li");
      if (post.external) {
        listItem.innerHTML = `<span class="external-site">(outside link)</span> <a href="${post.url}">${post.title} (<em>${post.date}</em>)</a>`;
      } else {
        listItem.innerHTML = `<a href="${post.url}">${post.title} (<em>${post.date}</em>)</a>`;
      }
      blogList.appendChild(listItem);
    }
  }
});
