---
title: Search for Lost Hands
date: 2025-07-27
---

Dp,ryo,rd ,u jsmfd hry ;pdy pm ,u lrunpstf.

<details>  
  <summary>If you don't like cryptography puzzles...</summary>  
  *Sometimes my hands get lost on my keyboard*  
</details>

I do this all the time, almost always by putting each of my fingers on my keyboard one key to the right of where they should be. It doesn't seem to happen as often on the left side. Then I'll bang out a one or two word search in my browser only noticing the gibberish I've just typed when I'm met with no relevant results. I can be a fairly spoiled user of technology. My first thought is often: *ugh... they should know what I MEAN.* So, I figured I'd build a solution in Lucene.

## The Plan

**Indexing**: nothing to do here—it'd be wasteful to transform every input. I'll use [Lucene](https://lucene.apache.org/) to index some test data from https://dumps.wikimedia.org. 

**Searching**: I'll use a `BooleanQuery` in Lucene to search for both: 
1. The original query string (to handle cases where my fingers are not lost) 
2. The query string shifted left (to handle cases where my fingers are all off to the right)

<a name="assumptions"></a>It's a simple approach. I'm relying on a couple assumptions with this approach:
1. If a query is typed correctly, it's "left-shifted" translation is gibberish, and not something else entirely.
2. A "right-shifted" query is gibberish.
If one of these is not true, we may get false positives. 

## The Code

First, let's index all titles from Wikipedia (https://dumps.wikimedia.org/enwiki/latest/) for some test data to play with:
```java
static Directory index(String dataFile) throws IOException {  
    Directory dir = new ByteBuffersDirectory();  
    Analyzer analyzer = new WhitespaceAnalyzer();  
    IndexWriterConfig config = new IndexWriterConfig(analyzer);  
  
    try (IndexWriter writer = new IndexWriter(dir, config);  
         BufferedReader br = new BufferedReader(new InputStreamReader(  
             new GZIPInputStream(new FileInputStream(dataFile)), StandardCharsets.UTF_8))) {  
  
        System.out.println("Indexing " + dataFile + "...");  
        br.lines()
            .map(line -> line.replace('_', ' ')) // That's just how Wikimedia encodes spaces  
            .forEach(title -> {  
                try {  
                    Document doc = new Document();  
                    doc.add(new TextField("title", title, Field.Store.YES));  
                    writer.addDocument(doc);  
                } catch (IOException e) {  
                    throw new UncheckedIOException(e);  
                }  
            });  
        System.out.println("Done indexing.");  
    }  
  
    return dir;  
}
```
*This takes about 30s to run on my machine.*

Next, let's write a method to shift a string to the left:
```java
static String shiftLeft(String input) {  
    StringBuilder result = new StringBuilder(input.length());  
    for (char c : input.toCharArray()) {  
        result.append(shiftCharLeft(c));  
    }  
    return result.toString();  
}  
  
static char shiftCharLeft(char c) {  
    return switch (c) {  
        case 'w' -> 'q';  
        case 'e' -> 'w';  
        case 'r' -> 'e';  
        case 't' -> 'r';  
        case 'y' -> 't';
// ... you get the idea
```

Then a search method that returns the top 10 results of a boolean query comprising of the original string and its "left-shift":
```java
static List<String> search(Directory dir, String query) throws IOException {  
    List<String> results = new ArrayList<>();  
  
    try (DirectoryReader reader = DirectoryReader.open(dir)) {  
        IndexSearcher searcher = new IndexSearcher(reader);  
  
        String shiftedQueryStr = shiftLeft(query);  
  
        BooleanQuery.Builder booleanQuery = new BooleanQuery.Builder();  
        Query originalQuery = new TermQuery(new Term("title", query.toLowerCase()));  
        Query shiftedQuery = new TermQuery(new Term("title", shiftedQueryStr.toLowerCase()));  
        booleanQuery.add(originalQuery, BooleanClause.Occur.SHOULD);  
        booleanQuery.add(shiftedQuery, BooleanClause.Occur.SHOULD);  
  
        TopDocs topDocs = searcher.search(booleanQuery.build(), 10);  
        StoredFields storedFields = searcher.storedFields();  
        for (ScoreDoc hit : topDocs.scoreDocs) {  
            Document doc = storedFields.document(hit.doc);  
            results.add(doc.get("title"));  
        }  
    }  
  
    return results;  
}
```

Finally:
```java
public static void main(String[] args) throws Exception {  
    Directory dir = index("src/main/resources/enwiki-latest-all-titles-in-ns0.gz");  
  
    try (BufferedReader readerConsole = new BufferedReader(new InputStreamReader(System.in))) {  
        while (true) {  
            System.out.print("Enter your query: ");  
            String query = readerConsole.readLine();  
  
            List<String> results = search(dir, query);  
  
            if (results.isEmpty()) {  
                System.out.println("No results found for: " + query);  
            } else {  
                System.out.println("Results for: " + query);  
                for (String title : results) {  
                    System.out.println(" - " + title);  
                }  
            }  
        }  
    }  
}
```

## Results

```
Enter your query: hioyst
Results for: hioyst
 - 10-string guitar
 - 12-string guitar
 - 12/6-string guitar
 - 18-string guitar
 - 6-string guitar
 - 6/12-string guitar
 - 7-string guitar
 - 8-string guitar
 - AK-47 guitar
 - Contra guitar

Enter your query: hendrix
Results for: hendrix
 - Jimi hendrix
 - Jimmy hendrix
 - Terri hendrix
 - Early life of jimi hendrix
```
:D 

---

I figured while I was writing it that the [assumptions](#assumptions) I made earlier had some counterexamples... let me know if you think of any!
