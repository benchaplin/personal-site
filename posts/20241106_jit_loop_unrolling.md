---
title: Just-in-time Loop Unrolling
date: 2024-11-06
---

I was reading [some Lucene code](https://github.com/apache/lucene/blob/12ca4779b962c96367f3e6a8b06523837e5e6434/lucene/core/src/java/org/apache/lucene/internal/vectorization/DefaultVectorUtilSupport.java#L38) the other day and came across a technique I'd never seen before:

```java
public float dotProduct(float[] a, float[] b) {  
    float res = 0f;  
    int i = 0;  
    
    // if the array is big, unroll it  
    if (a.length > 32) {  
        float acc1 = 0;  
        float acc2 = 0;  
        float acc3 = 0;  
        float acc4 = 0;  
        int upperBound = a.length & ~(4 - 1);  
        for (; i < upperBound; i += 4) {  
            acc1 = fma(a[i], b[i], acc1);  
            acc2 = fma(a[i + 1], b[i + 1], acc2);  
            acc3 = fma(a[i + 2], b[i + 2], acc3);  
            acc4 = fma(a[i + 3], b[i + 3], acc4);  
        }  
        res += acc1 + acc2 + acc3 + acc4;  
    }  
    
    for (; i < a.length; i++) {  
        res = fma(a[i], b[i], res);  
    }  
    return res;  
}
```

It looks a bit like the dot product method I'd expect:

```java
public float plainDotProduct(float[] a, float[] b) {
    float res = 0f;

    for (int i = 0; i < a.length; i ++) {
        res = fma(a[i], b[i], res); // fma does (a[i] * b[i]) + res
    }

    return res;
}
```

But the first method does the accumulation in chunks of four. I imagined this must be a performance enhancement, but it wasn't clear to me why. The downside is more clear—the first method requires more memory to store `acc1, acc2, acc3, acc4` alongside `res`. Runtime is of course still *O(n)*. It also involves more code. So what's the point?

I love chatbots for this stuff. I can just paste in the method and get an explanation specific to this code. Ah—this is called [loop unrolling](https://en.wikipedia.org/wiki/Loop_unrolling) (I guess I could have figured that out from the comment). What's the benefit? Wikipedia makes it clear: 

>The goal of loop unwinding is to increase a program's speed by reducing or eliminating instructions that control the loop, such as pointer arithmetic and "end of loop" tests on each iteration.

So we're reducing the "overhead" of loops. A for-loop in assembly looks something like this:

```
    xor eax, eax               ; i = 0
loop_start:
    cmp eax, ecx               ; compare i with array length
    jge loop_end               ; if i >= length, exit the loop

    <loop body>

    inc eax                    ; increment i
    jmp loop_start             ; jump back to the start of the loop
loop_end:
```

The `cmp, inc, jmp` instructions represent the overhead—the instructions that run on each loop iteration. Unrolling a loop with a factor of 4 (as the aforementioned `dotProduct` method does) means 1/4 the number of overhead instructions. Does that always mean a faster program? Well, not necessarily, CPUs take advantage of [instruction-level parallelism](https://en.wikipedia.org/wiki/Instruction-level_parallelism), so loop unrolling must parallelize somewhat efficiently to reduce CPI (cycles per instruction). Another thing to consider is cache behavior. But let's not get bogged down—loop unrolling can certainly speed up execution depending on the setting.

## The HotSpot JIT compiler

I don't know much about compiler optimizations, but learning about loop unrolling made me wonder if something like a JVM's JIT compiler would ever do loop unrolling automatically. Turns out it does—check out mentions of the term "unroll" in the [HotSpot's JIT compiler loop optimizations](https://github.com/openjdk/jdk/blob/4431852/src/hotspot/share/opto/loopTransform.cpp). In short, this JIT uses a number of heuristics to decide whether to unroll a loop. 

### Installing hsdis

I decided I wanted to see for myself. Let's walk through building the JVM from OpenJDK source and using a tool called **hsdis (HotSpot Disassembler)** to inspect the native JIT-compiled code as human-readable assembly. I couldn't get hsdis to load into the JVM on my Mac—security policies I think. So I used a Debian box. Let's get started.

1. hsdis needs a backend—I'll be using binutils-2.43.

```
curl -Lo binutils-2.43.tar.gz https://ftp.gnu.org/gnu/binutils/binutils-2.43.tar.gz
tar xvf binutils-2.43.tar.gz
```

2. Check out OpenJDK: https://github.com/openjdk/jdk. You'll need another JDK installed to act as a "boot JDK"—I used: `sudo apt install zulu<jdk-version>-jdk`.
3. Configure the repo for hsdis with binutils.

```
cd jdk
bash configure --with-hsdis=binutils --with-binutils-src=path/to/binutils-2.43
```

4. Build and install hsdis.

```
make build-hsdis
make install-hsdis
```

5. Verify the build. Look in `jdk/build/linux-x86_64-server-release/images/jdk`:
    1. `lib` should contain `hsdis-amd64.so`
    2. `bin` should contain `javac` and `java`—we'll be using these to run our program

### JIT loop unrolling in action

Alright, time to write some code. Let's see if we can get the JIT compiler unrolling that `plainDotProduct` method.

```java
public class DotProduct {

    public static void main(String[] args) {
        int size = 1000;
        float[] vectorA = new float[size];
        float[] vectorB = new float[size];

        for (int i = 0; i < size; i++) {
            vectorA[i] = (float) Math.random();
            vectorB[i] = (float) Math.random();
        }

        // Call a lot to allow JIT optimizations
        int warmupIterations = 10_000;
        for (int i = 0; i < warmupIterations; i++) {
            plainDotProduct(vectorA, vectorB);
        }
    }

    public static float plainDotProduct(float[] a, float[] b) {
        float res = 0f;

        for (int i = 0; i < a.length; i ++) {
            res += a[i] * b[i];
        }

        return res;
    }
}
```

The HotSpot JIT compiler will only optimize a method if it's called enough, so I've set 10,000 calls to `plainDotProduct`. We can use the following flags to print assembly code for `DotProduct::plainDotProduct`.

```
../java -XX:+UnlockDiagnosticVMOptions -XX:PrintAssemblyOptions=intel -XX:CompileCommand=print,DotProduct::plainDotProduct -XX:LoopUnrollLimit=1 DotProduct
```
Note: I've tacked on `-XX:LoopUnrollLimit=1`—preventing loop unrolling so that we can see the code before it's optimized.

Scroll down to the "C2-compiled nmethod" assembly. Let's check it out (I've removed most instructions to keep things brief—note the `...`s):

```
[Verified Entry Point]
  # {method} {0x00007f648c4003b8} 'plainDotProduct' '([F[F)F' in 'DotProduct'
  # parm0:    rsi:rsi   = '[F'     ; rsi holds the first parameter, vector a
  # parm1:    rdx:rdx   = '[F'     ; rdx holds the second parameter, vector b
  
  ...

  ; Main loop (dot product)
  0x00007f64dff62401:   vmovss xmm2,DWORD PTR [rsi+rcx*4+0x10]  ; load element from vector a
  0x00007f64dff62407:   vmulss xmm1,xmm2,DWORD PTR [rdx+rcx*4+0x10] ; multiply with corresponding element from vector b
  0x00007f64dff6240d:   vaddss xmm0,xmm0,xmm1              ; accumulate product into xmm0
  0x00007f64dff62411:   inc    ecx                         ; increment loop counter
  0x00007f64dff62413:   cmp    ecx,r10d                    ; compare counter to loop end
  0x00007f64dff62416:   jl     0x00007f64dff62401          ; loop if not finished

  ...
  
  0x00007f64dff6283f:   hlt
```

Alright, we've our dot product loop with work being done by the AVX instructions: `vmovss, vmulss, vaddss` and the aforementioned "loop overhead" of `inc, cmp, jl`. Let's remove the `-XX:LoopUnrollLimit=1` now and let this thing go wild.

```
../java -XX:+UnlockDiagnosticVMOptions -XX:PrintAssemblyOptions=intel -XX:CompileCommand=print,DotProduct::plainDotProduct DotProduct
```

```
[Verified Entry Point]
  # {method} {0x00007f648c4003b8} 'plainDotProduct' '([F[F)F' in 'DotProduct'
  # parm0:    rsi:rsi   = '[F'     ; rsi holds the first parameter, vector a
  # parm1:    rdx:rdx   = '[F'     ; rdx holds the second parameter, vector b
  
  ...

  ; Main loop (dot product)
  0x00007fd7cff62748:   vmovdqu ymm1,YMMWORD PTR [rdx+rcx*4+0x10]
  0x00007fd7cff6274e:   vmulps ymm1,ymm1,YMMWORD PTR [rsi+rcx*4+0x10]
  0x00007fd7cff62754:   vaddss xmm0,xmm0,xmm1
  0x00007fd7cff62758:   vpshufd xmm2,xmm1,0x1
  0x00007fd7cff6275d:   vaddss xmm0,xmm0,xmm2
  0x00007fd7cff62761:   vpshufd xmm2,xmm1,0x2
  0x00007fd7cff62766:   vaddss xmm0,xmm0,xmm2
  0x00007fd7cff6276a:   vpshufd xmm2,xmm1,0x3
  0x00007fd7cff6276f:   vaddss xmm0,xmm0,xmm2
  0x00007fd7cff62773:   vextractf128 xmm2,ymm1,0x1
  0x00007fd7cff62779:   vaddss xmm0,xmm0,xmm2
  0x00007fd7cff6277d:   vpshufd xmm3,xmm2,0x1
  0x00007fd7cff62782:   vaddss xmm0,xmm0,xmm3
  0x00007fd7cff62786:   vpshufd xmm3,xmm2,0x2
  0x00007fd7cff6278b:   vaddss xmm0,xmm0,xmm3
  0x00007fd7cff6278f:   vpshufd xmm3,xmm2,0x3
  0x00007fd7cff62794:   vaddss xmm0,xmm0,xmm3
  0x00007fd7cff62798:   add    ecx,0x8                     ; increment loop by the unrolling factor (8)
  0x00007fd7cff6279b:   cmp    ecx,r11d                    ; compare counter to loop end
  0x00007fd7cff6279e:   jl     0x00007fd7cff62748          ; loop if not finished
  0x00007fd7cff627a0:   cmp    ecx,ebp                     ; check for leftovers
  0x00007fd7cff627a2:   jge    0x00007fd7cff627ba
  ; Capture the leftovers
  0x00007fd7cff627a4:   vmovss xmm2,DWORD PTR [rsi+rcx*4+0x10]
  0x00007fd7cff627aa:   vmulss xmm1,xmm2,DWORD PTR [rdx+rcx*4+0x10]
  0x00007fd7cff627b0:   vaddss xmm0,xmm0,xmm1
  0x00007fd7cff627b4:   inc    ecx
  0x00007fd7cff627b6:   cmp    ecx,ebp
  0x00007fd7cff627b8:   jl     0x00007fd7cff627a4
  
  ...
  
  0x00007f64dff6283f:   hlt
```

HotSpot loop unrolled with a factor of 8 (we could try to count the chunks of vector operations or simply note the loop increment is doing a `+= 8`)! Also, recognize the extra loop after the `jge` instruction? That serves the same purpose as the [second for-loop](https://github.com/apache/lucene/blob/12ca4779b962c96367f3e6a8b06523837e5e6434/lucene/core/src/java/org/apache/lucene/internal/vectorization/DefaultVectorUtilSupport.java#L58) in the original Lucene `dotProduct`—if we loop unroll by a factor of `n`, the remainder of `length / n` will need to be computed outside of the unrolled loop. 

*Note: if you want to avoid the AVX instructions inherent in this vector example, try writing a method that simply increments a sum with a random number in a loop. That should be unrolled similarly, but result in simpler assembly.*

---

For me, that kind of investigation is deeply satisfying. *This unrolling is supposed to happen, huh? Well, show me.* I'm left with the question, though—why implement loop unrolling manually if the JIT compiler will just do it for me when I need it? I'm not sure the answer. I suppose you might want performance enhancements in a particular JVM without a JIT compiler, or a JIT compiler that doesn't do loop unrolling. Maybe you want fine-grained control over the "warm-up" before unrolling, or the unrolling factor? Let me know if you have any thoughts!
