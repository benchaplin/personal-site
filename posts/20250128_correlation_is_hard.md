---
title: Correlation is Hard 
date: 2025-01-28
---

I came across an interesting problem the other day: 

>Given some data, generate a filter with parameters: $s$ (selectivity) and $c$ (correlation).

- By "filter" I mean a binary function over the data points, determining whether each is "filtered" or not.
- By "selectivity" I mean the fraction of data points which pass the filter.
- By "correlation" I mean some notion of whether larger data values are filtered (negative correlation) or smaller data values are filtered (positive correlation).

<img src="/image/correlation1.svg" alt="correlations" style="width: 600px;">

Let's get some more mathematical definitions:
- Let $D \subset [0, 1]$ be our data set.
- Let $B: D \rightarrow \{0, 1\}$ be our filter function,
	- where $B(d \in D) = 0$ means $d$ is "filtered,"
	- and $B(d \in D) = 1$ means $d$ is "not filtered."
- Then our selectivity $s$:
$$s = \frac{\displaystyle\sum_{i = 0}^{|D|} B(d_i)}{|D|} \text{ where } d_i \in D$$

How should we define correlation? There are several options out there, but one that immediately makes sense to me is something like:
$$ c = \frac{\mathbb{E}[d \mid B(d) = 1]}{\mathbb{E}[d]}$$
A ratio of the (mean of the unfiltered data) to the (mean of all the data). This definition gives $0 \leq c \leq 1$. I prefer a definition where $-1 \leq c \leq 1$, so let's normalize it:
$$c_{\text{norm}} = \frac{\mathbb{E}[d \mid B(d)] - \mathbb{E}[d]}{\mathbb{E}[|d - \mathbb{E}[d]|]}$$

Alright, we've got a sense of things here. So how do we generate this filter to match a given $s$ & $c$? My first thought was by using some probability density function. We'd want the area beneath the curve to equal $s$, and the correlation to match one of our definitions. I went looking for some curves, for instance the [log-normal distribution](https://en.wikipedia.org/wiki/Log-normal_distribution), which skews to only ever contain positive numbers, something I needed for particularly extreme correlations. Not only did those look difficult to make work for both of my parameters, I soon realized my data was not particularly uniform, so even if the area under the curve was 0.5, $s$ might be significantly different.

I needed a numeric approach. I thought—what filter would give us the absolute lowest/highest correlation values? Well, we could simply set the correct fraction ($s$) of the smallest/largest data points. That minimizes/maximizes both definitions of $c$, so let's just call them correlation -1 and correlation 1:

<img src="/image/correlation2.svg" alt="max/min correlations" style="width: 600px;">

We can redefine correlation one last time to make this work, so if the maximum $c_{\text{norm}} = 0.6$ (when we set all of the largest data points), and we want a $c_{\text{norm}} = 0.5$, then $c_{\text{weighted-norm}} = 0.3$. 
$$c_{\text{weighted-norm}} = c_{\text{norm}} \cdot \text{max}(c_{\text{norm}})$$

## Approach 1

A numeric approach was beginning to appear to me: let's start at the left case for $c < 0$ and the right case for $c > 0$, then weaken it somehow. My first thought was to shift the mass itself, and maybe randomize it a bit by sprinkling some stochastic selections in there as well. So an input of $(D, c = -0.5, s = 0.25)$ would go something like:

<img src="/image/correlation3.svg" alt="correlation shift with randomization" style="width: 600px;">

We achieve the desired correlation by shifting and randomizing in batches, measuring correlation as we go and comparing to the target $c_{\text{weighted-norm}}$ (you can check out an example of this algorithm here: https://github.com/benchaplin/corrselect-filter).

## Approach 2

One thing I don't love about "Approach 1" is what happens as correlation approaches 0 (left graph below). What I really want for a "zero correlation" is a uniformly random filter of size $s$ over the data set (right graph below).

<img src="/image/correlation4.svg" alt="two filters with correlation 0" style="width: 600px;">

The mean-centric correlation definition I've been using sees no difference between these two options. But a better correlation definition would, because there is definitely some form of correlation going on in the left picture. 

But I like the "vertical column" approach because it does capture the "absolute" worst/best correlation for $c = \pm 1$. So what we need is something that morphs nicely between -1 to 0 to 1, capturing everything I want:

<img src="/image/correlation5.svg" alt="ideal correlation evolution"  style="width: 600px;">

An fun side problem is finding the equation of a line that does this continuously (parameterized by $c$) keeping:
$$\int_{0}^{1} f(c, s) = s \qquad \forall s \in (0, 1), c \in [-1, 1]$$
But again, our data isn't uniform so best to continue with the numeric approach.

Here's what I settled on:
1. Again: 
	1. For $c < 0$, start with the $s$ fraction of the smallest data points
	2. For $c > 0$, start with the $s$ fraction of the largest data points
2. Clear $(1 - |c|)$ of the set points.
3. Set $(1 - |c|)$ unset points randomly over the entire data set.

For example ($s = 0.25, c = -0.6$):

<img src="/image/correlation6.svg" alt="filter build example" style="width: 800px;">

This way, as correlation goes from -1 to 0 to 1, we'll see filters looking like this:

<img src="/image/correlation7.svg" alt="approach 2 over correlations" style="width: 800px;">

## Smooth it out?

For my application, I was happy enough with "Approach 2," so I left it there. However, if one wanted to avoid steep probability "drop-offs" (in my diagrams: where blue ends), I think this could be extended to "step down" some number of times to appear more like the smooth curves we looked at in the beginning of this post.

<img src="/image/correlation8.svg" alt="smoother approach"  style="width: 600px;">

Something to try in the future :).

