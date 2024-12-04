---
title: Building a Bigger HNSW Graph
date: 2024-12-04
---

In my previous post, [Building an HNSW graph](/blog/20241121_building_an_hnsw_graph), I walked through building an HNSW graph from scratch, adding seven nodes in total over three layers. The example covered most the intricacies of HNSW insertion, notably:
- multiple levels
- entry point promotion
- the _**direction diversity heuristic**_
- pruning edges (when max degree is reached)

However, a few aspects remain unclear. First and foremost, how do we determine the “candidates” lists that I previously assumed were already known? Furthermore, how does the parameter called $efConst$ (or in Lucene: $beamWidth$) come into play? I'd like to wrap up these loose ends in this post. 

We'll start with more vectors, here's an expanded list: 

| label | π-radians |
| ----- | --------- |
| 0     | 0.5       |
| 1     | 0.75      |
| 2     | 0.2       |
| 3     | 0.9       |
| 4     | 0.8       |
| 5     | 0.77      |
| 6     | 0.6       |
| 7     | 0.1       |
| 8     | 0.3       |
| 9     | 0.37      |
| 10    | 0.95      |
| 11    | 0.25      |
| 12    | 0.7       |
| 13    | 0.45      |
| 14    | 0.02      |
| 15    | 0.66      |

<img src="/image/hnsw_more_vecs.png" alt="HNSW more vectors" style="width: 600px;">

I've added vectors 7-13 to the graph myself to get us started with a bigger graph (feel free to work through a couple insertions to test your understanding from the previous blog post). Here's the graph with nodes 0-13:

<img src="/image/hnsw13.png" alt="HNSW 13" style="width: 600px;">

Remember, the graph is built with parameters:
- $M = 2$: max node degree (at level 0, the max degree becomes $2M$)
	- $m_L = \frac{1}{ln(M)}$: normalization factor
- $efConst = 10$: number of candidates to track (this param is known as $beamWidth$ in Lucene)

Let's walk through the insertion of nodes 14 and 15.

## `insert(14)`

1. Stochastically determine the node's level using: 
$$\lfloor -\ln(unif(0,1)) \cdot m_L \rfloor$$

> Result: `nodeLevel = 0`

2. Add node to level 0.
3. Search from the entry point until we reach `nodeLevel`:
	1. Level 2:
		1. Current node is entry point 6. Consider the neighbors of 6: \[11\], are any closer (in terms of vector distance) to node 14? 
			1. 11: closer than 6, so travel to 11.
	2. Level 1:
		1. Current node is 11. Consider the neighbors of 11: \[0\], are any closer to node 14?
			1. 0: not closer than 11.
	3. Level 0 (the insertion `nodeLevel` - so we begin to look for neighbors).
		1. Current node is 11. We will keep track of two sets: $C$ (candidates) and $W$ (closest $efConst$ vectors). We add 11 to $C$ and $W$ and begin to process $C$ as a priority queue:
			1. Pop closest element (to 14) from $C$: 11. Add unseen neighbors \[2, 8\] to both sets. Now $C =$ \{2, 8\} and $W =$ \{11, 2, 8\}.
			2. Pop closest element (to 14) from $C$: 2. Add unseen neighbors \[7\] to both sets. Now $C =$ \{8, 7\} and $W =$ \{11, 2, 8, 7\}.
			3. Pop closest element (to 14) from $C$: 7. All neighbors have been seen. Now $C =$ \{8\}  and $W =$ \{11, 2, 8, 7\}.
			4. Pop closest element (to 14) from $C$: 8. Add unseen neighbors \[0, 9\] to both sets. Now $C =$ \{0, 9\} and $W =$ \{11, 2, 8, 7, 0, 9\}.
			5. Pop closest element (to 14) from $C$: 9. Add unseen neighbors \[13\] to both sets. Now $C =$ \{0, 13\} and $W =$ \{11, 2, 8, 7, 0, 9, 13\}.
			6. Pop closest element (to 14) from $C$: 13. All neighbors have been seen. Now $C =$ \{0\} and $W =$ \{11, 2, 8, 7, 0, 9, 13\}.
			7. Pop closest element (to 14) from $C$: 0. Add unseen neighbors \[6\] to both sets. Now $C =$ \{6\} and $W =$ \{11, 2, 8, 7, 0, 9, 13, 6\}.
			8. Pop closest element (to 14) from $C$: 6. Add unseen neighbors \[12\] to both sets. Now $C =$ \{12\} and $W =$ \{11, 2, 8, 7, 0, 9, 13, 6, 12\}.
			9. Pop closest element (to 14) from $C$: 12. Add unseen neighbors \[1\] to both sets. Now $C =$ \{1\} and $W =$ \{11, 2, 8, 7, 0, 9, 13, 6, 12, 1\}. _**Note**: $beamWidth = 10$ has been met as $|W| = 10$_.
			10. Pop closest element (to 14) from $C$: 1. Add unseen neighbors \[3, 4, 5\] to both sets. Now $C =$ \{3, 4, 5\} and $W =$ \{11, 2, 8, 7, 0, 9, 13, 6, 12, 1\} ($W$ is maxed out, and none of \[3, 4, 5\] are closer to 14 than the farthest from $W$: 1, so $W$ remains unchanged).
			11. Pop closest element (to 14) from $C$: 5. _**We stop** because $d(14, 5) > d(14, 1)$—1 being the farthest element in $W$._ 
4. Order $W$ from closest to farthest: \[7, 2, 11, 8, 9, 13, 0, 6, 12, 1\], _**this is our list of neighbor candidates**_.
5. Now, we add connections considering the closest 4 nodes.
	1. Level 0 (candidates from closest to farthest = \[7, 2, 11, 8\]):
		1. Add edge (14, 7).
		2. Add edge (14, 2)? No, because of the diverse directions heuristic—it's the same direction as node 7. 
		3. Add edge (14, 11)? No, it's the same direction as node 7.
		4. Add edge (14, 8)? No, it's the same direction as node 7.

<img src="/image/hnsw14.png" alt="HNSW 14" style="width: 600px;">

## `insert(15)`

1. Stochastically determine the node's level:

> Result: `nodeLevel = 0`

2. Add node to level 0.
3. Search from the entry point until we reach `nodeLevel`:
	1. Level 2:
		1. Current node is entry point 6. Consider the neighbors of 6: \[11\], are any closer (in terms of vector distance) to node 15? 
			1. 11: not closer than 6.
	2. Level 1:
		1. Current node is 6. Consider the neighbors of 6: \[0, 12\], are any closer to node 15?
			1. 0: not closer than 6.
			2. 12: closer than 6, so travel to 12.
	3. Level 0 (the insertion `nodeLevel` - so we begin to look for neighbors).
		1. Current node is 12. We will keep track of two sets: $C$ (candidates) and $W$ (closest $efConst$ vectors). We add 12 to $C$ and $W$ and begin to process $C$ as a priority queue:
			1. Pop closest element (to 15) from $C$: 12. Add unseen neighbors \[1, 6\] to both sets. Now $C =$ \{1, 6\} and $W =$ \{12, 1, 6\}.
			2. Pop closest element (to 15) from $C$: 6. Add unseen neighbors \[0\] to both sets. Now $C =$ \{1, 0\} and $W =$ \{12, 1, 6, 0\}.
			3. Pop closest element (to 15) from $C$: 1. Add unseen neighbors \[3, 4, 5\] to both sets. Now $C =$ \{0, 3, 4, 5\} and $W =$ \{12, 1, 6, 0, 3, 4, 5\}.
			4. Pop closest element (to 15) from $C$: 5. All neighbors have been seen. Now $C =$ \{0, 3, 4\} and $W =$ \{12, 1, 6, 0, 3, 4, 5\}.
			5. Pop closest element (to 15) from $C$: 4. All neighbors have been seen. Now $C =$ \{0, 3\} and $W =$ \{12, 1, 6, 0, 3, 4, 5\}.
			6. Pop closest element (to 15) from $C$: 0. Add unseen neighbors \[8, 9, 13\] to both sets. Now $C =$ \{3, 8, 9, 13\} and $W =$ \{12, 1, 6, 0, 3, 4, 5, 8, 9, 13\}. _**Note**: $beamWidth = 10$ has been met as $|W| = 10$_.
			7. Pop closest element (to 15) from $C$: 13. All neighbors have been seen. Now $C =$ \{3, 8, 9\} and $W =$ \{12, 1, 6, 0, 3, 4, 5, 8, 9, 13\}.
			8. Pop closest element (to 15) from $C$: 3. Add unseen neighbors \[10\] to both sets. Now $C =$ \{8, 9, 10\} and $W =$ \{12, 1, 6, 0, 3, 4, 5, 9, 13, 10\} ($W$ is maxed out, but 10 is closer to 15 than 8, so we remove 8 and add 10).
			9. Pop closest element (to 15) from $C$: 9. All neighbors have been seen. Now $C =$ \{8, 10\} and $W =$ \{12, 1, 6, 0, 3, 4, 5, 9, 13, 10\}.
			10. Pop closest element (to 15) from $C$: 10. All neighbors have been seen. Now $C =$ \{8\} and $W =$ \{12, 1, 6, 0, 3, 4, 5, 9, 13, 10\}.
			11. Pop closest element (to 15) from $C$: 8. _**We stop** because $d(15, 8) > d(15, 10)$—10 being the farthest element in $W$._ 
4. Order $W$ from closest to farthest: \[12, 6, 1, 5, 4, 0, 13, 3, 9, 10\], _**this is our list of neighbor candidates**_.
5. Now, we add connections considering the closest 4 nodes.
	1. Level 0 (candidates from closest to farthest = \[12, 6, 1, 5\]):
		1. Add edge (15, 12).
		2. Add edge (15, 6)? Yes, it's diverse because $d(12, 6) > d(15, 6)$.
		3. Add edge (15, 1)? No, it's the same direction as node 12.
		4. Add edge (15, 5)? No, it's the same direction as node 12.

<img src="/image/hnsw15.png" alt="HNSW 15" style="width: 600px;">

---

To summarize: when inserting a node, we greedy search down the the level of insertion, then do a sort of BFS to determine a set of candidate neighbors. Our results are capped by the $efConst$ / $beamWidth$ parameter. From there, we proceed with edge creation as described in my previous blog post.

I hope this example clarified the process of HNSW insertion. I haven't explicitly discussed the actual search algorithm, but it's no different than the traversal done down the levels 2 and 1 in these insertion examples. It's simply a greedy search—follow the best neighbor to a local minimum, then step down a level.