"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import localFont from "next/font/local";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { TextAnimate } from "@/components/ui/animated-text"
import Link from "next/link";
import Logo from "@/components/logo";

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
    <div className="relative bg-black min-h-screen">
      <Stairs status={status} onComplete={() => {}} />

      <AnimatePresence mode="wait">
        {status === "loading" || status === "transitioning" ? (
          <motion.div
            key="preloader"
            className={cn(
              "h-screen w-full bg-white flex items-center justify-center uppercase flex-col text-7xl font-bold fixed inset-0 z-50",
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
            <Logo/>
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
        <div className="h-screen w-full px-10 flex items-center justify-center">
              <div className="h-full w-full rounded-xl bg-white flex items-center justify-center text-center">
              <h1 className={cn(
                "text-7xl font-black"
                ,font2.className
              )}
              >
                Your Knowledge <br /> Has Value
              </h1>
              </div>
        </div>
        <div className="h-screen w-full bg-white px-10 py-5 flex items-center justify-center gap-5">
          <div className="flex flex-col gap-3">
            <div className="border h-60 w-70 rounded-md px-3 py-4">
              <h1 className="font-black text-xl">Create or Join Match</h1>
            </div>
            <div className="border h-60 w-70 rounded-md px-3 py-4">
              <h1 className="font-black text-xl">Stake Sol</h1>
            </div>
          </div>
          <h1 className={cn(
            "text-4xl border rounded-md py-5 px-3 font-black text-center"
          )}
              >
                Your Knowledge <br /> Has Value
          </h1>
          <div className="flex flex-col gap-3">
            <div className="border h-60 w-70 rounded-md px-3 py-4">
              <h1 className="font-black text-xl">Answer</h1>
            </div>
            <div className="border h-60 w-70 rounded-md px-3 py-4">
              <h1 className="font-black text-xl">Win</h1>
            </div>
          </div>
          </div>
        </>
      )}
    </div>
  );
}
