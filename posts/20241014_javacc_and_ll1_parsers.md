---
title: JavaCC and LL(1) Parsers
date: 2024-10-14
---

This is a story of escape characters (it won't be *too* painful, don't worry). It's also a story about how JavaCC matches tokens as an "LL(1) parser", and what I needed to understand in order to get my grammar working when working on [a new parser feature in Apache Lucene](https://github.com/apache/lucene/pull/13887). Take a look at [Apache Lucene's QueryParsers](https://lucene.apache.org/core/9_0_0/queryparser/index.html) if you want to understand the actual work done in the aforementioned PR—but for this post, I'll use a toy example to explain the problem and solution.

Here's the setup—we're parsing terms with some delimiters in mind. Let's say we’re building a command-line tool to process file paths, where paths can include spaces, but spaces can also separate different file paths. For example:

`Documents/MyFile.txt Projects/Code.java`

However, users might also have file paths with spaces that need to be treated as part of a single term. In such cases, we want to give them the ability to escape the space with a backslash:

`Documents/My\ File.txt Projects/Code.java`

This input should still be parsed as two file paths: "Documents/My File.txt" and "Projects/Code.java".

[JavaCC](https://javacc.github.io/javacc/) is a popular parser generator. Define some "tokens" and a "grammar", and JavaCC will generate Java code that recognizes matches to that grammar. Like me, you might read some JavaCC docs and examples, then write this token definition:
```
TOKEN : {
	  < SPACE: " " >
	| < PATH_CHAR: (~[" "] | "\\"~[])+ >
}
```

Basically:
- `< SPACE: " " >`: Spaces are *not* part of file paths 
- `< PATH_CHAR: (~[" "] | "\\"~[])+ >`: File paths are made up of either:
	-  characters that are not spaces
	- OR any escaped characters (in JavaCC, the empty negation set `~[]` matches any character)

One note that will be important to remember throughout these code examples: in Java, `\\` is used to mean a single backslash. This is because in Java itself, a single backslash is parsed as an escape character. Therefore, if we want to mean a literal backslash, we need to escape the escape. So whenever you see `\\` in Java/CC, think of it as really *one* backslash.

Alright, let's give this token definition a shot. I'll run some inputs, and we can see what tokens JavaCC parses.

| Input                                | File paths parsed                      |
| ------------------------------------ | -------------------------------------- |
| `dir/file.txt`                       | `[dir/file.txt]`                       |
| `dir/file.txt dir/image.png`         | `[dir/file.txt, dir/image.png]`        |
| `dir/my\ file.txt`                   | `[dir/my file.txt]`                    |
| `dir/my\ file.txt dir/my\ image.png` | `[dir/my file.txt, dir/my image.png]`  |
| `dir/my file.txt dir/my\ image.png`  | `[dir/my, file.txt, dir/my image.png]` |

Looking good! I even threw in a bad input at the end, where the space between `my file` is not escaped.

Let's get in a unit testing mindset now. How can we break this thing... what are some interesting edge cases? Our token definition is built around backslashes and spaces. What if we double those up? Let's focus on double backslashes. We should parse these as an escaped backslash.

| Input                          | File paths parsed               |
| ------------------------------ | ------------------------------- |
| `dir/fi\\le.txt`               | `[dir/fi\le.txt]`               |
| `dir/file.txt\\ dir/image.png` | `[dir/file.txt\ dir/image.png]` |

Whoa—ok... there's the bug. We were expecting a double backslash to be parsed as an escaped backslash, then the space to act as a delimiter. We wanted two file paths parsed: `[dir/file.txt\, dir/image.png]`, but we got a single amalgamation. 

What's happening here? Well it seems like JavaCC is parsing the second of the two backslashes as an escape character for the following space. I found that strange—I was expecting the backslashes to be parsed together. Maybe order matters? I tried `< PATH_CHAR: ("\\"~[] | ~[" "])+ >`, but I got the same result. 

Documentation time. We need to figure out how JavaCC actually matches our input given the token definition. Turns out JavaCC is an [LL parser](https://en.wikipedia.org/wiki/LL_parser):
- it's a **top-down** parser
- it reads an input **left-to-right**
- it performs **leftmost derivation**

Let's check out what these terms mean in the context of an example. The breaking example here is a double backslash followed by a space. Instead of working through the input `dir/file.txt\\ dir/image.png`, I'll use a simpler input of `fo\\ ba` to keep this concise. Let's see how JavaCC parses file paths from this input:

![Parser diagram](/image/parser1.svg)

Remember our definition of the `PATH_CHAR` token: `< PATH_CHAR: (~[" "] | "\\"~[])+ >`, so we have two "options" separated by an "OR." I've labeled these **o1** and **o2** (note: because **o2** parses two characters, I've labeled the second check as **o2 cont.**). If the character on the left (y-axis) matches the option, I write a ✅. If not, it's an ❌. 
- We work from the **top-down**.
- We read the input **left-to-right** ('f' first, then 'o', ...).
- I constructed the tree's left branches first, which is **leftmost derivation** (that doesn't really have an affect on the outcome here)

This process is deterministic in practice, but I like to think of it as an NFA. The parser trying every option around the `|` for each character. If *any* series of choices matches, that match counts. The problem is, a single series of choices gets us parsing past the space:
- f: **o1**
- o: **o1**
- \\: **o1**
- \\: **o2**
- \<space\>: **o2 cont.**
- b: **o1**
- a: **o1**

If we want to break parsing a file path at the space in `fo\\ bar`, we'll certainly need that series of choices to break. We'll also need to make sure no series of choices gets us past the space.

*Spoiler alert, the solution is below!*

```
TOKEN : {
	  < SPACE: " " >
	| < PATH_CHAR: (~[" ", "\\"] | "\\"~[])+ >
}
```

The addition of `"\\"` to the negated character set `~[" ", "\\"]` should do the trick. We need to make sure backslashes are *only* parsed as escape characters, not as single characters. Check out the process now:

![New parser diagram](/image/parser2.svg)

The key step is at the parsing of the first backslash. It can no longer match against **o1**, so **o2** is the only option. This gives us the behavior we want: escape characters are *always* applied to the following character. 
