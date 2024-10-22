---
title: Lightweight Search in the Browser with Lunr
date: 2024-10-21
---

I faced a unique task recently—to build a standard internal search function for a website without a backend. 

If you own a full-fledged web application, you might integrate something like [Apache Lucene](https://lucene.apache.org/) into the backend and support an endpoint for the frontend to call when performing a search. You could also try [integrating with Google](https://programmablesearchengine.google.com/about/) to piggyback off what they've scraped and indexed of your site. If you're using a CMS, it probably has a search feature built-in.

But what if you own a mostly-static, lightweight website hosted with some standard provider and you don't want to spend *any* more money? Let's take a look at how we can build a custom search bar on such a site with just a few extra steps at build time.

## Step 1: Scrape our own site

We need the content of our site in a simple format in order to index it. My content is spread across various React JSX files in `<p>` tags, so I decided to scrape my own site at build time and aggregate this content into a JSON file.

I'm using Node, so I'll use [Puppeteer](https://pptr.dev/) (I'm on v19) for this—a nice JS headless browser library. Let's set it up to start looking at our homepage running on a local server:

```javascript
const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
const startingUrl = "http://localhost:3000";
await page.goto(startingUrl);
```

Alright, now we want to walk through every page in the site and capture titles/text. If you have a sitemap, you could use that as a list of pages to index. You could also hardcode links if you're OK with updating the list when a new page is added. A fully automated solution would be to crawl the site, building a comprehensive set of all URLs accessible through its links. Whatever you do, let's assume we have a list of `urls` to index.

We'll build a Javascript object containing the URL, the title of the page and the text. I've got all my titles in `<h2>` elements, and all my text in `<p>` elements inside a `<div>` with a class called `content-container`, so I'll use that knowledge to query:

```javascript
const searchIndexDocs = {};
for (const url of urls) {
    await page.goto(url);

    try {
        await page.waitForSelector("h2");
        const titleEl = await page.$("h2");
        const title = await titleEl.evaluate(el => el.textContent);

        await page.waitForSelector(".content-container");
        const textList = await page.evaluate(() => {
            const contentContainer =
                document.querySelector(".content-container");
            if (contentContainer) {
                const pElements =
                    contentContainer.querySelectorAll("p");
                return Array.from(pElements).map(p => p.textContent);
            }
            return [];
        });

        const text = textList.join(" "); // Join the paragraphs into a single block of text

        searchIndexDocs[url] = { // Add a document to the index data
            page: url,
            title,
            text
        };

        await titleEl.dispose();
    } catch (error) {
        console.error(`Error scraping ${url}: ${error}`);
    }
}
await browser.close();

const filePath = path.join(
	__dirname,
	"../public/files/searchIndexDocs.json"
);
const jsonData = JSON.stringify(searchIndexDocs, null, 2); // Write the entire index data to a file
fs.writeFile(filePath, jsonData, err => {
	if (err) {
		console.error(`Error writing to file: ${err}`);
	}
});
/*
searchIndexDocs.json will look something like this:

{
  "/about/team": {
    "page": "/about/team",
    "title": "Our team",
    "text": "Our team consists of seasoned professionals..."
  },
  "/donations": {
    "page": "/donations",
    "title": "Donate to our Cause",
    "text": "Your donations are greatly appreciated..."
  },
  ...
}
*/
```

You'll notice we finished the scraping job by writing the results to a file that will be served by our web server. **Security callout:** once this is deployed, *everything* you scraped will be public, so make sure you vet the data in this file carefully. 

## Step 2: Index the data

We'll use [Lunr](https://lunrjs.com/) as our search engine. Lunr is perfect for us because it runs directly in the browser. It's also dead simple to set up—in its own words, Lunr is "a bit like Solr, but much smaller and not as bright." To set up Lunr, we need to implement an index, taking in the data we just scraped:

```javascript
const lunr = require("lunr");
const documents = require("../public/files/searchIndexDocs.json");

const index = lunr(function () {
	this.ref("page");
	this.field("title");
	this.field("text");

	documents.forEach(doc => {
		this.add(doc);
	}, this);
});
```

Now, we can use the built-in search function. I'll customize it a bit to ensure we don't get results on an empty search:

```javascript
export function search(query) {
    if (query.trim() === "") {
        return [];
    } else {
        const res = index.search(query);
        return res;
    }
}
```

## Step 3: Build the search bar

Now we can write some frontend code. We can call `search` on the user input and get some documents looking like this:

```javascript
const results = search(searchTerm);
/*
[
    {
        "ref": "/about/team",
        "score": 3.238,
        "matchData": {
            "metadata": {
                "test": {
                    "text": {}
                }
            }
        }
    },
    {
        "ref": "/donations",
        "score": 3.062,
        "matchData": {
            "metadata": {
                "test": {
                    "text": {}
                }
            }
        }
    }
]
*/
```

We've got a list of results, with the `"ref"` value being the URL path we indexed. We can use this to grab the document from `searchIndexDocs.json` (which uses the URL paths as keys), then write all sorts of nice UI code:
- display a link to `result["ref"]`
- display the title of the page: `searchIndexDocs[results["ref"]].title`
- display some sample of the text: `searchIndexDocs[results["ref"]].text`, maybe with some highlighting of the search term

---

Overall, we were able to take a job that usually runs on the server and offload it in a few ways:
- The aggregation of data is now done by the machine running the build.
	- In my case, this is my laptop or the free tier of GitHub Actions.
- The data is stored and served by the web server in the form of a JSON file.
- The data is indexed by the user's browser upon first visiting the page.
- The search is processed by Lunr in the user's browser.

This breakdown helps make clear the drawbacks and limitations of a system like this. A lot of the work is handled by the user's machine, thus there's a theoretical limit on the size of the index due to:
- the time it takes to load the JSON data over the network
- the time it takes Lunr to index and search in the browser

In contrast, a traditional server-side approach could take advantage of various scaling and caching solutions to support a larger index.

But for me, running a small website on a tight budget, this was a satisfying solution to implementing search.