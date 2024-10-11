---
title: Adding a feature in Lucene's QueryParser
date: 2024-10-11
---

Brian Goetz: https://github.com/apache/lucene/commit/8ab0396cfccdafe51e6b741ea8e35a6491e1aa09

Useful commands

- rebuild JavaCC: ./gradlew -p lucene/queryparser javaccParserClassic
-

Problem: QueryParser can't parse escaped brackets in range query terms.

Range query: \[a TO b\]

```
queryParser.parse( "[ a\\[i\\] TO b\\[i\\] ]" );

/*
org.apache.lucene.queryparser.classic.ParseException: Cannot parse '[a\[i\] TO b\[i\]]': Encountered " "]" "] "" at line 1, column 6.
Was expecting:
    "TO" ...
 */
```

## Debugging JavaCC

https://javacc.github.io/javacc/
using `DEBUG_TOKEN_MANAGER` (`DEBUG_PARSER` gives simpler output)

- will throw- must replaceAll: debugStream -> System.out and (int)curChar -> curCharc

"abc"

```
<DEFAULT>Current character : 97 (97) at line 1 column 1
   No string literal matches possible.
   Starting NFA to match one of : { <token of kind 7>, <AND>, <OR>, <NOT>,
     <BAREOPER>, <QUOTED>, <FUZZY_SLOP>, <PREFIXTERM>, <WILDTERM>,
     <REGEXPTERM>, <TERM> }
<DEFAULT>Current character : 97 (97) at line 1 column 1
   Currently matched the first 1 characters as a <TERM> token.
   Possible kinds of longer matches : { <TERM>, <PREFIXTERM>, <token of kind 7>, <AND>,
     <OR>, <NOT>, <BAREOPER>, <QUOTED>, <FUZZY_SLOP>,
     <WILDTERM>, <REGEXPTERM> }
<DEFAULT>Current character : 98 (98) at line 1 column 2
   Currently matched the first 2 characters as a <TERM> token.
   Possible kinds of longer matches : { <WILDTERM>, <PREFIXTERM>, <token of kind 7>, <AND>,
     <OR>, <NOT>, <BAREOPER>, <QUOTED>, <FUZZY_SLOP>,
     <REGEXPTERM>, <TERM> }
<DEFAULT>Current character : 99 (99) at line 1 column 3
   Currently matched the first 3 characters as a <TERM> token.
   Possible kinds of longer matches : { <TERM>, <PREFIXTERM>, <token of kind 7>, <AND>,
     <OR>, <NOT>, <BAREOPER>, <QUOTED>, <FUZZY_SLOP>,
     <WILDTERM>, <REGEXPTERM> }
****** FOUND A <TERM> MATCH (abc) ******

Returning the <EOF> token.
```

"abc\[\]"

```
<DEFAULT>Current character : 97 (97) at line 1 column 1
   No string literal matches possible.
   Starting NFA to match one of : { <token of kind 7>, <AND>, <OR>, <NOT>,
     <BAREOPER>, <QUOTED>, <FUZZY_SLOP>, <PREFIXTERM>, <WILDTERM>,
     <REGEXPTERM>, <TERM> }
<DEFAULT>Current character : 97 (97) at line 1 column 1
   Currently matched the first 1 characters as a <TERM> token.
   Possible kinds of longer matches : { <TERM>, <PREFIXTERM>, <token of kind 7>, <AND>,
     <OR>, <NOT>, <BAREOPER>, <QUOTED>, <FUZZY_SLOP>,
     <WILDTERM>, <REGEXPTERM> }
<DEFAULT>Current character : 98 (98) at line 1 column 2
   Currently matched the first 2 characters as a <TERM> token.
   Possible kinds of longer matches : { <WILDTERM>, <PREFIXTERM>, <token of kind 7>, <AND>,
     <OR>, <NOT>, <BAREOPER>, <QUOTED>, <FUZZY_SLOP>,
     <REGEXPTERM>, <TERM> }
<DEFAULT>Current character : 99 (99) at line 1 column 3
   Currently matched the first 3 characters as a <TERM> token.
   Possible kinds of longer matches : { <TERM>, <PREFIXTERM>, <token of kind 7>, <AND>,
     <OR>, <NOT>, <BAREOPER>, <QUOTED>, <FUZZY_SLOP>,
     <WILDTERM>, <REGEXPTERM> }
<DEFAULT>Current character : 91 (91) at line 1 column 4
   Currently matched the first 3 characters as a <TERM> token.
   Putting back 1 characters into the input stream.
****** FOUND A <TERM> MATCH (abc) ******

<DEFAULT>Current character : 91 (91) at line 1 column 4
   No more string literal token matches are possible.
   Currently matched the first 1 characters as a "[" token.
****** FOUND A "[" MATCH ([) ******

<Range>Current character : 93 (93) at line 1 column 5
   No more string literal token matches are possible.
   Currently matched the first 1 characters as a "]" token.
****** FOUND A "]" MATCH (]) ******
```

(Exception)

```
org.apache.lucene.queryparser.classic.ParseException: Cannot parse 'abc[]': Encountered " "]" "] "" at line 1, column 4.
Was expecting one of:
    "TO" ...
    <RANGE_QUOTED> ...
    <RANGE_GOOP> ...
```

Note: lexical state changes to `<Range>` after \[ (91).

"abc\\\[\\\]"

```
<DEFAULT>Current character : 97 (97) at line 1 column 1
   No string literal matches possible.
   Starting NFA to match one of : { <token of kind 7>, <AND>, <OR>, <NOT>,
     <BAREOPER>, <QUOTED>, <FUZZY_SLOP>, <PREFIXTERM>, <WILDTERM>,
     <REGEXPTERM>, <TERM> }
<DEFAULT>Current character : 97 (97) at line 1 column 1
   Currently matched the first 1 characters as a <TERM> token.
   Possible kinds of longer matches : { <TERM>, <PREFIXTERM>, <token of kind 7>, <AND>,
     <OR>, <NOT>, <BAREOPER>, <QUOTED>, <FUZZY_SLOP>,
     <WILDTERM>, <REGEXPTERM> }
<DEFAULT>Current character : 98 (98) at line 1 column 2
   Currently matched the first 2 characters as a <TERM> token.
   Possible kinds of longer matches : { <WILDTERM>, <PREFIXTERM>, <token of kind 7>, <AND>,
     <OR>, <NOT>, <BAREOPER>, <QUOTED>, <FUZZY_SLOP>,
     <REGEXPTERM>, <TERM> }
<DEFAULT>Current character : 99 (99) at line 1 column 3
   Currently matched the first 3 characters as a <TERM> token.
   Possible kinds of longer matches : { <TERM>, <PREFIXTERM>, <token of kind 7>, <AND>,
     <OR>, <NOT>, <BAREOPER>, <QUOTED>, <FUZZY_SLOP>,
     <WILDTERM>, <REGEXPTERM> }
<DEFAULT>Current character : 92 (92) at line 1 column 4
   Currently matched the first 3 characters as a <TERM> token.
   Possible kinds of longer matches : { <WILDTERM>, <PREFIXTERM>, <TERM> }
<DEFAULT>Current character : 91 (91) at line 1 column 5
   Currently matched the first 5 characters as a <TERM> token.
   Possible kinds of longer matches : { <TERM>, <PREFIXTERM>, <token of kind 7>, <AND>,
     <OR>, <NOT>, <BAREOPER>, <QUOTED>, <FUZZY_SLOP>,
     <WILDTERM>, <REGEXPTERM> }
<DEFAULT>Current character : 92 (92) at line 1 column 6
   Currently matched the first 5 characters as a <TERM> token.
   Possible kinds of longer matches : { <WILDTERM>, <PREFIXTERM>, <TERM> }
<DEFAULT>Current character : 93 (93) at line 1 column 7
   Currently matched the first 7 characters as a <TERM> token.
   Possible kinds of longer matches : { <TERM>, <PREFIXTERM>, <token of kind 7>, <AND>,
     <OR>, <NOT>, <BAREOPER>, <QUOTED>, <FUZZY_SLOP>,
     <WILDTERM>, <REGEXPTERM> }
****** FOUND A <TERM> MATCH (abc\\[\\]) ******

Returning the <EOF> token.
```

Note: when it sees \\ (92) - it's ready for `{ <WILDTERM>, <PREFIXTERM>, <TERM> }`, but then when it sees \[ (91) it's back to plain `<TERM>`. It doesn't add backslash to the term, it still says "Currently matched the first 3".

"\[a TO b\]"

```
<DEFAULT>Current character : 91 (91) at line 1 column 1
   No more string literal token matches are possible.
   Currently matched the first 1 characters as a "[" token.
****** FOUND A "[" MATCH ([) ******

<Range>Current character : 97 (97) at line 1 column 2
   No string literal matches possible.
   Starting NFA to match one of : { <token of kind 7>, <RANGE_QUOTED>, <RANGE_GOOP> }
<Range>Current character : 97 (97) at line 1 column 2
   Currently matched the first 1 characters as a <RANGE_GOOP> token.
   Possible kinds of longer matches : { <token of kind 7>, <RANGE_QUOTED>, <RANGE_GOOP> }
<Range>Current character : 32 (32) at line 1 column 3
   Currently matched the first 1 characters as a <RANGE_GOOP> token.
   Putting back 1 characters into the input stream.
****** FOUND A <RANGE_GOOP> MATCH (a) ******

<Range>Current character : 32 (32) at line 1 column 3
   No string literal matches possible.
   Starting NFA to match one of : { <token of kind 7>, <RANGE_QUOTED>, <RANGE_GOOP> }
<Range>Current character : 32 (32) at line 1 column 3
   Currently matched the first 1 characters as a <token of kind 7> token.
****** FOUND A <token of kind 7> MATCH ( ) ******

<Range>Current character : 84 (84) at line 1 column 4
   Possible string literal matches : { "TO" }
<Range>Current character : 79 (79) at line 1 column 5
   No more string literal token matches are possible.
   Currently matched the first 2 characters as a "TO" token.
<Range>Current character : 32 (32) at line 1 column 6
   Starting NFA to match one of : { <token of kind 7>, <RANGE_QUOTED>, <RANGE_GOOP> }
<Range>Current character : 32 (32) at line 1 column 6
   Currently matched the first 2 characters as a "TO" token.
   Putting back 1 characters into the input stream.
****** FOUND A "TO" MATCH (TO) ******

<Range>Current character : 32 (32) at line 1 column 6
   No string literal matches possible.
   Starting NFA to match one of : { <token of kind 7>, <RANGE_QUOTED>, <RANGE_GOOP> }
<Range>Current character : 32 (32) at line 1 column 6
   Currently matched the first 1 characters as a <token of kind 7> token.
****** FOUND A <token of kind 7> MATCH ( ) ******

<Range>Current character : 98 (98) at line 1 column 7
   No string literal matches possible.
   Starting NFA to match one of : { <token of kind 7>, <RANGE_QUOTED>, <RANGE_GOOP> }
<Range>Current character : 98 (98) at line 1 column 7
   Currently matched the first 1 characters as a <RANGE_GOOP> token.
   Possible kinds of longer matches : { <token of kind 7>, <RANGE_QUOTED>, <RANGE_GOOP> }
<Range>Current character : 93 (93) at line 1 column 8
   Currently matched the first 1 characters as a <RANGE_GOOP> token.
   Putting back 1 characters into the input stream.
****** FOUND A <RANGE_GOOP> MATCH (b) ******

<Range>Current character : 93 (93) at line 1 column 8
   No more string literal token matches are possible.
   Currently matched the first 1 characters as a "]" token.
****** FOUND A "]" MATCH (]) ******

Returning the <EOF> token.
```

Note: lexical state `<Range>`

"\[a\\\[\\\] TO b\]" <- this is the key one that should parse but doesn't

```
<DEFAULT>Current character : 91 (91) at line 1 column 1
   No more string literal token matches are possible.
   Currently matched the first 1 characters as a "[" token.
****** FOUND A "[" MATCH ([) ******

<Range>Current character : 97 (97) at line 1 column 2
   No string literal matches possible.
   Starting NFA to match one of : { <token of kind 7>, <RANGE_QUOTED>, <RANGE_GOOP> }
<Range>Current character : 97 (97) at line 1 column 2
   Currently matched the first 1 characters as a <RANGE_GOOP> token.
   Possible kinds of longer matches : { <token of kind 7>, <RANGE_QUOTED>, <RANGE_GOOP> }
<Range>Current character : 92 (92) at line 1 column 3
   Currently matched the first 2 characters as a <RANGE_GOOP> token.
   Possible kinds of longer matches : { <token of kind 7>, <RANGE_QUOTED>, <RANGE_GOOP> }
<Range>Current character : 91 (91) at line 1 column 4
   Currently matched the first 3 characters as a <RANGE_GOOP> token.
   Possible kinds of longer matches : { <token of kind 7>, <RANGE_QUOTED>, <RANGE_GOOP> }
<Range>Current character : 92 (92) at line 1 column 5
   Currently matched the first 4 characters as a <RANGE_GOOP> token.
   Possible kinds of longer matches : { <token of kind 7>, <RANGE_QUOTED>, <RANGE_GOOP> }
<Range>Current character : 93 (93) at line 1 column 6
   Currently matched the first 4 characters as a <RANGE_GOOP> token.
   Putting back 1 characters into the input stream.
****** FOUND A <RANGE_GOOP> MATCH (a\\[\\) ******

<Range>Current character : 93 (93) at line 1 column 6
   No more string literal token matches are possible.
   Currently matched the first 1 characters as a "]" token.
****** FOUND A "]" MATCH (]) ******
```

(Exception)

```
org.apache.lucene.queryparser.classic.ParseException: Cannot parse '[a\[\] TO b]': Encountered " "]" "] "" at line 1, column 5.
Was expecting:
    "TO" ...
```

## One Issue

Token def:
`| <RANGE_GOOP:   (~[ " ", "]", "}" ] | "\\" ~[] )+ >`
Test case:
`assertQueryEquals("[a\\\\ TO b]", a, "[a\\ TO b]")`
Error:

```
org.apache.lucene.queryparser.classic.ParseException: Cannot parse '[a\\ TO b]': Encountered " <RANGE_GOOP> "b "" at line 1, column 8.
Was expecting:
    "TO" ...
```

(so it parses `a\\ TO` as the first term)

Fixed token def:
`| <RANGE_GOOP:   (~[ "\\", " ", "]", "}" ] | "\\" ~[] )+ >`

Why _I think_ this works:
![[Drawing 2024-10-09 18.30.36.excalidraw|600]]

Debug code:

```
<DEFAULT>Current character : 91 (91) at line 1 column 1
   No more string literal token matches are possible.
   Currently matched the first 1 characters as a "[" token.
****** FOUND A "[" MATCH ([) ******

<Range>Current character : 97 (97) at line 1 column 2
   No string literal matches possible.
   Starting NFA to match one of : { <token of kind 7>, <RANGE_QUOTED>, <RANGE_GOOP> }
<Range>Current character : 97 (97) at line 1 column 2
   Currently matched the first 1 characters as a <RANGE_GOOP> token.
   Possible kinds of longer matches : { <RANGE_GOOP> }
<Range>Current character : 92 (92) at line 1 column 3
   Currently matched the first 2 characters as a <RANGE_GOOP> token.
   Possible kinds of longer matches : { <RANGE_GOOP> }
<Range>Current character : 92 (92) at line 1 column 4
   Currently matched the first 3 characters as a <RANGE_GOOP> token.
   Possible kinds of longer matches : { <RANGE_GOOP> }
<Range>Current character : 32 (32) at line 1 column 5
   Currently matched the first 4 characters as a <RANGE_GOOP> token.
   Possible kinds of longer matches : { <RANGE_GOOP> }
<Range>Current character : 84 (84) at line 1 column 6
   Currently matched the first 5 characters as a <RANGE_GOOP> token.
   Possible kinds of longer matches : { <RANGE_GOOP> }
<Range>Current character : 79 (79) at line 1 column 7
   Currently matched the first 6 characters as a <RANGE_GOOP> token.
   Possible kinds of longer matches : { <RANGE_GOOP> }
<Range>Current character : 32 (32) at line 1 column 8
   Currently matched the first 6 characters as a <RANGE_GOOP> token.
   Putting back 1 characters into the input stream.
****** FOUND A <RANGE_GOOP> MATCH (a\\\\ TO) ******

```

vs.

```
<DEFAULT>Current character : 91 (91) at line 1 column 1
   No more string literal token matches are possible.
   Currently matched the first 1 characters as a "[" token.
****** FOUND A "[" MATCH ([) ******

<Range>Current character : 97 (97) at line 1 column 2
   No string literal matches possible.
   Starting NFA to match one of : { <token of kind 7>, <RANGE_QUOTED>, <RANGE_GOOP> }
<Range>Current character : 97 (97) at line 1 column 2
   Currently matched the first 1 characters as a <RANGE_GOOP> token.
   Possible kinds of longer matches : { <RANGE_GOOP> }
<Range>Current character : 92 (92) at line 1 column 3
   Currently matched the first 1 characters as a <RANGE_GOOP> token.
   Possible kinds of longer matches : { <RANGE_GOOP> }
<Range>Current character : 92 (92) at line 1 column 4
   Currently matched the first 3 characters as a <RANGE_GOOP> token.
   Possible kinds of longer matches : { <RANGE_GOOP> }
<Range>Current character : 32 (32) at line 1 column 5
   Currently matched the first 3 characters as a <RANGE_GOOP> token.
   Putting back 1 characters into the input stream.
****** FOUND A <RANGE_GOOP> MATCH (a\\\\) ******
```

**Root question here:** how does JavaCC match tokens with `|`?

Simple JavaCC setup:

```
options {
    STATIC = false;  // To prevent JavaCC from generating static methods
    JAVA_UNICODE_ESCAPE=true;
    DEBUG_TOKEN_MANAGER=true;
}

PARSER_BEGIN(SimpleParser)
public class SimpleParser {
    public static void main(String[] args) throws ParseException {
        SimpleParser parser = new SimpleParser(System.in);  // System.in works directly
        parser.Input();
        System.out.println("Parsing successful!");
    }
}
PARSER_END(SimpleParser)

SKIP : {
    " " | "\t" | "\n" | "\r"
}

TOKEN : {
    <TEST: ( ~["a", " "] | "a" ~[] )+ >
}

void Input() :
{}
{
    <TEST> { System.out.println("Parsed token!"); }
}
```

Run:

```
java -cp javacc-7.0.12.jar javacc SimpleParser.jj
javac SimpleParser.java SimpleParserConstants.java SimpleParserTokenManager.java Token.java ParseException.java SimpleCharStream.java
java SimpleParser
```

Run some test cases like: "baa def", "bca def"

OK figured it out: JavaCC is an LL(k) parser (LL(1) by default):

- L: left to right
- L: leftmost derivation
  - `"a" | "b" | "c"` goes left to right
- k: lookahead k chars

It's an NFA checking options in parallel (internal `SimpleParserTokenManager` keeps a `jjstateSet` for state of each branch).

- At each character, it checks whether any of the paths (or states) are still valid and continues with those.
- If one path becomes invalid (e.g., it can no longer match the token), that path is discarded.

## Backwards compatibility

"[\\ TO abc]"

| Before                                                                                                                   | After                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| org.apache.lucene.queryparser.classic.ParseException: Cannot parse '[\ TO abc]': Term can not end with escape character. | org.apache.lucene.queryparser.classic.ParseException: Cannot parse '[\ TO abc]': Encountered " <RANGE_GOOP> "\\] "" at line 1, column 6.<br>Was expecting:<br> "TO" ... |

Range terms ending with an escape character used to throw different ParseException, now if:

- the first term ends in an escape character, it reads the following space as an escaped space, then the TO as a continuation of the first term - ParseException is for no TO
- the second term ends in an escape character, it reads the following closing bracket as an escaped bracket and thus part of the term - ParseException is for no ]
