"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import localFont from "next/font/local";
import { motion, AnimatePresence, useScroll, useTransform } from "motion/react";
import { cn } from "@/lib/utils";
import { TextAnimate } from "@/components/ui/animated-text"
import Link from "next/link";
import Logo from "@/components/logo";
import { ReactLenis } from "lenis/react";
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

const font2 = localFont({
  src: "../components/fonts/Regular.woff",
});

const heroImages = [
  {
    src: "/hero/king.png",
    alt: "King chess piece",
    rowX: "calc(-50% - 30vw)",
    finalX: "calc(-50% - 26vw)",
    finalY: "calc(-50% - 25vh)",
    rotate: -8,
    size: "clamp(90px, 18vw, 260px)",
    floatY: -18,
  },
  {
    src: "/hero/trophy.png",
    alt: "Trophy",
    rowX: "calc(-50% - 10vw)",
    finalX: "calc(-50% - 33vw)",
    finalY: "calc(-50% + 18vh)",
    rotate: 7,
    size: "clamp(100px, 20vw, 290px)",
    floatY: 14,
  },
  {
    src: "/hero/skull.png",
    alt: "Skull",
    rowX: "calc(-50% + 10vw)",
    finalX: "calc(-50% + 28vw)",
    finalY: "calc(-50% - 23vh)",
    rotate: 8,
    size: "clamp(100px, 19vw, 280px)",
    floatY: -15,
  },
  {
    src: "/hero/solana.png",
    alt: "Solana coin",
    rowX: "calc(-50% + 30vw)",
    finalX: "calc(-50% + 33vw)",
    finalY: "calc(-50% + 26vh)",
    rotate: -9,
    size: "clamp(105px, 22vw, 340px)",
    floatY: 18,
  },
];

const Stairs = ({ status, onComplete }: { status: string; onComplete: () => void }) => {
  const bars = 8;
  const overlapPx = 2;
  return (
    <div className="fixed inset-0 z-[100] flex pointer-events-none overflow-hidden">
      {[...Array(bars)].map((_, i) => (
        <motion.div
          key={i}
          className="h-[105vh] bg-black relative flex-none will-change-transform"
          initial={{ y: "100%" }}
          animate={
            status === "transitioning" || status === "hero"
              ? { y: ["100%", "0%", "-100%"] }
              : { y: "100%" }
          }
          transition={{
            duration: 1.5,
            times: [0, 0.5, 1],
            ease: [0.76, 0, 0.24, 1],
            delay: 0.05 * i,
          }}
          style={{
            marginLeft: i === 0 ? "0" : `-${overlapPx}px`,
            width: `calc(${100 / bars}% + ${overlapPx}px)`,
          }}
          onAnimationComplete={i === bars - 1 ? onComplete : undefined}
        />
      ))}
    </div>
  );
};

const ScrollTransition = () => {
  const containerRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { scrollYProgress } = useScroll({
    target: mounted ? containerRef : undefined,
    offset: ["start start", "end end"],
  });

  const scale = useTransform(scrollYProgress, [0, 0.4], [1, 0.5]);
  const containerPadding = useTransform(scrollYProgress, [0, 0.4], ["2.5rem", "0rem"]);
  const containerBorderRadius = useTransform(scrollYProgress, [0, 0.4], ["0.75rem", "0rem"]);
  const contentOpacity = useTransform(scrollYProgress, [0.3, 0.6], [0, 1]);
  
  const py = useTransform(scrollYProgress, [0.4, 0.6], ["0rem", "1.25rem"]);
  const px = useTransform(scrollYProgress, [0.4, 0.6], ["0rem", "0.75rem"]);
  const borderWidth = useTransform(scrollYProgress, [0.4, 0.6], [0, 1]);

  return (
    <div ref={containerRef} className="relative h-[250vh] bg-black">
      <div className="sticky top-0 h-screen overflow-hidden">
        <motion.div 
          style={{ padding: containerPadding }}
          className="h-full w-full"
        >
          <motion.div 
            className="h-full w-full bg-white flex items-center justify-center relative"
            style={{ borderRadius: containerBorderRadius }}
          >
            <motion.div 
              className="flex flex-col items-center justify-center z-10"
              style={{ scale }}
            >
              <motion.h1 
                className={cn(
                  "text-7xl font-black text-center leading-tight",
                  font2.className
                )}
                style={{ 
                  color: "#000",
                  borderWidth,
                  borderStyle: "solid",
                  borderColor: "rgba(0,0,0,0.1)",
                  paddingTop: py,
                  paddingBottom: py,
                  paddingLeft: px,
                  paddingRight: px,
                  borderRadius: "0.5rem"
                }}
              >
                Your Knowledge <br /> Has Value
              </motion.h1>
            </motion.div>

            {/* Section 3 Content - Fading in */}
            <motion.div 
              className="absolute inset-0 flex items-center justify-center gap-10 px-10 py-5"
              style={{ opacity: contentOpacity }}
            >
              <div className="flex flex-col gap-5">
                <div className="border border-black/10 h-64 w-72 rounded-2xl px-6 py-8 bg-black/[0.02] flex flex-col items-center text-center">
                  <div className="h-32 w-32">
                    <DotLottieReact src="/animation/Bulb Idea Setting.lottie" loop autoplay />
                  </div>
                  <h1 className="font-black text-2xl leading-none mt-auto">Create or<br/>Join Match</h1>
                </div>
                <div className="border border-black/10 h-64 w-72 rounded-2xl px-6 py-8 bg-black/[0.02] flex flex-col items-center text-center">
                  <div className="h-32 w-32">
                    <DotLottieReact src="/animation/coin.lottie" loop autoplay />
                  </div>
                  <h1 className="font-black text-2xl leading-none mt-auto">Stake Sol</h1>
                </div>
              </div>
              
              {/* Spacer for the central text */}
              <div className="w-80" />

              <div className="flex flex-col gap-5">
                <div className="border border-black/10 h-64 w-72 rounded-2xl px-6 py-8 bg-black/[0.02] flex flex-col items-center text-center">
                  <div className="h-32 w-32">
                    <DotLottieReact src="/animation/Industrial Design.lottie" loop autoplay />
                  </div>
                  <h1 className="font-black text-2xl leading-none mt-auto">Answer</h1>
                </div>
                <div className="border border-black/10 h-64 w-72 rounded-2xl px-6 py-8 bg-black/[0.02] flex flex-col items-center text-center">
                  <div className="h-32 w-32">
                    <DotLottieReact src="/animation/Trophy.lottie" loop autoplay />
                  </div>
                  <h1 className="font-black text-2xl leading-none mt-auto">Win</h1>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

const Footer = () => {
  return (
    <footer className={cn("bg-black text-white px-10 pt-24 pb-10 border-t border-white/10", font2.className)}>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-20">
        <div className="flex flex-col gap-6 max-w-sm">
          <Logo color="white" />
          <p className="text-white/60 text-sm leading-relaxed lowercase tracking-wider">
            the ultimate pvp experience on solana. cook your opponents and get rewarded for what you know.
          </p>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-16 uppercase tracking-[0.2em] text-[10px]">
          <div className="flex flex-col gap-6">
            <span className="text-white/40">platform</span>
            <a href="#" className="hover:text-[#14F195] transition-colors">matches</a>
            <a href="#" className="hover:text-[#14F195] transition-colors">leaderboard</a>
            <a href="#" className="hover:text-[#14F195] transition-colors">staking</a>
          </div>
          <div className="flex flex-col gap-6">
            <span className="text-white/40">company</span>
            <a href="#" className="hover:text-[#14F195] transition-colors">about</a>
            <a href="#" className="hover:text-[#14F195] transition-colors">terms</a>
            <a href="#" className="hover:text-[#14F195] transition-colors">privacy</a>
          </div>
          <div className="flex flex-col gap-6">
            <span className="text-white/40">social</span>
            <a href="#" className="hover:text-[#9945FF] transition-colors">x / twitter</a>
            <a href="#" className="hover:text-[#9945FF] transition-colors">discord</a>
            <a href="#" className="hover:text-[#9945FF] transition-colors">telegram</a>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto mt-32 pt-10 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-6 text-[10px] uppercase tracking-widest text-white/30">
        <p>© 2026 tryhard protocol. all rights reserved.</p>
        <div className="flex gap-10">
          <span>built on solana</span>
        </div>
      </div>
    </footer>
  );
};

export default function Home() {
  const [status, setStatus] = useState("loading"); // loading, transitioning, hero
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [textFinished, setTextFinished] = useState(false);

  useEffect(() => {
    // Preload hero images
    const promises = heroImages.map((image) => {
      return new Promise((resolve) => {
        const img = new window.Image();
        img.src = image.src;
        img.onload = resolve;
        img.onerror = resolve;
      });
    });

    Promise.all(promises).then(() => setImagesLoaded(true));

    // Wait for text animations (3 words/phrases + duration)
    const timer = setTimeout(() => {
      setTextFinished(true);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (imagesLoaded && textFinished && status === "loading") {
      setStatus("transitioning");
    }
  }, [imagesLoaded, textFinished, status]);

  useEffect(() => {
    if (status === "transitioning") {
      const timer = setTimeout(() => {
        setStatus("hero");
      }, 1000); // Switch to hero when all bars fully cover the screen (0.2s delay + 0.75s animation = 0.95s)
      return () => clearTimeout(timer);
    }
  }, [status]);

  return (
    <ReactLenis root>
    <div className="relative bg-black min-h-screen">
      <Stairs status={status} onComplete={() => {}} />

      <AnimatePresence mode="wait">
        {status === "loading" || status === "transitioning" ? (
          <motion.div
            key="preloader"
            className={cn(
              "h-screen w-full bg-white text-black flex items-center justify-center uppercase flex-col text-7xl font-bold fixed inset-0 z-50",
              font2.className
            )}
          >
            <TextAnimate animation="slideUp" by="word">
              Cook or
            </TextAnimate>
            <TextAnimate animation="slideUp" by="word" delay={0.5}>
              Get Cooked
            </TextAnimate>
            <TextAnimate className="text-xl lowercase mt-10" delay={1}>
              loading...
            </TextAnimate>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {status === "hero" && (
        <>
        <motion.main
          key="main"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="min-h-screen overflow-hidden bg-black text-white"
        >
          <motion.nav
            className={cn(
              "fixed left-0 top-0 z-40 flex w-full items-center justify-between px-5 py-5 text-xs uppercase tracking-[0.28em] text-white/80 sm:px-10",
              font2.className,
            )}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
          >
            <a href="">ABOUT</a>
            <Logo color="white"/>
            <Link href="/home">GET STARTED</Link>
          </motion.nav>

          <section className="relative flex min-h-screen w-full items-center justify-center bg-black px-4 text-center">
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-45"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.45 }}
              transition={{ duration: 1.2, delay: 0.8 }}
            >
              <div className="absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
            </motion.div>

            <div className="pointer-events-none absolute inset-0 z-30">
              {heroImages.map((image, index) => (
                <motion.div
                  key={image.src}
                  className="absolute left-1/2 top-1/2"
                  initial={{
                    x: image.finalX,
                    y: "100vh",
                    opacity: 0,
                    rotate: 0,
                  }}
                  animate={{
                    x: image.finalX,
                    y: image.finalY,
                    opacity: 1,
                    rotate: image.rotate,
                  }}
                  transition={{
                    duration: 1.2,
                    delay: 0.4 + index * 0.1,
                    ease: [0.215, 0.61, 0.355, 1],
                  }}
                >
                  <motion.div
                    animate={{
                      y: [0, image.floatY, 0, image.floatY * -0.45, 0],
                      rotate: [
                        0,
                        image.rotate * 0.22,
                        0,
                        image.rotate * -0.18,
                        0,
                      ],
                    }}
                    transition={{
                      delay: 1.6 + index * 0.16,
                      duration: 5.2 + index * 0.35,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <Image
                      src={image.src}
                      alt={image.alt}
                      width={100}
                      height={100}
                      priority
                      className="h-40 select-none object-contain drop-shadow-[0_22px_55px_rgba(255,255,255,0.12)]"
                      style={{ width: image.size }}
                    />
                  </motion.div>
                </motion.div>
              ))}
            </div>

            <motion.div
              className={cn("relative z-20 max-w-[94vw] font-black", font2.className)}
              initial={{ opacity: 0, y: 50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 1, ease: [0.215, 0.61, 0.355, 1], delay: 0.2 }}
            >
              <h1 className="text-[20vh] leading-none tracking-tighter">
                1v1 Anyone
              </h1>
              <h1 className="text-[20vh] leading-none tracking-tighter">
                on Anything
              </h1>
            </motion.div>
          </section>
        </motion.main>
        
        <ScrollTransition />

        <div className="bg-white min-h-screen flex items-center justify-center px-10 py-20">
          <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
            <div className="space-y-8">
              <h2 className={cn("text-6xl font-black leading-none", font2.className)}>
                Time to lockin <br /> touch grass later.
              </h2>
              <p className="text-black/60 text-lg leading-relaxed lowercase tracking-tight">
                Join players competing in real-time battles. Stake SOL, answer correctly, and take the pool. No luck, just knowledge.
              </p>
              <div className="flex gap-4">
                <Link href="/home" className={cn("bg-black text-white px-8 py-4 rounded-full text-xs font-bold uppercase tracking-widest hover:scale-105 transition-transform", font2.className)}>
                  Start Now
                </Link>
              </div>
            </div>
            <div className="relative aspect-square bg-black rounded-3xl overflow-hidden flex items-center justify-center p-10">
               <DotLottieReact src="/animation/Dollar Coins Chest.lottie" loop autoplay />
            </div>
          </div>
        </div>

        <Footer />
        </>
      )}
    </div>
    </ReactLenis>
  );
}
