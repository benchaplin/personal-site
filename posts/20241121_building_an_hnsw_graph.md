---
title: Building an HNSW Graph
date: 2024-11-21
---

I often get overconfident when learning a new concept. Sometimes, I think I'm assuming the confidence of my teacher. Whether that teacher is a human, a textbook, or a blog post, if it explains a concept confidently, I can sort of inherit that confidence. Of course it's an illusion—their confidence is backed by experience, time, etc. Mine is imagined. My knowledge won't hold up when tested.

Recently, I've been learning about [Hierarchical Navigable Small World (HNSW) graphs](https://en.wikipedia.org/wiki/Hierarchical_navigable_small_world), and I've had some great teachers:
- The [original paper](https://arxiv.org/abs/1603.09320) where the method is published is well-written for a novice like me.
- Third party sources like [this one](https://github.com/brtholomy/hnsw) and [this one](https://www.pinecone.io/learn/series/faiss/hnsw/) simplify the concepts and give some illuminating context.

In order to test my knowledge and build some real confidence, I worked out a couple examples. I figured I'd share one on how an HNSW is built. Maybe it'll be useful for someone out there learning about HNSW graphs. "Teaching" (kinda) this also solidifies my own understanding. So here we go.

I've been interested in HNSWs in the context of [Lucene](https://lucene.apache.org/), so I'll be referring to its implementation of HNSWs (my example actually builds on [this specific test](https://github.com/apache/lucene/blob/6fe8165/lucene/core/src/test/org/apache/lucene/util/hnsw/HnswGraphTestCase.java#L740)). Lucene's algorithms differ from the original HNSW paper in a few ways, the most notable being that Lucene treats an HNSW as a directed graph, whereas the paper implies it is undirected. However, I'll set aside that detail for simplicity.

We'll be working with the following vectors on the unit circle:

| label | π-radians | x-value | y-value |
| ----- | ------- | ------- | ------- |
| 0     | 0.5     | 0       | 1       |
| 1     | 0.75    | -0.71   | 0.71    |
| 2     | 0.2     | 0.81    | 0.59    |
| 3     | 0.9     | -0.95   | 0.31    |
| 4     | 0.8     | -0.81   | 0.59    |
| 5     | 0.77    | -0.75   | 0.66    |
| 6     | 0.6     | -0.31   | 0.95    |

<img src="/image/hnsw_vecs.png" alt="HNSW vectors" style="width: 600px;">

Now we'll build an HNSW by inserting vectors one by one, in order of label. We'll use the parameters:
- $M = 2$: max node degree (at level 0, the max degree becomes $2M$)
	- $m_L = \frac{1}{ln(M)}$: normalization factor
- $efConst = 10$: number of candidates to track (this param is known as $beamWidth$ in Lucene)

## `insert(0)`

1. Stochastically determine the node's level using:
$$\lfloor -\ln(unif(0,1)) \cdot m_L \rfloor$$

<img src="/image/hnsw_level_fn.png" alt="HNSW level function" style="width: 600px;">

> Result: `nodeLevel = 1`

2. Add node from `nodeLevel` down to level 0:
	1. Because this is the first node on the top level, mark it as the "entry point" (blue).

<img src="/image/hnsw0.png" alt="HNSW 0" style="width: 600px;">

## `insert(1)`

1. Again, stochastically determine the node's level using the same function. 

> Result: `nodeLevel = 0` 

2.  Add node to level 0.
3. Search from the entry point until we reach `nodeLevel`, then add connections considering the closest $2M = 4$ nodes.
	1. Level 0:
		1. Add edge (1, 0).

<img src="/image/hnsw1.png" alt="HNSW 1" style="width: 600px;">

## `insert(2)`

1. Stochastically determine the node's level.

> Result: `nodeLevel = 0`

2. Add node to level 0.
3. Search from the entry point until we reach `nodeLevel`, then add connections considering the closest $2M = 4$ nodes. When adding connections, use the _**direction diversity heuristic:** add only if the potential neighbor is closer to the new node than any of the new node's existing neighbors._
	1. Level 0: 
		1. Add edge (2, 0).
		2. Add edge (2, 1)? No, because $d(0, 1) < d(2, 1)$.

<img src="/image/hnsw2.png" alt="HNSW 2" style="width: 600px;">

## `insert(3)`

1. Stochastically determine the node's level.

> Result: `nodeLevel = 1`

2. Add the node from `nodeLevel` down to level 0.
3. Search from the entry point until we reach `nodeLevel`, then for each level below, add connections considering the closest 2 (level > 0) / 4 (level 0) nodes.
	1. Level 1: 
		1. Add edge (3, 0).
	2. Level 0 (candidates from closest to farthest = \[1, 0, 2\]):
		1. Add edge (3, 1).
		2. Add edge (3, 0)? No, because of the diverse directions heuristic: $d(1, 0) < d(3, 0)$.
		3. Add edge (3, 2)? No, because of the diverse directions heuristic: $d(1, 2) < d(3, 2)$.

<img src="/image/hnsw3.png" alt="HNSW 3" style="width: 600px;">

## `insert(4)`

1.  Stochastically determine the node's level.

> Result: `nodeLevel = 0`

2. Add node to level 0.
3. Search from the entry point until we reach `nodeLevel`, then add connections considering the closest 4 nodes.
	1. Level 0 (candidates from closest to farthest = \[1, 3, 0, 2\]):
		1. Add edge (4, 1).
		2. Add edge (4, 3)? Yes, it's diverse because: $d(1, 3) > d(4, 3)$. 
		3. Add edge (4, 0)? No, because: $d(1, 0) < d(4, 0)$.
		4. Add edge (4, 2)? No, because: $d(1, 2) < d(4, 2)$.

<img src="/image/hnsw4.png" alt="HNSW 4" style="width: 600px;">

## `insert(5)`

1. Stochastically determine the node's level.

> Result: `nodeLevel = 1`

2. Add the node from `nodeLevel` down to level 0.
3. Search from the entry point until we reach `nodeLevel`, then for each level below, add connections considering the closest 2 (level > 0) / 4 (level 0) nodes.
	1. Level 1 (candidates from closest to farthest = \[3, 0\]):
		1. Add edge (5, 3).
		2. Add edge (5, 0)? Yes, it's diverse because: $d(3, 0) > d(5, 0)$.
	2. Level 0 (candidates from closest to farthest = \[1, 4, 3, 0, 2\]):
		1. Add edge (5, 1).
		2. Add edge (5, 4)? Yes, it's diverse because $d(1, 4) > d(5, 4)$.
		3. Add edge (5, 3)? No, it's the same direction as node 4.
		4. Add edge (5, 0)? No, it's the same direction as node 1.
		5. Add edge (5, 2)? No, it's the same direction as node 1.

<img src="/image/hnsw5.png" alt="HNSW 5" style="width: 600px;">

## `insert(6)`

1. Stochastically determine the node's level.

> Result: `nodeLevel = 2` - ***new level alert!***

2. Add the node from `nodeLevel` down to level 0.
	1. Because this is the first node on the top level, mark it as the "entry point" (blue).
3. Search from the entry point until we reach `nodeLevel`, then for each level below, add connections considering the closest 2 (level > 0) / 4 (level 0) nodes.
	1. Level 1 (candidates from closest to farthest = \[0, 5, 3\])
		1. Add edge (6, 0).
			1. Now node 0 has more than $M = 2$ edges, we need to remove the _**least diverse:** the farthest non-diverse neighbor._ Consider the neighbors as candidates and order them closest to farthest = \[6, 5, 3\].
				1. 6 is diverse.
				2. 5 is not diverse.
				3. 3 is the **_farthest_** not diverse, so remove (0, 3).
		2. Add edge (6, 5)? Yes, it's diverse compared to 0.
			1. Now node 5 has more than $M = 2$ edges, we need to remove the least diverse. The neighbors (closest to farthest) = \[3, 6, 0\]
				1. 3 is diverse.
				2. 5 is diverse.
				3. 0 is the farthest not diverse, so remove (5, 0).
		3. Add edge (6, 3)? No, it's the same direction as 5.
	2. Level 0 (candidates from closest to farthest = \[0, 1, 5, 4, 3, 2\])
		1. Add edge (6, 0).
		2. Add edge (6, 1)? Yes, it's diverse compared to 0.
			1. Now node 1 has more than $2M = 4$ edges, we need to remove the least diverse. Consider the neighbors as candidates and order them closest to farthest = \[5, 4, 6, 3, 0\]
				1. 5 is diverse.
				2. 4 is not diverse.
				3. 6 is diverse.
				4. 3 is not diverse.
				5. 0 is the farthest not diverse, so remove (1, 0).
		3. Add edge (6, 5)? No, it's the same direction as 1.
		4. Add edge (6, 4)? No, it's the same direction as 1.
		5. Add edge (6, 3)? No, it's the same direction as 1.
		6. Add edge (6, 2)? No, it's the same direction as 0.

<img src="/image/hnsw6.png" alt="HNSW 6" style="width: 600px;">

---

And that's it! This example covers most of the intricacies of the HNSW insertion algorithm, including:
- multiple levels
- entry point promotion
- the _**direction diversity heuristic**_
- pruning edges (when max degree is reached)

One parameter we never dealt with was $efConst/beamWidth$ which was set to 10, and thus never maxed out. This is a limit on the number of "candidates" to consider. Once there are greater than 10 nodes on a level, we'd need to formalize this "search from the entry point" step to understand how candidates are selected in order to figure out which 10 to choose. This is getting long, so I'll save that for another post.